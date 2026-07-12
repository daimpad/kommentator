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
         onCreate  : (anno) => void        (Callback nach dem Anlegen)
         onUpdate  : (anno) => void        (Callback nach dem Bearbeiten)
         onDelete  : (id)   => void        (Callback nach dem Löschen)
         onChange  : (annos) => void       (Callback nach jeder Änderung; z. B.
                                            um extern zu speichern – ohne Backend)
       }
     instanz.export()          -> JSON-String (nur eigene Kommentare)
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
    titel:              "Kommentar-Tool",
    autorLabel:         "Autor:in:",
    platzhalterName:    "—",
    einKommentar:       " Kommentar",
    mehrereKommentare:  " Kommentare",
    leseFehler:         "Datei konnte nicht gelesen werden: ",
    markierungAria:     "Kommentar",        // Präfix für aria-label der Markierung
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
    hilfeHinweis: "Das Namensfeld ordnet Kommentare nur einer Person zu — es ist kein Zugriffsschutz. Beim Export werden die Seiten-URL und der Seitentitel mitgespeichert, damit erkennbar bleibt, zu welcher Seite die Kommentare gehören.",
    menuAria:           "Kommentar-Menü öffnen",
    menuTitel:          "Kommentator",
    groesseAria:        "Randspalte breiter oder schmaler ziehen"
  };

  var idSeed = 0; // fortlaufend, damit gleichzeitig erzeugte Ids eindeutig bleiben

  /* -------------------------------------------------------------------- */
  /* Hilfsfunktionen                                                       */
  /* -------------------------------------------------------------------- */
  function resolve(elOrSel) {
    if (!elOrSel) return null;
    return typeof elOrSel === "string" ? document.querySelector(elOrSel) : elOrSel;
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
    // Randspalte im Auto-Layout per Ziehgriff breiter/schmaler ziehbar
    this.resizable = options.resizable !== false;
    this._notesWidth = options.notesWidth || null; // z. B. "22rem" oder "320px"

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
      c.classList.add("kommentare-scope", "kommentare-doc");

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

      var importBtn = el("button", "kommentare-btn");
      importBtn.type = "button";
      importBtn.textContent = T.ladenBtn;
      importBtn.title = T.ladenTitel;
      var exportBtn = el("button", "kommentare-btn kommentare-btn-primary");
      exportBtn.type = "button";
      exportBtn.textContent = T.herunterladenBtn;
      actions.appendChild(importBtn);
      actions.appendChild(exportBtn);
      var countEl = el("span", "kommentare-count");
      toolbar.appendChild(titleEl);
      toolbar.appendChild(whoEl);
      toolbar.appendChild(actions);
      toolbar.appendChild(countEl);
      // readOnly: nur Import/Export ausblenden – Hilfe/Theme bleiben nutzbar
      if (this.readOnly) {
        importBtn.classList.add("kommentare-hidden");
        exportBtn.classList.add("kommentare-hidden");
      }
      this._helpBtn = helpBtn;
      this._themeBtn = themeBtn;

      // Randspalte
      var margin = el("aside", "kommentare-margin kommentare-scope");
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
        (T.hilfeSchritte || []).forEach(function (s) {
          var li = el("li");
          var b = el("b"); b.textContent = s[0];
          li.appendChild(b);
          li.appendChild(document.createTextNode(" — " + s[1]));
          helpList.appendChild(li);
        });
        var helpNote = el("p", "kommentare-help-note"); helpNote.textContent = T.hilfeHinweis;
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
      var floating = this.toolbarMode === "floating" && autoToolbar;
      if (floating) titleEl.textContent = T.menuTitel;

      // Ziehgriff zwischen Dokument und Randspalte (nur Auto-Layout)
      var gutter = null;
      if (autoMargin && this.resizable) {
        gutter = el("div", "kommentare-gutter");
        gutter.setAttribute("role", "separator");
        gutter.setAttribute("aria-orientation", "vertical");
        gutter.setAttribute("aria-label", T.groesseAria);
        gutter.setAttribute("tabindex", "0");
      }
      this._gutterEl = gutter;

      if (autoToolbar && autoMargin) {
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

      // Floating-Modus: Aktionsleiste in ein Menü hinter einem Button unten rechts
      var fab = null, panel = null;
      if (floating) {
        panel = el("div", "kommentare-panel kommentare-scope kommentare-hidden");
        panel.setAttribute("role", "menu");
        panel.setAttribute("aria-label", T.menuTitel);
        panel.appendChild(toolbar);
        fab = el("button", "kommentare-fab kommentare-scope");
        fab.type = "button";
        fab.setAttribute("aria-label", T.menuAria);
        fab.setAttribute("aria-expanded", "false");
        fab.textContent = "☰";
        document.body.appendChild(panel);
        document.body.appendChild(fab);
        this._insertedNodes.push(panel, fab);
      }
      this._fabEl = fab;
      this._panelEl = panel;

      document.body.appendChild(compose);
      document.body.appendChild(fileIn);
      this._insertedNodes.push(compose, fileIn);
      if (help) { document.body.appendChild(help); this._insertedNodes.push(help); }

      // Elemente sammeln, die die Theme-Klasse tragen, und Anfangs-Theme setzen
      this._scopeEls = [this.container, toolbar, margin, compose];
      if (help) this._scopeEls.push(help);
      if (fab) this._scopeEls.push(fab);
      if (panel) this._scopeEls.push(panel);
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
      this._onExportClick = function () { self._download(); };
      this._onFileChange = function (e) { self._readFiles(e); };
      this._importBtn.addEventListener("click", this._onImportClick);
      this._exportBtn.addEventListener("click", this._onExportClick);
      this._fileIn.addEventListener("change", this._onFileChange);

      // Hilfe-Panel
      if (this._helpBtn && this._helpEl) {
        this._onHelpOpen = function () { self._openHelp(); };
        this._onHelpClose = function () { self._closeHelp(); };
        this._onHelpBackdrop = function (e) { if (e.target === self._helpEl) self._closeHelp(); };
        this._onHelpKey = function (e) { if (e.key === "Escape") self._closeHelp(); };
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
        try { self._gutterEl.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    },

    _emitChange: function () {
      if (this.onChange) this.onChange(this.getAnnotations());
    },

    /* ---- Hilfe-Panel ------------------------------------------------- */
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
      var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) out.push(n);
      return out;
    },
    _globalOffset: function (node, off) {
      var sum = 0, nodes = this._textNodes(this.container);
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] === node) return sum + off;
        sum += nodes[i].nodeValue.length;
      }
      return sum;
    },
    _plainText: function () {
      return this._textNodes(this.container).map(function (t) { return t.nodeValue; }).join("");
    },

    /* ---- Bereich [start,end) mit <mark> umschließen (knotenübergreifend) */
    _wrapRange: function (start, end, id) {
      var anno = this.annos.get(id);
      var label = anno
        ? (this.texte.markierungAria + " " + this.texte.von + " " +
           (anno.author || this.texte.platzhalterName) + ": „" + anno.quote + "“")
        : this.texte.markierungAria;

      var hits = [], pos = 0, nodes = this._textNodes(this.container);
      for (var i = 0; i < nodes.length; i++) {
        var t = nodes[i], s = pos, e = pos + t.nodeValue.length;
        pos = e;
        var from = Math.max(start, s), to = Math.min(end, e);
        if (from < to) hits.push({ node: t, from: from - s, to: to - s });
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

    _unwrapMarks: function () {
      var marks = this.container.querySelectorAll("mark.kommentare-mark");
      marks.forEach(function (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
      });
      this.container.normalize();
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

    _relayout: function () { // alle Markierungen neu aufbauen (nach Import)
      this._unwrapMarks();
      var full = this._plainText();
      this.annos.forEach(function (a) {
        var anchor = this._findAnchor(full, a);
        if (!anchor) return;
        a.pos = { start: anchor.start, end: anchor.end };
        this._wrapRange(anchor.start, anchor.end, a.id);
      }, this);
    },

    /* ---- Auswahl -> Kommentar --------------------------------------- */
    _handleSelection: function () {
      if (this.readOnly) return;
      var sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      var r = sel.getRangeAt(0);
      if (!this.container.contains(r.commonAncestorContainer)) return;
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
    _closeCompose: function () {
      this._composeEl.classList.add("kommentare-hidden");
      this.pending = null;
      this._editing = null;
    },

    _saveComment: function () {
      var val = this._composeText.value.trim();

      // Bearbeiten einer bestehenden Annotation
      if (this._editing) {
        var a = this.annos.get(this._editing);
        if (!val || !a) { this._closeCompose(); return; }
        a.body = val;
        this._closeCompose();
        this._render();
        if (this.onUpdate) this.onUpdate(toW3C(a));
        this._emitChange();
        return;
      }

      // Neue Annotation
      if (!val || !this.pending) { this._closeCompose(); return; }
      var p = this.pending;
      var id = newId();
      var anno = {
        id: id, quote: p.quote, prefix: p.prefix, suffix: p.suffix,
        pos: { start: p.start, end: p.end }, body: val, author: this.autor,
        created: new Date().toISOString()
      };
      this.annos.set(id, anno);
      this._wrapRange(p.start, p.end, id);
      this._closeCompose();
      this._render();
      if (this.onCreate) this.onCreate(toW3C(anno));
      this._emitChange();
    },

    _startEdit: function (id) {
      if (this.readOnly || !this.annos.has(id)) return;
      this.pending = null;
      this._editing = id;
      var m = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + cssEscape(id) + '"]');
      var rect = m ? m.getBoundingClientRect() : { left: 40, right: 40, top: 80, bottom: 80 };
      this._openCompose(rect);
    },

    /* ---- Randspalte ------------------------------------------------- */
    _render: function () {
      var self = this, T = this.texte;
      var notes = this._notesEl;
      notes.innerHTML = "";
      var list = Array.from(this.annos.values()).sort(function (a, b) {
        return a.pos.start - b.pos.start;
      });
      this._emptyEl.classList.toggle("kommentare-hidden", list.length > 0);

      list.forEach(function (a) {
        var note = el("div", "kommentare-note");
        note.dataset.annoId = a.id;
        note.setAttribute("role", "listitem");
        note.setAttribute("tabindex", "0");
        var mine = a.author === self.autor;
        var quoteEl = el("blockquote");
        quoteEl.textContent = "„" + a.quote + "“";
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
      this._exportBtn.disabled = mineCount === 0;
    },

    _focusAnno: function (id) {
      var sel = cssEscape(id);
      this.container.querySelectorAll("mark.kommentare-mark.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      this._marginEl.querySelectorAll(".kommentare-note.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      var m = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + sel + '"]');
      var note = this._marginEl.querySelector('.kommentare-note[data-anno-id="' + sel + '"]');
      if (m) { m.classList.add("is-active"); m.scrollIntoView({ block: "center" }); }
      if (note) note.classList.add("is-active");
    },

    _removeAnno: function (id) {
      this.annos.delete(id);
      var m = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + cssEscape(id) + '"]');
      if (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        this.container.normalize();
      }
      this._render();
      if (this.onDelete) this.onDelete(id);
      this._emitChange();
    },

    /* ---- Export / Import (W3C-nah) ---------------------------------- */
    _download: function () {
      var json = this.export();
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = el("a");
      var safe = (this.autor || "kommentare").replace(/[^\w\-]+/g, "_").toLowerCase();
      a.href = url;
      a.download = "kommentare_" + safe + "_" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
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

    import: function (jsonOrArray) {
      var data = jsonOrArray;
      if (typeof data === "string") data = JSON.parse(data);
      var arr = Array.isArray(data) ? data : (data && data.annotations) || [];
      var added = 0;
      for (var i = 0; i < arr.length; i++) {
        var a = fromW3C(arr[i]);
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

      // Markierungen entfernen, Ausgangs-DOM wiederherstellen
      this._unwrapMarks();
      this.container.classList.remove("kommentare-scope", "kommentare-doc",
        "kommentare-dark", "kommentare-light");

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
    return {
      id: a.id, type: "Annotation", created: a.created,
      creator: { name: a.author },
      body: [{ type: "TextualBody", purpose: "commenting", value: a.body }],
      target: { selector: [
        { type: "TextQuoteSelector", exact: a.quote, prefix: a.prefix, suffix: a.suffix },
        { type: "TextPositionSelector", start: a.pos.start, end: a.pos.end }
      ] }
    };
  }
  function fromW3C(o) {
    try {
      var sel = (o.target && o.target.selector) || [];
      var q = sel.find(function (s) { return s.type === "TextQuoteSelector"; }) || {};
      var p = sel.find(function (s) { return s.type === "TextPositionSelector"; }) || {};
      var body = (o.body || []).map(function (b) { return b.value; })
        .filter(Boolean).join("\n");
      return {
        id: o.id, quote: q.exact || "", prefix: q.prefix || "", suffix: q.suffix || "",
        pos: { start: p.start || 0, end: p.end || 0 }, body: body,
        author: (o.creator && o.creator.name) || "?", created: o.created || ""
      };
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
