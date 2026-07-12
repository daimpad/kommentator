/* ============================================================================
   demo.js — nur für die Demo-Seite.
   ----------------------------------------------------------------------------
   Startet das Kommentar-Werkzeug und bietet Demo-Komfort: Autor:in wechseln
   ohne Neuladen sowie einen Hell-/Dunkel-Umschalter, der auch die Demo-Seite
   selbst umfärbt (über data-theme am <html>).

   In einer echten Einbindung genügt der init-Aufruf – siehe README / Hilfe-Button.
   ========================================================================== */
(function () {
  "use strict";

  var autorInput = document.getElementById("autor");
  var applyBtn = document.getElementById("apply");

  // aktueller Theme-Zustand ("auto" | "light" | "dark"), über Umschalter gesetzt
  var current = document.documentElement.getAttribute("data-theme") || "auto";

  function applyPageTheme(theme) {
    current = theme;
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }

  function start(name) {
    return window.Kommentare.init({
      container: "[data-kommentierbar]",
      autor: name,
      help: true,          // „?“-Button mit Kurzanleitung
      themeToggle: true,    // Hell-/Dunkel-Umschalter in der Aktionsleiste
      theme: current,       // Anfangszustand übernehmen
      onThemeChange: applyPageTheme // Demo-Seite mit umfärben
    });
  }

  function currentName() {
    return (autorInput && autorInput.value.trim()) || "Gast";
  }

  window.instanz = start(currentName());

  // Autor:in wechseln: Instanz neu aufbauen, Notizen erhalten.
  if (applyBtn) {
    applyBtn.addEventListener("click", function () {
      var name = currentName();
      var annos = window.instanz.getAnnotations();
      window.instanz.destroy();
      window.instanz = start(name);
      window.instanz.import(annos);
    });
  }
})();
