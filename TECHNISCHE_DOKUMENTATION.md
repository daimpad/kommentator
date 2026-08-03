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
| `test/acceptance.mjs` | Headless-Akzeptanztest des Werkzeugs (Playwright) |
| `test/plugin-einstellungen.php` | Test der Plugin-Logik (Einstellungen, Filter-Vorrang) — ohne WordPress |
| `UEBERBLICK.md` | Was der Kommentator ist, wofür er taugt, für wen |

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
| `notes` | String | `'inline'` (Randspalte, Standard) oder `'floating'` (Notizen schweben im Panel, Seite bleibt unverändert) |
| `resizable` | Boolean | ziehbare Randspalte im Auto-Layout (Standard: `true`) |
| `notesWidth` | String | Startbreite der Randspalte, z. B. `'22rem'` |
| `elements` | Boolean | beliebige Web-Elemente (Boxen/Bilder) kommentierbar (Standard: `true`) |
| `points` | Boolean | Punkt an eine bestimmte Stelle „anheften" (Standard: `true`) |
| `exclude` | String | CSS-Selektor: passende Bereiche (inkl. Nachfahren) sind vom Kommentieren ausgenommen — Text, Element und Punkt (z. B. `'#wpadminbar'` oder `'.no-comments'`) |
| `email` | String | Empfänger für „Per E-Mail senden“; leer = Button aus |
| `emailSubject` | String | optionaler Betreff-Präfix (Standard: „Kommentare“ + Seitentitel) |
| `webhook` | String | `http(s)`-Adresse einer zentralen Sammelstelle; neue Kommentare werden dorthin gemeldet. Leer (Standard) = aus, es verlässt nichts den Browser |
| `webhookAuto` | Boolean | automatisch bei jeder Änderung melden (Standard: `true`); `false` = nur der Knopf „Alle senden“ |
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
| `instanz.send()` | schickt alle eigenen Kommentare an `webhook`; gibt die Anzahl zurück (`0` ohne `webhook`) |
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

### Element-Kommentare (Boxen/Bilder statt Text)

Mit `elements: true` (Standard) erscheint über den Notizen der Knopf **„Element
kommentieren"**. Im Element-Modus folgt ein Umriss dem Element unter dem Zeiger;
ein Klick wählt es (Host-Links/Buttons werden dabei abgefangen) und öffnet
dasselbe Kommentar-Popover. Gesetzte Element-Kommentare erscheinen als farbige
Rahmen mit nummeriertem Badge (eigene Overlay-Ebene, kein `<mark>`).

Datenmodell für Element-Annotationen (W3C `CssSelector`):

```json
{
  "id": "…", "type": "Annotation", "creator": { "name": "…" },
  "body": [{ "type": "TextualBody", "purpose": "commenting", "value": "…" }],
  "target": { "selector": [
    { "type": "CssSelector", "value": ":scope > div:nth-of-type(2) > p:nth-of-type(1)" },
    { "type": "TextQuoteSelector", "exact": "…Textausschnitt als Fallback…" }
  ]}
}
```

Verankerung: zuerst über den container-relativen CSS-Pfad (`:scope > …` bzw.
`#id > …`); scheitert das (DOM umgebaut), Fallback über den Text-Fingerprint
(`TextQuoteSelector.exact`) unter gleichartigen Elementen. Die Overlays werden
bei Scroll/Resize/Layoutänderung neu positioniert (ResizeObserver + gedrosselte
Listener). Wie bei Text gilt: verlorene Anker verschwinden still, wenn sich die
Seite zwischen den Runden strukturell ändert.

### Punkt-Kommentare (an eine bestimmte Stelle „anheften")

Mit `points: true` (Standard) erscheint über den Notizen der Knopf **„Punkt
anheften"**. Ein Klick heftet einen nummerierten **Pin** an genau die Stelle.
Verankert wird **Element-relativ**, nicht in absoluten Seiten-Pixeln: gespeichert
werden der CSS-Pfad des angeklickten Elements plus die relative Position darin
(`rx`, `ry` als Anteil 0–1). Beim Wiederladen wird das Element aufgelöst und der
Pixel als `rect.left + rx·Breite`, `rect.top + ry·Höhe` neu berechnet — so bleibt
der Punkt bei Reflow/Responsive am selben Ort des Elements.

W3C-Ablage: `CssSelector` + Media-`FragmentSelector` (`xywh=percent:rx,ry,0,0`):

```json
"target": { "selector": [
  { "type": "CssSelector", "value": ":scope > p:nth-of-type(1)" },
  { "type": "FragmentSelector",
    "conformsTo": "http://www.w3.org/TR/media-frags/",
    "value": "xywh=percent:62,50,0,0" },
  { "type": "TextQuoteSelector", "exact": "…Fingerprint…" }
]}
```

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

## Zentrale Sammelstelle (`webhook`)

Standardmäßig verlässt **kein** Kommentar den Browser. Wird `webhook` auf eine
`http(s)`-Adresse gesetzt, meldet das Werkzeug jede eigene Änderung zusätzlich
dorthin — gedacht für ein **Google Sheet hinter einem Apps-Script-Web-App**, aber
absichtlich generisch: derselbe Aufruf bedient auch einen Cloudflare Worker,
Formspree oder einen eigenen Endpunkt. Schritt-für-Schritt-Anleitung samt
fertigem Apps-Script: **[TUTORIAL.md, Abschnitt 8 „Kommentare in einem Google Sheet sammeln"](TUTORIAL.md#8-kommentare-in-einem-google-sheet-sammeln)**.

Gemeldet wird:

- **automatisch** nach jedem Anlegen, Bearbeiten und Löschen (`webhookAuto`,
  Standard an),
- **auf Knopfdruck** über „Alle senden“ im Menü (bzw. `instanz.send()`) — das
  Netz für den Fall, dass ein automatischer Versand ins Leere lief.

### Nutzlast

Ein `POST` mit JSON-Text. `eintraege` ist bewusst **flach**, damit die
Gegenstelle jeden Eintrag direkt als Tabellenzeile anhängen kann:

```json
{
  "generator": "kommentar-tool",
  "version": 1,
  "gesendet": "2026-07-31T09:12:33.004Z",
  "eintraege": [{
    "zeitpunkt":   "2026-07-31T09:12:33.004Z",
    "erstellt":    "2026-07-31T09:12:30.881Z",
    "seitenUrl":   "https://example.org/entwurf",
    "seitenTitel": "Entwurf Startseite",
    "autor":       "Vorname Nachname",
    "art":         "Text",
    "aktion":      "neu",
    "stelle":      "der markierte Wortlaut",
    "kommentar":   "Bitte kürzen.",
    "kommentarId": "amc1x2k3abcd",
    "sitzung":     "sm9k2lqx7f",
    "userAgent":   "Mozilla/5.0 …",
    "sprache":     "de-DE",
    "bildschirm":  "1440×900"
  }]
}
```

| Feld | Bedeutung |
|---|---|
| `art` | `Text`, `Element` oder `Punkt` |
| `aktion` | `neu`, `geändert` oder `gelöscht` — die Gegenstelle kann die Zeile entsprechend anlegen, aktualisieren oder markieren |
| `stelle` | markierter Wortlaut bzw. Element-Beschreibung („`section`: Über uns“) oder Punktposition („`img` (42%, 61%)“) |
| `kommentarId` | stabile Annotations-`id` — **der Schlüssel zum Entdoppeln** |
| `sitzung` | anonyme Sitzungskennung (siehe unten) |

### Keine IP-Adresse

Browser-JS kennt die eigene IP nicht, und ein Apps-Script-Web-App bekommt sie
ebenfalls nicht zu sehen — sie wäre nur über einen vorgeschalteten Proxy
(z. B. Cloudflare Worker) zu bekommen und ist als personenbezogenes Datum
DSGVO-relevant. Stattdessen trägt jeder Eintrag eine **anonyme Sitzungskennung**
(`sitzung`): eine Zufallszeichenkette, die die Meldungen eines Tabs gruppiert
und mit dem Schließen des Tabs verfällt (`sessionStorage`, kein `localStorage`,
kein Cookie, keine seitenübergreifende Wiedererkennung).

Ist die Sammelstelle aktiv, benennt der „?“-Hilfetext das ausdrücklich — er
listet auf, was verschickt wird, und dass keine IP dabei ist.

### Bündelung und die 64-KiB-Grenze

`sendBeacon()` und `fetch({keepalive:true})` teilen sich ein **gemeinsames
Kontingent von 64 KiB für alle offenen Anfragen**. Wird es überschritten, gibt
`sendBeacon` `false` zurück und `fetch` scheitert mit `TypeError` — beides
lautlos, wenn man nicht hinsieht.

Deshalb:

- Einträge werden vor dem Versand in **Bündel unter 56 KiB** aufgeteilt
  (byte-genau gemessen, Umlaute zählen doppelt).
- `keepalive` setzt nur der **automatische Einzelversand** — dort ist es
  sinnvoll, weil die Sendung einen Seitenwechsel überleben soll.
- Mehrere Bündel („Alle senden“) gehen als **gewöhnliches `fetch`** raus, das
  kein Kontingent kennt. Auch ein einzelner überlanger Eintrag (sehr langer
  Kommentar) nimmt diesen Weg, statt still zu scheitern.
- Lehnt `sendBeacon` ab, weil das Kontingent schon aufgebraucht ist, folgt der
  Versuch **ohne** `keepalive` — sonst scheiterte auch er.

Meldet der Browser doch einen Fehler (Netz weg, Adresse tot), landet er als
Hinweis am Knopf „Alle senden“.

### Warum „abschicken und gut“

Der Versand nutzt `navigator.sendBeacon()`, ersatzweise `fetch(…, {mode:
'no-cors', keepalive: true})` mit `Content-Type: text/plain`. Das ist Absicht:

- **`text/plain` vermeidet die CORS-Vorabanfrage.** Ein Apps-Script-Web-App
  kann auf `OPTIONS` keine CORS-Header liefern; mit `application/json` würde
  der Browser preflighten und der Aufruf scheitern. Apps Script liest den
  rohen Text über `e.postData.contents` — der JSON-Inhalt kommt unverändert an.
- **Die Antwort ist nicht auswertbar.** `no-cors` liefert eine „opaque
  response“; ob die Zeile wirklich geschrieben wurde, weiß der Browser nicht.
  Deshalb der Knopf „Alle senden“ als Netz und `kommentarId` zum Entdoppeln.
- **Kein Wiederholungs-Puffer.** Der Zustand bleibt im Speicher der Sitzung;
  fehlgeschlagene Meldungen gehen beim Neuladen verloren. Wer Zustellung
  garantieren will, exportiert zusätzlich JSON.

---

## Layout: in-flow vs. schwebend (ganze Seite kommentieren)

Standard (`notes: 'inline'`): das Werkzeug **umschließt den Container** und baut
eine zweispaltige Ansicht (Dokument + Randspalte). Das setzt einen abgegrenzten
Inhaltscontainer voraus.

Mit **`notes: 'floating'`** wird die Seite **nicht umgebaut**: der Container
bleibt unverändert an Ort und Stelle, Aktionsleiste **und** Notizen liegen in
einem schwebenden Panel hinter dem Button unten rechts (wie die Overlays). So
lässt sich ein beliebig großer Container kommentieren — bis hin zur **ganzen
Seite inklusive Header und Footer**:

```html
<script>
  Kommentare.init({ container: 'body', notes: 'floating', autor: '…' });
</script>
```

Damit `container: 'body'` sauber funktioniert, ignoriert die Textauswahl
automatisch `<script>`/`<style>` sowie alle werkzeugeigenen Bedienelemente
(Panel, Overlays, Popover; markiert mit `data-kommentare-ui`).

**Eingabefelder und Editoren:** Text zu markieren bedeutet dort *bearbeiten*,
nicht kommentieren. Auswahlen in `input`, `textarea`, `select` und
`[contenteditable]` (z. B. dem WordPress-Block-Editor) lösen daher **kein**
Kommentarfeld aus. Solche Bereiche lassen sich weiterhin per **Element** oder
**Punkt** kommentieren.

> Die in-flow-Variante (`inline`) reflowt die Seite und eignet sich für einen
> Artikel-/Content-Container; die schwebende Variante (`floating`) lässt das
> Seitenlayout unangetastet und ist für ganze Seiten gedacht.

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
ZIP hochladen) und aktivieren.

### Einstellungsseite (Einstellungen → Kommentator)

Das Wesentliche ist im Backend eintragbar — ohne `functions.php`. Gespeichert
wird als **eine** Option `kommentare_optionen` (Array):

| Schlüssel | Typ | Standard | Bedeutung |
|---|---|---|---|
| `webhook` | string | leer | Adresse der zentralen Sammelstelle; leer = aus |
| `webhook_auto` | 0/1 | `1` | automatisch bei jeder Änderung melden |
| `container` | string | `body` | kommentierbarer Bereich (CSS-Selektor) |
| `email` | string | leer | Empfänger für „Per E-Mail senden“ |
| `frontend` | 0/1 | `1` | im Frontend laden |
| `nur_eingeloggt` | 0/1 | **`1`** | im Frontend nur für angemeldete Nutzer:innen (sichere Vorgabe) |
| `backend` | 0/1 | `1` | in wp-admin laden |

Beim Speichern geprüft (`kommentare_optionen_pruefen()`): `webhook` nur `http(s)`
(`esc_url_raw` mit Schema-Whitelist), `email` über `sanitize_email`, `container`
über `sanitize_text_field` mit Rückfall auf `body`. Abgelehnte Eingaben melden
sich über `add_settings_error` sichtbar, statt still verworfen zu werden.

### Filter

Die Filter bleiben die vollständige Konfigurationsebene und haben **Vorrang**:
die gespeicherte Einstellung ist jeweils nur der Vorgabewert, den der Filter
bekommt. Bestehende `functions.php`-Einbindungen wirken unverändert weiter.

| Filter | Typ | Standard |
|---|---|---|
| `kommentare_container_selector` | string | Einstellung `container` (`body`) |
| `kommentare_notes` | string | `floating` (Notizen schweben; `inline` = Randspalte) |
| `kommentare_should_load` | bool | Einstellung `frontend`, standardmäßig auf angemeldete Nutzer:innen eingeschränkt |
| `kommentare_should_load_admin` | bool, `$hook` | Einstellung `backend` (`true`) |
| `kommentare_autor` | string | Anzeigename bzw. „Gast“ |
| `kommentare_read_only` | bool | `false` |
| `kommentare_help` | bool | `true` |
| `kommentare_theme_toggle` | bool | `true` |
| `kommentare_toolbar_mode` | string | `floating` |
| `kommentare_resizable` | bool | `true` |
| `kommentare_email` | string | Einstellung `email` (leer = Button aus) |
| `kommentare_elements` | bool | `true` |
| `kommentare_points` | bool | `true` |
| `kommentare_exclude` | string, `$is_admin` | Frontend `#wpadminbar`, Backend leer |
| `kommentare_webhook` | string | Einstellung `webhook` (leer = aus) |
| `kommentare_webhook_auto` | bool | Einstellung `webhook_auto` (`true`) |
| `kommentare_init_config` | array | vollständige init-Optionen (z. B. `texte`) |

Die gebündelten Assets unter `wordpress/kommentare-tool/assets/` sind Kopien der
Root-Dateien. Nach Änderungen synchronisieren:

```bash
npm run sync-plugin-assets
```

---

## Release: Plugin getrennt vom Werkzeug

Das WordPress-Plugin hat einen **eigenen, getaggten Release-Kanal** — unabhängig
vom statischen Werkzeug. So gibt es immer einen Stand, der **nur das Plugin**
enthält und direkt in WordPress installierbar ist.

| | Plugin | statisches Werkzeug |
|---|---|---|
| Tag-Schema | `wp-v<version>` (z. B. `wp-v1.9.0`) | keins nötig (läuft über GitHub Pages/`main`) |
| Version | Plugin-Header in `kommentare-tool.php` | — |
| Ergebnis | Release mit `kommentare-tool-<version>.zip` | Dateien im Repo-Root |

### ZIP lokal bauen

```bash
npm run build-plugin        # -> dist/kommentare-tool-<version>.zip
```

Das Skript (`scripts/build-plugin-zip.sh`) bricht ab, wenn

1. Header-Version, `KOMMENTARE_VERSION` und `Stable tag` in der `readme.txt`
   nicht übereinstimmen,
2. die gebündelten Assets von `kommentare.js`/`kommentare.css` abweichen
   (verhindert das Ausliefern eines veralteten Stands),
3. die PHP-Datei einen Syntaxfehler hat,
4. eine übergebene Version nicht zum Plugin-Header passt.

Das ZIP enthält genau einen Ordner `kommentare-tool/` (so erwartet es WordPress)
mit `kommentare-tool.php`, `readme.txt`, `assets/` und `LICENSE`.

### Release veröffentlichen

Neue Plugin-Version: Version in `kommentare-tool.php` (Header **und**
`KOMMENTARE_VERSION`) sowie `Stable tag` in der `readme.txt` erhöhen, einen
Changelog-Abschnitt `= <version> =` ergänzen — dann:

```bash
git tag wp-v1.9.1 && git push origin wp-v1.9.1
```

Der Workflow `.github/workflows/release-wp-plugin.yml` baut das ZIP, zieht die
Release-Notizen aus dem passenden Changelog-Abschnitt der `readme.txt` und
veröffentlicht den Release. Alternativ ohne Tag: **Actions → „WordPress-Plugin
Release" → Run workflow** mit der Version.

> Der Workflow braucht Schreibrechte für Releases (`permissions: contents: write`
> ist gesetzt). Falls die Repo-Einstellung *Settings → Actions → General →
> Workflow permissions* auf „Read repository contents" steht, dort auf
> „Read and write permissions" umstellen.

---

## Tests

Headless-Akzeptanztest (Playwright). Deckt alle Abnahmekriterien plus
Bearbeiten, i18n, `onChange`, prefix/suffix-Disambiguierung, A11y-Attribute,
Floating-Menü, ziehbare Spalte und das Demo-Modal ab.

```bash
npm install            # installiert playwright (devDependency)
npx playwright install chromium
npm test               # Werkzeug + Plugin-Logik
npm run test-plugin    # nur die Plugin-Logik (uebersprungen ohne PHP)
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
