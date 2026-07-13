=== Kommentare (Textstellen-Annotation) ===
Contributors: daimpad
Tags: annotation, kommentare, markierung, annotation, text
Requires at least: 5.0
Requires PHP: 7.0
Stable tag: 1.7.1
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
  Bereichs. Standard: `body` (ganze Seite inkl. Header/Footer). Auf den Inhalt
  einschränken: `.entry-content` bzw. `.wp-block-post-content`.
* `kommentare_notes` (string) – `'floating'` (Notizen schweben, Seite bleibt
  unverändert – Standard) oder `'inline'` (Notizen als Randspalte, baut die
  Seite um; nur für einen abgegrenzten Inhaltscontainer sinnvoll).
* `kommentare_should_load` (bool) – ob geladen wird. Standard: `is_singular()`.
* `kommentare_autor` (string) – angezeigter Autorname. Standard: Anzeigename des
  eingeloggten Benutzers, sonst „Gast".
* `kommentare_read_only` (bool) – nur ansehen, keine neuen Kommentare.
* `kommentare_help` (bool) – „?“-Hilfe-Button. Standard: an.
* `kommentare_theme_toggle` (bool) – Hell-/Dunkel-Umschalter. Standard: an.
* `kommentare_toolbar_mode` (string) – `'floating'` (Button unten rechts,
  Standard) oder `'bar'` (Balken oben).
* `kommentare_resizable` (bool) – ziehbare Notizspalte. Standard: an.
* `kommentare_email` (string) – E-Mail-Empfänger für „Per E-Mail senden“
  (leer = Button aus). Standard: leer.
* `kommentare_elements` (bool) – Element-Kommentare (Boxen/Bilder). Standard: an.
* `kommentare_points` (bool) – Punkt an eine Stelle anheften. Standard: an.
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

= 1.7.1 =
* Fix: „Notizen (Markdown)“/„Per E-Mail senden“ stürzten mit Element-/
  Punkt-Kommentaren ab; Markdown zeigt jetzt passende Überschriften je Art.
* Fix: Pins/Element-Rahmen saßen falsch, wenn das Theme body positioniert
  (position:relative/margin).
* Fix: „Als PDF / drucken“ druckt im Floating-Notizen-Modus jetzt auch die
  Notizliste mit.

= 1.7.0 =
* Ganze Seite kommentierbar: Container-Standard jetzt `body` (Header + Inhalt +
  Footer), Notizen schweben (notes: 'floating') – die Seite wird nicht umgebaut.
* Neuer Filter kommentare_notes.

= 1.6.0 =
* Punkt-Kommentare: an eine bestimmte Stelle einen Pin anheften
  (Element-relativ verankert; Filter kommentare_points).

= 1.5.0 =
* Element-Kommentare: beliebige Web-Elemente (Boxen/Container/Bilder) statt nur
  Text kommentieren (Filter kommentare_elements).

= 1.4.0 =
* Download-Untermenü: JSON, „Notizen“ als Markdown, „Als PDF / drucken“.
* „Per E-Mail senden“ (öffnet Entwurf; Empfänger via Filter kommentare_email).
* Druckstil (@media print) für sauberen PDF-Export.

= 1.3.0 =
* Floating-Button unten rechts (Menü) statt Balken oben; ziehbare Notizspalte.
* Neue Filter: kommentare_toolbar_mode, kommentare_resizable.
* Theme-Umschalter jetzt standardmäßig an.

= 1.2.0 =
* „?“-Hilfe-Button mit Kurzanleitung, optionaler Hell-/Dunkel-Umschalter.
* Export speichert zusätzlich den Seitentitel (sourceTitle).
* Neue Filter: kommentare_help, kommentare_theme_toggle.

= 1.1.0 =
* Modernisiertes Design (weiche Flächen, Akzentfarbe, Dark-Mode, Pill-Buttons).
* MIT-Lizenz.

= 1.0.0 =
* Erste Version: Einbindung der statischen Assets, Filter zur Konfiguration.
