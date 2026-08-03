=== Kommentare (Textstellen-Annotation) ===
Contributors: daimpad
Tags: annotation, kommentare, markierung, annotation, text
Requires at least: 5.0
Requires PHP: 7.0
Stable tag: 1.12.0
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

Optional lässt sich eine zentrale Sammelstelle hinterlegen (Filter
`kommentare_webhook`): dann melden sich neue Kommentare zusätzlich automatisch
an eine Adresse – z. B. an ein Google-Apps-Script-Web-App vor einem Google
Sheet. So laufen viele Kommentierende auf vielen Seiten in einer Tabelle
zusammen. Ohne Adresse verlässt kein Kommentar den Browser.

= Zugriffsschutz =

Das Namensfeld dient nur der Zuordnung, nicht dem Schutz. Echten Schutz regelt
der Betrieb per WordPress-Login/Rollen (Filter `kommentare_should_load`) oder
per HTTP Basic Auth in der .htaccess.

== Installation ==

1. Ordner `kommentare-tool` nach `wp-content/plugins/` hochladen
   (oder als ZIP über „Plugins > Installieren > Plugin hochladen").
2. Plugin „Kommentare (Textstellen-Annotation)" aktivieren.
3. Fertig – die ganze Seite ist kommentierbar, im **Frontend wie im Backend**
   (wp-admin). Der Knopf für alle Funktionen sitzt unten rechts.

Hinweis: In Eingabefeldern und Editoren (Textfelder, Block-Editor) löst das
Markieren von Text absichtlich keinen Kommentar aus – dort schreibt man. Solche
Bereiche lassen sich weiterhin über „Element kommentieren" oder „Punkt anheften"
kommentieren.

== Einstellungen (Backend) ==

Unter **Einstellungen → Kommentator** lässt sich das Wesentliche eintragen,
ohne Code anzufassen:

* **Adresse der Sammelstelle** – leer = aus (dann verlässt kein Kommentar den
  Browser). Mit Adresse landen neue Kommentare automatisch in der Tabelle.
* **Automatisch melden** – aus = nur der Knopf „Alle senden" schickt.
* **Laden im Frontend / im Backend** – je einzeln an- und abschaltbar.
* **Im Frontend nur angemeldete Nutzer:innen** – empfohlen, sobald eine
  Sammelstelle eingetragen ist. Die Adresse steht im Seitenquelltext und lässt
  sich nicht geheim halten; ohne diesen Haken kann auf einer öffentlichen Seite
  jede:r in deine Tabelle schreiben.
* **Kommentierbarer Bereich** – CSS-Selektor, Standard `body`.
* **E-Mail-Empfänger** – für „Per E-Mail senden"; leer = Knopf aus.

Die Filter unten funktionieren unverändert weiter und haben **Vorrang**: die
gespeicherte Einstellung ist nur der Vorgabewert. Wer schon per functions.php
konfiguriert hat, muss nichts ändern.

== Anpassung (Filter) ==

* `kommentare_container_selector` (string) – CSS-Selektor des kommentierbaren
  Bereichs. Standard: `body` (ganze Seite inkl. Header/Footer). Auf den Inhalt
  einschränken: `.entry-content` bzw. `.wp-block-post-content`.
* `kommentare_notes` (string) – `'floating'` (Notizen schweben, Seite bleibt
  unverändert – Standard) oder `'inline'` (Notizen als Randspalte, baut die
  Seite um; nur für einen abgegrenzten Inhaltscontainer sinnvoll).
* `kommentare_should_load` (bool) – ob im Frontend geladen wird. Standard: `true`
  (überall). Einschränken z. B. auf `is_singular()`.
* `kommentare_should_load_admin` (bool, string $hook) – ob im Backend (wp-admin)
  geladen wird. Standard: `true` (alle Admin-Seiten). Abschalten mit
  `add_filter('kommentare_should_load_admin', '__return_false')`.
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
* `kommentare_exclude` (string, bool $is_admin) – CSS-Selektor für vom
  Kommentieren ausgenommene Bereiche. Standard: Frontend `#wpadminbar`,
  Backend leer (die Admin-Oberfläche selbst ist kommentierbar).
* `kommentare_webhook` (string) – https-Adresse einer zentralen Sammelstelle,
  an die neue Kommentare gemeldet werden (z. B. ein Google-Apps-Script-Web-App
  vor einem Google Sheet). Standard: leer = aus, dann verlässt kein Kommentar
  den Browser. Anleitung: TUTORIAL.md, Abschnitt 8 „Kommentare in einem Google
  Sheet sammeln".
* `kommentare_webhook_auto` (bool) – automatisch bei jeder Änderung melden.
  Standard: an. Aus = nur der Knopf „Alle senden" schickt.
* `kommentare_init_config` (array, bool $is_admin) – vollständige init-Optionen;
  hier lassen sich z. B. eigene UI-Texte (`texte`) ergänzen.

Beispiel (functions.php des Themes):

    add_filter('kommentare_container_selector', function () {
        return '.wp-block-post-content';
    });
    add_filter('kommentare_should_load', function ($load) {
        return $load && is_user_logged_in();
    });

== Changelog ==

= 1.12.0 =
* Neu: Einstellung „Im Frontend nur angemeldete Nutzer:innen". Wichtig, sobald
  eine Sammelstelle eingetragen ist: die Adresse steht im Seitenquelltext, auf
  einer öffentlichen Seite könnte sonst jede:r in die Tabelle schreiben.
  Vorgabe ist aus – bestehende Installationen verhalten sich unverändert.
* Fix: Beim Löschen eines Kommentars, dessen Markierung über mehrere Elemente
  lief (z. B. über ein <b> oder eine Absatzgrenze), blieben Teile der farbigen
  Markierung ohne zugehörige Notiz stehen. Jetzt verschwinden alle Teile.
* Fix: Klick auf eine Notiz hebt jetzt die ganze Markierung hervor, nicht nur
  ihr erstes Stück.
* Fix: Große Sendungen an die Sammelstelle scheiterten still und meldeten
  trotzdem Erfolg (64-KiB-Grenze von sendBeacon/keepalive, die für alle
  offenen Anfragen zusammen gilt). Ab rund 100 Kommentaren ging bei „Alle
  senden" nichts mehr raus. Sendungen werden jetzt gebündelt, große Mengen
  gehen ohne keepalive raus, und echte Fehler erscheinen am Knopf.
* Barrierefreiheit: Im Hilfe-Dialog bleibt der Tastaturfokus jetzt im Dialog.
* Robustheit: Zwei Instanzen auf demselben Bereich werden erkannt und
  abgelehnt, statt sich gegenseitig zu überlagern.

= 1.11.0 =
* Neu: Einstellungsseite unter „Einstellungen → Kommentator". Adresse der
  Sammelstelle, automatischer Versand, kommentierbarer Bereich, E-Mail-Empfänger
  und ob im Frontend/Backend geladen wird — alles im Backend eintragbar, ohne
  die functions.php anzufassen.
* „Einstellungen"-Link direkt in der Plugin-Liste.
* Die Filter bleiben unverändert bestehen und haben weiterhin Vorrang: die
  gespeicherte Einstellung ist nur der Vorgabewert. Bestehende Einbindungen per
  functions.php funktionieren also unverändert weiter.
* Eingaben werden geprüft: die Sammelstelle nimmt nur http(s)-Adressen an,
  ungültige Eingaben werden mit sichtbarem Hinweis abgelehnt statt still
  geschluckt.

= 1.10.0 =
* Neu: zentrale Sammelstelle. Mit dem Filter kommentare_webhook gehen neue
  Kommentare automatisch an eine Adresse – z. B. an ein Google-Apps-Script-Web-App
  vor einem Google Sheet. Damit laufen viele Kommentierende auf vielen Seiten in
  einer einzigen Tabelle zusammen.
* Gemeldet werden Zeitpunkt, Seiten-URL und -Titel, Autor:in, Art (Text/Element/
  Punkt), markierte Stelle, Kommentar, Kommentar-ID, Browser, Sprache und
  Bildschirmgröße – KEINE IP-Adresse, nur eine anonyme Sitzungskennung.
* Neuer Knopf „Alle senden" als Netz für den automatischen Versand; Filter
  kommentare_webhook_auto schaltet die Automatik ab.
* Ohne gesetzte Adresse bleibt alles wie bisher: kein Versand, kein Knopf.

= 1.9.0 =
* Backend: das Werkzeug lädt jetzt auch in wp-admin (Filter
  kommentare_should_load_admin) – Admin-Oberfläche, Menü und Adminleiste sind
  dort kommentierbar.
* Frontend: lädt jetzt auf allen Seiten (vorher nur einzelne Beiträge/Seiten).
* Fix: Text-Kommentare griffen bei üblichen Auswahlarten nicht richtig – ein
  Dreifachklick markierte den Absatz plus den Rest der Seite, eine Auswahl über
  mehrere Absätze wurde ganz verworfen (Offset-Berechnung bei
  Element-Grenzpunkten).
* In Eingabefeldern/Editoren löst Text markieren keinen Kommentar mehr aus
  (dort wird geschrieben); Element-/Punkt-Kommentare bleiben möglich.

= 1.8.0 =
* Neue Option/Filter kommentare_exclude: Bereiche vom Kommentieren ausnehmen;
  Standard schließt die WordPress-Admin-Bar (#wpadminbar) aus.
* Theme-Knopf folgt im Auto-Modus live dem Systemwechsel (hell/dunkel).
* Barrierefreiheit: Panel als role="region" mit aria-controls am Menü-Button;
  Auswahl-Cursor nicht mehr über den Werkzeug-Bedienelementen.
* Schnelleres Sortieren der Notizliste bei vielen Kommentaren.

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
