=== Kommentare (Textstellen-Annotation) ===
Contributors: daimpad
Tags: annotation, kommentare, markierung, annotation, text
Requires at least: 5.0
Requires PHP: 7.0
Stable tag: 1.2.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Textstellen in Beiträgen/Seiten markieren, kommentieren, als JSON exportieren
und mehrere Exporte zusammenführen. Kein Backend, keine externen Abhängigkeiten.

== Beschreibung ==

Dieses Plugin bindet das statische Kommentar-Werkzeug (kommentare.css +
kommentare.js) auf einzelnen Beiträgen und Seiten ein. Nutzer:innen markieren
Textstellen mit der Maus (oder per Touch), erfassen Kommentare in einer
Randspalte und laden ihre eigenen Kommentare als JSON herunter. Der Betrieb
sammelt die Dateien ein und liest sie über „Kommentare laden" gemeinsam ein –
alle Notizen erscheinen dann nebeneinander.

Der Zustand bleibt im Speicher der Sitzung (kein localStorage, kein Backend).

= Zugriffsschutz =

Das Namensfeld dient nur der Zuordnung, nicht dem Schutz. Echten Schutz regelt
der Betrieb per WordPress-Login/Rollen (Filter `kommentare_should_load`) oder
per HTTP Basic Auth in der .htaccess.

== Installation ==

1. Ordner `kommentare-tool` nach `wp-content/plugins/` hochladen
   (oder als ZIP über „Plugins > Installieren > Plugin hochladen").
2. Plugin „Kommentare (Textstellen-Annotation)" aktivieren.
3. Fertig – auf einzelnen Beiträgen/Seiten wird der Content-Bereich
   (`.entry-content`) kommentierbar.

== Anpassung (Filter) ==

* `kommentare_container_selector` (string) – CSS-Selektor des kommentierbaren
  Bereichs. Standard: `.entry-content`. Bei manchen Block-Themes:
  `.wp-block-post-content`.
* `kommentare_should_load` (bool) – ob geladen wird. Standard: `is_singular()`.
* `kommentare_autor` (string) – angezeigter Autorname. Standard: Anzeigename des
  eingeloggten Benutzers, sonst „Gast".
* `kommentare_read_only` (bool) – nur ansehen, keine neuen Kommentare.
* `kommentare_help` (bool) – „?“-Hilfe-Button. Standard: an.
* `kommentare_theme_toggle` (bool) – Hell-/Dunkel-Umschalter. Standard: aus.
* `kommentare_init_config` (array) – vollständige init-Optionen; hier lassen
  sich z. B. eigene UI-Texte (`texte`) ergänzen.

Beispiel (functions.php des Themes):

    add_filter('kommentare_container_selector', function () {
        return '.wp-block-post-content';
    });
    add_filter('kommentare_should_load', function ($load) {
        return $load && is_user_logged_in();
    });

== Changelog ==

= 1.2.0 =
* „?“-Hilfe-Button mit Kurzanleitung, optionaler Hell-/Dunkel-Umschalter.
* Export speichert zusätzlich den Seitentitel (sourceTitle).
* Neue Filter: kommentare_help, kommentare_theme_toggle.

= 1.1.0 =
* Modernisiertes Design (weiche Flächen, Akzentfarbe, Dark-Mode, Pill-Buttons).
* MIT-Lizenz.

= 1.0.0 =
* Erste Version: Einbindung der statischen Assets, Filter zur Konfiguration.
