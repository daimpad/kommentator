<?php
/**
 * Plugin Name:       Kommentare (Textstellen-Annotation)
 * Plugin URI:        https://github.com/daimpad/kommentator
 * Description:        Bindet das statische Kommentar-Werkzeug in Beiträge/Seiten ein: Textstellen markieren, kommentieren, als JSON exportieren und mehrere Exporte zusammenführen. Kein Backend, keine externen Abhängigkeiten.
 * Version:           1.17.0
 * Requires at least: 5.0
 * Requires PHP:      7.0
 * Author:            daimpad
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       kommentare-tool
 * Update URI:        https://github.com/daimpad/kommentator
 *
 * ---------------------------------------------------------------------------
 * HINWEIS ZUM ZUGRIFFSSCHUTZ
 * Das Namensfeld ordnet Kommentare einer Person zu – es ist KEIN Zugriffs-
 * schutz. Echten Schutz regelt der Betrieb: WordPress-Login/Rollen (siehe
 * Filter 'kommentare_should_load') oder HTTP Basic Auth per .htaccess.
 *
 * Geteilte Sichtbarkeit ist bewusst asynchron und ohne Backend: Nutzer:innen
 * exportieren ihre Kommentare, der Betrieb sammelt die JSON-Dateien ein und
 * liest sie über „Kommentare laden" wieder gemeinsam ein.
 * ---------------------------------------------------------------------------
 */

if (!defined('ABSPATH')) {
    exit; // Direktaufruf verhindern
}

if (!defined('KOMMENTARE_VERSION')) {
    define('KOMMENTARE_VERSION', '1.17.0');
}

/* Pfad der Hauptdatei — die Update-Anbindung braucht ihn für
   plugin_basename(); __FILE__ wäre dort die updater.php. */
if (!defined('KOMMENTARE_DATEI')) {
    define('KOMMENTARE_DATEI', __FILE__);
}

/* Aktualisierungen kommen aus den GitHub-Releases dieses Repositories —
   das Plugin liegt nicht im WordPress-Verzeichnis. Siehe updater.php. */
require_once __DIR__ . '/updater.php';

/* ===========================================================================
 * EINSTELLUNGEN (Einstellungen → Kommentator)
 * ---------------------------------------------------------------------------
 * Alles Wesentliche lässt sich im Backend eintragen — ohne functions.php.
 * Die Filter weiter unten bleiben bestehen: die gespeicherte Einstellung ist
 * jeweils nur der VORGABEWERT, ein Filter im Theme sticht ihn weiterhin.
 * ======================================================================== */

/** Vorgabewerte aller Einstellungen. */
function kommentare_standard_optionen() {
    return array(
        'webhook'      => '',      // Adresse der zentralen Sammelstelle
        'webhook_auto' => 1,       // automatisch bei jeder Änderung melden
        'webhook_token' => '',     // gemeinsames Geheimwort für die Sammelstelle
        'email'        => '',      // Empfänger für „Per E-Mail senden"
        'container'    => 'body',  // kommentierbarer Bereich
        'frontend'     => 1,       // im Frontend laden
        'backend'      => 1,       // in wp-admin laden
        // Im Frontend nur für angemeldete Nutzer:innen — sichere Vorgabe:
        // die Adresse der Sammelstelle steht im Seitenquelltext, eine offene
        // Seite wäre damit eine offene Schreibberechtigung auf die Tabelle.
        'nur_eingeloggt' => 1,
    );
}

/** Gespeicherte Einstellungen, mit Vorgaben aufgefüllt. */
function kommentare_optionen() {
    $gespeichert = get_option('kommentare_optionen', array());
    if (!is_array($gespeichert)) {
        $gespeichert = array();
    }
    return array_merge(kommentare_standard_optionen(), $gespeichert);
}

/** Einzelne Einstellung lesen. */
function kommentare_option($schluessel) {
    $optionen = kommentare_optionen();
    return isset($optionen[$schluessel]) ? $optionen[$schluessel] : null;
}

/**
 * Eingaben prüfen, bevor sie gespeichert werden.
 *
 * @param array $eingabe Rohwerte aus dem Formular.
 * @return array
 */
function kommentare_optionen_pruefen($eingabe) {
    $standard = kommentare_standard_optionen();
    $eingabe  = is_array($eingabe) ? $eingabe : array();
    $sauber   = array();

    // Nur Skalare weiterreichen. Ein verschachteltes Formularfeld
    // (kommentare_optionen[email][]=x) brächte sonst sanitize_email() dazu,
    // strlen() auf ein Array zu werfen — fataler Fehler auf options.php.
    $text = function ($schluessel) use ($eingabe) {
        if (!isset($eingabe[$schluessel]) || !is_scalar($eingabe[$schluessel])) {
            return '';
        }
        return trim((string) $eingabe[$schluessel]);
    };

    // Sammelstelle: ausschließlich http(s). Alles andere wird verworfen —
    // mit sichtbarer Rückmeldung, statt still zu schlucken.
    $roh = $text('webhook');
    $url = $roh === '' ? '' : esc_url_raw($roh, array('http', 'https'));
    // esc_url_raw ist Bereiniger, kein Prüfer: protokollrelative Adressen
    // (//host/exec) überleben, das Werkzeug verwirft sie später still.
    if ($url !== '') {
        $teile = wp_parse_url($url);
        if (empty($teile['scheme']) || empty($teile['host'])
            || !in_array(strtolower($teile['scheme']), array('http', 'https'), true)) {
            $url = '';
        }
    }
    if ($roh !== '' && $url === '') {
        add_settings_error(
            'kommentare_optionen',
            'kommentare_webhook_ungueltig',
            __('Die Adresse der Sammelstelle wurde nicht übernommen: Es sind nur http(s)-Adressen erlaubt.', 'kommentare-tool'),
            'error'
        );
    }
    $sauber['webhook'] = $url;

    $sauber['webhook_auto']   = empty($eingabe['webhook_auto']) ? 0 : 1;
    $sauber['frontend']       = empty($eingabe['frontend']) ? 0 : 1;
    $sauber['backend']        = empty($eingabe['backend']) ? 0 : 1;
    $sauber['nur_eingeloggt'] = empty($eingabe['nur_eingeloggt']) ? 0 : 1;

    $mailRoh = $text('email');
    $mail    = $mailRoh === '' ? '' : sanitize_email($mailRoh);
    if ($mailRoh !== '' && $mail === '') {
        add_settings_error(
            'kommentare_optionen',
            'kommentare_email_ungueltig',
            __('Die E-Mail-Adresse wurde nicht übernommen: keine gültige Adresse.', 'kommentare-tool'),
            'error'
        );
    }
    $sauber['email'] = $mail;

    // Geheimwort: beliebiger Text, nur Länge und Steuerzeichen begrenzen.
    $token = sanitize_text_field($text('webhook_token'));
    if (strlen($token) > 200) {
        $token = substr($token, 0, 200);
    }
    $sauber['webhook_token'] = $token;

    // Container-Selektor: grob validieren, damit ein Tippfehler nicht erst im
    // Browser auffällt (dort risse ein ungültiger Selektor bei
    // zusammengefasstem JS das ganze Bündel mit).
    $container = sanitize_text_field($text('container'));
    if ($container !== '' && !kommentare_selektor_gueltig($container)) {
        add_settings_error(
            'kommentare_optionen',
            'kommentare_container_ungueltig',
            __('Der kommentierbare Bereich wurde nicht übernommen: kein gültiger CSS-Selektor.', 'kommentare-tool'),
            'error'
        );
        $container = '';
    }
    $sauber['container'] = $container !== '' ? $container : $standard['container'];

    return $sauber;
}

/**
 * Grobe Plausibilitätsprüfung eines CSS-Selektors.
 * Fängt die häufigen Tippfehler ab (offene Klammern, Komma am Ende, leere
 * Teile) — eine vollständige Selektor-Grammatik ist hier weder nötig noch
 * sinnvoll, das letzte Wort hat ohnehin der Browser.
 *
 * @param string $selektor
 * @return bool
 */
function kommentare_selektor_gueltig($selektor) {
    if (strlen($selektor) > 200) {
        return false;
    }
    // unausgeglichene Klammern
    foreach (array(array('[', ']'), array('(', ')')) as $paar) {
        if (substr_count($selektor, $paar[0]) !== substr_count($selektor, $paar[1])) {
            return false;
        }
    }
    // leere Teile: führendes/abschließendes Komma oder ",,"
    foreach (explode(',', $selektor) as $teil) {
        if (trim($teil) === '') {
            return false;
        }
    }
    // muss mit einem für Selektoren sinnvollen Zeichen beginnen
    return (bool) preg_match('/^[a-zA-Z.#*\[:]/', ltrim($selektor));
}

/** Einstellung registrieren. */
function kommentare_einstellungen_registrieren() {
    register_setting('kommentare_optionen_gruppe', 'kommentare_optionen', array(
        'type'              => 'array',
        'sanitize_callback' => 'kommentare_optionen_pruefen',
        'default'           => kommentare_standard_optionen(),
    ));
}
add_action('admin_init', 'kommentare_einstellungen_registrieren');

/** Menüpunkt unter „Einstellungen". */
function kommentare_menue() {
    add_options_page(
        __('Kommentator', 'kommentare-tool'),
        __('Kommentator', 'kommentare-tool'),
        'manage_options',
        'kommentare-tool',
        'kommentare_einstellungsseite'
    );
}
add_action('admin_menu', 'kommentare_menue');

/** „Einstellungen"-Link in der Plugin-Liste. */
function kommentare_plugin_links($links) {
    $link = '<a href="' . esc_url(admin_url('options-general.php?page=kommentare-tool')) . '">'
          . esc_html__('Einstellungen', 'kommentare-tool') . '</a>';
    array_unshift($links, $link);
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'kommentare_plugin_links');

/**
 * Im Netzwerk-Admin auf die Einstellungen der Einzelsites hinweisen — dort
 * greift plugin_action_links_ nicht, und konfiguriert wird pro Site.
 */
function kommentare_netzwerk_plugin_links($links) {
    $links[] = '<span>' . esc_html__('Einstellungen je Website', 'kommentare-tool') . '</span>';
    return $links;
}
add_filter('network_admin_plugin_action_links_' . plugin_basename(__FILE__),
    'kommentare_netzwerk_plugin_links');

/**
 * Textbaustein für die Datenschutzerklärung (Werkzeuge → Datenschutz).
 * Nur relevant, wenn eine Sammelstelle eingetragen ist — sonst verlässt
 * nichts den Browser und es gibt nichts zu erklären.
 */
function kommentare_datenschutz_hinweis() {
    if (!function_exists('wp_add_privacy_policy_content')) {
        return;
    }
    $inhalt = '<p class="privacy-policy-tutorial">'
        . esc_html__('Vorschlag: nur nötig, wenn unter Einstellungen → Kommentator eine Sammelstelle eingetragen ist.', 'kommentare-tool')
        . '</p><p><strong>' . esc_html__('Kommentar-Werkzeug', 'kommentare-tool') . '</strong></p>'
        . '<p>' . esc_html__('Auf dieser Website lassen sich Textstellen markieren und kommentieren. Ist eine zentrale Sammelstelle konfiguriert, werden folgende Angaben an diese Adresse übermittelt: Zeitpunkt, Seiten-Adresse (ohne Abfrageteil) und Seitentitel, angezeigter Name, Art und Ort der Markierung, der Kommentartext, eine Kommentar-Kennung, Browserkennung, Spracheinstellung und Bildschirmgröße.', 'kommentare-tool') . '</p>'
        . '<p>' . esc_html__('Es wird keine IP-Adresse übermittelt. Zur Gruppierung der Meldungen einer Sitzung dient eine zufällige Kennung, die im Sitzungsspeicher des Browsers liegt und mit dem Schließen des Tabs verfällt. Cookies werden nicht gesetzt.', 'kommentare-tool') . '</p>'
        . '<p>' . esc_html__('Empfänger der Daten ist der Betreiber der eingetragenen Sammelstelle. Liegt diese bei einem Anbieter außerhalb der EU (etwa Google Sheets), findet insoweit eine Drittlandübermittlung statt. Die IP-Adresse ist dem Empfänger dabei technisch auf Transportebene bekannt.', 'kommentare-tool') . '</p>';
    wp_add_privacy_policy_content(
        __('Kommentare (Textstellen-Annotation)', 'kommentare-tool'),
        wp_kses_post(wpautop($inhalt, false))
    );
}
add_action('admin_init', 'kommentare_datenschutz_hinweis');

/** Die Einstellungsseite. */
function kommentare_einstellungsseite() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $o = kommentare_optionen();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Kommentator', 'kommentare-tool'); ?></h1>
        <p class="description" style="max-width:46em">
            <?php esc_html_e('Markieren, kommentieren, exportieren — im Frontend wie im Backend. Ohne Sammelstelle bleibt alles im Browser; erst mit einer Adresse laufen die Kommentare in einer zentralen Tabelle zusammen.', 'kommentare-tool'); ?>
        </p>

        <form method="post" action="options.php">
            <?php settings_fields('kommentare_optionen_gruppe'); ?>

            <h2 class="title"><?php esc_html_e('Zentrale Sammelstelle', 'kommentare-tool'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="kommentare-webhook"><?php esc_html_e('Adresse', 'kommentare-tool'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[webhook]" id="kommentare-webhook" type="url"
                               class="regular-text code" inputmode="url" spellcheck="false"
                               placeholder="https://script.google.com/macros/s/…/exec"
                               value="<?php echo esc_attr($o['webhook']); ?>">
                        <p class="description">
                            <?php esc_html_e('Leer lassen = aus. Dann verlässt kein Kommentar den Browser und der Knopf „Alle senden" erscheint nicht.', 'kommentare-tool'); ?>
                            <br>
                            <?php esc_html_e('Für ein Google Sheet: Tabelle anlegen → Erweiterungen → Apps Script → Skript einfügen → Bereitstellen als Web-App („Ausführen als: Ich", „Zugriff: Jeder") → die Adresse auf /exec hier eintragen.', 'kommentare-tool'); ?>
                            <a href="https://github.com/daimpad/kommentator/blob/main/TUTORIAL.md#8-kommentare-in-einem-google-sheet-sammeln"
                               target="_blank" rel="noopener"><?php esc_html_e('Schritt-für-Schritt-Anleitung mit fertigem Skript', 'kommentare-tool'); ?></a>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="kommentare-token"><?php esc_html_e('Geheimwort', 'kommentare-tool'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[webhook_token]" id="kommentare-token" type="text"
                               class="regular-text code" spellcheck="false" autocomplete="off"
                               value="<?php echo esc_attr($o['webhook_token']); ?>">
                        <p class="description">
                            <?php esc_html_e('Wird bei jeder Meldung als „token" mitgeschickt. Das Apps Script kann damit fremde Einträge abweisen — nötig, weil die Adresse der Sammelstelle im Seitenquelltext steht und sich nicht geheim halten lässt.', 'kommentare-tool'); ?>
                            <br>
                            <?php esc_html_e('Trage denselben Wert im Apps Script ein (Konstante GEHEIMWORT) und veröffentliche danach eine neue Version. Leer = keine Prüfung.', 'kommentare-tool'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Versand', 'kommentare-tool'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[webhook_auto]" type="checkbox" value="1"
                                   <?php checked($o['webhook_auto'], 1); ?>>
                            <?php esc_html_e('Jede Änderung automatisch melden', 'kommentare-tool'); ?>
                        </label>
                        <p class="description">
                            <?php esc_html_e('Aus = nur der Knopf „Alle senden" schickt. Gemeldet werden Zeitpunkt, Seiten-URL und -Titel, Autor:in, Art, markierte Stelle, Kommentar, Browser, Sprache und Bildschirmgröße — keine IP-Adresse, nur eine anonyme Sitzungskennung.', 'kommentare-tool'); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <h2 class="title"><?php esc_html_e('Anzeige', 'kommentare-tool'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><?php esc_html_e('Laden', 'kommentare-tool'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[frontend]" type="checkbox" value="1"
                                   <?php checked($o['frontend'], 1); ?>>
                            <?php esc_html_e('Im Frontend (öffentliche Seiten)', 'kommentare-tool'); ?>
                        </label><br>
                        <label>
                            <input name="kommentare_optionen[backend]" type="checkbox" value="1"
                                   <?php checked($o['backend'], 1); ?>>
                            <?php esc_html_e('Im Backend (wp-admin)', 'kommentare-tool'); ?>
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Wer darf kommentieren', 'kommentare-tool'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[nur_eingeloggt]" type="checkbox" value="1"
                                   <?php checked($o['nur_eingeloggt'], 1); ?>>
                            <?php esc_html_e('Im Frontend nur angemeldete Nutzer:innen', 'kommentare-tool'); ?>
                        </label>
                        <p class="description">
                            <?php esc_html_e('Standard: an. Ohne Haken sehen und nutzen alle Besucher:innen das Werkzeug — auf einer öffentlichen Seite mit Sammelstelle heißt das: jede:r kann in deine Tabelle schreiben, denn die Adresse steht im Seitenquelltext und lässt sich nicht geheim halten. Den Haken nur entfernen, wenn Rückmeldungen von nicht angemeldeten Personen ausdrücklich erwünscht sind.', 'kommentare-tool'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="kommentare-container"><?php esc_html_e('Kommentierbarer Bereich', 'kommentare-tool'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[container]" id="kommentare-container" type="text"
                               class="regular-text code" spellcheck="false"
                               value="<?php echo esc_attr($o['container']); ?>">
                        <p class="description">
                            <?php esc_html_e('CSS-Selektor. Standard „body" = ganze Seite inklusive Kopf- und Fußbereich. Nur den Inhalt: .entry-content oder .wp-block-post-content.', 'kommentare-tool'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="kommentare-email"><?php esc_html_e('E-Mail-Empfänger', 'kommentare-tool'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[email]" id="kommentare-email" type="email"
                               class="regular-text" value="<?php echo esc_attr($o['email']); ?>">
                        <p class="description">
                            <?php esc_html_e('Für „Per E-Mail senden". Leer = Knopf aus.', 'kommentare-tool'); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button(); ?>
        </form>

        <p class="description">
            <?php esc_html_e('Feinere Einstellungen (Element-/Punkt-Kommentare, Theme-Umschalter, eigene Texte, Nur-Lesen) laufen weiter über Filter im Theme. Ein Filter sticht dabei immer den hier gespeicherten Wert.', 'kommentare-tool'); ?>
            <a href="https://github.com/daimpad/kommentator/blob/main/TECHNISCHE_DOKUMENTATION.md#wordpress-plugin"
               target="_blank" rel="noopener"><?php esc_html_e('Übersicht aller Filter', 'kommentare-tool'); ?></a>
        </p>
    </div>
    <?php
}

/**
 * Selektor des zu kommentierenden Containers.
 * Standard: die ganze Seite (<body>) – so lassen sich Header, Inhalt UND
 * Footer kommentieren. Zusammen mit schwebenden Notizen (siehe unten) wird die
 * Seite dabei NICHT umgebaut.
 *
 * Auf den reinen Inhaltsbereich einschränken per Filter:
 *   add_filter('kommentare_container_selector', function () {
 *       return '.entry-content'; // oder '.wp-block-post-content'
 *   });
 *
 * @return string
 */
function kommentare_container_selector() {
    return (string) apply_filters('kommentare_container_selector', kommentare_option('container'));
}

/**
 * Auf welchen Ansichten wird das Werkzeug im FRONTEND geladen?
 * Standard: überall im Frontend, damit sich jede Seite kommentieren lässt.
 *
 * Beispiele:
 *   // Nur einzelne Beiträge/Seiten:
 *   add_filter('kommentare_should_load', fn() => is_singular());
 *   // Nur für eingeloggte Nutzer:innen:
 *   add_filter('kommentare_should_load', fn($load) => $load && is_user_logged_in());
 *
 * @return bool
 */
function kommentare_should_load() {
    $laden = (bool) kommentare_option('frontend');
    // Wer die Sammelstelle nutzt, schreibt aus dem Frontend in eine fremde
    // Tabelle — die Beschränkung auf angemeldete Nutzer:innen ist dann das
    // wirksamste Mittel gegen Fremdeinträge.
    if ($laden && kommentare_option('nur_eingeloggt')) {
        $laden = is_user_logged_in();
    }
    return (bool) apply_filters('kommentare_should_load', $laden);
}

/**
 * Auf welchen Ansichten wird das Werkzeug im BACKEND (wp-admin) geladen?
 * Standard: auf allen Admin-Seiten für Nutzer:innen, die den Admin sehen dürfen.
 *
 * Beispiele:
 *   // Backend-Kommentare abschalten:
 *   add_filter('kommentare_should_load_admin', '__return_false');
 *   // Nur auf bestimmten Admin-Seiten (z. B. Design/Customizer-Bereiche):
 *   add_filter('kommentare_should_load_admin', function ($load, $hook) {
 *       return $load && strpos($hook, 'themes') === 0;
 *   }, 10, 2);
 *
 * @param string $hook_suffix Aktuelle Admin-Seite (z. B. 'edit.php').
 * @return bool
 */
function kommentare_should_load_admin($hook_suffix = '') {
    return (bool) apply_filters('kommentare_should_load_admin', (bool) kommentare_option('backend'), $hook_suffix);
}

/**
 * Welche init-Optionen sind personen- bzw. schutzbezogen?
 *
 * Diese Werte gehen NICHT ins ausgelieferte HTML, sondern werden vom Browser
 * über einen eigenen Endpunkt nachgeladen — er prüft die Berechtigung
 * erneut. Dadurch enthält die Seite selbst weder einen Klarnamen noch die
 * Adresse der Sammelstelle, und ein fehlgeleiteter Seiten-Cache kann beides
 * nicht an Fremde ausliefern.
 *
 * @return string[]
 */
function kommentare_persoenliche_schluessel() {
    return array('autor', 'webhook', 'webhookAuto', 'webhookToken', 'email');
}

/**
 * init-Optionen für das Werkzeug zusammenstellen.
 *
 * @param bool $is_admin Backend-Kontext?
 * @return array
 */
function kommentare_build_config($is_admin = false) {
    // Autor:in aus dem eingeloggten WordPress-Benutzer (sonst „Gast").
    // display_name kommt HTML-maskiert aus der Datenbank („Müller &amp; Söhne")
    // — für ein JS-Textfeld muss das zurückgedreht werden.
    $autor = is_user_logged_in()
        ? html_entity_decode((string) wp_get_current_user()->display_name, ENT_QUOTES, 'UTF-8')
        : 'Gast';
    // (string) wie bei allen anderen Werten: ein Filter, der versehentlich ein
    // WP_User-Objekt zurückgibt, schriebe sonst dessen Felder in den Quelltext.
    $autor = (string) apply_filters('kommentare_autor', $autor);
    if ($autor === '') {
        $autor = 'Gast';
    }

    // Im Backend nur die eigene Werkzeug-UI ausnehmen (die Admin-Oberfläche
    // selbst soll kommentierbar sein); im Frontend zusätzlich die Admin-Bar.
    $exclude_default = $is_admin ? '' : '#wpadminbar';

    $config = array(
        'container'   => kommentare_container_selector(),
        'autor'       => $autor,
        'readOnly'    => (bool) apply_filters('kommentare_read_only', false),
        'help'        => (bool) apply_filters('kommentare_help', true),
        'themeToggle' => (bool) apply_filters('kommentare_theme_toggle', true),
        // 'bar' (Balken oben) oder 'floating' (Button unten rechts)
        'toolbarMode' => (string) apply_filters('kommentare_toolbar_mode', 'floating'),
        // 'inline' (Randspalte) oder 'floating' (Notizen schweben, Seite bleibt
        // unverändert – nötig, um die ganze Seite/Header/Footer zu kommentieren)
        'notes'       => (string) apply_filters('kommentare_notes', 'floating'),
        'resizable'   => (bool) apply_filters('kommentare_resizable', true),
        // E-Mail-Empfänger für „Per E-Mail senden" (leer = Button aus)
        'email'       => (string) apply_filters('kommentare_email', kommentare_option('email')),
        // Beliebige Elemente (Boxen/Bilder) kommentierbar machen
        'elements'    => (bool) apply_filters('kommentare_elements', true),
        // Punkt an eine bestimmte Stelle anheften
        'points'      => (bool) apply_filters('kommentare_points', true),
        // Vom Kommentieren ausgenommene Bereiche (CSS-Selektor)
        'exclude'     => (string) apply_filters('kommentare_exclude', $exclude_default, $is_admin),
        // Zentrale Sammelstelle: https-Adresse, an die neue Kommentare gemeldet
        // werden (z. B. ein Google-Apps-Script-Web-App vor einem Google Sheet).
        // Leer = aus; dann verlässt kein Kommentar den Browser.
        'webhook'     => (string) apply_filters('kommentare_webhook', kommentare_option('webhook')),
        // Automatisch bei jeder Änderung melden (sonst nur „Alle senden“)
        'webhookAuto' => (bool) apply_filters('kommentare_webhook_auto', (bool) kommentare_option('webhook_auto')),
        // Gemeinsames Geheimwort für die Sammelstelle (leer = keins)
        'webhookToken' => (string) apply_filters('kommentare_webhook_token', kommentare_option('webhook_token')),
    );

    // Weitere init-Optionen (z. B. eigene UI-Texte) frei ergänzbar:
    //   add_filter('kommentare_init_config', function ($cfg, $is_admin) {
    //       $cfg['texte'] = array('notizenKopf' => 'Anmerkungen');
    //       return $cfg;
    //   }, 10, 2);
    return apply_filters('kommentare_init_config', $config, $is_admin);
}

/**
 * CSS + JS registrieren und mit dem init-Aufruf starten.
 *
 * @param bool $is_admin Backend-Kontext?
 */
function kommentare_enqueue($is_admin = false) {
    $base = plugin_dir_url(__FILE__) . 'assets/';

    wp_enqueue_style(
        'kommentare-tool',
        $base . 'kommentare.css',
        array(),
        KOMMENTARE_VERSION
    );

    wp_enqueue_script(
        'kommentare-tool',
        $base . 'kommentare.js',
        array(),
        KOMMENTARE_VERSION,
        true // im Footer laden
    );

    $config = kommentare_build_config($is_admin);

    // Persönliche Werte (Name, Sammelstelle, Geheimwort, E-Mail) aus dem HTML
    // heraushalten — sie kommen gleich über den Endpunkt nach. Im HTML bleibt
    // nur, was für jede:n gleich ist und damit gefahrlos cachebar ist.
    $persoenlich = array();
    foreach (kommentare_persoenliche_schluessel() as $schluessel) {
        if (array_key_exists($schluessel, $config)) {
            $persoenlich[$schluessel] = $config[$schluessel];
            unset($config[$schluessel]);
        }
    }
    // Ohne Nachladen wäre der Autorname leer — bis dahin „Gast".
    $config['autor'] = 'Gast';

    $endpunkt = esc_url_raw(rest_url('kommentare-tool/v1/konfiguration'));
    $nonce    = wp_create_nonce('wp_rest');

    // Robuster Start:
    // - try/catch, damit ein Fehler nicht das ganze (womöglich von einem
    //   Optimierungs-Plugin zusammengefasste) Skriptbündel mitreißt.
    // - mehrere Versuche: wird kommentare.js mit defer/async oder verzögert
    //   geladen, ist window.Kommentare beim ersten Anlauf noch nicht da.
    //   Ohne Wiederholung fehlte das Werkzeug spurlos.
    // - Der Block-Editor baut seine Oberfläche erst nach DOMContentLoaded auf.
    // - Die persönlichen Werte werden davor geholt; scheitert das, startet das
    //   Werkzeug trotzdem — dann eben ohne Namen und ohne Sammelstelle.
    $init = '(function(){var n=0,c=' . wp_json_encode($config) . ';'
          . 'function start(){'
          . 'if(window.kommentareInstanz)return;'
          . 'if(!window.Kommentare){if(++n<40){setTimeout(start,150);}return;}'
          . 'try{window.kommentareInstanz=window.Kommentare.init(c);}'
          . 'catch(e){if(window.console&&console.warn){console.warn("Kommentator:",e&&e.message);}}}'
          . 'var geholt=false;'
          . 'function holen(){'
          . 'if(geholt){start();return;}geholt=true;'   // nur ein Abruf, auch bei 'load'
          . 'if(!window.fetch){start();return;}'
          . 'fetch(' . wp_json_encode($endpunkt) . ',{credentials:"same-origin",'
          . 'headers:{"X-WP-Nonce":' . wp_json_encode($nonce) . '}})'
          . '.then(function(r){return r.ok?r.json():null;})'
          . '.then(function(p){if(p){for(var k in p){if(Object.prototype.hasOwnProperty.call(p,k))c[k]=p[k];}}})'
          . '["catch"](function(){})'
          . '.then(function(){start();});}'
          . 'function s(){holen();}'
          . 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){setTimeout(s,0);});}'
          . 'else{setTimeout(s,0);}'
          . 'window.addEventListener("load",function(){setTimeout(s,0);});})();';

    wp_add_inline_script('kommentare-tool', $init);
}

/**
 * Endpunkt für die personenbezogenen Werte.
 *
 * Getrennt vom HTML, damit die Seite selbst weder Klarnamen noch die Adresse
 * der Sammelstelle enthält: Ein Voll-Seiten-Cache kann dann nichts
 * Persönliches an Fremde ausliefern, und wer die Seite ohne Anmeldung abruft,
 * bekommt hier nichts.
 */
function kommentare_rest_registrieren() {
    register_rest_route('kommentare-tool/v1', '/konfiguration', array(
        'methods'             => 'GET',
        'callback'            => 'kommentare_rest_konfiguration',
        'permission_callback' => 'kommentare_rest_erlaubt',
    ));
}
add_action('rest_api_init', 'kommentare_rest_registrieren');

/**
 * Dieselbe Prüfung wie beim Ausliefern — im REST-Kontext greifen die
 * Frontend-/Backend-Bedingungen nicht, deshalb ausdrücklich nachgebildet.
 *
 * @return bool
 */
function kommentare_rest_erlaubt() {
    if (is_user_logged_in()) {
        return true;
    }
    // Nicht angemeldet: nur, wenn das Werkzeug überhaupt offen ausgeliefert
    // wird (Frontend an UND „nur angemeldet" aus).
    $offen = kommentare_option('frontend') && !kommentare_option('nur_eingeloggt');
    return (bool) apply_filters('kommentare_rest_erlaubt', (bool) $offen);
}

/**
 * @return WP_REST_Response
 */
function kommentare_rest_konfiguration() {
    $config = kommentare_build_config(false);
    $raus   = array();
    foreach (kommentare_persoenliche_schluessel() as $schluessel) {
        if (array_key_exists($schluessel, $config)) {
            $raus[$schluessel] = $config[$schluessel];
        }
    }
    $antwort = rest_ensure_response($raus);
    // Persönliche Antwort: niemals zwischenspeichern.
    $antwort->header('Cache-Control', 'no-store, private');
    return $antwort;
}

/**
 * Seiten mit personalisierter Konfiguration nicht in einen Voll-Seiten-Cache
 * lassen. Autorname und Sammelstellen-Adresse werden serverseitig ins HTML
 * geschrieben; ein Cache für angemeldete Nutzer:innen würde diese Seite sonst
 * an Fremde ausliefern — und damit die Einstellung „nur angemeldet"
 * aushebeln. Muss vor der Ausgabe laufen, deshalb template_redirect.
 */
function kommentare_cache_ausschluss() {
    if (is_admin() || !is_user_logged_in() || !kommentare_should_load()) {
        return;
    }
    if (!defined('DONOTCACHEPAGE')) {
        define('DONOTCACHEPAGE', true);
    }
    // von einigen Cache-Plugins zusätzlich ausgewertet
    if (!defined('DONOTCACHEOBJECT')) {
        define('DONOTCACHEOBJECT', true);
    }
}
add_action('template_redirect', 'kommentare_cache_ausschluss');

/** Frontend. */
function kommentare_enqueue_assets() {
    if (!kommentare_should_load()) {
        return;
    }
    // In der Customizer-Vorschau läuft bereits eine Instanz im Rahmen
    // darum — zwei überlagerte Werkzeuge helfen niemandem.
    if (function_exists('is_customize_preview') && is_customize_preview()) {
        return;
    }
    kommentare_enqueue(false);
}
add_action('wp_enqueue_scripts', 'kommentare_enqueue_assets');

/**
 * Admin-Seiten, auf denen das Werkzeug mehr stört als nützt: Oberflächen, die
 * ihr DOM selbst verwalten (React/Customizer), und die eigene Einstellungsseite.
 *
 * @return string[]
 */
function kommentare_admin_ausnahmen() {
    return (array) apply_filters('kommentare_admin_ausnahmen', array(
        'customize.php',              // Customizer
        'site-editor.php',            // Full-Site-Editing
        'widgets.php',                // Block-Widgets
        'theme-editor.php',           // Datei-Editor
        'plugin-editor.php',
        'settings_page_kommentare-tool', // eigene Einstellungsseite
    ));
}

/** Backend (wp-admin), inklusive Block-Editor. */
function kommentare_enqueue_admin_assets($hook_suffix = '') {
    if (in_array($hook_suffix, kommentare_admin_ausnahmen(), true)) {
        return;
    }
    if (!kommentare_should_load_admin($hook_suffix)) {
        return;
    }
    kommentare_enqueue(true);
}
add_action('admin_enqueue_scripts', 'kommentare_enqueue_admin_assets');
