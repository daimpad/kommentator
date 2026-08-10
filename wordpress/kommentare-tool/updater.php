<?php
/**
 * Update-Anbindung an die GitHub-Releases dieses Repositories.
 * ---------------------------------------------------------------------------
 * Das Plugin liegt nicht im WordPress-Verzeichnis; ohne diese Datei müsste
 * jede neue Fassung von Hand als ZIP hochgeladen werden. Mit ihr erscheint
 * eine neue Version wie bei jedem anderen Plugin unter „Plugins" bzw.
 * „Dashboard → Aktualisierungen" — samt Details-Fenster, Ein-Klick-Update und
 * (wenn gewünscht) automatischen Updates.
 *
 * Grundsätze, die hier nicht aufgeweicht werden:
 *   - Es wird NUR gefragt, nie gemeldet. An GitHub geht eine gewöhnliche
 *     Leseanfrage ohne Kennung der Website; es werden keine Daten übertragen.
 *   - Als Paketquelle wird ausschließlich ein Anhang auf github.com
 *     akzeptiert. Ein umgebogenes Repository kann damit keine beliebige
 *     Adresse in den Aktualisierungsvorgang schieben.
 *   - Scheitert die Abfrage, passiert nichts: kein Fehler, kein Hinweis,
 *     keine Wiederholungsschleife. WordPress arbeitet ohne Update weiter.
 *   - Abschaltbar über den Filter 'kommentare_updates' — für Installationen,
 *     die Aktualisierungen zentral verwalten.
 * ======================================================================== */

if (!defined('ABSPATH')) {
    exit;
}

/** Zwischenspeicher für die Release-Abfrage. */
if (!defined('KOMMENTARE_UPDATE_CACHE')) {
    define('KOMMENTARE_UPDATE_CACHE', 'kommentare_tool_release');
}

/** Repository, aus dem Aktualisierungen kommen (owner/repo). */
function kommentare_update_repo() {
    $repo = apply_filters('kommentare_update_repo', 'daimpad/kommentator');
    return is_string($repo) && preg_match('#^[\w.-]+/[\w.-]+$#', $repo) ? $repo : 'daimpad/kommentator';
}

/** Sollen Aktualisierungen überhaupt gesucht werden? */
function kommentare_updates_aktiv() {
    return (bool) apply_filters('kommentare_updates', true);
}

/**
 * Nur Anhänge von github.com sind als Paket zulässig.
 * Alles andere wird verworfen — ein Update lädt Code nach und ausgeführt
 * wird er mit den Rechten der Website.
 */
function kommentare_paket_erlaubt($url) {
    if (!is_string($url) || $url === '') {
        return false;
    }
    $teile = wp_parse_url($url);
    if (empty($teile['scheme']) || empty($teile['host'])) {
        return false;
    }
    return strtolower($teile['scheme']) === 'https'
        && strtolower($teile['host']) === 'github.com';
}

/**
 * Angaben zum neuesten Plugin-Release.
 *
 * Es zählen nur Releases mit dem Tag-Schema `wp-v*` — das statische Werkzeug
 * hat keinen eigenen Release-Kanal, aber falls je einer dazukommt, greift
 * diese Abfrage nicht daneben. Entwürfe und Vorabfassungen bleiben außen vor.
 *
 * @param bool $erzwingen Zwischenspeicher übergehen.
 * @return array Leeres Array, wenn nichts Verwertbares gefunden wurde.
 */
function kommentare_neuester_release($erzwingen = false) {
    if (!$erzwingen) {
        $gepuffert = get_site_transient(KOMMENTARE_UPDATE_CACHE);
        // 'keine' ist ein gemerktes Fehlschlagen: nicht bei jedem Seitenaufruf
        // erneut anklopfen, wenn GitHub gerade nicht erreichbar ist.
        if ($gepuffert === 'keine') {
            return array();
        }
        if (is_array($gepuffert)) {
            return $gepuffert;
        }
    }

    $antwort = wp_remote_get(
        'https://api.github.com/repos/' . kommentare_update_repo() . '/releases?per_page=10',
        array(
            'timeout' => 8,
            'headers' => array(
                'Accept'     => 'application/vnd.github+json',
                'User-Agent' => 'kommentare-tool/' . KOMMENTARE_VERSION,
            ),
        )
    );

    $misslungen = is_wp_error($antwort)
        || (int) wp_remote_retrieve_response_code($antwort) !== 200;

    if (!$misslungen) {
        $releases = json_decode(wp_remote_retrieve_body($antwort), true);
        if (is_array($releases)) {
            foreach ($releases as $release) {
                $gefunden = kommentare_release_auswerten($release);
                if ($gefunden) {
                    set_site_transient(KOMMENTARE_UPDATE_CACHE, $gefunden, 6 * HOUR_IN_SECONDS);
                    return $gefunden;
                }
            }
        }
    }

    set_site_transient(KOMMENTARE_UPDATE_CACHE, 'keine', 15 * MINUTE_IN_SECONDS);
    return array();
}

/**
 * Einen einzelnen Release-Eintrag auf Verwertbarkeit prüfen.
 * Ohne passenden ZIP-Anhang ist ein Release für uns wertlos: Der von GitHub
 * erzeugte Quelltext-Download hätte den falschen Ordneraufbau.
 */
function kommentare_release_auswerten($release) {
    if (!is_array($release) || !empty($release['draft']) || !empty($release['prerelease'])) {
        return array();
    }
    $tag = isset($release['tag_name']) ? (string) $release['tag_name'] : '';
    if (strpos($tag, 'wp-v') !== 0) {
        return array();
    }
    $version = substr($tag, 4);
    if (!preg_match('#^\d+(\.\d+)*$#', $version)) {
        return array();
    }

    $paket = '';
    $anhaenge = isset($release['assets']) && is_array($release['assets']) ? $release['assets'] : array();
    foreach ($anhaenge as $anhang) {
        $name = isset($anhang['name']) ? (string) $anhang['name'] : '';
        $url  = isset($anhang['browser_download_url']) ? (string) $anhang['browser_download_url'] : '';
        if ($name === 'kommentare-tool-' . $version . '.zip' && kommentare_paket_erlaubt($url)) {
            $paket = $url;
            break;
        }
    }
    if ($paket === '') {
        return array();
    }

    return array(
        'version'   => $version,
        'paket'     => $paket,
        'seite'     => isset($release['html_url']) ? (string) $release['html_url'] : '',
        'notizen'   => isset($release['body']) ? (string) $release['body'] : '',
        'datum'     => isset($release['published_at']) ? (string) $release['published_at'] : '',
    );
}

/** Ist der gefundene Release neuer als das, was hier läuft? */
function kommentare_update_verfuegbar($release) {
    return !empty($release['version'])
        && version_compare($release['version'], KOMMENTARE_VERSION, '>');
}

/** Gemeinsame Angaben für beide Einträge im Update-Zwischenspeicher. */
function kommentare_update_eintrag($release) {
    return (object) array(
        'id'           => 'github.com/' . kommentare_update_repo(),
        'slug'         => 'kommentare-tool',
        'plugin'       => plugin_basename(KOMMENTARE_DATEI),
        'new_version'  => empty($release['version']) ? KOMMENTARE_VERSION : $release['version'],
        'url'          => 'https://github.com/' . kommentare_update_repo(),
        'package'      => empty($release['paket']) ? '' : $release['paket'],
        'requires'     => '5.0',
        'requires_php' => '7.0',
        'icons'        => array(),
        'banners'      => array(),
        'banners_rtl'  => array(),
    );
}

/**
 * Neue Fassung in den Update-Zwischenspeicher von WordPress hängen.
 * Auch das Ergebnis „nichts Neues" wird eingetragen (no_update) — sonst zeigt
 * WordPress bei diesem Plugin keinen Schalter für automatische Updates an.
 */
function kommentare_update_pruefen($transient) {
    if (!is_object($transient) || !kommentare_updates_aktiv()) {
        return $transient;
    }
    $datei   = plugin_basename(KOMMENTARE_DATEI);
    $release = kommentare_neuester_release();
    if (empty($release['version'])) {
        return $transient;
    }

    if (kommentare_update_verfuegbar($release)) {
        if (!isset($transient->response) || !is_array($transient->response)) {
            $transient->response = array();
        }
        $transient->response[$datei] = kommentare_update_eintrag($release);
        unset($transient->no_update[$datei]);
    } else {
        if (!isset($transient->no_update) || !is_array($transient->no_update)) {
            $transient->no_update = array();
        }
        $eintrag = kommentare_update_eintrag($release);
        $eintrag->new_version = KOMMENTARE_VERSION;
        $eintrag->package     = '';
        $transient->no_update[$datei] = $eintrag;
    }
    return $transient;
}
add_filter('pre_set_site_transient_update_plugins', 'kommentare_update_pruefen');

/**
 * Die Release-Notizen von GitHub sind Markdown aus fremder Hand. Hier wird
 * nur maskierter Text mit Absätzen und Listenpunkten daraus — kein HTML aus
 * der Antwort erreicht die Seite.
 */
function kommentare_notizen_formatieren($text) {
    $zeilen = preg_split('#\r\n|\r|\n#', (string) $text);
    $aus    = '';
    $liste  = false;
    foreach ($zeilen as $zeile) {
        $zeile = rtrim($zeile);
        if (preg_match('#^\s*[*-]\s+(.*)$#', $zeile, $treffer)) {
            if (!$liste) { $aus .= '<ul>'; $liste = true; }
            $aus .= '<li>' . esc_html($treffer[1]) . '</li>';
            continue;
        }
        if ($liste) { $aus .= '</ul>'; $liste = false; }
        if (trim($zeile) === '' || trim($zeile) === '---') {
            continue;
        }
        if (preg_match('~^\s*\#{1,6}\s+(.*)$~', $zeile, $treffer)) {
            $aus .= '<h4>' . esc_html($treffer[1]) . '</h4>';
            continue;
        }
        $aus .= '<p>' . esc_html($zeile) . '</p>';
    }
    if ($liste) { $aus .= '</ul>'; }
    return $aus;
}

/** Inhalt des Details-Fensters („Details anzeigen" in der Plugin-Liste). */
function kommentare_update_info($ergebnis, $aktion, $args) {
    if ($aktion !== 'plugin_information') {
        return $ergebnis;
    }
    if (!is_object($args) || empty($args->slug) || $args->slug !== 'kommentare-tool') {
        return $ergebnis;
    }
    $release = kommentare_neuester_release();
    if (empty($release['version'])) {
        return $ergebnis;
    }
    return (object) array(
        'name'          => 'Kommentare (Textstellen-Annotation)',
        'slug'          => 'kommentare-tool',
        'version'       => $release['version'],
        'author'        => '<a href="https://github.com/daimpad">daimpad</a>',
        'homepage'      => 'https://github.com/' . kommentare_update_repo(),
        'download_link' => $release['paket'],
        'requires'      => '5.0',
        'requires_php'  => '7.0',
        'last_updated'  => $release['datum'],
        'sections'      => array(
            'description' => '<p>' . esc_html__(
                'Textstellen markieren, kommentieren, als JSON exportieren und mehrere Exporte zusammenführen — ohne Server und ohne externe Abhängigkeiten.',
                'kommentare-tool') . '</p>',
            'changelog'   => kommentare_notizen_formatieren($release['notizen']),
        ),
    );
}
add_filter('plugins_api', 'kommentare_update_info', 10, 3);

/** Nach einem Update ist die gemerkte Antwort veraltet. */
function kommentare_update_cache_leeren() {
    delete_site_transient(KOMMENTARE_UPDATE_CACHE);
}
add_action('upgrader_process_complete', 'kommentare_update_cache_leeren');

/** Zusätzlicher Link in der Plugin-Liste: sofort nachsehen statt warten. */
function kommentare_update_link($links) {
    if (!kommentare_updates_aktiv() || !current_user_can('update_plugins')) {
        return $links;
    }
    $url = wp_nonce_url(
        add_query_arg('kommentare-update-pruefen', '1', admin_url('plugins.php')),
        'kommentare-update-pruefen'
    );
    $links[] = '<a href="' . esc_url($url) . '">'
             . esc_html__('Nach Updates suchen', 'kommentare-tool') . '</a>';
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(KOMMENTARE_DATEI), 'kommentare_update_link');

/** Den Link von oben ausführen: Zwischenspeicher verwerfen und neu fragen. */
function kommentare_update_erzwingen() {
    if (empty($_GET['kommentare-update-pruefen'])) {
        return;
    }
    if (!current_user_can('update_plugins')
        || !isset($_REQUEST['_wpnonce'])
        || !wp_verify_nonce(sanitize_text_field(wp_unslash($_REQUEST['_wpnonce'])), 'kommentare-update-pruefen')) {
        return;
    }
    kommentare_update_cache_leeren();
    kommentare_neuester_release(true);
    delete_site_transient('update_plugins');
    wp_safe_redirect(admin_url('plugins.php'));
    exit;
}
add_action('load-plugins.php', 'kommentare_update_erzwingen');
