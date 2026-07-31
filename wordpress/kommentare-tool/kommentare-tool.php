<?php
/**
 * Plugin Name:       Kommentare (Textstellen-Annotation)
 * Plugin URI:        https://github.com/daimpad/kommentator
 * Description:        Bindet das statische Kommentar-Werkzeug in Beiträge/Seiten ein: Textstellen markieren, kommentieren, als JSON exportieren und mehrere Exporte zusammenführen. Kein Backend, keine externen Abhängigkeiten.
 * Version:           1.10.0
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

define('KOMMENTARE_VERSION', '1.10.0');

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
    return apply_filters('kommentare_container_selector', 'body');
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
    return (bool) apply_filters('kommentare_should_load', true);
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
    return (bool) apply_filters('kommentare_should_load_admin', true, $hook_suffix);
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
        'email'       => (string) apply_filters('kommentare_email', ''),
        // Beliebige Elemente (Boxen/Bilder) kommentierbar machen
        'elements'    => (bool) apply_filters('kommentare_elements', true),
        // Punkt an eine bestimmte Stelle anheften
        'points'      => (bool) apply_filters('kommentare_points', true),
        // Vom Kommentieren ausgenommene Bereiche (CSS-Selektor)
        'exclude'     => (string) apply_filters('kommentare_exclude', $exclude_default, $is_admin),
        // Zentrale Sammelstelle: https-Adresse, an die neue Kommentare gemeldet
        // werden (z. B. ein Google-Apps-Script-Web-App vor einem Google Sheet).
        // Leer = aus; dann verlässt kein Kommentar den Browser.
        'webhook'     => (string) apply_filters('kommentare_webhook', ''),
        // Automatisch bei jeder Änderung melden (sonst nur „Alle senden“)
        'webhookAuto' => (bool) apply_filters('kommentare_webhook_auto', true),
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
