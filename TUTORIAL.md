# Tutorial — Nutzung, Installation & Einsatz

Dieses Tutorial führt Schritt für Schritt durch das Kommentar-Werkzeug: erst
ausprobieren, dann in eine eigene Seite einbinden, bedienen, Kommentare teilen,
in WordPress installieren und schließlich veröffentlichen.

**Inhalt**

1. [In 1 Minute ausprobieren](#1-in-1-minute-ausprobieren)
2. [In eine eigene Seite einbinden](#2-in-eine-eigene-seite-einbinden)
3. [Bedienung (für Nutzer:innen)](#3-bedienung-für-nutzerinnen)
4. [Kommentare teilen & zusammenführen](#4-kommentare-teilen--zusammenführen)
5. [In WordPress installieren](#5-in-wordpress-installieren)
6. [Veröffentlichen auf GitHub Pages](#6-veröffentlichen-auf-github-pages)
7. [Echten Zugriffsschutz einrichten](#7-echten-zugriffsschutz-einrichten)
8. [Problembehebung](#8-problembehebung)

---

## 1. In 1 Minute ausprobieren

Kein Server, kein Build nötig.

1. Repository herunterladen (grüner „Code“-Button → *Download ZIP*, oder
   `git clone`).
2. `demo.html` im Browser öffnen (Doppelklick).
3. Namen eingeben → **Übernehmen**.
4. Im Text mit der Maus eine Stelle markieren → Kommentar eintippen →
   **Speichern**.

Fertig. Über den Button **☰ unten rechts** erreichst du alle Funktionen.

---

## 2. In eine eigene Seite einbinden

Drei Schritte in deiner HTML-Datei:

```html
<!-- 1. Stylesheet in den <head> -->
<link rel="stylesheet" href="kommentare.css">

<!-- 2. Den zu kommentierenden Bereich auszeichnen -->
<div data-kommentierbar>
  … dein Fließtext …
</div>

<!-- 3. Skript vor </body> laden und starten -->
<script src="kommentare.js"></script>
<script>
  Kommentare.init({
    container: '[data-kommentierbar]',
    autor: 'Vorname Nachname',
    toolbarMode: 'floating', // Button unten rechts (statt Balken oben)
    themeToggle: true
  });
</script>
```

`kommentare.css` und `kommentare.js` müssen neben deiner HTML-Datei liegen (oder
passe die Pfade an). Randspalte und Menü werden automatisch erzeugt.

> **Tipp:** Der Container sollte **nur den Fließtext** umfassen — keine Sidebar,
> keine „Ähnliche Beiträge“. Sonst verschieben sich die gespeicherten
> Zeichenpositionen.

Alle Optionen stehen in der [Technischen Dokumentation](TECHNISCHE_DOKUMENTATION.md).

---

## 3. Bedienung (für Nutzer:innen)

| Aktion | So geht’s |
|---|---|
| **Markieren & kommentieren** | Textstelle mit Maus/Touch markieren → Text eingeben → Speichern |
| **Element kommentieren** | im Menü „Element kommentieren“ → Box/Bild anklicken → Text eingeben |
| **Notiz ↔ Markierung** | Klick auf eine Markierung, ein Element-Badge oder eine Notiz hebt beide hervor |
| **Bearbeiten / Löschen** | Bei den eigenen Notizen über „bearbeiten“ / „löschen“ |
| **Notizspalte breiter ziehen** | Am Griff zwischen Text und Notizen ziehen |
| **Alle Funktionen** | Button **☰ unten rechts** öffnet das Menü |
| **Herunterladen** | „Kommentare (JSON)“ oder „Notizen (Markdown)“ im Menü |
| **Als PDF / drucken** | öffnet den Druckdialog → „Als PDF speichern“ (Bedienelemente werden ausgeblendet) |
| **Per E-Mail senden** | lädt die Datei herunter und öffnet einen E-Mail-Entwurf (falls konfiguriert) |
| **Hilfe** | „?“ im Menü zeigt die Kurzanleitung |
| **Hell/Dunkel** | ☾/☀ im Menü |

Kommentare bleiben im Browser der Sitzung — bis du sie exportierst.

---

## 4. Kommentare teilen & zusammenführen

Es gibt **kein Backend**. Teilen läuft asynchron in drei Schritten:

1. **Exportieren:** Jede:r lädt über *Meine Kommentare herunterladen* eine
   JSON-Datei herunter (Dateiname enthält Namen und Datum).
2. **Einsammeln:** Die betreibende Person sammelt die JSON-Dateien ein
   (z. B. per E-Mail/Upload).
3. **Zusammenführen:** Auf derselben Seite über *Kommentare laden* alle Dateien
   auswählen. Die Notizen erscheinen nebeneinander, **dedupliziert nach `id`**,
   mit den Namen der jeweiligen Autor:innen.

Damit die Markierungen exakt sitzen, muss der zugrunde liegende **Text
unverändert** sein. Jede Export-Datei enthält `source` (URL) und `sourceTitle`,
sodass klar bleibt, zu welcher Seite sie gehört.

---

## 5. In WordPress installieren

**Variante A — Plugin (empfohlen)**

1. Den Ordner `wordpress/kommentare-tool/` als ZIP packen.
2. WordPress-Admin → **Plugins → Installieren → Plugin hochladen** → ZIP wählen.
3. Aktivieren. Auf einzelnen Beiträgen/Seiten wird `.entry-content`
   kommentierbar; das Menü sitzt unten rechts.

Anpassen (in der `functions.php` deines Themes), z. B. anderer Container oder
nur für eingeloggte Nutzer:innen:

```php
add_filter('kommentare_container_selector', fn() => '.wp-block-post-content');
add_filter('kommentare_should_load', fn($load) => $load && is_user_logged_in());
```

Weitere Filter: siehe `wordpress/kommentare-tool/readme.txt` und die
[Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md#wordpress-plugin).

**Variante B — Child-Theme**

`kommentare.css`/`kommentare.js` ins Theme legen und per
`wp_enqueue_style`/`wp_enqueue_script` einbinden, dann per
`wp_add_inline_script` den `init`-Aufruf mit `container: '.entry-content'`
ergänzen.

---

## 6. Veröffentlichen auf GitHub Pages

Die statischen Dateien lassen sich direkt als Website ausliefern.

1. Repository nach GitHub pushen (Dateien im Root).
2. Repo → **Settings → Pages**.
3. **Build and deployment → Source:** „**Deploy from a branch**“.
4. **Branch:** `main`, Ordner: `/ (root)` → **Save**.
5. Nach ~1–2 Minuten ist die Seite unter
   `https://<name>.github.io/<repo>/` erreichbar. `index.html` leitet auf
   `demo.html` weiter.

Jeder weitere Push auf `main` baut die Seite automatisch neu. Falls du den alten
Stand siehst: hart neu laden (Strg/Cmd + Shift + R) oder privates Fenster —
GitHubs CDN cacht einige Minuten.

> „GitHub Actions“ als Quelle ist für dieses rein statische Projekt **nicht**
> nötig; „Deploy from a branch“ ist der einfachere Weg.

---

## 7. Echten Zugriffsschutz einrichten

Das Namensfeld ist **kein** Passwortschutz. Wer den Zugang beschränken will,
regelt das serverseitig, z. B. per HTTP Basic Auth (Apache):

`.htaccess`:

```apache
AuthType Basic
AuthName "Kommentierung"
AuthUserFile /absoluter/pfad/zu/.htpasswd
Require valid-user
```

`.htpasswd` erzeugen (Benutzer „anna“):

```bash
htpasswd -c /absoluter/pfad/zu/.htpasswd anna
```

In WordPress übernehmen das Login/Rollen bzw. der Filter
`kommentare_should_load`.

---

## 8. Problembehebung

| Symptom | Ursache / Lösung |
|---|---|
| Markierungen sitzen nach Reload falsch | Der Text hat sich geändert. Für exakte Verankerung Text stabil halten. |
| Auf GitHub Pages erscheint der alte Stand | CDN-Cache: hart neu laden oder privates Fenster; sicherstellen, dass Pages-Quelle „Deploy from a branch / main“ ist. |
| Menü/Notizen fehlen | Stimmt der `container`-Selektor? Wird `kommentare.js` geladen (Konsole prüfen)? |
| Positionen verschieben sich | Container umfasst zu viel (Sidebar/Widgets). Enger fassen. |
| Nichts lässt sich markieren | `readOnly: true` gesetzt? Oder Auswahl außerhalb des Containers. |

Mehr Details: [Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md).
