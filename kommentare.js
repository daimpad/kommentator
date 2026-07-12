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
         onCreate  : (anno) => void        (Callback nach dem Anlegen)
         onDelete  : (id)   => void        (Callback nach dem Löschen)
       }
     instanz.export()          -> JSON-String (nur eigene Kommentare)
     instanz.import(jsonOrArr) -> führt Annotationen zusammen (dedupliziert nach id)
     instanz.getAnnotations()  -> Array (W3C-nahe Annotationen)
     instanz.destroy()         -> entfernt Markierungen, stellt DOM wieder her
   ========================================================================== */
(function (global) {
  "use strict";

  /* Zentral gebündelte, leicht anpassbare deutsche UI-Texte. */
  var TEXTE = {
    notizenKopf:        "Notizen",
    leer:               "Noch keine Kommentare. Markiere eine Textstelle, um zu beginnen.",
    kommentarPlatzhalter:"Kommentar…",
    abbrechen:          "Abbrechen",
    speichern:          "Speichern",
    loeschen:           "löschen",
    ladenBtn:           "Kommentare laden",
    ladenTitel:         "Exportierte Kommentar-Dateien einlesen und zusammenführen",
    herunterladenBtn:   "Meine Kommentare herunterladen",
    titel:              "Kommentar-Tool",
    autorLabel:         "Autor:in:",
    platzhalterName:    "—",
    einKommentar:       " Kommentar",
    mehrereKommentare:  " Kommentare",
    leseFehler:         "Datei konnte nicht gelesen werden: "
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
    this.onDelete = typeof options.onDelete === "function" ? options.onDelete : null;

    this.annos = new Map();   // id -> interne Annotation
    this.pending = null;      // {start,end,quote,prefix,suffix}

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
      var c = this.container;
      c.classList.add("kommentare-scope", "kommentare-doc");

      // Aktionsleiste
      var toolbar = el("div", "kommentare-toolbar kommentare-scope");
      var titleEl = el("span", "kommentare-title"); titleEl.textContent = TEXTE.titel;
      var whoEl = el("span", "kommentare-who");
      whoEl.innerHTML = TEXTE.autorLabel + " <b></b>";
      this._whoName = whoEl.querySelector("b");
      this._whoName.textContent = this.autor || TEXTE.platzhalterName;
      var actions = el("span", "kommentare-actions");
      var importBtn = el("button", "kommentare-btn");
      importBtn.type = "button";
      importBtn.textContent = TEXTE.ladenBtn;
      importBtn.title = TEXTE.ladenTitel;
      var exportBtn = el("button", "kommentare-btn");
      exportBtn.type = "button";
      exportBtn.textContent = TEXTE.herunterladenBtn;
      actions.appendChild(importBtn);
      actions.appendChild(exportBtn);
      var countEl = el("span", "kommentare-count");
      toolbar.appendChild(titleEl);
      toolbar.appendChild(whoEl);
      toolbar.appendChild(actions);
      toolbar.appendChild(countEl);
      if (this.readOnly) actions.classList.add("kommentare-hidden");

      // Randspalte
      var margin = el("aside", "kommentare-margin kommentare-scope");
      var head = el("div", "kommentare-margin-head"); head.textContent = TEXTE.notizenKopf;
      var notes = el("div", "kommentare-notes");
      var empty = el("div", "kommentare-empty"); empty.textContent = TEXTE.leer;
      margin.appendChild(head);
      margin.appendChild(notes);
      margin.appendChild(empty);

      // Kommentar-Eingabe (Popover, an <body> gehängt)
      var compose = el("div", "kommentare-compose kommentare-scope kommentare-hidden");
      var textarea = el("textarea");
      textarea.placeholder = TEXTE.kommentarPlatzhalter;
      var row = el("div", "kommentare-compose-row");
      var cancelBtn = el("button", "kommentare-btn"); cancelBtn.type = "button"; cancelBtn.textContent = TEXTE.abbrechen;
      var saveBtn = el("button", "kommentare-btn"); saveBtn.type = "button"; saveBtn.textContent = TEXTE.speichern;
      row.appendChild(cancelBtn);
      row.appendChild(saveBtn);
      compose.appendChild(textarea);
      compose.appendChild(row);

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

      if (autoToolbar && autoMargin) {
        // vollständiges Layout selbst erzeugen und den Container umschließen
        var parent = c.parentNode;
        this._containerHome = { parent: parent, next: c.nextSibling };
        var wrapper = el("div", "kommentare kommentare-scope");
        var body = el("div", "kommentare-body");
        parent.insertBefore(wrapper, c);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(body);
        body.appendChild(c);       // Container wird zur Dokumentspalte
        body.appendChild(margin);  // Randspalte daneben
        this._wrapper = wrapper;
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

      document.body.appendChild(compose);
      document.body.appendChild(fileIn);
      this._insertedNodes.push(compose, fileIn);
    },

    /* ---- Ereignisse verdrahten (instanz-lokal gebunden) -------------- */
    _bindEvents: function () {
      var self = this;

      this._onMouseUp = function () { self._handleSelection(); };
      this._onContainerClick = function (e) {
        var m = e.target.closest("mark.kommentare-mark");
        if (m && self.container.contains(m)) self._focusAnno(m.dataset.annoId);
      };
      if (!this.readOnly) this.container.addEventListener("mouseup", this._onMouseUp);
      this.container.addEventListener("click", this._onContainerClick);

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
        range.surroundContents(m);
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

    _relayout: function () { // alle Markierungen neu aufbauen (nach Import)
      this._unwrapMarks();
      var full = this._plainText();
      this.annos.forEach(function (a) {
        var start = a.pos.start, end = a.pos.end;
        if (full.slice(start, end) !== a.quote) { // Fallback: per Wortlaut ankern
          var idx = a.quote ? full.indexOf(a.quote) : -1;
          if (idx < 0) return;
          start = idx; end = idx + a.quote.length; a.pos = { start: start, end: end };
        }
        this._wrapRange(start, end, a.id);
      }, this);
    },

    /* ---- Auswahl -> Kommentar --------------------------------------- */
    _handleSelection: function () {
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
      var x = rect.left + window.scrollX, y = rect.bottom + window.scrollY + 6;
      x = Math.min(x, window.scrollX + document.documentElement.clientWidth - cw - 8);
      if (y + ch > window.scrollY + document.documentElement.clientHeight)
        y = rect.top + window.scrollY - ch - 6;
      c.style.left = Math.max(8, x) + "px";
      c.style.top = Math.max(8, y) + "px";
      this._composeText.value = "";
      this._composeText.focus();
    },
    _closeCompose: function () {
      this._composeEl.classList.add("kommentare-hidden");
      this.pending = null;
    },

    _saveComment: function () {
      var val = this._composeText.value.trim();
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
    },

    /* ---- Randspalte ------------------------------------------------- */
    _render: function () {
      var self = this;
      var notes = this._notesEl;
      notes.innerHTML = "";
      var list = Array.from(this.annos.values()).sort(function (a, b) {
        return a.pos.start - b.pos.start;
      });
      this._emptyEl.classList.toggle("kommentare-hidden", list.length > 0);

      list.forEach(function (a) {
        var note = el("div", "kommentare-note");
        note.dataset.annoId = a.id;
        var mine = a.author === self.autor;
        var quoteEl = el("blockquote");
        quoteEl.textContent = "„" + a.quote + "“";
        var bodyEl = el("div", "kommentare-note-body");
        bodyEl.textContent = a.body;
        var metaEl = el("div", "kommentare-note-meta");
        var nameEl = el("span");
        nameEl.textContent = a.author || TEXTE.platzhalterName;
        metaEl.appendChild(nameEl);
        if (mine && !self.readOnly) {
          var delBtn = el("button", "kommentare-btn");
          delBtn.type = "button";
          delBtn.textContent = TEXTE.loeschen;
          delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            self._removeAnno(a.id);
          });
          metaEl.appendChild(delBtn);
        }
        note.appendChild(quoteEl);
        note.appendChild(bodyEl);
        note.appendChild(metaEl);
        note.addEventListener("click", function () { self._focusAnno(a.id); });
        notes.appendChild(note);
      });

      var n = this.annos.size;
      this._countEl.textContent = n + (n === 1 ? TEXTE.einKommentar : TEXTE.mehrereKommentare);
      var mineCount = list.filter(function (a) { return a.author === self.autor; }).length;
      this._exportBtn.disabled = mineCount === 0;
    },

    _focusAnno: function (id) {
      this.container.querySelectorAll("mark.kommentare-mark.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      this._marginEl.querySelectorAll(".kommentare-note.is-active")
        .forEach(function (e) { e.classList.remove("is-active"); });
      var m = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + id + '"]');
      var note = this._marginEl.querySelector('.kommentare-note[data-anno-id="' + id + '"]');
      if (m) { m.classList.add("is-active"); m.scrollIntoView({ block: "center" }); }
      if (note) note.classList.add("is-active");
    },

    _removeAnno: function (id) {
      this.annos.delete(id);
      var m = this.container.querySelector('mark.kommentare-mark[data-anno-id="' + id + '"]');
      if (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        this.container.normalize();
      }
      this._render();
      if (this.onDelete) this.onDelete(id);
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
          catch (_) { global.alert(TEXTE.leseFehler + file.name); }
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
      return added;
    },

    getAnnotations: function () {
      return Array.from(this.annos.values()).map(toW3C);
    },

    destroy: function () {
      // Ereignisse lösen
      this.container.removeEventListener("mouseup", this._onMouseUp);
      this.container.removeEventListener("click", this._onContainerClick);

      // Markierungen entfernen, Ausgangs-DOM wiederherstellen
      this._unwrapMarks();
      this.container.classList.remove("kommentare-scope", "kommentare-doc");

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
