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

  // Theme-Zustand ("auto" | "light" | "dark") – vom Umschalter im Menü gesetzt
  var currentTheme = document.documentElement.getAttribute("data-theme") || "auto";

  function applyPageTheme(theme) {
    currentTheme = theme;
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
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
  if (nameInput) nameInput.focus();
})();
