<?php
/**
 * Plugin Name:       Kommentare (Textstellen-Annotation)
 * Plugin URI:        https://github.com/daimpad/kommentator
 * Description:        Bindet das statische Kommentar-Werkzeug in Beiträge/Seiten ein: Textstellen markieren, kommentieren, als JSON exportieren und mehrere Exporte zusammenführen. Kein Backend, keine externen Abhängigkeiten.
 * Version:           1.4.0
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

define('KOMMENTARE_VERSION', '1.4.0');

/**
 * Selektor des zu kommentierenden Containers.
 * Standard: der Content-Bereich klassischer/Block-Themes.
 *
 * Anpassen per Filter, z. B. in der functions.php:
 *   add_filter('kommentare_container_selector', function () {
 *       return '.wp-block-post-content';
 *   });
 *
 * @return string
 */
function kommentare_container_selector() {
    return apply_filters('kommentare_container_selector', '.entry-content');
}

/**
 * Auf welchen Ansichten wird das Werkzeug geladen?
 * Standard: einzelne Beiträge und Seiten (is_singular()).
 *
 * Beispiele:
 *   // Nur für eingeloggte Nutzer:innen:
 *   add_filter('kommentare_should_load', fn($load) => $load && is_user_logged_in());
 *   // Nur für einen bestimmten Beitragstyp:
 *   add_filter('kommentare_should_load', fn($load) => $load && is_singular('dokument'));
 *
 * @return bool
 */
function kommentare_should_load() {
    return (bool) apply_filters('kommentare_should_load', is_singular());
}

/**
 * CSS + JS registrieren und mit dem init-Aufruf starten.
 */
function kommentare_enqueue_assets() {
    if (!kommentare_should_load()) {
        return;
    }

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

    // Autor:in aus dem eingeloggten WordPress-Benutzer (sonst „Gast").
    $autor = is_user_logged_in() ? wp_get_current_user()->display_name : 'Gast';
    $autor = apply_filters('kommentare_autor', $autor);

    $config = array(
        'container'   => kommentare_container_selector(),
        'autor'       => $autor,
        'readOnly'    => (bool) apply_filters('kommentare_read_only', false),
        'help'        => (bool) apply_filters('kommentare_help', true),
        'themeToggle' => (bool) apply_filters('kommentare_theme_toggle', true),
        // 'bar' (Balken oben) oder 'floating' (Button unten rechts)
        'toolbarMode' => (string) apply_filters('kommentare_toolbar_mode', 'floating'),
        'resizable'   => (bool) apply_filters('kommentare_resizable', true),
        // E-Mail-Empfänger für „Per E-Mail senden" (leer = Button aus)
        'email'       => (string) apply_filters('kommentare_email', ''),
    );

    // Weitere init-Optionen (z. B. eigene UI-Texte) frei ergänzbar:
    //   add_filter('kommentare_init_config', function ($cfg) {
    //       $cfg['texte'] = array('notizenKopf' => 'Anmerkungen');
    //       return $cfg;
    //   });
    $config = apply_filters('kommentare_init_config', $config);

    $init = 'document.addEventListener("DOMContentLoaded",function(){'
          . 'if(window.Kommentare){'
          . 'window.kommentareInstanz=window.Kommentare.init(' . wp_json_encode($config) . ');'
          . '}});';

    wp_add_inline_script('kommentare', $init);
}
add_action('wp_enqueue_scripts', 'kommentare_enqueue_assets');
