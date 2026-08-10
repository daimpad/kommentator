/* ============================================================================
   demo.js — nur für die Demo-Seite.
   ----------------------------------------------------------------------------
   Beim Laden erscheint ein Namens-Modal. Nach „Übernehmen“ wird es dauerhaft
   ausgeblendet und das Werkzeug gestartet: volle Breite Text, rechts die
   ziehbare Notizspalte, alle Funktionen hinter dem Button unten rechts (☰).

   In einer echten Einbindung genügt der init-Aufruf – siehe „Für
   Entwickler:innen“ am Seitenende oder die README.
   ========================================================================== */
(function () {
  "use strict";

  var gate = document.getElementById("gate");
  var nameInput = document.getElementById("gate-name");
  var goBtn = document.getElementById("gate-go");
  var themeBtn = document.getElementById("gate-theme");

  // Theme-Zustand ("auto" | "light" | "dark") – vom Umschalter im Menü gesetzt
  var currentTheme = document.documentElement.getAttribute("data-theme") || "auto";

  function systemIstDunkel() {
    return !!(window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  // "auto" heißt: was das System gerade vorgibt.
  function effektivesTheme() {
    if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
    return systemIstDunkel() ? "dark" : "light";
  }

  // Der Knopf zeigt, wohin es geht: im Hellen der Mond, im Dunkeln die Sonne.
  function themeKnopfAuffrischen() {
    if (!themeBtn) return;
    var dunkel = effektivesTheme() === "dark";
    themeBtn.textContent = dunkel ? "☀" : "☾";
    themeBtn.setAttribute("aria-pressed", dunkel ? "true" : "false");
  }

  function applyPageTheme(theme) {
    currentTheme = theme;
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    themeKnopfAuffrischen();
  }

  function start(name) {
    window.instanz = window.Kommentare.init({
      container: "[data-kommentierbar]",
      autor: name,
      toolbarMode: "floating",   // Funktionen hinter dem Button unten rechts
      resizable: true,           // Notizspalte am Griff breiter ziehbar
      help: true,                // „?“ mit Kurzanleitung (im Menü)
      themeToggle: true,         // ☾/☀ im Menü
      theme: currentTheme,
      email: "kontakt@nozilla.de", // „Per E-Mail senden“ öffnet Entwurf an diese Adresse
      // Zentrale Sammelstelle (optional, hier bewusst aus): mit einer Adresse
      // landen neue Kommentare automatisch in einer Tabelle, z. B. einem Google
      // Sheet hinter einem Apps-Script-Web-App. Siehe TUTORIAL.md, Abschnitt 8.
      //   webhook: "https://script.google.com/macros/s/…/exec",
      onThemeChange: applyPageTheme // Demo-Seite mitfärben
    });
  }

  function enter() {
    var name = (nameInput && nameInput.value.trim()) || "Gast";
    if (gate) gate.style.display = "none"; // Modal dauerhaft ausblenden
    start(name);
  }

  if (goBtn) goBtn.addEventListener("click", enter);
  if (nameInput) nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") enter();
  });

  // Hell/Dunkel schon im Modal umschaltbar — sonst säße man bis nach dem
  // Start in einer Ansicht fest, die man vielleicht gar nicht will. Die Wahl
  // geht als `theme` in init() und landet danach im Umschalter des Menüs.
  if (themeBtn) themeBtn.addEventListener("click", function () {
    applyPageTheme(effektivesTheme() === "dark" ? "light" : "dark");
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var folgen = function () { if (currentTheme === "auto") themeKnopfAuffrischen(); };
    if (mq.addEventListener) mq.addEventListener("change", folgen);
    else if (mq.addListener) mq.addListener(folgen);
  }
  themeKnopfAuffrischen();

  if (nameInput) nameInput.focus();
})();
