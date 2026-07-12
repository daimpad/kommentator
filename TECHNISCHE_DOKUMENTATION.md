# Technische Dokumentation

Referenz für Entwickler:innen: API, Optionen, Datenmodell, Theming, Tests und
interne Funktionsweise des Kommentar-Werkzeugs.

- Einsteiger:innen → siehe [TUTORIAL.md](TUTORIAL.md)
- Überblick → siehe [README.md](README.md)

---

## Dateien

| Datei | Zweck |
|---|---|
| `kommentare.js` | Das Werkzeug: `Kommentare.init(...)` |
| `kommentare.css` | Gekapselte Stile (Präfix `kommentare-`, themebar über CSS-Variablen, Dark-Mode) |
| `demo.html` | Einbindungsbeispiel / Spielwiese |
| `demo.js` | ausgelagerter Start-Code der Demo-Seite (nur für die Demo) |
| `index.html` | Wurzel-Weiterleitung auf `demo.html` (für GitHub Pages) |
| `wordpress/kommentare-tool/` | installierbares WordPress-Plugin (bündelt die Assets) |
| `test/acceptance.mjs` | Headless-Akzeptanztest (Playwright) |

Grundprinzipien: **kein Build**, kein Bundler, **keine externen Abhängigkeiten**,
**kein `localStorage`**. Der Zustand lebt im Speicher der Sitzung.

---

## Öffentliche API

`Kommentare.init(options)` → Instanz

| Option | Typ | Bedeutung |
|---|---|---|
| `container` | Selektor \| Element | **Pflicht.** Der kommentierbare Bereich |
| `autor` | String | Name für neue Kommentare |
| `margin` | Selektor \| Element | optionaler Mount für die Randspalte |
| `toolbar` | Selektor \| Element | optionaler Mount für die Aktionsleiste |
| `readOnly` | Boolean | nur ansehen, keine neuen Kommentare |
| `toolbarMode` | String | `'bar'` (Balken oben, Standard) oder `'floating'` (Button unten rechts, der ein Menü öffnet) |
| `resizable` | Boolean | ziehbare Randspalte im Auto-Layout (Standard: `true`) |
| `notesWidth` | String | Startbreite der Randspalte, z. B. `'22rem'` |
| `email` | String | Empfänger für „Per E-Mail senden“; leer = Button aus |
| `emailSubject` | String | optionaler Betreff-Präfix (Standard: „Kommentare“ + Seitentitel) |
| `help` | Boolean | „?“-Hilfe-Button mit Kurzanleitung (Standard: `true`) |
| `themeToggle` | Boolean | Hell-/Dunkel-Umschalter (Standard: `false`) |
| `theme` | String | Anfangs-Theme: `'auto'` (Standard), `'light'`, `'dark'` |
| `texte` | Object | überschreibt einzelne UI-Texte (i18n) |
| `onCreate(anno)` | Funktion | nach dem Anlegen (W3C-Annotation) |
| `onUpdate(anno)` | Funktion | nach dem Bearbeiten |
| `onDelete(id)` | Funktion | nach dem Löschen |
| `onChange(annos)` | Funktion | nach jeder Änderung (z. B. um extern zu speichern) |
| `onThemeChange(theme)` | Funktion | nach Umschalten des Themes (z. B. um die Seite mitzufärben) |

### Instanz-Methoden

| Methode | Ergebnis |
|---|---|
| `instanz.export()` | JSON-String (nur eigene Kommentare des aktuellen Autors) |
| `instanz.exportMarkdown()` | lesbare „Nur Notizen“-Fassung (Markdown) mit URL, Wortlaut, Kommentar, Autor:in, Datum |
| `instanz.import(jsonOrArray)` | führt Annotationen zusammen, **dedupliziert nach `id`**; gibt die Anzahl neu hinzugefügter zurück |
| `instanz.getAnnotations()` | Array (W3C-nahe Annotationen) |
| `instanz.setTheme('auto'\|'light'\|'dark')` | schaltet das Theme programmatisch |
| `instanz.destroy()` | entfernt Markierungen, stellt DOM-Ausgangszustand wieder her |

Mehrere Instanzen auf einer Seite stören sich nicht (instanz-lokaler Zustand,
gescopte DOM-Abfragen).

### Beispiel mit allen gängigen Optionen

```html
<link rel="stylesheet" href="kommentare.css">
<div data-kommentierbar> … dein Fließtext … </div>
<script src="kommentare.js"></script>
<script>
  const inst = Kommentare.init({
    container: '[data-kommentierbar]',
    autor: 'Vorname Nachname',
    toolbarMode: 'floating',
    resizable: true,
    themeToggle: true,
    theme: 'auto',
    onChange: (annos) => console.log(annos.length + ' Kommentare'),
  });
</script>
```

---

## Datenmodell

Jede Annotation ist nah an **W3C Web Annotation**:

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

### Verankerung beim Einlesen

1. Zuerst über `TextPositionSelector` (Zeichenposition).
2. Passt der Wortlaut dort nicht mehr, Fallback über `TextQuoteSelector.exact`.
3. Kommt der Wortlaut **mehrfach** vor, wählt `prefix`/`suffix` die richtige Stelle.

Markierungen funktionieren **knotenübergreifend** (über mehrere Absätze und
verschachtelte Elemente hinweg). Voraussetzung für exakte Wiederverankerung: der
Ausgangstext bleibt zwischen den Runden unverändert.

### Export-Hülle (Herkunft der Kommentare)

`instanz.export()` schreibt eine Hülle um die Annotationen:

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
Export-Zeitpunkt — so ist beim Einsammeln erkennbar, zu welcher Seite eine
Datei gehört.

---

## Download-Optionen & Versand

Im Menü stehen unter „Herunterladen“:

| Option | Ergebnis |
|---|---|
| **Kommentare (JSON)** | vollständiger W3C-Export (`export()`) — zum Wieder-Einlesen/Zusammenführen |
| **Notizen (Markdown)** | lesbare `.md`-Datei (`exportMarkdown()`) mit URL, Wortlaut, Kommentar, Autor:in, Datum |
| **Als PDF / drucken** | `window.print()`; ein `@media print`-Stil blendet Bedienelemente aus und setzt Dokument + Notizen einspaltig — im Systemdialog „Als PDF speichern“ |
| **Per E-Mail senden** | nur wenn `email` gesetzt: lädt die JSON-Datei herunter und öffnet einen `mailto:`-Entwurf an die Adresse |

**Bewusste Grenzen (technisch unvermeidbar):**

- **`mailto:` kann keine Datei anhängen** (RFC 6068 kennt keinen Anhang-Parameter).
  Der Button lädt daher die Datei herunter und öffnet einen vorbefüllten
  Entwurf; kleine Notizmengen stehen inline im Text, sonst ein Hinweis zum
  manuellen Anhängen. Ein automatischer Anhang-Versand ginge nur über
  `navigator.share({files})` (v. a. mobil) oder ein Backend — Letzteres ist
  ausgeschlossen.
- **Der „Screenshot“ ist ein Druck-PDF**, kein Raster-PNG. Ein pixelgenaues PNG
  beliebiger Seiten ist clientseitig ohne externe Bibliothek nicht zuverlässig
  (Canvas-Tainting bei Cross-Origin-Bildern, fehlende externe Fonts). Der
  Druckweg ist dafür robust, vektoriell und erfasst die volle Seite.

---

## Gestaltung / Theme

Alle Farben, Radien und Schatten liegen als CSS-Variablen auf
`.kommentare-scope`. Zum Anpassen die Werte nach `kommentare.css` überschreiben
(eigenes Stylesheet nach diesem laden). Dark-Mode ist enthalten:

- automatisch per `prefers-color-scheme`,
- oder explizit per Klasse `kommentare-dark` / `kommentare-light` am Scope-Element,
- oder per `themeToggle: true` (☾/☀-Umschalter) bzw. `instanz.setTheme(...)`.

Mit `onThemeChange` lässt sich die restliche Seite mitfärben (so macht es
`demo.js` über `data-theme` am `<html>`).

---

## UI-Texte / i18n

Alle sichtbaren Texte liegen im `TEXTE`-Objekt (`Kommentare.TEXTE`, Standard
Deutsch). Pro Instanz überschreibbar:

```js
Kommentare.init({
  container: '[data-kommentierbar]',
  texte: { notizenKopf: 'Notes', speichern: 'Save', hilfeTitel: 'How it works' }
});
```

---

## WordPress-Plugin

Ordner `wordpress/kommentare-tool/` nach `wp-content/plugins/` kopieren (oder als
ZIP hochladen) und aktivieren. Konfiguration über Filter:

| Filter | Typ | Standard |
|---|---|---|
| `kommentare_container_selector` | string | `.entry-content` |
| `kommentare_should_load` | bool | `is_singular()` |
| `kommentare_autor` | string | Anzeigename bzw. „Gast“ |
| `kommentare_read_only` | bool | `false` |
| `kommentare_help` | bool | `true` |
| `kommentare_theme_toggle` | bool | `true` |
| `kommentare_toolbar_mode` | string | `floating` |
| `kommentare_resizable` | bool | `true` |
| `kommentare_init_config` | array | vollständige init-Optionen (z. B. `texte`) |

Die gebündelten Assets unter `wordpress/kommentare-tool/assets/` sind Kopien der
Root-Dateien. Nach Änderungen synchronisieren:

```bash
npm run sync-plugin-assets
```

---

## Tests

Headless-Akzeptanztest (Playwright). Deckt alle Abnahmekriterien plus
Bearbeiten, i18n, `onChange`, prefix/suffix-Disambiguierung, A11y-Attribute,
Floating-Menü, ziehbare Spalte und das Demo-Modal ab.

```bash
npm install            # installiert playwright (devDependency)
npx playwright install chromium
npm test
```

Optional mit vorinstalliertem Chromium:

```bash
CHROMIUM_PATH=/pfad/zu/chrome node test/acceptance.mjs
```

---

## Barrierefreiheit

- Sichtbarer Tastatur-Fokus überall; `prefers-reduced-motion` respektiert.
- Markierungen sind fokussierbar (`role="button"`, `tabindex`, `aria-label`) und
  per Enter/Space aktivierbar; Notizen ebenso.
- Modale (Hilfe, Info) schließen per ×, Escape und Klick auf den Hintergrund.
- Responsiv bis mobil (Randspalte klappt unter den Text).

---

## Zugriffsschutz (bewusste Entscheidung)

Das Namensfeld dient der **Zuordnung**, nicht dem Zugriffsschutz. Echten Schutz
(„Name + Passwort“) realisiert der Betrieb auf Server-Ebene, z. B. per HTTP
Basic Auth (`.htaccess`) oder — in WordPress — per Login/Rollen. Geteilte
Sichtbarkeit ist asynchron und ohne Backend: exportieren → einsammeln →
importieren.
