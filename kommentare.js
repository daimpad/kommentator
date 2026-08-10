/* ============================================================================
   kommentare.js — einbindbares Kommentar-Werkzeug (Vanilla-JS, kein Build)
   ----------------------------------------------------------------------------
   Textstellen markieren, kommentieren, als JSON exportieren und mehrere
   Exporte wieder zusammenführen. Keine externen Abhängigkeiten, kein
   localStorage. Der Zustand lebt im Speicher der Sitzung.

   Öffentliche API:
     Kommentare.init(options) -> Instanz
       options: {
         container : Selektor | Element   (Pflicht, der kommentierbare Bereich)
         autor     : String               (Name für neue Kommentare)
         margin    : Selektor | Element    (optionaler Mount für die Randspalte)
         toolbar   : Selektor | Element    (optionaler Mount für die Aktionsleiste)
         readOnly  : Boolean               (nur ansehen, keine neuen Kommentare)
         texte     : Object                (überschreibt einzelne UI-Texte, i18n)
         webhook   : String                (optionale https-Adresse, an die neue
                                            Kommentare gemeldet werden, z. B. ein
                                            Google-Apps-Script-Web-App. Leer = aus)
         webhookAuto: Boolean              (automatisch bei jeder Änderung senden;
                                            Standard: an, sobald webhook gesetzt ist)
         webhookToken: String              (optionales Geheimwort; wird als
                                            'token' mitgeschickt, damit die
                                            Gegenstelle Fremdeinträge abweist)
         onCreate  : (anno) => void        (Callback nach dem Anlegen)
         onUpdate  : (anno) => void        (Callback nach dem Bearbeiten)
         onDelete  : (id)   => void        (Callback nach dem Löschen)
         onChange  : (annos) => void       (Callback nach jeder Änderung; z. B.
                                            um extern zu speichern – ohne Backend)
       }
     instanz.export()          -> JSON-String (nur eigene Kommentare)
     instanz.send()            -> sendet alle eigenen Kommentare an den webhook
     instanz.import(jsonOrArr) -> führt Annotationen zusammen (dedupliziert nach id)
     instanz.getAnnotations()  -> Array (W3C-nahe Annotationen)
     instanz.destroy()         -> entfernt Markierungen, stellt DOM wieder her
   ========================================================================== */
(function (global) {
  "use strict";

  /* Zentral gebündelte, leicht anpassbare deutsche UI-Texte (Standard).
     Pro Instanz über options.texte überschreibbar (mehrsprachige Einbindung). */
  var TEXTE = {
    notizenKopf:        "Notizen",
    leer:               "Noch keine Kommentare. Markiere eine Textstelle, um zu beginnen.",
    kommentarPlatzhalter:"Kommentar…",
    abbrechen:          "Abbrechen",
    speichern:          "Speichern",
    bearbeiten:         "bearbeiten",
    loeschen:           "löschen",
    ladenBtn:           "Kommentare laden",
    ladenTitel:         "Exportierte Kommentar-Dateien einlesen und zusammenführen",
    herunterladenBtn:   "Meine Kommentare herunterladen",
    herunterladenJson:  "Kommentare (JSON)",
    herunterladenMd:    "Notizen (Markdown)",
    druckenBtn:         "Als PDF / drucken",
    emailBtn:           "Per E-Mail senden",
    emailBetreff:       "Kommentare",
    emailIntro:         "Anbei meine Kommentare",
    emailAnhangHinweis: "(Bitte die soeben heruntergeladene Datei anhängen.)",
    downloadKopf:       "Herunterladen",
    keineNotizen:       "Keine eigenen Kommentare.",
    quelleLabel:        "Quelle:",
    exportiertLabel:    "Exportiert:",
    titel:              "Kommentar-Tool",
    autorLabel:         "Autor:in:",
    platzhalterName:    "—",
    einKommentar:       " Kommentar",
    mehrereKommentare:  " Kommentare",
    leseFehler:         "Datei konnte nicht gelesen werden: ",
    markierungAria:     "Kommentar",        // Präfix für aria-label der Markierung
    notizSpringt:       "zur Markierung springen",
    von:                "von",
    hilfeBtn:           "?",
    hilfeAria:          "Hilfe anzeigen",
    hilfeTitel:         "So funktioniert’s",
    hilfeSchliessen:    "Schließen",
    themeAria:          "Hell-/Dunkelmodus umschalten",
    hilfeSchritte: [
      ["Markieren", "Textstelle mit der Maus oder per Touch markieren, um sie zu kommentieren."],
      ["Verbinden", "Klick auf eine Markierung oder eine Notiz hebt beide gemeinsam hervor."],
      ["Bearbeiten", "Eigene Notizen lassen sich über „bearbeiten“ und „löschen“ ändern."],
      ["Herunterladen", "„Meine Kommentare herunterladen“ speichert die eigenen Kommentare als JSON-Datei."],
      ["Zusammenführen", "„Kommentare laden“ liest exportierte Dateien ein und führt sie zusammen (ohne Duplikate)."]
    ],
    hilfeSenden: ["Senden", "Neue Kommentare gehen automatisch an die zentrale Tabelle; „Alle senden“ schickt sie noch einmal komplett."],
    hilfeHinweisSenden: "Diese Seite meldet neue Kommentare an eine zentrale Tabelle: Kommentar, markierte Stelle, Name, Seiten-URL, Zeitpunkt sowie Browser, Sprache und Bildschirmgröße. Keine IP-Adresse — nur eine anonyme Sitzungskennung, die mit dem Schließen des Tabs verfällt.",
    hilfeHinweis: "Das Namensfeld ordnet Kommentare nur einer Person zu — es ist kein Zugriffsschutz. Beim Export werden die Seiten-URL und der Seitentitel mitgespeichert, damit erkennbar bleibt, zu welcher Seite die Kommentare gehören.",
    menuAria:           "Kommentar-Menü öffnen",
    menuTitel:          "Kommentator",
    groesseAria:        "Randspalte breiter oder schmaler ziehen",
    elementBtn:         "Element kommentieren",
    elementBtnAktiv:    "Element-Auswahl beenden",
    elementAria:        "Element-Auswahl umschalten",
    elementLabel:       "Element",
    punktBtn:           "Punkt anheften",
    punktBtnAktiv:      "Anheften beenden",
    punktAria:          "Punkt-Modus umschalten",
    punktLabel:         "Punkt",
    sendenBtn:          "Alle senden",
    sendenTitel:        "Alle eigenen Kommentare an die zentrale Tabelle senden",
    // „Abgeschickt" statt „Gesendet": eine Empfangsbestätigung gibt es
    // technisch nicht (siehe _webhookPost), das soll der Text nicht behaupten.
    sendenOk:           "Abgeschickt",
    sendenLeer:         "Nichts zu senden",
    sendenFehler:       "Senden nicht möglich",
    artText:            "Text",
    artElement:         "Element",
    artPunkt:           "Punkt",
    aktionNeu:          "neu",
    aktionGeaendert:    "geändert",
    aktionGeloescht:    "gelöscht"
  };

  var idSeed = 0; // fortlaufend, damit gleichzeitig erzeugte Ids eindeutig bleiben

  /* Größte Nutzlast einer Sendung an die Sammelstelle. sendBeacon und
     fetch({keepalive:true}) begrenzen den Rumpf auf 64 KiB; darüber scheitert
     der Versand still. Etwas Luft lassen (Header, Mehrbyte-Zeichen). */
  var WEBHOOK_MAX = 56 * 1024;

  /* Länge in BYTES, nicht in Zeichen: Umlaute und Emoji brauchen mehrere
     Bytes, und die Grenze des Browsers zählt Bytes. */
  function byteLen(s) {
    try { return new Blob([s]).size; }
    catch (_) { return s.length * 3; } // Worst-Case-Schätzung
  }

  /* -------------------------------------------------------------------- */
  /* Hilfsfunktionen                                                       */
  /* -------------------------------------------------------------------- */
  // Ein ungültiger Selektor darf nicht werfen: bei zusammengefasstem JS
  // (Optimierungs-Plugins) risse ein Throw das ganze Bündel mit.
  function resolve(elOrSel) {
    if (!elOrSel) return null;
    if (typeof elOrSel !== "string") return elOrSel.nodeType === 1 ? elOrSel : null;
    try { return document.querySelector(elOrSel); }
    catch (_) { return null; }
  }
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function newId() {
    idSeed += 1;
    return "a" + Date.now().toString(36) + idSeed.toString(36) +
           Math.random().toString(36).slice(2, 6);
  }
  // Sicheres Einbetten einer (ggf. importierten, fremden) id in einen CSS-Selektor.
  function cssEscape(s) {
    s = String(s);
    if (global.CSS && typeof global.CSS.escape === "function") return global.CSS.escape(s);
    return s.replace(/[^\w-]/g, function (ch) {
      return "\\" + ch;
    });
  }
  /* Anonyme Sitzungskennung: gruppiert die Meldungen einer Person, ohne sie zu
     identifizieren (keine IP, kein Tracking über die Sitzung hinaus). Liegt in
     sessionStorage, damit sie beim Blättern innerhalb eines Tabs stabil bleibt
     und mit dem Schließen des Tabs verschwindet — kein localStorage. Ist der
     Speicher gesperrt, gilt sie nur für diesen Seitenaufruf. */
  /* Seiten-URL für die Meldung: ohne Abfrageteil und ohne Fragment. In
     wp-admin stehen dort sonst _wpnonce, action, post-IDs und Schlüssel —
     die haben in einer fremden Tabelle und deren Protokollen nichts zu
     suchen. Herkunft und Pfad genügen, um die Seite zu erkennen. */
  function sichereUrl() {
    if (!global.location) return "";
    var l = global.location;
    if (l.origin && l.pathname) return l.origin + l.pathname;
    return String(l.href || "").split("?")[0].split("#")[0];
  }

  var sitzungsFallback = null;
  function sitzungsId() {
    var neu = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      var s = global.sessionStorage;
      var v = s.getItem("kommentare-sitzung");
      if (!v) { v = neu; s.setItem("kommentare-sitzung", v); }
      return v;
    } catch (_) {
      if (!sitzungsFallback) sitzungsFallback = neu;
      return sitzungsFallback;
    }
  }

  function commonPrefixLen(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
  }
  function commonSuffixLen(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) i++;
    return i;
  }

  /* -------------------------------------------------------------------- */
  /* Instanz                                                               */
  /* -------------------------------------------------------------------- */
  function Instanz(options) {
    options = options || {};
    var container = resolve(options.container);
    if (!container) {
      throw new Error("Kommentare.init: container nicht gefunden (" + options.container + ")");
    }
    // Zweimal auf denselben Container würde zwei überlagerte Werkzeuge
    // erzeugen (doppelter Knopf, doppeltes Popover bei jeder Auswahl).
    if (container.hasAttribute("data-kommentare-aktiv")) {
      throw new Error("Kommentare.init: für diesen Container läuft bereits eine Instanz " +
                      "(erst destroy() aufrufen).");
    }
    container.setAttribute("data-kommentare-aktiv", "1");

    this.container = container;
    this.autor = options.autor || "";
    this.readOnly = !!options.readOnly;
    this.onCreate = typeof options.onCreate === "function" ? options.onCreate : null;
    this.onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : null;
    this.onDelete = typeof options.onDelete === "function" ? options.onDelete : null;
    this.onChange = typeof options.onChange === "function" ? options.onChange : null;
    this.onThemeChange = typeof options.onThemeChange === "function" ? options.onThemeChange : null;

    // Optionale UI-Erweiterungen
    this.help = options.help !== false;          // Hilfe-Button (standardmäßig an)
    this.themeToggle = !!options.themeToggle;     // Hell-/Dunkel-Umschalter (opt-in)
    this._theme = options.theme || "auto";        // "auto" | "light" | "dark"
    this._scopeEls = [];                          // Elemente, die die Theme-Klasse tragen
    // Aktionsleiste als Balken oben ("bar", Standard) oder als Floating-Button
    // unten rechts ("floating"), der ein Menü öffnet.
    this.toolbarMode = options.toolbarMode === "floating" ? "floating" : "bar";
    // Notizen als in-flow Randspalte ("inline", Standard) oder schwebend im
    // Floating-Panel ("floating"). Bei "floating" wird die Seite NICHT umgebaut,
    // sodass sich der ganze Bereich (auch Header/Footer) kommentieren lässt.
    this.notesMode = options.notes === "floating" ? "floating" : "inline";
    // Randspalte im Auto-Layout per Ziehgriff breiter/schmaler ziehbar
    this.resizable = options.resizable !== false;
    this._notesWidth = options.notesWidth || null; // z. B. "22rem" oder "320px"
    // E-Mail-Empfänger (leer = kein „Per E-Mail senden“-Knopf) + optionaler Betreff
    this.email = options.email || "";
    this.emailSubject = options.emailSubject || "";
    // Beliebige Web-Elemente (Boxen/Container/Bilder) kommentierbar machen
    this.elements = options.elements !== false;
    // Punkt an eine bestimmte Stelle „anheften" (Element-relativer Anker)
    this.points = options.points !== false;
    // Optionaler CSS-Selektor: passende Bereiche (inkl. Nachfahren) sind von
    // Text-/Element-/Punkt-Kommentaren ausgenommen (z. B. '#wpadminbar').
    this.exclude = "";
    if (options.exclude) {
      try { document.querySelector(options.exclude); this.exclude = String(options.exclude); }
      catch (_) { /* ungueltiger Selektor -> ignorieren statt spaeter zu werfen */ }
    }
    // Optionale Meldestelle: jede Änderung wird zusätzlich an diese Adresse
    // geschickt (z. B. ein Google-Apps-Script-Web-App vor einem Google Sheet).
    // Leer = aus; das Werkzeug bleibt dann vollständig offline-fähig.
    this.webhook = "";
    if (options.webhook && /^https?:\/\//i.test(String(options.webhook))) {
      this.webhook = String(options.webhook);
    }
    this.webhookAuto = options.webhookAuto !== false;
    // Gemeinsames Geheimwort: die Gegenstelle kann damit fremde Einträge
    // abweisen. Ohne das kann jede:r schreiben, der die Adresse kennt — und
    // die steht zwangsläufig im Seitenquelltext.
    this.webhookToken = options.webhookToken ? String(options.webhookToken) : "";
    // Anonyme Sitzungskennung (keine IP) — nur anlegen, wenn tatsächlich
    // gemeldet wird. Ohne Sammelstelle wird nichts gespeichert.
    this._sitzung = this.webhook ? sitzungsId() : "";
    this._sendTimer = null;

    this._mode = null;              // null | "element" | "point"
    this.pendingEl = null;          // {el, css, tag, fingerprint} für neue Element-Anno
    this.pendingPoint = null;       // {el, css, tag, fingerprint, rx, ry} für neuen Punkt

    // UI-Texte: Standard + per-Instanz-Overrides (i18n), ohne globalen Zustand zu berühren
    this.texte = {};
    var k;
    for (k in TEXTE) if (Object.prototype.hasOwnProperty.call(TEXTE, k)) this.texte[k] = TEXTE[k];
    if (options.texte) for (k in options.texte) {
      if (Object.prototype.hasOwnProperty.call(options.texte, k)) this.texte[k] = options.texte[k];
    }

    this.annos = new Map();   // id -> interne Annotation
    this.pending = null;      // {start,end,quote,prefix,suffix} für neue Markierung
    this._editing = null;     // id der gerade bearbeiteten Annotation

    this._marginHost = resolve(options.margin);
    this._toolbarHost = resolve(options.toolbar);
    this._insertedNodes = []; // von uns eingefügte Knoten (für destroy)
    this._wrapper = null;     // erzeugtes Layout (falls vorhanden)
    this._containerHome = null; // {parent, next} zum Zurücksetzen bei destroy

    this._buildLayout();
    this._bindEvents();
    this._render();
  }

  Instanz.prototype = {

    /* ---- Layout aufbauen -------------------------------------------- */
    _buildLayout: function () {
      var T = this.texte;
      var c = this.container;
      // Das in-flow-Layout umschließt den Container mit einem Wrapper. Bei
      // <body> (oder <html>) hieße das, <body> aus dem Dokument auszuhängen —
      // document.body wäre danach null und JEDES weitere Skript der Seite
      // stürbe mit. Für solche Container gibt es nur schwebende Notizen.
      if (this.notesMode !== "floating" && !this._marginHost &&
          (c === document.body || c === document.documentElement)) {
        this.notesMode = "floating";
      }
      var floatingNotes = this.notesMode === "floating" && !this._toolbarHost && !this._marginHost;
      // Scope (CSS-Variablen) immer; die Dokument-Typo nur im in-flow Layout,
      // damit ein großer Container (z. B. <body>) nicht komplett umgestylt wird.
      c.classList.add("kommentare-scope");
      if (!floatingNotes) c.classList.add("kommentare-doc");

      // Aktionsleiste
      var toolbar = el("div", "kommentare-toolbar kommentare-scope");
      var titleEl = el("span", "kommentare-title"); titleEl.textContent = T.titel;
      var whoEl = el("span", "kommentare-who");
      whoEl.appendChild(document.createTextNode(T.autorLabel + " "));
      this._whoName = el("b");
      this._whoName.textContent = this.autor || T.platzhalterName;
      whoEl.appendChild(this._whoName);
      var actions = el("span", "kommentare-actions");

      // Hilfe-Button (immer sichtbar, auch im readOnly-Modus)
      var helpBtn = null;
      if (this.help) {
        helpBtn = el("button", "kommentare-btn kommentare-icon");
        helpBtn.type = "button";
        helpBtn.textContent = T.hilfeBtn;
        helpBtn.setAttribute("aria-label", T.hilfeAria);
        helpBtn.title = T.hilfeAria;
        actions.appendChild(helpBtn);
      }
      // Theme-Umschalter (opt-in, immer sichtbar)
      var themeBtn = null;
      if (this.themeToggle) {
        themeBtn = el("button", "kommentare-btn kommentare-icon");
        themeBtn.type = "button";
        actions.appendChild(themeBtn);
      }
      // Auswahl-Modi umschalten (opt-in). Sitzen NICHT in der Aktionsleiste,
      // sondern über den Notizen (siehe Randspalte weiter unten).
      var elementBtn = null;
      if (this.elements && !this.readOnly) {
        elementBtn = el("button", "kommentare-btn kommentare-mode-toggle kommentare-el-toggle");
        elementBtn.type = "button";
        elementBtn.textContent = T.elementBtn;
        elementBtn.setAttribute("aria-pressed", "false");
        elementBtn.setAttribute("aria-label", T.elementAria);
      }
      this._elementBtn = elementBtn;
      var pointBtn = null;
      if (this.points && !this.readOnly) {
        pointBtn = el("button", "kommentare-btn kommentare-mode-toggle kommentare-point-toggle");
        pointBtn.type = "button";
        pointBtn.textContent = T.punktBtn;
        pointBtn.setAttribute("aria-pressed", "false");
        pointBtn.setAttribute("aria-label", T.punktAria);
      }
      this._pointBtn = pointBtn;

      var importBtn = el("button", "kommentare-btn");
      importBtn.type = "button";
      importBtn.textContent = T.ladenBtn;
      importBtn.title = T.ladenTitel;
      actions.appendChild(importBtn);

      // Download-Gruppe: JSON (Primär), Markdown, Drucken/PDF, optional E-Mail
      var dl = el("span", "kommentare-downloads");
      var dlHead = el("span", "kommentare-downloads-head"); dlHead.textContent = T.downloadKopf;
      var exportBtn = el("button", "kommentare-btn kommentare-btn-primary");
      exportBtn.type = "button"; exportBtn.textContent = T.herunterladenJson;
      var mdBtn = el("button", "kommentare-btn");
      mdBtn.type = "button"; mdBtn.textContent = T.herunterladenMd;
      var printBtn = el("button", "kommentare-btn");
      printBtn.type = "button"; printBtn.textContent = T.druckenBtn;
      dl.appendChild(dlHead);
      dl.appendChild(exportBtn);
      dl.appendChild(mdBtn);
      dl.appendChild(printBtn);
      var emailBtn = null;
      if (this.email) {
        emailBtn = el("button", "kommentare-btn");
        emailBtn.type = "button"; emailBtn.textContent = T.emailBtn;
        dl.appendChild(emailBtn);
      }
      // „Alle senden“ als Netz für den automatischen Versand (nur mit webhook)
      var sendBtn = null;
      if (this.webhook) {
        sendBtn = el("button", "kommentare-btn kommentare-send");
        sendBtn.type = "button";
        sendBtn.textContent = T.sendenBtn;
        sendBtn.title = T.sendenTitel;
        dl.appendChild(sendBtn);
      }
      actions.appendChild(dl);

      var countEl = el("span", "kommentare-count");
      toolbar.appendChild(titleEl);
      toolbar.appendChild(whoEl);
      toolbar.appendChild(actions);
      toolbar.appendChild(countEl);
      // readOnly: eigene Downloads (JSON/MD/E-Mail) ausblenden — Laden/Drucken bleiben
      if (this.readOnly) {
        exportBtn.classList.add("kommentare-hidden");
        mdBtn.classList.add("kommentare-hidden");
        if (emailBtn) emailBtn.classList.add("kommentare-hidden");
        if (sendBtn) sendBtn.classList.add("kommentare-hidden");
      }
      this._helpBtn = helpBtn;
      this._themeBtn = themeBtn;
      this._mdBtn = mdBtn;
      this._printBtn = printBtn;
      this._emailBtn = emailBtn;
      this._sendBtn = sendBtn;

      // Randspalte
      var margin = el("aside", "kommentare-margin kommentare-scope");
      // Auswahl-Modi über den Notizen
      if (elementBtn) margin.appendChild(elementBtn);
      if (pointBtn) margin.appendChild(pointBtn);
      var head = el("div", "kommentare-margin-head"); head.textContent = T.notizenKopf;
      var notes = el("div", "kommentare-notes");
      notes.setAttribute("role", "list");
      var empty = el("div", "kommentare-empty"); empty.textContent = T.leer;
      margin.appendChild(head);
      margin.appendChild(notes);
      margin.appendChild(empty);

      // Kommentar-Eingabe (Popover, an <body> gehängt)
      var compose = el("div", "kommentare-compose kommentare-scope kommentare-hidden");
      compose.setAttribute("role", "dialog");
      compose.setAttribute("aria-label", T.titel);
      var textarea = el("textarea");
      textarea.placeholder = T.kommentarPlatzhalter;
      var row = el("div", "kommentare-compose-row");
      var cancelBtn = el("button", "kommentare-btn"); cancelBtn.type = "button"; cancelBtn.textContent = T.abbrechen;
      var saveBtn = el("button", "kommentare-btn"); saveBtn.type = "button"; saveBtn.textContent = T.speichern;
      row.appendChild(cancelBtn);
      row.appendChild(saveBtn);
      compose.appendChild(textarea);
      compose.appendChild(row);

      // Hilfe-Panel (modal, an <body> gehängt) – erklärt die Bedienung
      var help = null;
      if (this.help) {
        help = el("div", "kommentare-help kommentare-scope kommentare-hidden");
        help.setAttribute("role", "dialog");
        help.setAttribute("aria-modal", "true");
        help.setAttribute("aria-label", T.hilfeTitel);
        var box = el("div", "kommentare-help-box");
        var helpClose = el("button", "kommentare-help-close");
        helpClose.type = "button";
        helpClose.textContent = "×";
        helpClose.setAttribute("aria-label", T.hilfeSchliessen);
        var helpH = el("h2", "kommentare-help-title"); helpH.textContent = T.hilfeTitel;
        var helpList = el("ol", "kommentare-help-list");
        var schritte = (T.hilfeSchritte || []).slice();
        if (this.webhook && T.hilfeSenden) schritte.push(T.hilfeSenden);
        schritte.forEach(function (s) {
          var li = el("li");
          var b = el("b"); b.textContent = s[0];
          li.appendChild(b);
          li.appendChild(document.createTextNode(" — " + s[1]));
          helpList.appendChild(li);
        });
        var helpNote = el("p", "kommentare-help-note");
        // Bei aktiver Meldestelle transparent machen, was die Seite verschickt.
        helpNote.textContent = (this.webhook && T.hilfeHinweisSenden)
          ? T.hilfeHinweisSenden + " " + T.hilfeHinweis
          : T.hilfeHinweis;
        box.appendChild(helpClose);
        box.appendChild(helpH);
        box.appendChild(helpList);
        box.appendChild(helpNote);
        help.appendChild(box);
      }
      this._helpEl = help;
      this._helpClose = help ? helpClose : null;

      // verstecktes Datei-Feld für den Import
      var fileIn = el("input");
      fileIn.type = "file";
      fileIn.accept = "application/json,.json";
      fileIn.multiple = true;
      fileIn.className = "kommentare-hidden";

      // Referenzen merken
      this._toolbarEl = toolbar;
      this._marginEl = margin;
      this._notesEl = notes;
      this._emptyEl = empty;
      this._countEl = countEl;
      this._importBtn = importBtn;
      this._exportBtn = exportBtn;
      this._composeEl = compose;
      this._composeText = textarea;
      this._cancelBtn = cancelBtn;
      this._saveBtn = saveBtn;
      this._fileIn = fileIn;

      // Platzierung
      var autoToolbar = !this._toolbarHost;
      var autoMargin = !this._marginHost;
      // Floating-Menü, sobald toolbarMode floating ODER Notizen schwebend sind
      var floating = (this.toolbarMode === "floating" || floatingNotes) && autoToolbar;
      if (floating) titleEl.textContent = T.menuTitel;

      // Ziehgriff zwischen Dokument und Randspalte (nur in-flow Auto-Layout)
      var gutter = null;
      if (autoMargin && this.resizable && !floatingNotes) {
        gutter = el("div", "kommentare-gutter");
        gutter.setAttribute("role", "separator");
        gutter.setAttribute("aria-orientation", "vertical");
        gutter.setAttribute("aria-label", T.groesseAria);
        gutter.setAttribute("tabindex", "0");
      }
      this._gutterEl = gutter;

      if (floatingNotes) {
        // Kein in-flow Layout: Container bleibt unverändert an Ort und Stelle;
        // Aktionsleiste UND Notizen wandern ins Floating-Panel (siehe unten).
        this._wrapper = null;
        this._bodyEl = null;
      } else if (autoToolbar && autoMargin) {
        // vollständiges Layout selbst erzeugen und den Container umschließen
        var parent = c.parentNode;
        this._containerHome = { parent: parent, next: c.nextSibling };
        var wrapper = el("div", "kommentare kommentare-scope");
        var body = el("div", "kommentare-body");
        if (gutter) body.classList.add("kommentare-body-resizable");
        parent.insertBefore(wrapper, c);
        if (!floating) wrapper.appendChild(toolbar); // im Balken-Modus oben
        wrapper.appendChild(body);
        body.appendChild(c);              // Container wird zur Dokumentspalte
        if (gutter) body.appendChild(gutter);
        body.appendChild(margin);         // Randspalte daneben
        if (this._notesWidth) body.style.setProperty("--k-notes-w", this._notesWidth);
        this._wrapper = wrapper;
        this._bodyEl = body;
      } else {
        // Mount-Elemente nutzen; fehlende Teile neben dem Container platzieren
        if (this._toolbarHost) {
          this._toolbarHost.appendChild(toolbar);
        } else {
          c.parentNode.insertBefore(toolbar, c);
        }
        this._insertedNodes.push(toolbar);

        if (this._marginHost) {
          this._marginHost.appendChild(margin);
        } else {
          c.parentNode.insertBefore(margin, c.nextSibling);
        }
        this._insertedNodes.push(margin);
      }

      // Floating-Modus: Aktionsleiste (und ggf. Notizen) hinter einem Button unten rechts
      var fab = null, panel = null;
      if (floating) {
        panel = el("div", "kommentare-panel kommentare-scope kommentare-hidden");
        // kein role="menu": das Panel enthält gemischte Bedienelemente
        // (Buttons, Notizliste), keine menuitem-Struktur.
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-label", T.menuTitel);
        panel.setAttribute("data-kommentare-ui", "1");
        panel.id = newId();
        panel.appendChild(toolbar);
        if (floatingNotes) { panel.classList.add("kommentare-panel-notes"); panel.appendChild(margin); }
        fab = el("button", "kommentare-fab kommentare-scope");
        fab.type = "button";
        fab.setAttribute("aria-label", T.menuAria);
        fab.setAttribute("aria-expanded", "false");
        fab.setAttribute("aria-controls", panel.id);
        fab.setAttribute("data-kommentare-ui", "1");
        fab.textContent = "☰";
        document.body.appendChild(panel);
        document.body.appendChild(fab);
        this._insertedNodes.push(panel, fab);
      }
      this._fabEl = fab;
      this._panelEl = panel;

      compose.setAttribute("data-kommentare-ui", "1");
      if (help) help.setAttribute("data-kommentare-ui", "1");
      document.body.appendChild(compose);
      document.body.appendChild(fileIn);
      this._insertedNodes.push(compose, fileIn);
      if (help) { document.body.appendChild(help); this._insertedNodes.push(help); }

      // Overlay-Ebene für Element-/Punkt-Markierungen + Hover (Seiten-Koordinaten)
      var overlay = null, hover = null;
      if (this.elements || this.points) {
        overlay = el("div", "kommentare-overlay kommentare-scope");
        overlay.setAttribute("data-kommentare-ui", "1");
        hover = el("div", "kommentare-hover kommentare-scope kommentare-hidden");
        hover.setAttribute("data-kommentare-ui", "1");
        document.body.appendChild(overlay);
        document.body.appendChild(hover);
        this._insertedNodes.push(overlay, hover);
      }
      this._overlayEl = overlay;
      this._hoverEl = hover;

      // Elemente sammeln, die die Theme-Klasse tragen, und Anfangs-Theme setzen
      this._scopeEls = [this.container, toolbar, margin, compose];
      if (help) this._scopeEls.push(help);
      if (fab) this._scopeEls.push(fab);
      if (panel) this._scopeEls.push(panel);
      if (overlay) this._scopeEls.push(overlay);
      if (hover) this._scopeEls.push(hover);
      if (this._wrapper) this._scopeEls.push(this._wrapper);
      this._applyTheme(this._theme);
    },

    /* ---- Ereignisse verdrahten (instanz-lokal gebunden) -------------- */
    _bindEvents: function () {
      var self = this;

      this._onMouseUp = function () { self._handleSelection(); };
      this._onTouchEnd = function () {
        // Auf Touch-Geräten steht die Auswahl erst nach dem Loslassen fest.
        global.setTimeout(function () { self._handleSelection(); }, 0);
      };
      this._onContainerClick = function (e) {
        var m = e.target.closest("mark.kommentare-mark");
        if (m && self.container.contains(m)) self._focusAnno(m.dataset.annoId);
      };
      this._onContainerKey = function (e) {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        var m = e.target.closest && e.target.closest("mark.kommentare-mark");
        if (m && self.container.contains(m)) { e.preventDefault(); self._focusAnno(m.dataset.annoId); }
      };
      if (!this.readOnly) {
        this.container.addEventListener("mouseup", this._onMouseUp);
        this.container.addEventListener("touchend", this._onTouchEnd);
      }
      this.container.addEventListener("click", this._onContainerClick);
      this.container.addEventListener("keydown", this._onContainerKey);

      this._onSave = function () { self._saveComment(); };
      this._onCancel = function () { self._closeCompose(); };
      this._onComposeKey = function (e) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) self._saveComment();
        if (e.key === "Escape") self._closeCompose();
      };
      this._saveBtn.addEventListener("click", this._onSave);
      this._cancelBtn.addEventListener("click", this._onCancel);
      this._composeText.addEventListener("keydown", this._onComposeKey);

      this._onImportClick = function () { self._fileIn.click(); };
      this._onExportClick = function () { self._downloadJSON(); };
      this._onMdClick = function () { self._downloadMarkdown(); };
      this._onPrintClick = function () { self._print(); };
      this._onEmailClick = function () { self._email(); };
      this._onSendClick = function () { self.send(); };
      this._onFileChange = function (e) { self._readFiles(e); };
      this._importBtn.addEventListener("click", this._onImportClick);
      this._exportBtn.addEventListener("click", this._onExportClick);
      this._mdBtn.addEventListener("click", this._onMdClick);
      this._printBtn.addEventListener("click", this._onPrintClick);
      if (this._emailBtn) this._emailBtn.addEventListener("click", this._onEmailClick);
      if (this._sendBtn) this._sendBtn.addEventListener("click", this._onSendClick);
      this._fileIn.addEventListener("change", this._onFileChange);

      // Hilfe-Panel
      if (this._helpBtn && this._helpEl) {
        this._onHelpOpen = function () { self._openHelp(); };
        this._onHelpClose = function () { self._closeHelp(); };
        this._onHelpBackdrop = function (e) { if (e.target === self._helpEl) self._closeHelp(); };
        // Escape schließt; Tab bleibt im Dialog (aria-modal="true" allein
        // hindert die Tastatur nicht daran, dahinter weiterzuwandern).
        this._onHelpKey = function (e) {
          if (e.key === "Escape") { self._closeHelp(); return; }
          if (e.key === "Tab") self._trapFocus(e, self._helpEl);
        };
        this._helpBtn.addEventListener("click", this._onHelpOpen);
        this._helpClose.addEventListener("click", this._onHelpClose);
        this._helpEl.addEventListener("click", this._onHelpBackdrop);
        this._helpEl.addEventListener("keydown", this._onHelpKey);
      }

      // Theme-Umschalter
      if (this._themeBtn) {
        this._onThemeToggle = function () {
          self.setTheme(self._effectiveTheme() === "dark" ? "light" : "dark");
        };
        this._themeBtn.addEventListener("click", this._onThemeToggle);
        // Im Auto-Modus dem Systemwechsel live folgen (Knopf-Symbol aktuell halten)
        if (global.matchMedia) {
          this._mq = global.matchMedia("(prefers-color-scheme: dark)");
          this._onMqChange = function () {
            if (self._theme === "auto") self._updateThemeBtn();
          };
          if (this._mq.addEventListener) this._mq.addEventListener("change", this._onMqChange);
          else if (this._mq.addListener) this._mq.addListener(this._onMqChange); // ältere Browser
        }
      }

      // Floating-Menü (Button unten rechts)
      if (this._fabEl && this._panelEl) {
        this._onFabToggle = function (e) { e.stopPropagation(); self._toggleMenu(); };
        this._onDocClick = function (e) {
          if (self._panelEl.classList.contains("kommentare-hidden")) return;
          if (self._panelEl.contains(e.target) || self._fabEl.contains(e.target)) return;
          self._toggleMenu(false);
        };
        this._onMenuKey = function (e) { if (e.key === "Escape") self._toggleMenu(false); };
        this._fabEl.addEventListener("click", this._onFabToggle);
        document.addEventListener("click", this._onDocClick);
        this._panelEl.addEventListener("keydown", this._onMenuKey);
      }

      // Ziehgriff der Randspalte
      if (this._gutterEl) {
        this._onGutterDown = function (e) { self._startResize(e); };
        this._onGutterKey = function (e) {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          self._resizeBy(e.key === "ArrowLeft" ? 24 : -24); // links = breiter
        };
        this._gutterEl.addEventListener("pointerdown", this._onGutterDown);
        this._gutterEl.addEventListener("keydown", this._onGutterKey);
      }

      // Element-/Punkt-Kommentare
      if (this.elements || this.points) {
        if (this._elementBtn) {
          this._onElToggle = function () { self._setMode(self._mode === "element" ? null : "element"); };
          this._elementBtn.addEventListener("click", this._onElToggle);
        }
        if (this._pointBtn) {
          this._onPointToggle = function () { self._setMode(self._mode === "point" ? null : "point"); };
          this._pointBtn.addEventListener("click", this._onPointToggle);
        }
        // Hover-Rückmeldung im aktiven Modus
        this._onElMove = function (e) {
          if (!self._mode) return;
          var t = self._elementTargetFrom(e.target);
          if (!t) { self._hideHover(); return; }
          if (self._mode === "element") self._showHover(t);
          else self._showHoverPoint(e.clientX, e.clientY);
        };
        // Klick in Capture-Phase: Ziel wählen und Host-Handler/Links abfangen
        this._onElClick = function (e) {
          if (!self._mode) return;
          var t = self._elementTargetFrom(e.target);
          if (!t) return;
          e.preventDefault(); e.stopPropagation();
          if (self._mode === "element") self._selectElement(t);
          else self._placePoint(t, e.clientX, e.clientY);
        };
        this._onElKey = function (e) { if (e.key === "Escape" && self._mode) self._setMode(null); };
        this.container.addEventListener("mousemove", this._onElMove);
        this.container.addEventListener("click", this._onElClick, true);
        document.addEventListener("keydown", this._onElKey);

        // Overlay-Neuposition bei Scroll/Resize/Layoutänderung (rAF-gedrosselt)
        this._reposScheduled = false;
        this._onRepos = function () {
          if (self._reposScheduled) return;
          self._reposScheduled = true;
          (global.requestAnimationFrame || function (f) { global.setTimeout(f, 16); })(function () {
            self._reposScheduled = false;
            self._positionOverlays();
          });
        };
        global.addEventListener("scroll", this._onRepos, true);
        global.addEventListener("resize", this._onRepos);
        if (global.ResizeObserver) {
          this._ro = new global.ResizeObserver(this._onRepos);
          this._ro.observe(this.container);
        }
      }
    },

    /* ---- Element- & Punkt-Kommentare --------------------------------- */
    _elementTargetFrom: function (t) {
      if (!t || t.nodeType !== 1) return null;
      if (t === this.container) return null;
      if (!this.container.contains(t)) return null;
      // werkzeugeigene UI (Panel/Overlay/Hover/…) nie als Ziel wählen
      if (t.closest && t.closest("[data-kommentare-ui]")) return null;
      // ausgeschlossene Bereiche (Option exclude, z. B. '#wpadminbar')
      if (this.exclude && t.closest && t.closest(this.exclude)) return null;
      return t;
    },
    _setMode: function (mode) {
      var T = this.texte;
      this._mode = mode || null;
      this.container.classList.toggle("kommentare-picking", !!this._mode);
      if (this._elementBtn) {
        var onE = this._mode === "element";
        this._elementBtn.classList.toggle("is-active", onE);
        this._elementBtn.setAttribute("aria-pressed", onE ? "true" : "false");
        this._elementBtn.textContent = onE ? T.elementBtnAktiv : T.elementBtn;
      }
      if (this._pointBtn) {
        var onP = this._mode === "point";
        this._pointBtn.classList.toggle("is-active", onP);
        this._pointBtn.setAttribute("aria-pressed", onP ? "true" : "false");
        this._pointBtn.textContent = onP ? T.punktBtnAktiv : T.punktBtn;
      }
      if (!this._mode) this._hideHover();
      else if (this._panelEl) this._toggleMenu(false); // Menü schließen, Sicht frei
    },
    // Ursprung des Bezugssystems der absolut positionierten Overlays.
    // Die Overlay-Ebene liegt bei top:0/left:0 ihres containing blocks; ihre
    // Viewport-Position ist daher der korrekte Nullpunkt — auch wenn <body>
    // selbst positioniert/verschoben ist (position:relative, margin, …).
    _overlayBase: function () {
      // Nur die Overlay-Ebene bleibt fest bei 0/0 (der Hover-Kasten wird bewegt).
      if (!this._overlayEl) return { x: -window.scrollX, y: -window.scrollY };
      var r = this._overlayEl.getBoundingClientRect();
      return { x: r.left, y: r.top };
    },
    _showHover: function (elm) {
      if (!this._hoverEl) return;
      var r = elm.getBoundingClientRect();
      var base = this._overlayBase();
      var h = this._hoverEl;
      h.classList.remove("kommentare-hidden", "kommentare-hover-point");
      h.style.left = (r.left - base.x) + "px";
      h.style.top = (r.top - base.y) + "px";
      h.style.width = r.width + "px";
      h.style.height = r.height + "px";
    },
    _showHoverPoint: function (x, y) {
      if (!this._hoverEl) return;
      var base = this._overlayBase();
      var h = this._hoverEl;
      h.classList.remove("kommentare-hidden");
      h.classList.add("kommentare-hover-point");
      h.style.width = ""; h.style.height = "";
      h.style.left = (x - base.x) + "px";
      h.style.top = (y - base.y) + "px";
    },
    _hideHover: function () {
      if (this._hoverEl) this._hoverEl.classList.add("kommentare-hidden");
    },
    _fingerprint: function (elm) {
      var t = (elm.textContent || "").replace(/\s+/g, " ").trim();
      // Textlose Elemente (Bilder, Icons): src/alt als Kennung, sonst findet
      // der Fallback nur das ERSTE gleichartige Element.
      if (!t && elm.getAttribute) {
        t = elm.getAttribute("src") || elm.getAttribute("alt") || "";
        t = t.slice(-60); // Dateiname/Ende der URL ist der aussagekräftige Teil
      }
      return t.slice(0, 60);
    },
    // Container-relativer, robuster CSS-Pfad (id als Abkürzung, sonst nth-of-type).
    _cssPathOf: function (elm) {
      var parts = [], node = elm, usedId = false;
      while (node && node !== this.container && node.nodeType === 1) {
        if (node.id) { parts.unshift("#" + cssEscape(node.id)); usedId = true; break; }
        var tag = node.tagName.toLowerCase();
        var parent = node.parentNode, idx = 0, k = 0, i;
        if (parent) {
          for (i = 0; i < parent.children.length; i++) {
            if (parent.children[i].tagName === node.tagName) { k++; if (parent.children[i] === node) idx = k; }
          }
          parts.unshift(tag + ":nth-of-type(" + idx + ")");
        } else { parts.unshift(tag); }
        node = node.parentNode;
      }
      if (usedId) return parts.join(" > ");
      return ":scope > " + parts.join(" > ");
    },
    _resolveElement: function (a) {
      var elx = null;
      try { elx = this.container.querySelector(a.css); } catch (_) {}
      if (elx && this.container.contains(elx)) return elx;
      // Fallback: unter allen gleichartigen Elementen per Fingerprint suchen
      if (a.tag) {
        // a.tag stammt aus importierter Fremd-JSON -> Selektor absichern
        var cands = [];
        try { cands = this.container.querySelectorAll(a.tag); } catch (_) { return null; }
        var best = null, i;
        for (i = 0; i < cands.length; i++) {
          if (this._fingerprint(cands[i]) === a.fingerprint) { best = cands[i]; break; }
        }
        if (!best && a.fingerprint) {
          for (i = 0; i < cands.length; i++) {
            if (this._fingerprint(cands[i]).indexOf(a.fingerprint.slice(0, 20)) === 0) { best = cands[i]; break; }
          }
        }
        if (best) return best;
      }
      return null;
    },
    _selectElement: function (elm) {
      this.pending = null;
      this._editing = null;
      this.pendingPoint = null;
      this.pendingEl = {
        el: elm, css: this._cssPathOf(elm),
        tag: elm.tagName.toLowerCase(), fingerprint: this._fingerprint(elm)
      };
      this._setMode(null);
      this._openCompose(elm.getBoundingClientRect());
    },
    // Punkt an eine Stelle heften: Element + relative Position (rx,ry) darin.
    _placePoint: function (elm, clientX, clientY) {
      var r = elm.getBoundingClientRect();
      var rx = r.width ? (clientX - r.left) / r.width : 0.5;
      var ry = r.height ? (clientY - r.top) / r.height : 0.5;
      rx = Math.min(1, Math.max(0, rx));
      ry = Math.min(1, Math.max(0, ry));
      this.pending = null;
      this._editing = null;
      this.pendingEl = null;
      this.pendingPoint = {
        el: elm, css: this._cssPathOf(elm),
        tag: elm.tagName.toLowerCase(), fingerprint: this._fingerprint(elm), rx: rx, ry: ry
      };
      this._setMode(null);
      this._openCompose({ left: clientX, right: clientX, top: clientY, bottom: clientY });
    },
    _renderOverlays: function () {
      if (!this._overlayEl) return;
      var self = this, T = this.texte;
      this._overlayEl.innerHTML = "";
      var items = this._sortByTop(Array.from(this.annos.values()).filter(function (a) {
        return a.kind === "element" || a.kind === "point";
      }));
      items.forEach(function (a, i) {
        if (!self._resolveElement(a)) return;
        var marker, badge, label = (a.kind === "point" ? T.punktLabel : T.elementLabel) + " " + (i + 1);
        if (a.kind === "element") {
          marker = el("div", "kommentare-el-mark");
          badge = el("span", "kommentare-el-badge");
          badge.textContent = String(i + 1);
          marker.appendChild(badge);
        } else {
          marker = el("div", "kommentare-point-mark");
          marker.textContent = String(i + 1);
          badge = marker; // der Pin selbst ist klickbar
        }
        marker.dataset.annoId = a.id;
        marker.dataset.kind = a.kind;
        badge.setAttribute("role", "button");
        badge.setAttribute("tabindex", "0");
        badge.setAttribute("aria-label", label + ": " + (a.body || ""));
        badge.addEventListener("click", function (e) { e.stopPropagation(); self._focusAnno(a.id); });
        badge.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); self._focusAnno(a.id); }
        });
        self._overlayEl.appendChild(marker);
      });
      this._positionOverlays();
    },
    _positionOverlays: function () {
      if (!this._overlayEl) return;
      var self = this;
      var base = this._overlayBase();
      this._overlayEl.querySelectorAll(".kommentare-el-mark,.kommentare-point-mark").forEach(function (marker) {
        var a = self.annos.get(marker.dataset.annoId);
        var elx = a ? self._resolveElement(a) : null;
        if (!elx || !self.container.contains(elx)) { marker.style.display = "none"; return; }
        var r = elx.getBoundingClientRect();
        marker.style.display = "";
        if (marker.dataset.kind === "point") {
          marker.style.left = (r.left + (a.rx || 0) * r.width - base.x) + "px";
          marker.style.top = (r.top + (a.ry || 0) * r.height - base.y) + "px";
        } else {
          marker.style.left = (r.left - base.x) + "px";
          marker.style.top = (r.top - base.y) + "px";
          marker.style.width = r.width + "px";
          marker.style.height = r.height + "px";
        }
      });
    },
    _annoTop: function (a) {
      var node = null;
      if (a.kind === "element" || a.kind === "point") node = this._resolveElement(a);
      else node = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + cssEscape(a.id) + '"]');
      if (!node) return Number.POSITIVE_INFINITY;
      var r = node.getBoundingClientRect();
      var top = r.top + window.scrollY;
      if (a.kind === "point") top += (a.ry || 0) * r.height;
      return top;
    },
    // Nach visueller Position sortieren; _annoTop (DOM-Abfragen) wird dabei
    // einmal pro Annotation berechnet, nicht einmal pro Vergleich.
    _sortByTop: function (annos) {
      var self = this;
      return annos
        .map(function (a) { return { a: a, top: self._annoTop(a) }; })
        .sort(function (x, y) { return x.top - y.top; })
        .map(function (x) { return x.a; });
    },

    /* ---- Floating-Menü ----------------------------------------------- */
    _toggleMenu: function (force) {
      if (!this._panelEl) return;
      var hidden = this._panelEl.classList.contains("kommentare-hidden");
      var open = typeof force === "boolean" ? force : hidden;
      this._panelEl.classList.toggle("kommentare-hidden", !open);
      if (this._fabEl) this._fabEl.setAttribute("aria-expanded", open ? "true" : "false");
    },

    /* ---- Randspalte in der Breite ziehen ----------------------------- */
    _clampNotes: function (px) {
      if (!this._bodyEl) return px;
      var total = this._bodyEl.clientWidth || 1000;
      var min = 160, max = Math.max(min, total * 0.7);
      return Math.round(Math.min(max, Math.max(min, px)));
    },
    _currentNotes: function () {
      return this._marginEl ? this._marginEl.getBoundingClientRect().width : 320;
    },
    _resizeBy: function (delta) {
      if (!this._bodyEl) return;
      this._bodyEl.style.setProperty("--k-notes-w", this._clampNotes(this._currentNotes() + delta) + "px");
    },
    _startResize: function (e) {
      if (!this._bodyEl) return;
      var self = this;
      var bodyRect = this._bodyEl.getBoundingClientRect();
      try { this._gutterEl.setPointerCapture(e.pointerId); } catch (_) {}
      this._gutterEl.classList.add("is-dragging");
      var move = function (ev) {
        // Notiz-Breite = rechter Rand des Bodys minus Zeigerposition
        var w = self._clampNotes(bodyRect.right - ev.clientX);
        self._bodyEl.style.setProperty("--k-notes-w", w + "px");
      };
      var up = function () {
        self._gutterEl.classList.remove("is-dragging");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        try { self._gutterEl.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    },

    _emitChange: function () {
      if (this.onChange) this.onChange(this.getAnnotations());
    },

    /* ---- Hilfe-Panel ------------------------------------------------- */
    // Tastaturfokus im Dialog halten: am Ende zurück an den Anfang und
    // umgekehrt. Ohne das führt Tab aus einem "modalen" Dialog heraus.
    _trapFocus: function (e, wurzel) {
      if (!wurzel) return;
      var ziele = wurzel.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var sichtbar = Array.prototype.filter.call(ziele, function (n) {
        return !n.disabled && n.offsetParent !== null;
      });
      if (!sichtbar.length) return;
      var erste = sichtbar[0], letzte = sichtbar[sichtbar.length - 1];
      var aktiv = document.activeElement;
      if (e.shiftKey && (aktiv === erste || !wurzel.contains(aktiv))) {
        e.preventDefault(); letzte.focus();
      } else if (!e.shiftKey && (aktiv === letzte || !wurzel.contains(aktiv))) {
        e.preventDefault(); erste.focus();
      }
    },
    _openHelp: function () {
      if (!this._helpEl) return;
      this._helpEl.classList.remove("kommentare-hidden");
      if (this._helpClose) this._helpClose.focus();
    },
    _closeHelp: function () {
      if (!this._helpEl) return;
      this._helpEl.classList.add("kommentare-hidden");
      if (this._helpBtn) this._helpBtn.focus();
    },

    /* ---- Theme ------------------------------------------------------- */
    _effectiveTheme: function () {
      if (this._theme === "light" || this._theme === "dark") return this._theme;
      return (global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark" : "light";
    },
    _applyTheme: function (theme) {
      this._theme = theme;
      var cls = theme === "dark" ? "kommentare-dark" : (theme === "light" ? "kommentare-light" : null);
      this._scopeEls.forEach(function (elx) {
        if (!elx) return;
        elx.classList.remove("kommentare-dark", "kommentare-light");
        if (cls) elx.classList.add(cls);
      });
      this._updateThemeBtn();
    },
    _updateThemeBtn: function () {
      if (!this._themeBtn) return;
      var eff = this._effectiveTheme();
      this._themeBtn.textContent = eff === "dark" ? "☀" : "☾";
      this._themeBtn.setAttribute("aria-label", this.texte.themeAria);
      this._themeBtn.title = this.texte.themeAria;
      this._themeBtn.setAttribute("aria-pressed", eff === "dark" ? "true" : "false");
    },
    setTheme: function (theme) {
      this._applyTheme(theme);
      if (this.onThemeChange) this.onThemeChange(theme);
      return this;
    },

    /* ---- Textoffsets im Container ----------------------------------- */
    _textNodes: function (root) {
      var out = [];
      var exclude = this.exclude;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.nodeName;
          // Skript-/Stil-Text und werkzeugeigene UI ignorieren (wichtig, wenn
          // der Container die ganze Seite/<body> umfasst).
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") {
            return NodeFilter.FILTER_REJECT;
          }
          if (p.closest && p.closest("[data-kommentare-ui]")) return NodeFilter.FILTER_REJECT;
          if (exclude && p.closest && p.closest(exclude)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var n; while ((n = w.nextNode())) out.push(n);
      return out;
    },
    // Zeichenposition eines Auswahl-Grenzpunktes im Volltext des Containers.
    // Der Grenzpunkt kann auch ein ELEMENT-Knoten sein (Dreifachklick, Auswahl
    // über mehrere Absätze) — dann per Dokumentreihenfolge einordnen, statt
    // (wie früher) auf die Gesamtlänge zu verfallen.
    _globalOffset: function (node, off) {
      var nodes = this._textNodes(this.container);
      var i, sum = 0;
      // Schnellpfad: Grenzpunkt liegt in einem gezählten Textknoten
      if (node.nodeType === 3) {
        for (i = 0; i < nodes.length; i++) {
          if (nodes[i] === node) return sum + off;
          sum += nodes[i].nodeValue.length;
        }
      }
      // Allgemeiner Fall: Grenzpunkt mit jedem Textknoten vergleichen
      var bp = document.createRange();
      try { bp.setStart(node, off); bp.collapse(true); }
      catch (_) { return 0; }
      sum = 0;
      for (i = 0; i < nodes.length; i++) {
        var t = nodes[i], len = t.nodeValue.length;
        var r = document.createRange();
        r.selectNodeContents(t);
        // Grenzpunkt vor (oder am) Anfang dieses Knotens -> Position erreicht
        if (bp.compareBoundaryPoints(Range.START_TO_START, r) <= 0) return sum;
        // Grenzpunkt hinter (oder am) Ende -> Knoten vollständig davor
        if (bp.compareBoundaryPoints(Range.END_TO_START, r) >= 0) { sum += len; continue; }
        // Grenzpunkt liegt innerhalb dieses Knotens
        return sum + Math.min(off, len);
      }
      return sum;
    },
    _plainText: function () {
      return this._textNodes(this.container).map(function (t) { return t.nodeValue; }).join("");
    },

    /* ---- Bereich [start,end) mit <mark> umschließen (knotenübergreifend) */
    // Textknoten mit ihren kumulierten Start-/Endpositionen im Volltext.
    _knotenMitOffsets: function () {
      var nodes = this._textNodes(this.container), out = [], pos = 0, i;
      for (i = 0; i < nodes.length; i++) {
        var len = nodes[i].nodeValue.length;
        out.push({ node: nodes[i], start: pos, end: pos + len });
        pos += len;
      }
      return out;
    },
    _wrapRange: function (start, end, id, vorab) {
      var anno = this.annos.get(id);
      var label = anno
        ? (this.texte.markierungAria + " " + this.texte.von + " " +
           (anno.author || this.texte.platzhalterName) + ": „" + anno.quote + "“")
        : this.texte.markierungAria;

      // Optional vorberechnete Knotenliste (siehe _relayout) — spart bei
      // vielen Annotationen den wiederholten Baumdurchlauf.
      var liste = vorab || this._knotenMitOffsets();
      var hits = [], i;
      for (i = 0; i < liste.length; i++) {
        var k = liste[i];
        if (k.start >= end) break;        // alles Weitere liegt dahinter
        if (k.end <= start) continue;     // liegt noch davor
        hits.push({ node: k.node, from: Math.max(start, k.start) - k.start,
                    to: Math.min(end, k.end) - k.start });
      }
      // rückwärts, damit Split-Operationen frühere Knoten nicht verschieben
      for (var j = hits.length - 1; j >= 0; j--) {
        var h = hits[j];
        var range = document.createRange();
        range.setStart(h.node, h.from);
        range.setEnd(h.node, h.to);
        var m = el("mark", "kommentare-mark");
        m.dataset.annoId = id;
        m.setAttribute("role", "button");
        m.setAttribute("tabindex", "0");
        m.setAttribute("aria-label", label);
        // Range liegt innerhalb eines einzelnen Textknotens -> surroundContents ist
        // sicher; overlappende Annotationen ergeben verschachtelte <mark>. Zur
        // Sicherheit dennoch abgefangen.
        try {
          range.surroundContents(m);
        } catch (_) { /* Bereich nicht umschließbar – überspringen */ }
      }
    },

    // ALLE Markierungs-Teile einer Annotation. Eine Auswahl über mehrere
    // Knoten (z. B. über ein <b> oder eine Absatzgrenze hinweg) erzeugt
    // mehrere <mark>-Elemente mit derselben id — wer nur das erste anfasst,
    // lässt den Rest verwaist zurück.
    _marksOf: function (id) {
      return this.container.querySelectorAll(
        'mark.kommentare-mark[data-anno-id="' + cssEscape(id) + '"]');
    },
    _unwrapMarks: function () {
      var marks = this.container.querySelectorAll("mark.kommentare-mark");
      var eltern = [];
      marks.forEach(function (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        if (eltern.indexOf(p) === -1) eltern.push(p);
      });
      // gezielt statt dokumentweit (siehe _removeAnno)
      eltern.forEach(function (p) { p.normalize(); });
    },

    // Beste Verankerung finden: exakte Position, sonst per Wortlaut mit
    // prefix/suffix-Disambiguierung bei mehrfachem Vorkommen.
    _findAnchor: function (full, a) {
      if (a.quote && full.slice(a.pos.start, a.pos.end) === a.quote) {
        return { start: a.pos.start, end: a.pos.end };
      }
      if (!a.quote) return null;
      var occ = [], idx = full.indexOf(a.quote);
      while (idx !== -1) { occ.push(idx); idx = full.indexOf(a.quote, idx + 1); }
      if (!occ.length) return null;
      if (occ.length === 1) return { start: occ[0], end: occ[0] + a.quote.length };

      var pre = a.prefix || "", suf = a.suffix || "";
      var best = null, bestScore = -Infinity;
      for (var k = 0; k < occ.length; k++) {
        var s = occ[k], e = s + a.quote.length;
        var gotPre = full.slice(Math.max(0, s - pre.length), s);
        var gotSuf = full.slice(e, e + suf.length);
        var score = commonSuffixLen(gotPre, pre) + commonPrefixLen(gotSuf, suf);
        // Gleichstand: Nähe zur ursprünglichen Position bevorzugen
        var prox = -Math.abs(s - (a.pos ? a.pos.start : 0)) / 1e9;
        var total = score + prox;
        if (total > bestScore) { bestScore = total; best = { start: s, end: e }; }
      }
      return best;
    },

    // Alle Markierungen neu aufbauen (nach Import).
    //
    // Der Baumdurchlauf ist der teure Teil: einmal pro Annotation gerechnet
    // wird das Einlesen quadratisch (gemessen: 1500 Absätze × 100 Kommentare
    // ≈ 1 s Blockade). Deshalb EINMAL vorberechnen und die Liste durchreichen.
    //
    // Das ist nur zulässig, solange sich die Annotationen nicht überlappen:
    // Umschließen spaltet Textknoten, was Einträge NACH der Fundstelle
    // ungültig macht. Wir arbeiten deshalb von hinten nach vorne — bereits
    // verarbeitete (spätere) Knoten fassen wir nie wieder an. Bei echten
    // Überlappungen (verschachtelte <mark>) fällt die Berechnung pro
    // Annotation zurück, weil dort dieselbe Stelle mehrfach angefasst wird.
    _relayout: function () {
      this._unwrapMarks();
      var full = this._plainText();
      var anker = [];
      this.annos.forEach(function (a) {
        var anchor = this._findAnchor(full, a);
        if (!anchor) return;
        a.pos = { start: anchor.start, end: anchor.end };
        anker.push({ id: a.id, start: anchor.start, end: anchor.end });
      }, this);
      if (!anker.length) return;

      // absteigend nach Startposition: von hinten nach vorne umschließen
      anker.sort(function (x, y) { return y.start - x.start; });
      var ueberlappt = false, i;
      for (i = 1; i < anker.length; i++) {
        if (anker[i].end > anker[i - 1].start) { ueberlappt = true; break; }
      }
      var vorab = ueberlappt ? null : this._knotenMitOffsets();
      for (i = 0; i < anker.length; i++) {
        this._wrapRange(anker[i].start, anker[i].end, anker[i].id, vorab);
      }
    },

    /* ---- Auswahl -> Kommentar --------------------------------------- */
    // Liegt der Knoten in werkzeugeigener UI oder einem ausgeschlossenen Bereich?
    _inToolUi: function (node) {
      var e = node && (node.nodeType === 1 ? node : node.parentNode);
      if (!e || !e.closest) return false;
      if (e.closest("[data-kommentare-ui]")) return true;
      return !!(this.exclude && e.closest(this.exclude));
    },
    // Text in Eingabefeldern/Editoren markiert man zum Bearbeiten, nicht zum
    // Kommentieren — sonst poppt das Kommentarfeld beim Schreiben auf (z. B. im
    // WordPress-Editor). Solche Bereiche lassen sich weiter als Element oder
    // per Punkt kommentieren.
    _inEditable: function (node) {
      var e = node && (node.nodeType === 1 ? node : node.parentNode);
      if (!e || !e.closest) return false;
      return !!e.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]');
    },
    _handleSelection: function () {
      if (this.readOnly || this._mode) return;
      var sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      var r = sel.getRangeAt(0);
      if (!this.container.contains(r.commonAncestorContainer)) return;
      // Auswahl, die in der Werkzeug-UI beginnt/endet (z. B. Notiz-Panel bei
      // container=body), würde stille Offset-Fehler erzeugen -> abbrechen.
      if (this._inToolUi(r.startContainer) || this._inToolUi(r.endContainer)) return;
      // Auswahl in Eingabefeldern/Editoren gehört dem Bearbeiten, nicht uns.
      if (this._inEditable(r.startContainer) || this._inEditable(r.endContainer)) return;
      var start = this._globalOffset(r.startContainer, r.startOffset);
      var end = this._globalOffset(r.endContainer, r.endOffset);
      if (start > end) { var tmp = start; start = end; end = tmp; }
      var full = this._plainText();
      var raw = full.slice(start, end);
      var quote = raw.trim();
      if (!quote) return;
      // Trim-Korrektur der Offsets
      var lead = raw.length - raw.trimStart().length;
      start += lead; end = start + quote.length;
      this._editing = null;
      this.pending = {
        start: start, end: end, quote: quote,
        prefix: full.slice(Math.max(0, start - 32), start),
        suffix: full.slice(end, end + 32)
      };
      this._openCompose(r.getBoundingClientRect());
      sel.removeAllRanges();
    },

    _openCompose: function (rect) {
      var c = this._composeEl;
      c.classList.remove("kommentare-hidden");
      var cw = c.offsetWidth, ch = c.offsetHeight;
      var vw = document.documentElement.clientWidth;
      var vh = document.documentElement.clientHeight;
      // position:fixed -> Viewport-Koordinaten (KEINE scrollX/scrollY-Offsets)
      var x = rect.left, y = rect.bottom + 6;
      x = Math.min(x, vw - cw - 8);
      if (y + ch > vh) y = rect.top - ch - 6;
      c.style.left = Math.max(8, x) + "px";
      c.style.top = Math.max(8, y) + "px";
      var current = this._editing && this.annos.has(this._editing)
        ? this.annos.get(this._editing).body : "";
      this._composeText.value = current;
      this._composeText.focus();
    },
    _closeCompose: function (fokusAuf) {
      // Der Fokus darf nicht im ausgeblendeten Popover zurückbleiben — sonst
      // beginnt die Tastaturbedienung danach im Nichts.
      if (this._composeEl.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      this._composeEl.classList.add("kommentare-hidden");
      this.pending = null;
      this.pendingEl = null;
      this.pendingPoint = null;
      this._editing = null;
      if (fokusAuf) this._fokusAufAnno(fokusAuf);
    },
    // Nach dem Speichern dorthin springen, worum es ging: erst die Markierung,
    // sonst die Notiz.
    _fokusAufAnno: function (id) {
      var teile = this._marksOf(id);
      var ziel = teile.length ? teile[0]
        : this._marginEl.querySelector('.kommentare-note[data-anno-id="' + cssEscape(id) + '"]');
      if (ziel && ziel.focus) { try { ziel.focus(); } catch (_) {} }
    },

    _saveComment: function () {
      var val = this._composeText.value.trim();

      // Bearbeiten einer bestehenden Annotation
      if (this._editing) {
        var a = this.annos.get(this._editing);
        if (!val || !a) { this._closeCompose(); return; }
        a.body = val;
        this._closeCompose(a.id);
        this._render();
        if (this.onUpdate) this.onUpdate(toW3C(a));
        this._webhookAuto(a, this.texte.aktionGeaendert);
        this._emitChange();
        return;
      }

      // Neuer Element-Kommentar
      if (this.pendingEl) {
        if (!val) { this._closeCompose(); return; }
        var pe = this.pendingEl;
        var eid = newId();
        var eanno = {
          id: eid, kind: "element", css: pe.css, tag: pe.tag, fingerprint: pe.fingerprint,
          body: val, author: this.autor, created: new Date().toISOString()
        };
        this.annos.set(eid, eanno);
        this._closeCompose(eid);
        this._render();
        if (this.onCreate) this.onCreate(toW3C(eanno));
        this._webhookAuto(eanno);
        this._emitChange();
        return;
      }

      // Neuer Punkt-Kommentar
      if (this.pendingPoint) {
        if (!val) { this._closeCompose(); return; }
        var pp = this.pendingPoint;
        var pid = newId();
        var panno = {
          id: pid, kind: "point", css: pp.css, tag: pp.tag, fingerprint: pp.fingerprint,
          rx: pp.rx, ry: pp.ry, body: val, author: this.autor, created: new Date().toISOString()
        };
        this.annos.set(pid, panno);
        this._closeCompose(pid);
        this._render();
        if (this.onCreate) this.onCreate(toW3C(panno));
        this._webhookAuto(panno);
        this._emitChange();
        return;
      }

      // Neue Text-Annotation
      if (!val || !this.pending) { this._closeCompose(); return; }
      var p = this.pending;
      var id = newId();
      var anno = {
        id: id, kind: "text", quote: p.quote, prefix: p.prefix, suffix: p.suffix,
        pos: { start: p.start, end: p.end }, body: val, author: this.autor,
        created: new Date().toISOString()
      };
      this.annos.set(id, anno);
      this._wrapRange(p.start, p.end, id);
      this._closeCompose(id);
      this._render();
      if (this.onCreate) this.onCreate(toW3C(anno));
      this._webhookAuto(anno);
      this._emitChange();
    },

    _startEdit: function (id) {
      if (this.readOnly || !this.annos.has(id)) return;
      this.pending = null;
      this.pendingEl = null;
      this.pendingPoint = null;
      this._editing = id;
      var a = this.annos.get(id);
      var target = a && (a.kind === "element" || a.kind === "point")
        ? this._resolveElement(a)
        : this.container.querySelector('mark.kommentare-mark[data-anno-id="' + cssEscape(id) + '"]');
      var rect = target ? target.getBoundingClientRect() : { left: 40, right: 40, top: 80, bottom: 80 };
      this._openCompose(rect);
    },

    /* ---- Randspalte ------------------------------------------------- */
    _render: function () {
      var self = this, T = this.texte;
      var notes = this._notesEl;
      notes.innerHTML = "";
      // nach visueller Position (oben->unten) sortieren; mischt alle Anno-Arten
      var list = this._sortByTop(Array.from(this.annos.values()));
      this._emptyEl.classList.toggle("kommentare-hidden", list.length > 0);

      list.forEach(function (a) {
        var note = el("div", "kommentare-note");
        note.dataset.annoId = a.id;
        note.setAttribute("role", "listitem");
        note.setAttribute("tabindex", "0");
        // Ohne Namen kündigt eine Vorlesehilfe nur „Listenelement" an, obwohl
        // die Notiz anklickbar ist und zur Markierung springt.
        note.setAttribute("aria-label",
          (a.author || T.platzhalterName) + ": " +
          String(a.body || "").slice(0, 80) + " — " + T.notizSpringt);
        var mine = a.author === self.autor;
        var quoteEl = el("blockquote");
        if (a.kind === "element") {
          note.classList.add("kommentare-note-element");
          quoteEl.textContent = "⬚ " + (a.tag || T.elementLabel) +
            (a.fingerprint ? ": „" + a.fingerprint + "“" : "");
        } else if (a.kind === "point") {
          note.classList.add("kommentare-note-point");
          quoteEl.textContent = "📍 " + T.punktLabel + (a.tag ? " · " + a.tag : "");
        } else {
          quoteEl.textContent = "„" + a.quote + "“";
        }
        var bodyEl = el("div", "kommentare-note-body");
        bodyEl.textContent = a.body;
        var metaEl = el("div", "kommentare-note-meta");
        var nameEl = el("span");
        nameEl.textContent = a.author || T.platzhalterName;
        metaEl.appendChild(nameEl);
        if (mine && !self.readOnly) {
          var btnWrap = el("span", "kommentare-note-actions");
          var editBtn = el("button", "kommentare-btn");
          editBtn.type = "button";
          editBtn.textContent = T.bearbeiten;
          editBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            self._startEdit(a.id);
          });
          var delBtn = el("button", "kommentare-btn");
          delBtn.type = "button";
          delBtn.textContent = T.loeschen;
          delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            self._removeAnno(a.id);
          });
          btnWrap.appendChild(editBtn);
          btnWrap.appendChild(delBtn);
          metaEl.appendChild(btnWrap);
        }
        note.appendChild(quoteEl);
        note.appendChild(bodyEl);
        note.appendChild(metaEl);
        note.addEventListener("click", function () { self._focusAnno(a.id); });
        note.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault(); self._focusAnno(a.id);
          }
        });
        notes.appendChild(note);
      });

      var n = this.annos.size;
      this._countEl.textContent = n + (n === 1 ? T.einKommentar : T.mehrereKommentare);
      var mineCount = list.filter(function (a) { return a.author === self.autor; }).length;
      // Downloads eigener Kommentare nur bei vorhandenen eigenen Kommentaren
      var noneMine = mineCount === 0;
      this._exportBtn.disabled = noneMine;
      if (this._mdBtn) this._mdBtn.disabled = noneMine;
      if (this._emailBtn) this._emailBtn.disabled = noneMine;

      this._renderOverlays();
    },

    _focusAnno: function (id) {
      var sel = cssEscape(id);
      this.container.querySelectorAll("mark.kommentare-mark.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      this._marginEl.querySelectorAll(".kommentare-note.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      if (this._overlayEl) this._overlayEl.querySelectorAll(".kommentare-el-mark.is-active,.kommentare-point-mark.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });

      // alle Teile der Markierung hervorheben, zum ersten scrollen
      var teile = this._marksOf(id);
      var note = this._marginEl.querySelector('.kommentare-note[data-anno-id="' + sel + '"]');
      var a = this.annos.get(id);
      teile.forEach(function (t) { t.classList.add("is-active"); });
      if (teile.length) teile[0].scrollIntoView({ block: "center" });
      if (a && (a.kind === "element" || a.kind === "point")) {
        var box = this._overlayEl && this._overlayEl.querySelector('[data-anno-id="' + sel + '"]');
        var elx = this._resolveElement(a);
        if (elx) elx.scrollIntoView({ block: "center" });
        this._positionOverlays();
        if (box) box.classList.add("is-active");
      }
      if (note) note.classList.add("is-active");
    },

    _removeAnno: function (id) {
      var weg = this.annos.get(id); // vor dem Löschen merken (für die Meldung)
      // Wird gerade genau diese Notiz bearbeitet, muss das Popover mit weg —
      // sonst tippt man in ein Feld, dessen Notiz es nicht mehr gibt, und der
      // Text verschwindet beim Speichern kommentarlos.
      if (this._editing === id) this._closeCompose();
      this.annos.delete(id);
      // jedes Teilstück auflösen — sonst bleiben sichtbare Markierungen ohne
      // zugehörige Notiz stehen
      // normalize() NUR auf den betroffenen Elternknoten — dokumentweit würde
      // es fremd verwaltetes DOM (Block-Editor/React) unter den Füßen
      // wegziehen, wenn der Container die ganze Seite umfasst.
      var teile = this._marksOf(id), eltern = [];
      teile.forEach(function (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        if (eltern.indexOf(p) === -1) eltern.push(p);
      });
      eltern.forEach(function (p) { p.normalize(); });
      this._render();
      if (this.onDelete) this.onDelete(id);
      this._webhookAuto(weg, this.texte.aktionGeloescht);
      this._emitChange();
    },

    /* ---- Export / Import (W3C-nah) ---------------------------------- */
    _fileBase: function () {
      var safe = (this.autor || "kommentare").replace(/[^\w\-]+/g, "_").toLowerCase();
      return "kommentare_" + safe + "_" + new Date().toISOString().slice(0, 10);
    },
    _saveBlob: function (filename, text, mime) {
      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = el("a");
      a.href = url;
      a.download = filename;
      // Anker muss fuer manche Browser (aelteres Firefox) im Dokument haengen
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    _downloadJSON: function () {
      this._saveBlob(this._fileBase() + ".json", this.export(), "application/json");
    },
    _downloadMarkdown: function () {
      this._saveBlob(this._fileBase() + ".md", this.exportMarkdown(), "text/markdown;charset=utf-8");
    },
    // „Screenshot“ der Seite mit Notizen: Systemdruck -> „Als PDF speichern“.
    // Der Druck-Stil (@media print) blendet Bedienelemente aus.
    _print: function () {
      if (global.print) global.print();
    },
    _mailtoHref: function () {
      var T = this.texte;
      var subject = (this.emailSubject || T.emailBetreff);
      var title = (global.document && document.title) || "";
      if (title) subject += " – " + title;
      var src = global.location ? global.location.href : "";
      var intro = T.emailIntro + (src ? " (" + src + ")" : "") + ".\n\n";
      var md = this.exportMarkdown();
      var body = (intro + md).length <= 1500 ? intro + md : intro + T.emailAnhangHinweis;
      return "mailto:" + this.email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
    },
    // Lädt die Datei herunter (zum Anhängen) und öffnet einen E-Mail-Entwurf.
    // Ein echter Datei-Anhang ist per mailto nicht möglich (RFC 6068).
    _email: function () {
      if (!this.email) return;
      this._downloadJSON();
      if (global.location) global.location.href = this._mailtoHref();
    },

    /* ---- Meldestelle (webhook) --------------------------------------- */
    // Eine Annotation als flache Zeile — genau so, wie sie in einer Tabelle
    // (Google Sheet, Airtable, CSV) landen soll.
    _webhookEntry: function (a, aktion) {
      var T = this.texte;
      var art, stelle;
      if (a.kind === "element") {
        art = T.artElement;
        stelle = (a.tag || "") + (a.fingerprint ? ": " + a.fingerprint : "");
      } else if (a.kind === "point") {
        art = T.artPunkt;
        stelle = (a.tag || "") + " (" + Math.round((a.rx || 0) * 100) + "%, " +
                 Math.round((a.ry || 0) * 100) + "%)";
      } else {
        art = T.artText;
        stelle = a.quote || "";
      }
      var nav = global.navigator || {};
      var scr = global.screen || {};
      // Beim Löschen NICHT den vollen Wortlaut ein zweites Mal melden — die
      // Gegenstelle kennt ihn über die Kommentar-ID und soll die Zeile
      // räumen, nicht eine Kopie anlegen.
      var geloescht = aktion === T.aktionGeloescht;
      return {
        zeitpunkt:    new Date().toISOString(),
        erstellt:     a.created || "",
        seitenUrl:    sichereUrl(),
        seitenTitel:  (global.document && document.title) || "",
        autor:        a.author || "",
        art:          art,
        aktion:       aktion || T.aktionNeu,
        stelle:       geloescht ? "" : stelle,
        kommentar:    geloescht ? "" : (a.body || ""),
        kommentarId:  a.id,
        sitzung:      this._sitzung,
        userAgent:    nav.userAgent || "",
        sprache:      nav.language || "",
        bildschirm:   (scr.width || 0) + "×" + (scr.height || 0)
      };
    },
    // Eine Sendung verpacken (JSON-Text).
    _webhookPayload: function (entries) {
      var brief = {
        generator: "kommentar-tool",
        version: 1,
        gesendet: new Date().toISOString(),
        eintraege: entries
      };
      if (this.webhookToken) brief.token = this.webhookToken;
      return JSON.stringify(brief);
    },
    // Einträge so bündeln, dass jede Sendung unter der 64-KiB-Grenze bleibt,
    // die sowohl sendBeacon als auch fetch({keepalive:true}) setzen. Ein
    // einzelner überlanger Eintrag bleibt allein und geht ohne keepalive raus.
    _webhookBuendel: function (entries) {
      var buendel = [], aktuell = [], summe = 0, i, groesse;
      var huelle = byteLen(this._webhookPayload([])); // Grundgerüst der Sendung
      for (i = 0; i < entries.length; i++) {
        groesse = byteLen(JSON.stringify(entries[i])) + 1; // + Trennkomma
        if (aktuell.length && huelle + summe + groesse > WEBHOOK_MAX) {
          buendel.push(aktuell);
          aktuell = [];
          summe = 0;
        }
        aktuell.push(entries[i]);
        summe += groesse;
      }
      if (aktuell.length) buendel.push(aktuell);
      return buendel;
    },
    // Absenden ohne CORS-Vorabanfrage: 'text/plain' vermeidet den Preflight,
    // den ein Google-Apps-Script-Web-App nicht beantworten kann. Die Antwort
    // ist dadurch nicht lesbar — der Versand ist bewusst „abschicken und gut“.
    // Fehler, die der Browser DOCH meldet (z. B. Netz weg), landen am Knopf.
    _webhookSend: function (entries) {
      if (!this.webhook || !entries || !entries.length) return false;
      var self = this;
      var buendel = this._webhookBuendel(entries);
      // Das 64-KiB-Kontingent von sendBeacon/keepalive gilt für ALLE offenen
      // Anfragen zusammen — bei mehreren Bündeln scheiterten sonst alle bis
      // auf das erste. Dann lieber gewöhnliches fetch: kein Kontingent.
      var mitKeepalive = buendel.length === 1;
      var ok = true;
      buendel.forEach(function (teil) {
        if (!self._webhookPost(self._webhookPayload(teil), mitKeepalive)) ok = false;
      });
      return ok;
    },
    // erlaubeKeepalive: nur sinnvoll, wenn die Sendung einen Seitenwechsel
    // überleben soll (automatischer Einzelversand) — und nur unter 64 KiB.
    _webhookPost: function (payload, erlaubeKeepalive) {
      var self = this;
      var haltbar = !!erlaubeKeepalive && byteLen(payload) <= WEBHOOK_MAX;
      try {
        if (haltbar && global.navigator && global.navigator.sendBeacon) {
          var blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
          if (global.navigator.sendBeacon(this.webhook, blob)) return true;
          // Kontingent bereits ausgeschöpft -> ohne keepalive weiter,
          // sonst scheiterte auch der fetch-Versuch.
          haltbar = false;
        }
      } catch (_) { haltbar = false; }
      try {
        var opts = {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: payload
        };
        if (haltbar) opts.keepalive = true;
        global.fetch(this.webhook, opts)["catch"](function () {
          self._sendFeedback(self.texte.sendenFehler);
        });
        return true;
      } catch (_) { return false; }
    },
    // Automatischer Versand nach jeder eigenen Änderung (falls eingeschaltet).
    _webhookAuto: function (a, aktion) {
      if (!this.webhook || !this.webhookAuto || !a) return;
      this._webhookSend([this._webhookEntry(a, aktion)]);
    },
    // Kurze Rückmeldung am Knopf (eine Antwort vom Server gibt es nicht).
    _sendFeedback: function (text) {
      var btn = this._sendBtn;
      if (!btn) return;
      var self = this;
      if (this._sendTimer) global.clearTimeout(this._sendTimer);
      btn.textContent = text;
      this._sendTimer = global.setTimeout(function () {
        btn.textContent = self.texte.sendenBtn;
        self._sendTimer = null;
      }, 2500);
    },

    _readFiles: function (e) {
      var self = this;
      var files = Array.prototype.slice.call(e.target.files);
      var reads = files.map(function (file) {
        return file.text().then(function (text) {
          try { self.import(text); }
          catch (_) { global.alert(self.texte.leseFehler + file.name); }
        });
      });
      Promise.all(reads).then(function () { e.target.value = ""; });
    },

    /* ---- Öffentliche API -------------------------------------------- */
    export: function () {
      var self = this;
      var mine = Array.from(this.annos.values()).filter(function (a) {
        return a.author === self.autor;
      });
      var doc = {
        generator: "kommentar-tool",
        source: global.location ? global.location.href : "",
        sourceTitle: (global.document && document.title) || "",
        author: this.autor,
        exported: new Date().toISOString(),
        annotations: mine.map(toW3C)
      };
      return JSON.stringify(doc, null, 2);
    },

    // Lesbare „Nur Notizen“-Fassung der eigenen Kommentare (Markdown) mit
    // Seiten-URL/-Titel und je Notiz Wortlaut, Kommentar, Autor:in und Datum.
    exportMarkdown: function () {
      var self = this, T = this.texte;
      // visuelle Reihenfolge; Element-/Punkt-Annos haben kein pos
      var mine = this._sortByTop(Array.from(this.annos.values())
        .filter(function (a) { return a.author === self.autor; }));
      var title = (global.document && document.title) || "";
      var out = [];
      out.push("# " + T.notizenKopf + (title ? " – " + title : ""));
      out.push("");
      if (global.location) out.push(T.quelleLabel + " " + global.location.href);
      out.push(T.autorLabel + " " + (this.autor || T.platzhalterName));
      out.push(T.exportiertLabel + " " + new Date().toISOString());
      out.push("");
      if (!mine.length) out.push("_" + T.keineNotizen + "_");
      mine.forEach(function (a, i) {
        var head;
        if (a.kind === "element") {
          head = "⬚ " + (a.tag || T.elementLabel) +
            (a.fingerprint ? ": „" + a.fingerprint + "“" : "");
        } else if (a.kind === "point") {
          head = "📍 " + T.punktLabel + (a.tag ? " · " + a.tag : "");
        } else {
          head = "„" + a.quote + "“";
        }
        out.push("## " + (i + 1) + ". " + head);
        out.push("");
        out.push(a.body);
        out.push("");
        out.push("— " + (a.author || T.platzhalterName) +
          (a.created ? ", " + a.created.slice(0, 10) : ""));
        out.push("");
      });
      return out.join("\n");
    },

    import: function (jsonOrArray) {
      var data = jsonOrArray;
      // Kaputtes JSON wirft weiterhin (die Aufrufer melden es der Nutzerin),
      // aber eine gültige Datei mit unerwartetem Inhalt darf nicht werfen.
      if (typeof data === "string") data = JSON.parse(data);
      if (!data || typeof data !== "object") return 0;
      var arr = Array.isArray(data) ? data : (data.annotations || []);
      if (!Array.isArray(arr)) return 0;
      var added = 0;
      for (var i = 0; i < arr.length; i++) {
        var a = arr[i] && typeof arr[i] === "object" ? fromW3C(arr[i]) : null;
        if (a && a.id && !this.annos.has(a.id)) {
          this.annos.set(a.id, a);
          added++;
        }
      }
      this._relayout();
      this._render();
      if (added) this._emitChange();
      return added;
    },

    // Alle eigenen Kommentare an die Meldestelle schicken. Netz für den
    // automatischen Versand: Doppelte fängt die Gegenstelle über die
    // Kommentar-ID ab (siehe Apps-Script-Beispiel in der Dokumentation).
    send: function () {
      var self = this, T = this.texte;
      if (!this.webhook) return 0;
      var mine = this._sortByTop(Array.from(this.annos.values())
        .filter(function (a) { return a.author === self.autor; }));
      if (!mine.length) { this._sendFeedback(T.sendenLeer); return 0; }
      var ok = this._webhookSend(mine.map(function (a) {
        return self._webhookEntry(a, T.aktionNeu);
      }));
      this._sendFeedback(ok ? T.sendenOk + " (" + mine.length + ")" : T.sendenFehler);
      return ok ? mine.length : 0;
    },

    getAnnotations: function () {
      return Array.from(this.annos.values()).map(toW3C);
    },

    destroy: function () {
      // Ereignisse lösen
      this.container.removeEventListener("mouseup", this._onMouseUp);
      this.container.removeEventListener("touchend", this._onTouchEnd);
      this.container.removeEventListener("click", this._onContainerClick);
      this.container.removeEventListener("keydown", this._onContainerKey);
      if (this._onDocClick) document.removeEventListener("click", this._onDocClick);
      // Element-Kommentare: Listener/Beobachter lösen
      if (this._onElMove) this.container.removeEventListener("mousemove", this._onElMove);
      if (this._onElClick) this.container.removeEventListener("click", this._onElClick, true);
      if (this._onElKey) document.removeEventListener("keydown", this._onElKey);
      if (this._onRepos) {
        global.removeEventListener("scroll", this._onRepos, true);
        global.removeEventListener("resize", this._onRepos);
      }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._sendTimer) { global.clearTimeout(this._sendTimer); this._sendTimer = null; }
      if (this._mq && this._onMqChange) {
        if (this._mq.removeEventListener) this._mq.removeEventListener("change", this._onMqChange);
        else if (this._mq.removeListener) this._mq.removeListener(this._onMqChange);
        this._mq = null;
      }

      // Markierungen entfernen, Ausgangs-DOM wiederherstellen
      this._unwrapMarks();
      this.container.classList.remove("kommentare-scope", "kommentare-doc",
        "kommentare-dark", "kommentare-light", "kommentare-picking");
      // Container wieder freigeben, damit init() erneut greifen kann
      this.container.removeAttribute("data-kommentare-aktiv");
      this._sendBtn = null; // späte Rückmeldungen laufen ins Leere

      if (this._wrapper) {
        // Container an ursprüngliche Position zurücksetzen
        var home = this._containerHome;
        home.parent.insertBefore(this.container, home.next);
        if (this._wrapper.parentNode) this._wrapper.parentNode.removeChild(this._wrapper);
      }
      // von uns eingefügte Knoten entfernen
      this._insertedNodes.forEach(function (node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
      this._insertedNodes = [];
      this._wrapper = null;
      this.annos.clear();
    }
  };

  /* -------------------------------------------------------------------- */
  /* W3C-Konvertierung (Modul-Ebene, zustandslos)                          */
  /* -------------------------------------------------------------------- */
  function toW3C(a) {
    var base = {
      id: a.id, type: "Annotation", created: a.created,
      creator: { name: a.author },
      body: [{ type: "TextualBody", purpose: "commenting", value: a.body }]
    };
    if (a.kind === "element") {
      // W3C CssSelector fürs Element; Fingerprint als TextQuoteSelector-Refinement
      var elSel = [{ type: "CssSelector", value: a.css }];
      if (a.fingerprint) elSel.push({ type: "TextQuoteSelector", exact: a.fingerprint });
      base.target = { selector: elSel };
    } else if (a.kind === "point") {
      // CssSelector fürs Element + Media-Fragment (Prozent-Position rx,ry)
      var pSel = [
        { type: "CssSelector", value: a.css },
        { type: "FragmentSelector", conformsTo: "http://www.w3.org/TR/media-frags/",
          value: "xywh=percent:" + (a.rx * 100) + "," + (a.ry * 100) + ",0,0" }
      ];
      if (a.fingerprint) pSel.push({ type: "TextQuoteSelector", exact: a.fingerprint });
      base.target = { selector: pSel };
    } else {
      base.target = { selector: [
        { type: "TextQuoteSelector", exact: a.quote, prefix: a.prefix, suffix: a.suffix },
        { type: "TextPositionSelector", start: a.pos.start, end: a.pos.end }
      ] };
    }
    return base;
  }
  function fromW3C(o) {
    try {
      var sel = (o.target && o.target.selector) || [];
      var css = sel.find(function (s) { return s.type === "CssSelector"; });
      var frag = sel.find(function (s) { return s.type === "FragmentSelector"; });
      var q = sel.find(function (s) { return s.type === "TextQuoteSelector"; }) || {};
      var p = sel.find(function (s) { return s.type === "TextPositionSelector"; }) || {};
      var body = (o.body || []).map(function (b) { return b.value; })
        .filter(Boolean).join("\n");
      var common = {
        id: o.id, body: body,
        author: (o.creator && o.creator.name) || "?", created: o.created || ""
      };
      function tagOf(value) {
        var segs = String(value || "").split(">");
        var last = segs[segs.length - 1].trim();
        var m = last.match(/^([a-zA-Z][\w-]*)/); // '' bei reinem #id-Selektor
        return m ? m[1].toLowerCase() : "";
      }
      if (css && frag && /xywh=percent:/i.test(frag.value || "")) {
        // Punkt-Annotation: rx,ry aus dem Media-Fragment
        var nums = String(frag.value).replace(/^.*percent:/i, "").split(",");
        common.kind = "point";
        common.css = css.value || "";
        common.tag = tagOf(css.value);
        common.fingerprint = q.exact || "";
        common.rx = Math.min(1, Math.max(0, (parseFloat(nums[0]) || 0) / 100));
        common.ry = Math.min(1, Math.max(0, (parseFloat(nums[1]) || 0) / 100));
        return common;
      }
      if (css) {
        // Element-Annotation
        common.kind = "element";
        common.css = css.value || "";
        common.tag = tagOf(css.value);
        common.fingerprint = q.exact || "";
        return common;
      }
      common.kind = "text";
      common.quote = q.exact || ""; common.prefix = q.prefix || ""; common.suffix = q.suffix || "";
      common.pos = { start: p.start || 0, end: p.end || 0 };
      return common;
    } catch (_) { return null; }
  }

  /* -------------------------------------------------------------------- */
  /* Öffentliches Objekt                                                   */
  /* -------------------------------------------------------------------- */
  var Kommentare = {
    init: function (options) { return new Instanz(options); },
    TEXTE: TEXTE
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Kommentare;
  global.Kommentare = Kommentare;

})(typeof window !== "undefined" ? window : this);
