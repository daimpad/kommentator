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
| `demo.html` / `demo.js` | Demo-Seite (Namens-Modal, Floating-Menü, Info-Modal). `demo.js` ist **nur** Demo-Glue, nicht Teil des Werkzeugs. |
| `index.html` | Wurzel-Weiterleitung auf `demo.html` für GitHub Pages. |
| `wordpress/kommentare-tool/` | WordPress-Plugin; `assets/` sind **Kopien** von `kommentare.{js,css}`. |
| `test/acceptance.mjs` | Headless-Playwright-Test, treibt `demo.html`. Einzige Testquelle. |
| `README.md` | Schicke Landingpage. | 
| `TECHNISCHE_DOKUMENTATION.md` | API, Datenmodell, Theming, Filter, Tests. |
| `TUTORIAL.md` | Schritt-für-Schritt Nutzung/Installation/Deploy. |

## Nicht aufweichen (Projektprinzipien)

- **Keine externen Abhängigkeiten**, kein Bundler, kein Build-Schritt, **kein
  `localStorage`**. Zustand lebt im Speicher der Sitzung.
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
  gescopte Abfragen).

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
npm test          # = node test/acceptance.mjs
```

Der Test lädt `demo.html`. Die Demo zeigt beim Laden ein **Namens-Modal**; im
Test bestätigt die Hilfsfunktion `load()` es (Autor „Gast“). `window.instanz`
existiert erst **nach** dem Modal.

## Deployment

GitHub Pages, Quelle **„Deploy from a branch“ → `main` / root**. Jeder Push auf
`main` baut automatisch neu (`.nojekyll` liegt im Root). Nicht auf „GitHub
Actions“ umstellen — für rein statische Dateien unnötig.

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
- Keine `console.log`-Reste, keine toten Optionen.
