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
8. [Kommentare in einem Google Sheet sammeln](#8-kommentare-in-einem-google-sheet-sammeln)
9. [Problembehebung](#9-problembehebung)

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

**Wohin kommt was?**

- Das **`<link>`** gehört in den **`<head>`**.
- Das **`<script src="kommentare.js">`** und der **`init`-Aufruf** gehören ganz
  ans **Ende**, direkt **vor `</body>`** (nach dem Inhalt) — nicht in den `<head>`
  und nicht vor den zu kommentierenden Bereich.

### Variante A — ganze Seite (empfohlen, inkl. Header & Footer)

Nichts am Markup ändern; die Seite bleibt unverändert, die Notizen schweben:

```html
<head>
  <link rel="stylesheet" href="kommentare.css">
</head>
<body>
  … deine komplette Seite (Header, Inhalt, Footer) …

  <!-- ganz unten, vor </body> -->
  <script src="kommentare.js"></script>
  <script>
    Kommentare.init({
      container: 'body',      // die ganze Seite ist kommentierbar
      notes: 'floating',      // Notizen schweben (Seite wird NICHT umgebaut)
      autor: 'Vorname Nachname'
    });
  </script>
</body>
```

> Wenn früher „das Feld zum Kommentieren oberhalb der Seite" erschien, lag das
> an der in-flow-Variante (`notes: 'inline'`), die eine Randspalte/Leiste in die
> Seite einbaut. Mit **`notes: 'floating'`** passiert das nicht — nichts wird in
> den Seitenfluss eingefügt.

### Variante B — nur ein Inhaltsbereich (Randspalte neben dem Text)

```html
<div data-kommentierbar>
  … dein Fließtext …
</div>
<script src="kommentare.js"></script>
<script>
  Kommentare.init({
    container: '[data-kommentierbar]',
    autor: 'Vorname Nachname',
    toolbarMode: 'floating',
    themeToggle: true
  });
</script>
```

Hier erzeugt das Werkzeug Randspalte und Menü selbst. Der Container sollte dann
**nur den Fließtext** umfassen (keine Sidebar), sonst verschieben sich die
gespeicherten Zeichenpositionen.

`kommentare.css` und `kommentare.js` müssen erreichbar sein (Pfade ggf. anpassen).
Alle Optionen: [Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md).

---

## 3. Bedienung (für Nutzer:innen)

| Aktion | So geht’s |
|---|---|
| **Markieren & kommentieren** | Textstelle mit Maus/Touch markieren → Text eingeben → Speichern |
| **Element kommentieren** | Knopf „Element kommentieren“ über den Notizen → Box/Bild anklicken → Text eingeben |
| **Punkt anheften** | Knopf „Punkt anheften“ über den Notizen → genaue Stelle anklicken → Text eingeben |
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

1. **ZIP herunterladen** — im Repository unter
   [**Releases**](https://github.com/daimpad/kommentator/releases) den neuesten
   Eintrag „WordPress-Plugin *x.y.z*" öffnen und `kommentare-tool-x.y.z.zip`
   herunterladen. (Diese Releases enthalten **nur das Plugin**.)
   *Alternativ selbst bauen:* `npm run build-plugin` → `dist/`.
2. WordPress-Admin → **Plugins → Installieren → Plugin hochladen** → ZIP wählen.
3. Aktivieren. Fertig — die **ganze Seite** ist kommentierbar, im **Frontend
   wie im Backend** (wp-admin): Inhalt, Header, Footer, Admin-Menü und
   Adminleiste. Der Knopf für alle Funktionen sitzt unten rechts.

> **Aktualisieren:** neues ZIP aus dem aktuellen Release hochladen und die
> vorhandene Version ersetzen lassen. **Löschen** (nicht nur deaktivieren)
> entfernt auch die gespeicherten Einstellungen inklusive der
> Sammelstellen-Adresse.

> **In Eingabefeldern und Editoren** (Textfelder, Block-Editor) löst das
> Markieren von Text absichtlich *keinen* Kommentar aus — dort schreibt man.
> Diese Bereiche lassen sich über **„Element kommentieren"** oder **„Punkt
> anheften"** kommentieren.

### Einstellen — ohne Code

**Einstellungen → Kommentator** (oder der Link *Einstellungen* in der
Plugin-Liste). Dort lässt sich eintragen:

| Feld | Wofür |
|---|---|
| **Adresse der Sammelstelle** | Kommentare in einer zentralen Tabelle sammeln (siehe [Abschnitt 8](#8-kommentare-in-einem-google-sheet-sammeln)); leer = aus |
| **Jede Änderung automatisch melden** | aus = nur der Knopf „Alle senden" schickt |
| **Laden im Frontend / im Backend** | je einzeln abschaltbar |
| **Im Frontend nur angemeldete Nutzer:innen** | **Standard: an.** Abhaken nur, wenn Rückmeldungen von nicht angemeldeten Personen erwünscht sind — mit Sammelstelle kann dann jede:r in deine Tabelle schreiben |
| **Kommentierbarer Bereich** | CSS-Selektor; Standard `body` = ganze Seite. Nur der Inhalt: `.wp-block-post-content` |
| **E-Mail-Empfänger** | für „Per E-Mail senden"; leer = Knopf aus |

### Feiner justieren — per Filter

Alles Weitere (Element-/Punkt-Kommentare, Theme-Umschalter, Nur-Lesen, eigene
Texte) läuft über Filter in der `functions.php` deines Themes. Ein Filter hat
dabei immer **Vorrang** vor der gespeicherten Einstellung:

```php
// nur für eingeloggte Nutzer:innen
add_filter('kommentare_should_load', fn($load) => $load && is_user_logged_in());
// Punkt-Kommentare abschalten
add_filter('kommentare_points', '__return_false');
// nur ansehen, keine neuen Kommentare
add_filter('kommentare_read_only', '__return_true');
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

## 8. Kommentare in einem Google Sheet sammeln

Ohne Backend läuft das Teilen asynchron (Abschnitt 4). Wenn stattdessen **viele
Kommentierende auf vielen Seiten in einer einzigen Tabelle** zusammenlaufen
sollen, gibt es einen optionalen Weg: eine **Sammelstelle**. Das Werkzeug meldet
jede Änderung an eine Adresse; dahinter hängt ein kleines Google-Apps-Script,
das die Zeile ins Sheet schreibt. Kein Server, keine Datenbank, kein Hosting.

> Ohne `webhook` bleibt alles wie bisher: es verlässt kein Kommentar den Browser.

### Schritt 1 — Tabelle anlegen

Neues Google Sheet erstellen, z. B. „Kommentare“. Die Kopfzeile legt das Skript
selbst an.

### Schritt 2 — Apps Script einfügen

Im Sheet: **Erweiterungen → Apps Script**. Den vorhandenen Code durch diesen
ersetzen und speichern:

```javascript
/* Nimmt Meldungen des Kommentar-Werkzeugs entgegen und schreibt sie ins Sheet.
   Vorhandene Kommentar-IDs werden aktualisiert statt doppelt angelegt. */
const BLATT = 'Kommentare';
const SPALTEN = ['Zeitpunkt', 'Seiten-URL', 'Seitentitel', 'Autor:in', 'Art',
                 'Aktion', 'Markierte Stelle', 'Kommentar', 'Kommentar-ID',
                 'Sitzung', 'Browser', 'Sprache', 'Bildschirm'];
const SPALTE_ID = 9; // Position von 'Kommentar-ID' in SPALTEN

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // gleichzeitige Meldungen nacheinander abarbeiten
  try {
    const daten = JSON.parse(e.postData.contents);
    const blatt = holeBlatt();
    const letzte = blatt.getLastRow();
    const ids = letzte > 1
      ? blatt.getRange(2, SPALTE_ID, letzte - 1, 1).getValues().map(r => String(r[0]))
      : [];

    (daten.eintraege || []).forEach(k => {
      const zeile = [k.zeitpunkt, k.seitenUrl, k.seitenTitel, k.autor, k.art,
                     k.aktion, k.stelle, k.kommentar, k.kommentarId, k.sitzung,
                     k.userAgent, k.sprache, k.bildschirm];
      const pos = ids.indexOf(String(k.kommentarId));
      if (pos >= 0) {
        blatt.getRange(pos + 2, 1, 1, zeile.length).setValues([zeile]);
      } else {
        blatt.appendRow(zeile);
        ids.push(String(k.kommentarId));
      }
    });
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function holeBlatt() {
  const datei = SpreadsheetApp.getActiveSpreadsheet();
  let blatt = datei.getSheetByName(BLATT) || datei.insertSheet(BLATT);
  if (blatt.getLastRow() === 0) {
    blatt.appendRow(SPALTEN);
    blatt.setFrozenRows(1);
  }
  return blatt;
}
```

### Schritt 3 — Als Web-App veröffentlichen

**Bereitstellen → Neue Bereitstellung → Typ „Web-App“**, dann:

| Einstellung | Wert |
|---|---|
| Ausführen als | **Ich** (dein Google-Konto) |
| Zugriff | **Jeder** |

Beim ersten Mal fragt Google nach Berechtigungen — bestätigen. Danach die
angezeigte Adresse kopieren; sie endet auf `/exec`.

> „Zugriff: Jeder“ ist nötig, weil die kommentierenden Browser nicht bei Google
> angemeldet sind. Wer die Adresse kennt, kann Zeilen schreiben — sie gehört
> also nicht in öffentlich einsehbaren Code, wenn das stört. Nach jeder
> Skript-Änderung: **Bereitstellen → Bereitstellungen verwalten → bearbeiten →
> neue Version**, sonst läuft weiter der alte Stand.

### Schritt 4 — Adresse eintragen

**Statische Einbindung** (`demo.js` bzw. dein Start-Code):

```js
Kommentare.init({
  container: '[data-kommentierbar]',
  autor: name,
  webhook: 'https://script.google.com/macros/s/AKfycb…/exec'
});
```

**WordPress** — einfach im Backend: **Einstellungen → Kommentator**, Adresse ins
Feld *Adresse* eintragen, speichern. Fertig, kein Code nötig.

<details>
<summary>Alternativ per <code>functions.php</code> (falls du die Adresse lieber im Theme führst)</summary>

```php
add_filter('kommentare_webhook', function () {
    return 'https://script.google.com/macros/s/AKfycb…/exec';
});
```

Der Filter hat Vorrang vor der gespeicherten Einstellung.
</details>

Fertig. Ab jetzt landet jeder neue, geänderte und gelöschte Kommentar
automatisch als Zeile in der Tabelle — von jeder Seite, auf der das Werkzeug
läuft. Im Menü erscheint zusätzlich **„Alle senden“**, das alle eigenen
Kommentare noch einmal komplett schickt.

### Was in der Tabelle steht

Zeitpunkt · Seiten-URL · Seitentitel · Autor:in · Art (Text/Element/Punkt) ·
Aktion (neu/geändert/gelöscht) · markierte Stelle · Kommentar · Kommentar-ID ·
Sitzung · Browser · Sprache · Bildschirm.

**Keine IP-Adresse.** Weder Browser-JS noch Apps Script bekommen sie zu sehen —
dafür bräuchte es einen vorgeschalteten Proxy (z. B. Cloudflare Worker). Sie ist
außerdem ein personenbezogenes Datum und damit DSGVO-relevant. Stattdessen gibt
es eine **anonyme Sitzungskennung**, die die Meldungen eines Tabs gruppiert und
beim Schließen verfällt. Ist die Sammelstelle aktiv, sagt der „?“-Hilfetext das
den Kommentierenden ausdrücklich.

### Grenzen

| Punkt | Bedeutung |
|---|---|
| Keine Empfangsbestätigung | Der Versand ist „abschicken und gut“ (CORS lässt keine lesbare Antwort zu). „Alle senden“ ist das Netz; Doppelte fängt die Kommentar-ID ab. |
| Kein Rückkanal | Die Tabelle füllt sich, aber die Seite liest **nicht** aus ihr. Gemeinsames Sehen läuft weiterhin über „Kommentare laden“ (Abschnitt 4). |
| Datenschutzerklärung | Unter *Werkzeuge → Datenschutz* liegt ein fertiger Textbaustein, sobald das Plugin aktiv ist. |
| Öffentliche Adresse | Die `/exec`-Adresse steht im Seitenquelltext jeder Seite, auf der das Werkzeug läuft — bei einem Client-Werkzeug unvermeidbar. Wer sie kennt, kann Zeilen schreiben. Deshalb ist „Im Frontend nur angemeldete Nutzer:innen" ab Werk gesetzt. |
| Apps-Script-Kontingente | Für Review-Runden weit ausreichend; bei sehr hohem Aufkommen sind Cloudflare Worker oder Airtable die robustere Wahl — die Adresse tauschst du einfach aus, die Nutzlast bleibt gleich. |

Aufbau der Nutzlast: [Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md).

---

## 9. Problembehebung

| Symptom | Ursache / Lösung |
|---|---|
| Markierungen sitzen nach Reload falsch | Der Text hat sich geändert. Für exakte Verankerung Text stabil halten. |
| Auf GitHub Pages erscheint der alte Stand | CDN-Cache: hart neu laden oder privates Fenster; sicherstellen, dass Pages-Quelle „Deploy from a branch / main“ ist. |
| Menü/Notizen fehlen | Stimmt der `container`-Selektor? Wird `kommentare.js` geladen (Konsole prüfen)? |
| Positionen verschieben sich | Container umfasst zu viel (Sidebar/Widgets). Enger fassen. |
| Nichts lässt sich markieren | `readOnly: true` gesetzt? Oder Auswahl außerhalb des Containers. |

Mehr Details: [Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md).
