# Kommentator — einbindbares Kommentar-Werkzeug

Textstellen in einem Fließtext **markieren**, dazu **Kommentare** in einer
Randspalte erfassen, als **JSON exportieren** und mehrere Exporte wieder
**einlesen und zusammenführen** — als statische, wiederverwendbare Dateien zum
Einbinden in bestehende Seiten.

- **Kein Build**, kein Bundler, **keine externen Abhängigkeiten**, kein
  `localStorage`. Vanilla-JS.
- Datenmodell nah an **W3C Web Annotation** (`TextQuoteSelector` +
  `TextPositionSelector`).
- Der Zustand lebt **im Speicher der Sitzung**. Geteilte Sichtbarkeit erfolgt
  asynchron ohne Backend: exportieren → einsammeln → importieren.

## Dateien

| Datei | Zweck |
|---|---|
| `kommentare.css` | Gekapselte Stile (Präfix `kommentare-`, themebar über CSS-Variablen, Dark-Mode) |
| `kommentare.js` | Das Werkzeug: `Kommentare.init(...)` |
| `demo.html` | Einbindungsbeispiel & Kurz-Dokumentation |
| `demo.js` | ausgelagerter Start-Code der Demo-Seite (nur für die Demo) |
| `index.html` | Wurzel-Weiterleitung auf `demo.html` (für GitHub Pages) |
| `wordpress/kommentare-tool/` | Installierbares WordPress-Plugin (bündelt die Assets) |
| `test/acceptance.mjs` | Headless-Akzeptanztest (Playwright) |

## Einbindung (statisch)

```html
<!-- 1. Stylesheet in den <head> -->
<link rel="stylesheet" href="kommentare.css">

<!-- 2. Zu kommentierenden Bereich auszeichnen -->
<div data-kommentierbar>
  … dein Fließtext …
</div>

<!-- 3. Skript vor </body> laden und starten -->
<script src="kommentare.js"></script>
<script>
  Kommentare.init({ container: '[data-kommentierbar]', autor: 'Vorname Nachname' });
</script>
```

Randspalte und Aktionsleiste werden automatisch erzeugt, wenn keine
Mount-Selektoren übergeben werden.

## Öffentliche API

`Kommentare.init(options)` → Instanz

| Option | Typ | Bedeutung |
|---|---|---|
| `container` | Selektor \| Element | **Pflicht.** Der kommentierbare Bereich |
| `autor` | String | Name für neue Kommentare |
| `margin` | Selektor \| Element | optionaler Mount für die Randspalte |
| `toolbar` | Selektor \| Element | optionaler Mount für die Aktionsleiste |
| `readOnly` | Boolean | nur ansehen, keine neuen Kommentare |
| `help` | Boolean | „?“-Hilfe-Button mit Kurzanleitung (Standard: `true`) |
| `themeToggle` | Boolean | Hell-/Dunkel-Umschalter in der Aktionsleiste (Standard: `false`) |
| `theme` | String | Anfangs-Theme: `'auto'` (Standard), `'light'`, `'dark'` |
| `texte` | Object | überschreibt einzelne UI-Texte (i18n) |
| `onCreate(anno)` | Funktion | nach dem Anlegen |
| `onUpdate(anno)` | Funktion | nach dem Bearbeiten |
| `onDelete(id)` | Funktion | nach dem Löschen |
| `onChange(annos)` | Funktion | nach jeder Änderung (z. B. um extern zu speichern) |
| `onThemeChange(theme)` | Funktion | nach Umschalten des Themes (z. B. um die Seite mitzufärben) |

Instanz-Methode `instanz.setTheme('auto'\|'light'\|'dark')` schaltet das Theme
auch programmatisch um.

Instanz-Methoden:

| Methode | Ergebnis |
|---|---|
| `instanz.export()` | JSON-String (nur eigene Kommentare des aktuellen Autors) |
| `instanz.import(jsonOrArray)` | führt Annotationen zusammen, **dedupliziert nach `id`** |
| `instanz.getAnnotations()` | Array (W3C-nahe Annotationen) |
| `instanz.destroy()` | entfernt Markierungen, stellt DOM-Ausgangszustand wieder her |

Mehrere Instanzen auf einer Seite stören sich nicht (instanz-lokaler Zustand).

## Datenmodell

Jede Annotation (W3C-Web-Annotation-nah):

```json
{
  "id": "…",
  "type": "Annotation",
  "created": "ISO-8601",
  "creator": { "name": "…" },
  "body": [{ "type": "TextualBody", "purpose": "commenting", "value": "…" }],
  "target": { "selector": [
    { "type": "TextQuoteSelector", "exact": "…", "prefix": "…", "suffix": "…" },
    { "type": "TextPositionSelector", "start": 0, "end": 0 }
  ]}
}
```

Verankerung beim Einlesen: zuerst über `TextPositionSelector`; passt der
Wortlaut dort nicht mehr, Fallback über `TextQuoteSelector.exact`. Kommt der
Wortlaut mehrfach vor, wird über `prefix`/`suffix` die richtige Stelle gewählt.
Markierungen funktionieren knotenübergreifend (über mehrere Absätze und
verschachtelte Elemente hinweg).

## Zu welcher Seite gehören die Kommentare?

`instanz.export()` schreibt eine Hülle um die Annotationen, die die Herkunft
festhält — so erkennt der Betrieb beim Einsammeln, zu welcher Seite eine Datei
gehört:

```json
{
  "generator": "kommentar-tool",
  "source": "https://example.org/dokument",
  "sourceTitle": "Dokumenttitel",
  "author": "Vorname Nachname",
  "exported": "ISO-8601",
  "annotations": [ … ]
}
```

`source` ist die volle Seiten-URL, `sourceTitle` der Seitentitel zum
Export-Zeitpunkt.

## Gestaltung / Theme

Alle Farben liegen als CSS-Variablen auf `.kommentare-scope`. Zum Anpassen die
Werte nach `kommentare.css` überschreiben. Ein Dark-Mode ist enthalten
(automatisch per `prefers-color-scheme`, oder explizit per Klasse
`kommentare-dark` bzw. `kommentare-light` am Scope-Element). Mit
`themeToggle: true` erscheint ein ☾/☀-Umschalter in der Aktionsleiste; per
`onThemeChange` lässt sich die restliche Seite mitfärben (so macht es `demo.js`).

## WordPress

Zwei Wege:

**A) Plugin (empfohlen).** Ordner `wordpress/kommentare-tool/` nach
`wp-content/plugins/` kopieren (oder als ZIP hochladen) und aktivieren. Auf
einzelnen Beiträgen/Seiten wird `.entry-content` kommentierbar. Anpassung über
Filter — siehe `wordpress/kommentare-tool/readme.txt`
(`kommentare_container_selector`, `kommentare_should_load`, `kommentare_autor`,
`kommentare_read_only`, `kommentare_init_config`).

**B) Child-Theme.** `kommentare.css`/`kommentare.js` ins Theme legen und in der
`functions.php` per `wp_enqueue_style`/`wp_enqueue_script` einbinden, dann per
`wp_add_inline_script` den `init`-Aufruf mit `container: '.entry-content'`
ergänzen.

> Wichtig: Der Container-Selektor muss **nur den Fließtext** umfassen (nicht
> Sidebar/„Ähnliche Beiträge"), sonst verschieben sich die Zeichenpositionen.

## Tests

Headless-Akzeptanztest (Playwright), deckt alle Abnahmekriterien plus
Bearbeiten, i18n, `onChange`, Disambiguierung und A11y-Attribute ab:

```bash
npm install            # installiert playwright (devDependency)
npx playwright install chromium
npm test
```

## Deployment (GitHub Pages)

Die vier statischen Dateien im Repo-Root werden direkt ausgeliefert:
Repo → **Settings → Pages → Source: „Deploy from a branch" → `main` / root**.
`index.html` leitet auf `demo.html` weiter.

## Zugriffsschutz

Das Namensfeld dient der **Zuordnung**, nicht dem Zugriffsschutz. Echten Schutz
(„Name + Passwort") realisiert der Betrieb auf Server-Ebene, z. B. per HTTP
Basic Auth (`.htaccess`) oder — in WordPress — per Login/Rollen.

## Lizenz

[MIT](LICENSE) © 2026 Damian Paderta.
