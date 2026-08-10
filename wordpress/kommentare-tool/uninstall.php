<?php
/**
 * Aufräumen beim Löschen des Plugins.
 *
 * WordPress ruft diese Datei automatisch auf, sobald das Plugin über
 * „Plugins → Löschen" entfernt wird. Das Plugin legt genau eine Option an;
 * die soll nicht in der Datenbank zurückbleiben — sie enthält unter anderem
 * die Adresse der Sammelstelle.
 *
 * Deaktivieren allein löscht nichts: Wer das Plugin nur vorübergehend
 * abschaltet, findet seine Einstellungen danach unverändert vor.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit; // nur im Deinstallations-Kontext von WordPress
}

$kommentare_option = 'kommentare_optionen';

if (is_multisite()) {
    // In einem Netzwerk liegt die Option in jeder Website getrennt vor.
    $seiten = get_sites(array('fields' => 'ids', 'number' => 0));
    foreach ($seiten as $seiten_id) {
        switch_to_blog($seiten_id);
        delete_option($kommentare_option);
        restore_current_blog();
    }
} else {
    delete_option($kommentare_option);
}
