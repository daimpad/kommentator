<?php
/**
 * Plugin Name:       Kommentare (Textstellen-Annotation)
 * Plugin URI:        https://github.com/daimpad/kommentator
 * Description:        Bindet das statische Kommentar-Werkzeug in Beiträge/Seiten ein: Textstellen markieren, kommentieren, als JSON exportieren und mehrere Exporte zusammenführen. Kein Backend, keine externen Abhängigkeiten.
 * Version:           1.13.0
 * Requires at least: 5.0
 * Requires PHP:      7.0
 * Author:            daimpad
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       kommentare
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

define('KOMMENTARE_VERSION', '1.13.0');

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

    // Sammelstelle: ausschließlich http(s). Alles andere wird verworfen —
    // mit sichtbarer Rückmeldung, statt still zu schlucken.
    $roh = isset($eingabe['webhook']) ? trim((string) $eingabe['webhook']) : '';
    $url = $roh === '' ? '' : esc_url_raw($roh, array('http', 'https'));
    if ($roh !== '' && $url === '') {
        add_settings_error(
            'kommentare_optionen',
            'kommentare_webhook_ungueltig',
            __('Die Adresse der Sammelstelle wurde nicht übernommen: Es sind nur http(s)-Adressen erlaubt.', 'kommentare'),
            'error'
        );
    }
    $sauber['webhook'] = $url;

    $sauber['webhook_auto']   = empty($eingabe['webhook_auto']) ? 0 : 1;
    $sauber['frontend']       = empty($eingabe['frontend']) ? 0 : 1;
    $sauber['backend']        = empty($eingabe['backend']) ? 0 : 1;
    $sauber['nur_eingeloggt'] = empty($eingabe['nur_eingeloggt']) ? 0 : 1;

    $mail = isset($eingabe['email']) ? sanitize_email($eingabe['email']) : '';
    if (!empty($eingabe['email']) && $mail === '') {
        add_settings_error(
            'kommentare_optionen',
            'kommentare_email_ungueltig',
            __('Die E-Mail-Adresse wurde nicht übernommen: keine gültige Adresse.', 'kommentare'),
            'error'
        );
    }
    $sauber['email'] = $mail;

    $container = isset($eingabe['container']) ? sanitize_text_field($eingabe['container']) : '';
    $sauber['container'] = $container !== '' ? $container : $standard['container'];

    return $sauber;
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
        __('Kommentator', 'kommentare'),
        __('Kommentator', 'kommentare'),
        'manage_options',
        'kommentare-tool',
        'kommentare_einstellungsseite'
    );
}
add_action('admin_menu', 'kommentare_menue');

/** „Einstellungen"-Link in der Plugin-Liste. */
function kommentare_plugin_links($links) {
    $link = '<a href="' . esc_url(admin_url('options-general.php?page=kommentare-tool')) . '">'
          . esc_html__('Einstellungen', 'kommentare') . '</a>';
    array_unshift($links, $link);
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'kommentare_plugin_links');

/** Die Einstellungsseite. */
function kommentare_einstellungsseite() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $o = kommentare_optionen();
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Kommentator', 'kommentare'); ?></h1>
        <p class="description" style="max-width:46em">
            <?php esc_html_e('Markieren, kommentieren, exportieren — im Frontend wie im Backend. Ohne Sammelstelle bleibt alles im Browser; erst mit einer Adresse laufen die Kommentare in einer zentralen Tabelle zusammen.', 'kommentare'); ?>
        </p>

        <form method="post" action="options.php">
            <?php settings_fields('kommentare_optionen_gruppe'); ?>

            <h2 class="title"><?php esc_html_e('Zentrale Sammelstelle', 'kommentare'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="kommentare-webhook"><?php esc_html_e('Adresse', 'kommentare'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[webhook]" id="kommentare-webhook" type="url"
                               class="regular-text code" inputmode="url" spellcheck="false"
                               placeholder="https://script.google.com/macros/s/…/exec"
                               value="<?php echo esc_attr($o['webhook']); ?>">
                        <p class="description">
                            <?php esc_html_e('Leer lassen = aus. Dann verlässt kein Kommentar den Browser und der Knopf „Alle senden" erscheint nicht.', 'kommentare'); ?>
                            <br>
                            <?php esc_html_e('Für ein Google Sheet: Tabelle anlegen → Erweiterungen → Apps Script → Skript einfügen → Bereitstellen als Web-App („Ausführen als: Ich", „Zugriff: Jeder") → die Adresse auf /exec hier eintragen.', 'kommentare'); ?>
                            <a href="https://github.com/daimpad/kommentator/blob/main/TUTORIAL.md#8-kommentare-in-einem-google-sheet-sammeln"
                               target="_blank" rel="noopener"><?php esc_html_e('Schritt-für-Schritt-Anleitung mit fertigem Skript', 'kommentare'); ?></a>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Versand', 'kommentare'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[webhook_auto]" type="checkbox" value="1"
                                   <?php checked($o['webhook_auto'], 1); ?>>
                            <?php esc_html_e('Jede Änderung automatisch melden', 'kommentare'); ?>
                        </label>
                        <p class="description">
                            <?php esc_html_e('Aus = nur der Knopf „Alle senden" schickt. Gemeldet werden Zeitpunkt, Seiten-URL und -Titel, Autor:in, Art, markierte Stelle, Kommentar, Browser, Sprache und Bildschirmgröße — keine IP-Adresse, nur eine anonyme Sitzungskennung.', 'kommentare'); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <h2 class="title"><?php esc_html_e('Anzeige', 'kommentare'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><?php esc_html_e('Laden', 'kommentare'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[frontend]" type="checkbox" value="1"
                                   <?php checked($o['frontend'], 1); ?>>
                            <?php esc_html_e('Im Frontend (öffentliche Seiten)', 'kommentare'); ?>
                        </label><br>
                        <label>
                            <input name="kommentare_optionen[backend]" type="checkbox" value="1"
                                   <?php checked($o['backend'], 1); ?>>
                            <?php esc_html_e('Im Backend (wp-admin)', 'kommentare'); ?>
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Wer darf kommentieren', 'kommentare'); ?></th>
                    <td>
                        <label>
                            <input name="kommentare_optionen[nur_eingeloggt]" type="checkbox" value="1"
                                   <?php checked($o['nur_eingeloggt'], 1); ?>>
                            <?php esc_html_e('Im Frontend nur angemeldete Nutzer:innen', 'kommentare'); ?>
                        </label>
                        <p class="description">
                            <?php esc_html_e('Standard: an. Ohne Haken sehen und nutzen alle Besucher:innen das Werkzeug — auf einer öffentlichen Seite mit Sammelstelle heißt das: jede:r kann in deine Tabelle schreiben, denn die Adresse steht im Seitenquelltext und lässt sich nicht geheim halten. Den Haken nur entfernen, wenn Rückmeldungen von nicht angemeldeten Personen ausdrücklich erwünscht sind.', 'kommentare'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="kommentare-container"><?php esc_html_e('Kommentierbarer Bereich', 'kommentare'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[container]" id="kommentare-container" type="text"
                               class="regular-text code" spellcheck="false"
                               value="<?php echo esc_attr($o['container']); ?>">
                        <p class="description">
                            <?php esc_html_e('CSS-Selektor. Standard „body" = ganze Seite inklusive Kopf- und Fußbereich. Nur den Inhalt: .entry-content oder .wp-block-post-content.', 'kommentare'); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="kommentare-email"><?php esc_html_e('E-Mail-Empfänger', 'kommentare'); ?></label>
                    </th>
                    <td>
                        <input name="kommentare_optionen[email]" id="kommentare-email" type="email"
                               class="regular-text" value="<?php echo esc_attr($o['email']); ?>">
                        <p class="description">
                            <?php esc_html_e('Für „Per E-Mail senden". Leer = Knopf aus.', 'kommentare'); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button(); ?>
        </form>

        <p class="description">
            <?php esc_html_e('Feinere Einstellungen (Element-/Punkt-Kommentare, Theme-Umschalter, eigene Texte, Nur-Lesen) laufen weiter über Filter im Theme. Ein Filter sticht dabei immer den hier gespeicherten Wert.', 'kommentare'); ?>
            <a href="https://github.com/daimpad/kommentator/blob/main/TECHNISCHE_DOKUMENTATION.md#wordpress-plugin"
               target="_blank" rel="noopener"><?php esc_html_e('Übersicht aller Filter', 'kommentare'); ?></a>
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
    return apply_filters('kommentare_container_selector', kommentare_option('container'));
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
 * init-Optionen für das Werkzeug zusammenstellen.
 *
 * @param bool $is_admin Backend-Kontext?
 * @return array
 */
function kommentare_build_config($is_admin = false) {
    // Autor:in aus dem eingeloggten WordPress-Benutzer (sonst „Gast").
    $autor = is_user_logged_in() ? wp_get_current_user()->display_name : 'Gast';
    $autor = apply_filters('kommentare_autor', $autor);

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
        'kommentare',
        $base . 'kommentare.css',
        array(),
        KOMMENTARE_VERSION
    );

    wp_enqueue_script(
        'kommentare',
        $base . 'kommentare.js',
        array(),
        KOMMENTARE_VERSION,
        true // im Footer laden
    );

    $config = kommentare_build_config($is_admin);

    // Der Block-Editor baut seine Oberfläche erst nach DOMContentLoaded auf;
    // deshalb zusätzlich auf 'load' warten und leicht verzögert starten.
    $init = '(function(){function s(){if(!window.Kommentare||window.kommentareInstanz)return;'
          . 'window.kommentareInstanz=window.Kommentare.init(' . wp_json_encode($config) . ');}'
          . 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){setTimeout(s,0);});}'
          . 'else{setTimeout(s,0);}})();';

    wp_add_inline_script('kommentare', $init);
}

/** Frontend. */
function kommentare_enqueue_assets() {
    if (!kommentare_should_load()) {
        return;
    }
    kommentare_enqueue(false);
}
add_action('wp_enqueue_scripts', 'kommentare_enqueue_assets');

/** Backend (wp-admin), inklusive Block-Editor. */
function kommentare_enqueue_admin_assets($hook_suffix = '') {
    if (!kommentare_should_load_admin($hook_suffix)) {
        return;
    }
    kommentare_enqueue(true);
}
add_action('admin_enqueue_scripts', 'kommentare_enqueue_admin_assets');
