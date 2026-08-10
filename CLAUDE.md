# CLAUDE.md

Leitfaden für KI-Agenten (und Menschen), die in diesem Repository arbeiten.

## Projekt in einem Satz

Ein einbindbares, **statisches** Kommentar-Werkzeug (Vanilla-JS): Textstellen
markieren, kommentieren, als JSON exportieren und mehrere Exporte
zusammenführen — ohne Server, ohne Build, ohne externe Abhängigkeiten.

## Architektur & wichtige Dateien

| Pfad | Rolle |
|---|---|
| `kommentare.js` | Kernwerkzeug. `Kommentare.init(options)` → Instanz. Eine IIFE, `Instanz`-Prototyp, W3C-Konvertierung. |
| `kommentare.css` | Alle Stile, unter dem Präfix `kommentare-` gekapselt. Themebar über CSS-Variablen auf `.kommentare-scope`. |
| `demo.html` / `demo.js` | Demo-Seite (Namens-Modal, Floating-Menü). `demo.js` ist **nur** Demo-Glue, nicht Teil des Werkzeugs. |
| `demo.css` | Erscheinungsbild der Demo-Seite im **nozilla-CI**. Färbt das Werkzeug ausschließlich über dessen CSS-Variablen um — `kommentare.css` bleibt neutral. |
| `nozilla/` | Aus [nozilla-ci](https://github.com/daimpad/nozilla-ci) übernommen: Logo und zwei Schriftschnitte (OFL). Nur für die Demo-Seite. |
| `index.html` | Wurzel-Weiterleitung auf `demo.html` für GitHub Pages. |
| `wordpress/kommentare-tool/` | WordPress-Plugin; `assets/` sind **Kopien** von `kommentare.{js,css}`. |
| `test/acceptance.mjs` | Headless-Playwright-Test, treibt `demo.html`. Testquelle fürs Werkzeug. |
| `test/plugin-einstellungen.php` | Test der Plugin-Logik (Einstellungsseite, Filter-Vorrang) gegen eine WordPress-Attrappe. Läuft mit, wenn PHP vorhanden ist. |
| `README.md` | Schicke Landingpage. |
| `UEBERBLICK.md` | Ausführliche Einordnung: was/wofür/für wen. Nicht-technisch. |
| `TECHNISCHE_DOKUMENTATION.md` | API, Datenmodell, Theming, Filter, Tests. |
| `TUTORIAL.md` | Schritt-für-Schritt Nutzung/Installation/Deploy. |

## Nicht aufweichen (Projektprinzipien)

- **Keine externen Abhängigkeiten**, kein Bundler, kein Build-Schritt, **kein
  `localStorage`**. Zustand lebt im Speicher der Sitzung.
- **Ohne Konfiguration verlässt nichts den Browser.** Die Sammelstelle
  (`webhook`) ist opt-in und muss es bleiben: leer = kein Versand, kein Knopf.
  Gemeldet werden nie IP-Adressen, nur eine anonyme Sitzungskennung
  (`sessionStorage`); ist sie aktiv, benennt der Hilfetext den Versand.
- **Datenmodell W3C-Web-Annotation-nah** beibehalten (`TextQuoteSelector` +
  `TextPositionSelector`). Verankerung: Position zuerst, Fallback über Wortlaut,
  Disambiguierung per `prefix`/`suffix`.
- **Deutsche UI-Texte**, zentral im `TEXTE`-Objekt; pro Instanz via `texte`
  überschreibbar.
- **CSS-Klassennamen stabil halten** — `kommentare.js` und `test/acceptance.mjs`
  hängen daran. Umbenennungen brechen Tests.
- Das **Namensfeld ist kein Zugriffsschutz** (nur Zuordnung). Echten Schutz
  regelt der Betrieb serverseitig (HTTP Basic Auth / WordPress-Login).
- Barrierefreiheit wahren: sichtbarer Fokus, `prefers-reduced-motion`, ARIA an
  Markierungen/Notizen/Modalen, responsiv.
- Mehrere Instanzen pro Seite dürfen sich nicht stören (instanz-lokaler Zustand,
  gescopte Abfragen); zwei Instanzen auf **demselben** Container werden abgelehnt.
- **`<body>`/`<html>` als Container erzwingen schwebende Notizen.** Das
  in-flow-Layout würde den Container umschließen und damit `<body>` aushängen —
  `document.body` wäre `null` und die ganze Seite tot. Nicht aufweichen.
- **`normalize()` nur am betroffenen Elternknoten**, nie dokumentweit: bei
  `container: body` läge sonst fremd verwaltetes DOM (Block-Editor) darunter.

## Nach jeder Änderung

1. **Tests laufen lassen** (siehe unten) — müssen grün sein.
2. Bei Änderungen an `kommentare.js`/`kommentare.css`: **Plugin-Assets
   synchronisieren**: `npm run sync-plugin-assets`.
3. Neue Funktionen: einen Check in `test/acceptance.mjs` ergänzen und Doku
   (`TECHNISCHE_DOKUMENTATION.md`, ggf. `TUTORIAL.md`, README) aktualisieren.

## Tests

```bash
npm install
npx playwright install chromium
npm test          # Werkzeug (Playwright) + Plugin-Logik (PHP)
npm run test-plugin  # nur die Plugin-Logik
```

Der Test lädt `demo.html`. Die Demo zeigt beim Laden ein **Namens-Modal**; im
Test bestätigt die Hilfsfunktion `load()` es (Autor „Gast“). `window.instanz`
existiert erst **nach** dem Modal.

## Deployment

GitHub Pages, Quelle **„Deploy from a branch“ → `main` / root**. Jeder Push auf
`main` baut automatisch neu (`.nojekyll` liegt im Root). Nicht auf „GitHub
Actions“ umstellen — für rein statische Dateien unnötig.

## Release: Plugin getrennt vom Werkzeug

Das **WordPress-Plugin** hat einen eigenen Release-Kanal, das statische Werkzeug
läuft weiter über Pages/`main`. Diese Trennung nicht vermischen.

- Tag-Schema **`wp-v<version>`** (z. B. `wp-v1.9.0`) → Workflow
  `.github/workflows/release-wp-plugin.yml` baut `kommentare-tool-<version>.zip`
  und veröffentlicht den Release; Notizen kommen aus dem Changelog-Abschnitt
  `= <version> =` der `wordpress/kommentare-tool/readme.txt`.
- Vor dem Tag: Version an **drei** Stellen erhöhen — Plugin-Header,
  `KOMMENTARE_VERSION`, `Stable tag` in der `readme.txt` — plus Changelog-
  Abschnitt. `npm run build-plugin` prüft das und bricht bei Abweichung ab
  (auch bei nicht synchronisierten Assets).
- `dist/` ist Build-Ausgabe und liegt in `.gitignore`.

## Git-Workflow

- Entwicklung auf einem Feature-Branch, PR gegen `main`.
- Ist der zugehörige PR bereits **gemergt**, gilt Folgearbeit als frische
  Änderung: Branch neu von `origin/main` ziehen und einen **neuen** PR öffnen —
  nicht auf gemergter Historie stapeln.
- Commits/PRs klar und auf Deutsch beschreiben.

## Konventionen

- Reines ES5-taugliches JS in `kommentare.js` (var, Funktionsausdrücke) — es
  soll ohne Transpiler überall laufen.
- CSS: neue Regeln unter dem `kommentare-`-Präfix; Farben/Radien/Schatten als
  CSS-Variablen, damit alles themebar bleibt.
- **Erscheinungsbild gehört in `demo.css`, nicht in `kommentare.css`.** Die
  Demo trägt das nozilla-CI (Papier `#FFFEE5`, Tinte `#000`, Signal-Grün
  `#00FF9C` nur für Aktionen, Radius immer 0, harte Versatz-Schatten). Das
  Werkzeug selbst bleibt farblich neutral — sonst kann es niemand sonst
  einsetzen.
- **Keine Farb-Emoji** — weder in der Oberfläche noch in den Exporten noch in
  der Doku. Sie lassen sich nicht einfärben, nicht themen und sehen auf jedem
  System anders aus; das CI schließt sie aus. Einfarbige Zeichen als Symbol
  (`☰`, `☾`/`☀`, `⬚`, `◆`) sind in Ordnung.
- **Auch in `demo.css` Farben aus den Variablen nehmen, nie festes `#000`.**
  Sonst steht im Dunkelmodus schwarze Schrift auf schwarzer Fläche. Fest
  schwarz bleibt nur, was auf dem Signal-Grün liegt — das wechselt mit dem
  Modus nicht.
- Keine `console.log`-Reste, keine toten Optionen.
