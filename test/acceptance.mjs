/* ============================================================================
   Akzeptanztest (headless, Playwright) für das Kommentar-Werkzeug.
   ----------------------------------------------------------------------------
   Voraussetzung:
     npm install --save-dev playwright
     npx playwright install chromium
   Ausführen:
     node test/acceptance.mjs
   Optional (vorinstalliertes Chromium):
     CHROMIUM_PATH=/pfad/zu/chrome node test/acceptance.mjs
   ========================================================================== */
import { chromium } from "playwright";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoUrl = pathToFileURL(resolve(__dirname, "..", "demo.html")).href;

const launchOpts = { args: ["--no-sandbox"] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "PASS" : "FAIL") + " — " + name);
}

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

// Demo lädt jetzt mit Namens-Modal; laden + Modal bestätigen (Autor „Gast").
async function load() {
  await page.goto(demoUrl);
  await page.fill("#gate-name", "Gast");
  await page.click("#gate-go");
}
await load();

// Auswahl im Container per exaktem Text erzeugen und Kommentar speichern.
async function selectAndComment(exact, comment) {
  await page.evaluate((exact) => {
    const content = document.getElementById("content");
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node, full = "", map = [];
    while ((node = walker.nextNode())) { map.push([full.length, node]); full += node.nodeValue; }
    const idx = full.indexOf(exact);
    if (idx < 0) throw new Error("not found: " + exact);
    const end = idx + exact.length;
    const locate = (off) => { let prev = map[0]; for (const [s, n] of map) { if (off < s) break; prev = [s, n]; } return { node: prev[1], offset: off - prev[0] }; };
    const a = locate(idx), b = locate(end);
    const range = document.createRange();
    range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    content.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, exact);
  await page.fill(".kommentare-compose textarea", comment);
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".kommentare-compose .kommentare-btn");
    btns[btns.length - 1].click(); // Speichern
  });
}

// --- Abnahmekriterium 1: Markieren -> Kommentieren ---
await selectAndComment("Zeichenposition im Text", "Erster Kommentar von Gast.");
check("Markierung im Text erzeugt", (await page.locator("#content mark.kommentare-mark").count()) === 1);
check("Notiz in Randspalte erzeugt", (await page.locator(".kommentare-note").count()) === 1);

// A11y-Attribute an der Markierung
const markAttrs = await page.evaluate(() => {
  const m = document.querySelector("#content mark.kommentare-mark");
  return { role: m.getAttribute("role"), tab: m.getAttribute("tabindex"), aria: m.getAttribute("aria-label") };
});
check("A11y: Markierung hat role=button", markAttrs.role === "button");
check("A11y: Markierung ist fokussierbar (tabindex=0)", markAttrs.tab === "0");
check("A11y: Markierung hat aria-label", !!markAttrs.aria && markAttrs.aria.includes("Zeichenposition"));

// Export (nur eigener Autor) -> W3C-JSON
const exported = await page.evaluate(() => instanz.export());
const parsed = JSON.parse(exported);
check("Export ist gültiges JSON mit 1 Annotation", parsed.annotations && parsed.annotations.length === 1);
const w3c = parsed.annotations[0];
check("W3C: type Annotation", w3c.type === "Annotation");
check("W3C: TextQuoteSelector", w3c.target.selector.some((s) => s.type === "TextQuoteSelector"));
check("W3C: TextPositionSelector", w3c.target.selector.some((s) => s.type === "TextPositionSelector"));
check("Export: sourceTitle vorhanden", typeof parsed.sourceTitle === "string" && parsed.sourceTitle.length > 0);

// --- Download-Formate (Markdown), Drucken, E-Mail ---
const md = await page.evaluate(() => instanz.exportMarkdown());
check("Markdown: Kopf & Quelle", md.startsWith("# Notizen") && md.includes("Quelle:"));
check("Markdown: Wortlaut enthalten", md.includes("Zeichenposition im Text"));
check("Markdown: Kommentartext enthalten", md.includes("Erster Kommentar von Gast."));

const dlBtns = await page.evaluate(() =>
  [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")].map((b) => b.textContent));
check("Download: JSON-Button", dlBtns.includes("Kommentare (JSON)"));
check("Download: Markdown-Button", dlBtns.includes("Notizen (Markdown)"));
check("Download: Drucken/PDF-Button", dlBtns.includes("Als PDF / drucken"));
check("E-Mail: Button vorhanden (email gesetzt)", dlBtns.includes("Per E-Mail senden"));

const mailto = await page.evaluate(() => instanz._mailtoHref());
check("E-Mail: mailto an kontakt@nozilla.de", mailto.startsWith("mailto:kontakt@nozilla.de?subject="));
check("E-Mail: Body enthält den Kommentar", decodeURIComponent(mailto).includes("Erster Kommentar von Gast."));

// --- Hilfe-Button öffnet/schließt das Panel ---
const helpInitiallyHidden = await page.evaluate(() =>
  document.querySelector(".kommentare-help").classList.contains("kommentare-hidden"));
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")]
    .find((x) => x.getAttribute("aria-label") === "Hilfe anzeigen");
  b.click();
});
const helpOpened = await page.evaluate(() =>
  !document.querySelector(".kommentare-help").classList.contains("kommentare-hidden"));
await page.keyboard.press("Escape");
const helpClosed = await page.evaluate(() =>
  document.querySelector(".kommentare-help").classList.contains("kommentare-hidden"));
check("Hilfe: Panel initial verborgen", helpInitiallyHidden === true);
check("Hilfe: Button öffnet Panel", helpOpened === true);
check("Hilfe: Escape schließt Panel", helpClosed === true);

// --- Theme-Umschalter setzt Theme-Klasse + färbt die Seite ---
const themeRes = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")]
    .find((x) => x.getAttribute("aria-label") === "Hell-/Dunkelmodus umschalten");
  const has = !!b;
  if (b) b.click();
  const content = document.getElementById("content");
  return {
    has,
    scopeThemed: content.classList.contains("kommentare-dark") || content.classList.contains("kommentare-light"),
    pageThemed: ["dark", "light"].includes(document.documentElement.getAttribute("data-theme"))
  };
});
check("Theme: Umschalter vorhanden", themeRes.has);
check("Theme: Klick setzt Theme-Klasse am Scope", themeRes.scopeThemed);
check("Theme: Demo-Seite folgt (data-theme am <html>)", themeRes.pageThemed);

// --- Floating-Menü (Button unten rechts) ---
const fab = await page.evaluate(() => ({
  hasFab: !!document.querySelector(".kommentare-fab"),
  hiddenBefore: document.querySelector(".kommentare-panel").classList.contains("kommentare-hidden")
}));
await page.evaluate(() => document.querySelector(".kommentare-fab").click());
const fabOpened = await page.evaluate(() =>
  !document.querySelector(".kommentare-panel").classList.contains("kommentare-hidden"));
await page.evaluate(() => document.querySelector(".kommentare-fab").click()); // wieder schließen
check("Floating: FAB unten rechts vorhanden", fab.hasFab);
check("Floating: Menü initial verborgen", fab.hiddenBefore === true);
check("Floating: FAB öffnet das Menü", fabOpened === true);

// --- Ziehbare Notizspalte ---
const resize = await page.evaluate(() => {
  const g = document.querySelector(".kommentare-gutter");
  if (!g) return { has: false };
  const body = document.querySelector(".kommentare-body");
  const rect = body.getBoundingClientRect();
  const width = () => document.querySelector(".kommentare-margin").getBoundingClientRect().width;
  const before = width();
  g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: rect.right - 300 }));
  document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: rect.right - 460 }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  return { has: true, before, after: width() };
});
check("Resizable: Ziehgriff vorhanden", resize.has === true);
check("Resizable: Ziehen verbreitert die Notizspalte", resize.after > resize.before + 20);

// --- Bearbeiten einer bestehenden Notiz ---
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".kommentare-note-actions .kommentare-btn")];
  btns.find((b) => b.textContent === "bearbeiten").click();
});
await page.fill(".kommentare-compose textarea", "Bearbeiteter Text.");
await page.evaluate(() => {
  const btns = document.querySelectorAll(".kommentare-compose .kommentare-btn");
  btns[btns.length - 1].click();
});
const editedBody = (await page.locator(".kommentare-note .kommentare-note-body").first().textContent()).trim();
check("Bearbeiten: Notiztext aktualisiert", editedBody === "Bearbeiteter Text.");
check("Bearbeiten: weiterhin genau 1 Notiz", (await page.locator(".kommentare-note").count()) === 1);

// --- Abnahmekriterium 2: Reload + Import -> gleiche Stelle ---
await load();
await page.evaluate((json) => instanz.import(json), exported);
check("Reload+Import: Markierung wiederhergestellt", (await page.locator("#content mark.kommentare-mark").count()) === 1);
const markText = (await page.locator("#content mark.kommentare-mark").first().textContent()).trim();
check("Reload+Import: exakter Wortlaut verankert", markText === "Zeichenposition im Text");

// --- prefix/suffix-Disambiguierung bei mehrfachem Vorkommen ---
// "Text" kommt mehrfach vor; die Position stimmt nach Reload nicht -> Fallback per Wortlaut.
await load();
const dis = await page.evaluate(() => {
  const full = (function () {
    const w = document.createTreeWalker(document.getElementById("content"), NodeFilter.SHOW_TEXT);
    let s = "", n; while ((n = w.nextNode())) s += n.nodeValue; return s;
  })();
  // Zweites Vorkommen von "Text" gezielt ansteuern über prefix/suffix.
  const needle = "Text";
  const first = full.indexOf(needle);
  const second = full.indexOf(needle, first + 1);
  const pre = full.slice(Math.max(0, second - 20), second);
  const suf = full.slice(second + needle.length, second + needle.length + 20);
  instanz.import({ annotations: [{
    id: "disambig-1", type: "Annotation", creator: { name: "Test" },
    body: [{ type: "TextualBody", value: "zweites Vorkommen" }],
    target: { selector: [
      { type: "TextQuoteSelector", exact: needle, prefix: pre, suffix: suf },
      { type: "TextPositionSelector", start: 999999, end: 999999 } // Position absichtlich falsch
    ] } }] });
  const marks = [...document.querySelectorAll("#content mark.kommentare-mark")];
  // Position der gesetzten Markierung im Volltext ermitteln
  const m = marks[0];
  const range = document.createRange();
  range.selectNode(m);
  return { count: marks.length, second, foundText: m ? m.textContent : null };
});
check("Disambiguierung: genau eine Markierung gesetzt", dis.count === 1);
check("Disambiguierung: Wortlaut getroffen", dis.foundText === "Text");

// --- Abnahmekriterium 3: mehrere Autor:innen, Dedupe nach id ---
await load();
const fileA = JSON.stringify({ annotations: [{
  id: "shared-1", type: "Annotation", creator: { name: "Alice" },
  body: [{ type: "TextualBody", value: "Alice Kommentar" }],
  target: { selector: [{ type: "TextQuoteSelector", exact: "Platzhaltertext", prefix: "", suffix: "" }] } }] });
const fileB = JSON.stringify({ annotations: [
  { id: "shared-1", type: "Annotation", creator: { name: "Alice-dup" },
    body: [{ type: "TextualBody", value: "DUPLIKAT" }],
    target: { selector: [{ type: "TextQuoteSelector", exact: "Platzhaltertext" }] } },
  { id: "bob-2", type: "Annotation", creator: { name: "Bob" },
    body: [{ type: "TextualBody", value: "Bob Kommentar" }],
    target: { selector: [{ type: "TextQuoteSelector", exact: "verschachtelte\n      Elemente" }] } }] });
await page.evaluate((f) => instanz.import(f), fileA);
await page.evaluate((f) => instanz.import(f), fileB);
const all = await page.evaluate(() => instanz.getAnnotations());
check("Dedupe nach id: shared-1 nur einmal", all.filter((a) => a.id === "shared-1").length === 1);
check("Mehrere Autoren: Alice + Bob", all.some((a) => a.creator.name === "Alice") && all.some((a) => a.creator.name === "Bob"));
check("Duplikat verworfen (erster gewinnt)", all.find((a) => a.id === "shared-1").body[0].value === "Alice Kommentar");

// --- onChange-Callback ---
const changeFires = await page.evaluate(async () => {
  let count = 0;
  // eigener Container: #content gehört bereits der Demo-Instanz
  const host = document.createElement("div");
  host.id = "c-onchange";
  host.innerHTML = "<p>Platzhaltertext für den Callback.</p>";
  document.querySelector(".wrap").appendChild(host);
  const i2 = Kommentare.init({ container: "#c-onchange", autor: "CB", onChange: () => { count++; } });
  i2.import({ annotations: [{ id: "cb-1", creator: { name: "CB" }, body: [{ value: "x" }],
    target: { selector: [{ type: "TextQuoteSelector", exact: "Platzhaltertext" }] } }] });
  const after = count;
  i2.destroy();
  host.remove();
  return after;
});
check("onChange feuert bei Import", changeFires >= 1);

// --- i18n: per-Instanz-Texte ---
await load();
const i18nHead = await page.evaluate(() => {
  const host = document.querySelector(".wrap");
  const d = document.createElement("div"); d.id = "c-i18n"; d.innerHTML = "<p>Hello world text.</p>";
  host.appendChild(d);
  const i = Kommentare.init({ container: "#c-i18n", autor: "EN", texte: { notizenKopf: "NOTES" } });
  const head = d.parentNode.querySelector(".kommentare-margin-head") ||
    document.querySelector(".kommentare-margin-head:last-of-type");
  const heads = [...document.querySelectorAll(".kommentare-margin-head")].map((e) => e.textContent);
  i.destroy();
  return heads;
});
check("i18n: Instanz-Text 'NOTES' angewandt", i18nHead.includes("NOTES"));

// --- destroy() stellt Ausgangs-DOM wieder her ---
await load();
const pristine = await page.evaluate(() => document.getElementById("content").innerHTML);
await selectAndComment("Platzhaltertext", "temp");
await page.evaluate(() => instanz.destroy());
const afterDestroy = await page.evaluate(() => document.getElementById("content").innerHTML);
check("destroy(): keine Markierungen mehr", !/kommentare-mark/.test(afterDestroy));
check("destroy(): Container-Inhalt = Ausgangszustand", afterDestroy === pristine);
const leftover = await page.evaluate(() => ({
  toolbar: document.querySelectorAll(".kommentare-toolbar").length,
  margin: document.querySelectorAll(".kommentare-margin").length,
  compose: document.querySelectorAll(".kommentare-compose").length
}));
check("destroy(): Aktionsleiste/Randspalte/Popover entfernt",
  leftover.toolbar === 0 && leftover.margin === 0 && leftover.compose === 0);

// --- Namens-Modal: erscheint beim Laden, verschwindet nach „Übernehmen" ---
await page.goto(demoUrl); // bewusst OHNE load() – wir prüfen das Modal selbst
const gateBefore = await page.evaluate(() => {
  const g = document.getElementById("gate");
  return { visible: g && getComputedStyle(g).display !== "none", noInstanz: typeof window.instanz === "undefined" };
});
await page.fill("#gate-name", "Gast");
await page.click("#gate-go");
const gateAfter = await page.evaluate(() => ({
  hidden: getComputedStyle(document.getElementById("gate")).display === "none",
  hasInstanz: typeof window.instanz !== "undefined"
}));
check("Modal: erscheint beim Laden", gateBefore.visible === true);
check("Modal: Werkzeug startet erst nach Übernehmen", gateBefore.noInstanz === true);
check("Modal: verschwindet nach Übernehmen", gateAfter.hidden === true && gateAfter.hasInstanz === true);

// --- Element-Kommentare (beliebige Web-Elemente statt nur Text) ---
await load();
const elToggle = await page.evaluate(() => {
  const b = document.querySelector(".kommentare-margin .kommentare-el-toggle");
  return !!b && b.textContent === "Element kommentieren";
});
check("Element: Umschalt-Button über den Notizen", elToggle === true);

// erstes <p> im Container per API auswählen und kommentieren
await page.evaluate(() => window.instanz._selectElement(document.querySelector("#content p")));
await page.fill(".kommentare-compose textarea", "Diese Box prüfen.");
await page.evaluate(() => {
  const b = document.querySelectorAll(".kommentare-compose .kommentare-btn");
  b[b.length - 1].click();
});
check("Element: Overlay-Markierung erzeugt", (await page.locator(".kommentare-el-mark").count()) === 1);
check("Element: Element-Notiz in Randspalte", (await page.locator(".kommentare-note-element").count()) === 1);

const elAnns = await page.evaluate(() => instanz.getAnnotations());
check("Element: Export enthält CssSelector",
  elAnns.some((a) => a.target.selector.some((s) => s.type === "CssSelector")));

// Reload + Import: Element-Markierung wird über den CSS-Selektor wieder verankert
const elExport = await page.evaluate(() => instanz.export());
await load();
await page.evaluate((j) => instanz.import(j), elExport);
check("Element: nach Reload+Import wiederhergestellt", (await page.locator(".kommentare-el-mark").count()) === 1);
const reText = (await page.locator(".kommentare-note-element .kommentare-note-body").first().textContent()).trim();
check("Element: Kommentartext wiederhergestellt", reText === "Diese Box prüfen.");

// --- Punkt-Kommentare (an eine bestimmte Stelle anheften) ---
await load();
const ptToggle = await page.evaluate(() => {
  const b = document.querySelector(".kommentare-margin .kommentare-point-toggle");
  return !!b && b.textContent === "Punkt anheften";
});
check("Punkt: Umschalt-Button über den Notizen", ptToggle === true);

// Punkt in der Mitte/oben des ersten <p> setzen (Element-relativer Anker)
await page.evaluate(() => {
  const p = document.querySelector("#content p");
  const r = p.getBoundingClientRect();
  window.instanz._placePoint(p, r.left + r.width * 0.5, r.top + r.height * 0.3);
});
await page.fill(".kommentare-compose textarea", "Genau hier.");
await page.evaluate(() => {
  const b = document.querySelectorAll(".kommentare-compose .kommentare-btn");
  b[b.length - 1].click();
});
check("Punkt: Pin-Marker erzeugt", (await page.locator(".kommentare-point-mark").count()) === 1);
check("Punkt: Punkt-Notiz in Randspalte", (await page.locator(".kommentare-note-point").count()) === 1);

const ptAnns = await page.evaluate(() => instanz.getAnnotations());
check("Punkt: Export enthält FragmentSelector (Prozent-Position)",
  ptAnns.some((a) => a.target.selector.some((s) => s.type === "FragmentSelector" && /xywh=percent:/.test(s.value || ""))));

const ptExport = await page.evaluate(() => instanz.export());
await load();
await page.evaluate((j) => instanz.import(j), ptExport);
check("Punkt: nach Reload+Import wiederhergestellt", (await page.locator(".kommentare-point-mark").count()) === 1);
const ptText = (await page.locator(".kommentare-note-point .kommentare-note-body").first().textContent()).trim();
check("Punkt: Kommentartext wiederhergestellt", ptText === "Genau hier.");

// --- Floating-Notizen: ganze Fläche (inkl. „Header") kommentierbar, kein Reflow ---
await load();
const fn = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "fullpage";
  host.innerHTML = '<header id="fp-head"><h2>Kopfbereich Titel</h2></header>' +
    "<main><p>Inhalt eins zwei drei.</p></main>" +
    '<footer id="fp-foot"><small>Fusszeile Text</small></footer>';
  document.body.appendChild(host);
  const parentBefore = host.parentNode;
  window.__fn = window.Kommentare.init({ container: "#fullpage", notes: "floating", autor: "FN" });
  return {
    notReflowed: host.parentNode === parentBefore && parentBefore.nodeName === "BODY",
    panelHasNotes: !!document.querySelector(".kommentare-panel-notes"),
    marginInPanel: !!document.querySelector(".kommentare-panel-notes .kommentare-margin"),
    docClass: host.classList.contains("kommentare-doc")
  };
});
check("Floating-Notizen: Seite nicht umgebaut (kein Wrapper)", fn.notReflowed === true);
check("Floating-Notizen: Notizen im schwebenden Panel", fn.panelHasNotes && fn.marginInPanel);
check("Floating-Notizen: kein kommentare-doc auf großem Container", fn.docClass === false);

// „Header"-Text kommentieren (ganze Seite kommentierbar)
const fnMarks = await page.evaluate(() => {
  const h = document.querySelector("#fp-head h2"), tn = h.firstChild;
  const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, tn.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  h.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  window.__fn._composeText.value = "Kopf prüfen.";
  window.__fn._saveComment();
  return {
    headMarks: document.querySelectorAll("#fp-head mark.kommentare-mark").length,
    panelNotes: document.querySelectorAll(".kommentare-panel-notes .kommentare-note").length
  };
});
check("Floating-Notizen: Header-Text kommentierbar", fnMarks.headMarks === 1);
check("Floating-Notizen: Notiz im Panel gelistet", fnMarks.panelNotes === 1);

const fnDestroy = await page.evaluate(() => {
  window.__fn.destroy();
  return {
    panelGone: !document.querySelector(".kommentare-panel-notes"),
    hostStays: !!document.getElementById("fullpage"),
    noMarks: document.querySelectorAll("#fullpage mark.kommentare-mark").length === 0
  };
});
check("Floating-Notizen: destroy() entfernt Panel, Container bleibt",
  fnDestroy.panelGone && fnDestroy.hostStays && fnDestroy.noMarks);

// --- Regression: exportMarkdown/E-Mail mit gemischten Kommentar-Arten ---
await load();
await selectAndComment("Platzhaltertext", "Textnotiz.");
await page.evaluate(() => {
  window.instanz._selectElement(document.querySelector("#content p"));
  document.querySelector(".kommentare-compose textarea").value = "Elementnotiz.";
  window.instanz._saveComment();
  const p2 = document.querySelectorAll("#content p")[1];
  const r = p2.getBoundingClientRect();
  window.instanz._placePoint(p2, r.left + r.width * 0.4, r.top + r.height * 0.5);
  document.querySelector(".kommentare-compose textarea").value = "Punktnotiz.";
  window.instanz._saveComment();
});
const mixed = await page.evaluate(() => {
  const out = {};
  try { out.md = window.instanz.exportMarkdown(); out.crash = false; }
  catch (e) { out.crash = true; }
  try { window.instanz._mailtoHref(); out.mailCrash = false; }
  catch (e) { out.mailCrash = true; }
  return out;
});
check("Markdown: kein Absturz bei gemischten Arten", mixed.crash === false && mixed.mailCrash === false);
check("Markdown: kein 'undefined' im Text", mixed.md && !mixed.md.includes("undefined"));
check("Markdown: Element- und Punkt-Überschriften", mixed.md.includes("⬚") && mixed.md.includes("📍"));

// --- Regression: Overlay-Position bei positioniertem/verschobenem <body> ---
const offsetRes = await page.evaluate(() => {
  document.body.style.position = "relative";
  document.body.style.margin = "40px";
  const p2 = document.querySelectorAll("#content p")[2];
  const r = p2.getBoundingClientRect();
  window.instanz._placePoint(p2, r.left + r.width * 0.5, r.top + r.height * 0.5);
  document.querySelector(".kommentare-compose textarea").value = "Versatztest.";
  window.instanz._saveComment();
  const pins = document.querySelectorAll(".kommentare-point-mark");
  const pin = pins[pins.length - 1];
  const pr = pin.getBoundingClientRect();
  const rr = p2.getBoundingClientRect();
  const res = {
    dx: Math.abs((pr.left + pr.width / 2) - (rr.left + rr.width * 0.5)),
    dy: Math.abs((pr.top + pr.height / 2) - (rr.top + rr.height * 0.5))
  };
  document.body.style.position = "";
  document.body.style.margin = "";
  return res;
});
check("Overlay: Pin sitzt trotz body{position:relative;margin} korrekt (±2px)",
  offsetRes.dx <= 2 && offsetRes.dy <= 2);

// --- Regression: Druck im Floating-Notizen-Modus zeigt die Notizen ---
const printPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await printPage.goto(demoUrl);
await printPage.fill("#gate-name", "Gast");
await printPage.click("#gate-go");
await printPage.evaluate(() => {
  window.instanz.destroy();
  window.instanz = window.Kommentare.init({ container: "#content", notes: "floating", autor: "Gast" });
  window.instanz.import({ annotations: [{ id: "pr-1", type: "Annotation", creator: { name: "Gast" },
    body: [{ type: "TextualBody", value: "Drucknotiz" }],
    target: { selector: [{ type: "TextQuoteSelector", exact: "Platzhaltertext" }] } }] });
});
await printPage.emulateMedia({ media: "print" });
const printRes = await printPage.evaluate(() => {
  const margin = document.querySelector(".kommentare-panel-notes .kommentare-margin");
  const toolbar = document.querySelector(".kommentare-panel-notes .kommentare-toolbar");
  return {
    notizenSichtbar: margin ? margin.offsetParent !== null : false,
    toolbarAus: toolbar ? getComputedStyle(toolbar).display === "none" : true
  };
});
await printPage.close();
check("Druck (floating notes): Notizen sichtbar", printRes.notizenSichtbar === true);
check("Druck (floating notes): Werkzeugleiste ausgeblendet", printRes.toolbarAus === true);

// --- exclude-Option: Bereiche vom Kommentieren ausnehmen ---
await load();
const excl = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "exclhost";
  host.innerHTML = '<div id="adminbar"><p>Adminleiste Text</p></div>' +
    "<main><p>Normaler Inhalt eins zwei.</p></main>";
  document.body.appendChild(host);
  const inst = window.Kommentare.init({
    container: "#exclhost", notes: "floating", autor: "EX", exclude: "#adminbar"
  });
  // 1) Text im ausgeschlossenen Bereich: Auswahl wird verworfen
  const tn = host.querySelector("#adminbar p").firstChild;
  const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, tn.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  // eigenes Popover der Instanz prüfen (mehrere Instanzen auf der Seite!)
  const composeOffen = !inst._composeEl.classList.contains("kommentare-hidden");
  // 2) Element im ausgeschlossenen Bereich ist kein gültiges Ziel
  const zielAdmin = inst._elementTargetFrom(host.querySelector("#adminbar p"));
  const zielInhalt = inst._elementTargetFrom(host.querySelector("main p"));
  // 3) Ausgeschlossener Text fehlt im Volltext (Offsets bleiben stabil)
  const volltext = inst._plainText();
  inst.destroy(); host.remove();
  return { composeOffen, adminAusgeschlossen: zielAdmin === null, inhaltOk: !!zielInhalt,
           textAusgeschlossen: !volltext.includes("Adminleiste") };
});
check("exclude: Auswahl im ausgeschlossenen Bereich verworfen", excl.composeOffen === false);
check("exclude: Element dort kein Ziel, Inhalt weiterhin schon", excl.adminAusgeschlossen && excl.inhaltOk);
check("exclude: Text zählt nicht zu den Offsets", excl.textAusgeschlossen === true);

// --- Live-Theme: ☾/☀-Knopf folgt im Auto-Modus dem Systemwechsel ---
await page.emulateMedia({ colorScheme: "light" });
await load();
const iconHell = await page.evaluate(() =>
  [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")]
    .find((b) => b.getAttribute("aria-label") === "Hell-/Dunkelmodus umschalten").textContent);
await page.emulateMedia({ colorScheme: "dark" });
// das matchMedia-Change-Event feuert asynchron -> auf den Icon-Wechsel warten
const iconDunkel = await page.waitForFunction(() => {
  const b = [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")]
    .find((x) => x.getAttribute("aria-label") === "Hell-/Dunkelmodus umschalten");
  return b && b.textContent === "☀" ? b.textContent : false;
}, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => "timeout");
check("Live-Theme: Knopf wechselt bei Systemwechsel (auto)", iconHell === "☾" && iconDunkel === "☀");
await page.emulateMedia({ colorScheme: "light" });

// --- ARIA: Panel ist region (kein menu), FAB verweist per aria-controls ---
const aria = await page.evaluate(() => {
  const panel = document.querySelector(".kommentare-panel");
  const fab = document.querySelector(".kommentare-fab");
  return { role: panel ? panel.getAttribute("role") : null,
           controls: fab && panel ? fab.getAttribute("aria-controls") === panel.id : false };
});
check("ARIA: Panel role=region statt menu", aria.role === "region");
check("ARIA: FAB hat aria-controls aufs Panel", aria.controls === true);

// --- Offsets bei Element-Grenzpunkten (Dreifachklick, Mehr-Absatz-Auswahl) ---
await load();
const off = await page.evaluate(() => {
  const p0 = document.querySelector("#content p");
  return {
    gesamt: window.instanz._plainText().length,
    mitElement: window.instanz._globalOffset(p0, 0),
    mitTextknoten: window.instanz._globalOffset(p0.firstChild, 0)
  };
});
check("Offsets: Element-Grenzpunkt liefert echte Position (nicht Gesamtlänge)",
  off.mitElement === off.mitTextknoten && off.mitElement < off.gesamt);

// Dreifachklick-Auswahl (endContainer ist ein Element) trifft genau den Absatz
const triple = await page.evaluate(() => {
  const p0 = document.querySelector("#content p");
  const r = document.createRange();
  r.setStart(p0.firstChild, 0);
  r.setEnd(p0, p0.childNodes.length);   // Element-Grenzpunkt
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.getElementById("content").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  const q = window.instanz.pending ? window.instanz.pending.quote : "";
  const erwartet = p0.textContent.trim();
  window.instanz._closeCompose();
  return { passt: q === erwartet, laenge: q.length, erwartet: erwartet.length };
});
check("Offsets: Dreifachklick umfasst genau den Absatz", triple.passt === true);

// Auswahl über zwei Absätze mit Element-Grenzpunkten an beiden Enden
const multi = await page.evaluate(() => {
  const ps = document.querySelectorAll("#content p");
  const r = document.createRange();
  r.setStart(ps[0], 0);
  r.setEnd(ps[1], ps[1].childNodes.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.getElementById("content").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  const q = window.instanz.pending ? window.instanz.pending.quote : "";
  window.instanz._closeCompose();
  return { beginnt: q.indexOf(ps[0].textContent.trim().slice(0, 20)) === 0,
           endet: q.indexOf(ps[1].textContent.trim().slice(-20)) === q.length - 20 };
});
check("Offsets: Auswahl über zwei Absätze wird korrekt erfasst",
  multi.beginnt === true && multi.endet === true);

// --- Eingabefelder/Editoren: Auswahl dort kommentiert nicht (WP-Editor) ---
const editable = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "edithost";
  host.innerHTML = '<div contenteditable="true" id="ce"><p>Text im Editor.</p></div>' +
    '<textarea id="ta">Text im Feld.</textarea><p id="frei">Freier Text.</p>';
  document.body.appendChild(host);
  const inst = window.Kommentare.init({ container: "#edithost", notes: "floating", autor: "ED" });
  // eigenes Popover der Instanz prüfen (mehrere Instanzen auf der Seite!)
  const compose = inst._composeEl;
  function versuch(node) {
    const tn = node.firstChild;
    const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, tn.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    const offen = !compose.classList.contains("kommentare-hidden");
    inst._closeCompose();
    return offen;
  }
  const res = {
    contenteditable: versuch(host.querySelector("#ce p")),
    freierText: versuch(host.querySelector("#frei")),
    elementZiel: !!inst._elementTargetFrom(host.querySelector("#ce"))
  };
  inst.destroy(); host.remove();
  return res;
});
check("Editor-Schutz: Auswahl in contenteditable kommentiert nicht", editable.contenteditable === false);
check("Editor-Schutz: normaler Text weiterhin kommentierbar", editable.freierText === true);
check("Editor-Schutz: Editor-Bereich bleibt als Element kommentierbar", editable.elementZiel === true);

// --- Meldestelle (webhook): automatischer Versand + „Alle senden“ ---------
const HOOK = "https://beispiel.test/webhook";
const gesendet = [];
await page.route(HOOK, async (route) => {
  gesendet.push(route.request().postData() || "");
  await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
});
async function warteAufMeldungen(n) {
  for (let i = 0; i < 50 && gesendet.length < n; i++) await page.waitForTimeout(100);
  return gesendet.length;
}

await load();
check("Webhook: ohne Adresse kein „Alle senden“-Knopf",
  (await page.locator(".kommentare-send").count()) === 0);

const hook = await page.evaluate((url) => {
  const host = document.createElement("div");
  host.id = "hookhost";
  host.innerHTML = "<p>Ein Satz zum Melden.</p>";
  document.body.appendChild(host);
  const inst = window.Kommentare.init({
    container: "#hookhost", notes: "floating", autor: "Melder", webhook: url
  });
  const tn = host.querySelector("p").firstChild;
  const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, tn.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  inst._composeText.value = "Bitte prüfen.";
  inst._saveComment();                       // -> automatischer Versand
  const knopf = inst._sendBtn ? inst._sendBtn.textContent : "";
  inst.send();                               // -> „Alle senden“
  const rueckmeldung = inst._sendBtn ? inst._sendBtn.textContent : "";
  const hinweis = inst._helpEl
    ? inst._helpEl.querySelector(".kommentare-help-note").textContent : "";
  const schritte = inst._helpEl
    ? [...inst._helpEl.querySelectorAll(".kommentare-help-list li b")].map((b) => b.textContent) : [];
  window.hookInstanz = inst;
  return { knopf, rueckmeldung, hinweis, schritte, sitzung: inst._sitzung };
}, HOOK);

check("Webhook: „Alle senden“-Knopf vorhanden", hook.knopf === "Alle senden");
check("Webhook: Knopf meldet den Versand zurück", hook.rueckmeldung === "Abgeschickt (1)");
check("Webhook: Hilfe nennt den Sende-Schritt", hook.schritte.includes("Senden"));
check("Webhook: Hilfe weist auf den Datenversand hin",
  hook.hinweis.includes("zentrale Tabelle") && hook.hinweis.includes("Keine IP-Adresse"));

check("Webhook: automatischer Versand + „Alle senden“ erreichen die Adresse",
  (await warteAufMeldungen(2)) === 2);
const meldung = JSON.parse(gesendet[0] || "{}");
const eintrag = (meldung.eintraege || [])[0] || {};
check("Webhook: Nutzlast ist JSON mit eintraege[]",
  meldung.generator === "kommentar-tool" && (meldung.eintraege || []).length === 1);
check("Webhook: Eintrag trägt Kommentar, Stelle und Art",
  eintrag.kommentar === "Bitte prüfen." &&
  eintrag.stelle === "Ein Satz zum Melden." && eintrag.art === "Text");
check("Webhook: Eintrag trägt Seiten-URL, Titel, Autor:in und Zeitpunkt",
  typeof eintrag.seitenUrl === "string" && eintrag.seitenUrl.length > 0 &&
  typeof eintrag.seitenTitel === "string" &&
  eintrag.autor === "Melder" && /^\d{4}-\d{2}-\d{2}T/.test(eintrag.zeitpunkt || ""));
check("Webhook: Eintrag trägt anonyme Sitzungs-ID statt IP",
  eintrag.sitzung === hook.sitzung && hook.sitzung.length > 1 &&
  !("ip" in eintrag) && !/\bip\b/i.test(Object.keys(eintrag).join(",")));
check("Webhook: Eintrag trägt Browser-Angaben",
  typeof eintrag.userAgent === "string" && eintrag.userAgent.length > 0 &&
  /^\d+×\d+$/.test(eintrag.bildschirm || "") && "sprache" in eintrag);
check("Webhook: Kommentar-ID erlaubt der Gegenstelle das Entdoppeln",
  !!eintrag.kommentarId && eintrag.aktion === "neu");

// Löschen meldet sich als eigene Aktion (damit die Zeile markiert werden kann)
const geloescht = await page.evaluate(() => {
  const inst = window.hookInstanz;
  const id = [...inst.annos.keys()][0];
  inst._removeAnno(id);
  return id;
});
await warteAufMeldungen(3);
const letzte = JSON.parse(gesendet[gesendet.length - 1] || "{}");
check("Webhook: Löschen meldet aktion=gelöscht",
  ((letzte.eintraege || [])[0] || {}).aktion === "gelöscht" &&
  ((letzte.eintraege || [])[0] || {}).kommentarId === geloescht);

// webhookAuto:false -> kein automatischer Versand, „Alle senden“ weiterhin
const vorherAus = gesendet.length;
const manuell = await page.evaluate((url) => {
  window.hookInstanz.destroy();
  document.getElementById("hookhost").remove();
  const host = document.createElement("div");
  host.id = "hookhost2";
  host.innerHTML = "<p>Noch ein Satz.</p>";
  document.body.appendChild(host);
  const inst = window.Kommentare.init({
    container: "#hookhost2", notes: "floating", autor: "Melder",
    webhook: url, webhookAuto: false
  });
  const tn = host.querySelector("p").firstChild;
  const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, tn.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  inst._composeText.value = "Ohne Automatik.";
  inst._saveComment();
  window.hookInstanz2 = inst;
  return true;
}, HOOK);
await page.waitForTimeout(300);
check("Webhook: webhookAuto:false sendet nicht automatisch",
  manuell === true && gesendet.length === vorherAus);
await page.evaluate(() => window.hookInstanz2.send());
check("Webhook: „Alle senden“ funktioniert auch ohne Automatik",
  (await warteAufMeldungen(vorherAus + 1)) === vorherAus + 1);

// Ungültige/nicht-https Adressen werden ignoriert (kein Knopf, kein Versand)
const ungueltig = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "hookhost3"; host.innerHTML = "<p>Text.</p>";
  document.body.appendChild(host);
  const inst = window.Kommentare.init({
    container: "#hookhost3", notes: "floating", autor: "X", webhook: "javascript:alert(1)"
  });
  const res = { webhook: inst.webhook, knopf: !!inst._sendBtn };
  inst.destroy(); host.remove();
  window.hookInstanz2.destroy(); document.getElementById("hookhost2").remove();
  return res;
});
check("Webhook: nur http(s)-Adressen werden übernommen",
  ungueltig.webhook === "" && ungueltig.knopf === false);

// --- Markierungen über mehrere Knoten: löschen & hervorheben --------------
await load();
const mehrknoten = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "mk";
  host.innerHTML = "<p>Anfang <b>fett</b> und <i>kursiv</i> Ende.</p>";
  document.querySelector(".wrap").appendChild(host);
  const inst = window.Kommentare.init({ container: "#mk", notes: "floating", autor: "MK" });
  const p = host.querySelector("p");
  const r = document.createRange();
  r.setStart(p.firstChild, 0);
  r.setEnd(p.lastChild, p.lastChild.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  inst._composeText.value = "Über mehrere Knoten.";
  inst._saveComment();
  const teile = host.querySelectorAll("mark.kommentare-mark").length;
  const id = [...inst.annos.keys()][0];
  inst._focusAnno(id);
  const aktiv = host.querySelectorAll("mark.kommentare-mark.is-active").length;
  inst._removeAnno(id);
  const res = {
    teile,
    alleAktiv: aktiv === teile,
    restMarks: host.querySelectorAll("mark.kommentare-mark").length,
    textIntakt: host.textContent.trim() === "Anfang fett und kursiv Ende."
  };
  inst.destroy(); host.remove();
  return res;
});
check("Mehrknoten: Auswahl erzeugt mehrere Markierungs-Teile", mehrknoten.teile > 1);
check("Mehrknoten: Löschen entfernt ALLE Teile", mehrknoten.restMarks === 0);
check("Mehrknoten: Text bleibt unverändert", mehrknoten.textIntakt === true);
check("Mehrknoten: Hervorheben erfasst alle Teile", mehrknoten.alleAktiv === true);

// --- Doppelte Initialisierung auf demselben Container ---------------------
const doppel = await page.evaluate(() => {
  const host = document.createElement("div");
  host.id = "dop"; host.innerHTML = "<p>Doppelt hält nicht besser.</p>";
  document.querySelector(".wrap").appendChild(host);
  const a = window.Kommentare.init({ container: "#dop", notes: "floating", autor: "D" });
  let fehler = null;
  try { window.Kommentare.init({ container: "#dop", notes: "floating", autor: "D2" }); }
  catch (e) { fehler = e.message; }
  const attribut = host.getAttribute("data-kommentare-aktiv");
  a.destroy();
  const nachDestroy = host.hasAttribute("data-kommentare-aktiv");
  // nach destroy() muss init() wieder greifen
  let erneut = null;
  try { const b = window.Kommentare.init({ container: "#dop", notes: "floating", autor: "D3" });
        erneut = "ok"; b.destroy(); } catch (e) { erneut = e.message; }
  host.remove();
  return { fehler, attribut, nachDestroy, erneut };
});
check("Doppel-Init: zweite Instanz wird abgelehnt",
  !!doppel.fehler && doppel.fehler.indexOf("bereits eine Instanz") > -1);
check("Doppel-Init: Container ist als belegt markiert", doppel.attribut === "1");
check("Doppel-Init: destroy() gibt den Container frei", doppel.nachDestroy === false);
check("Doppel-Init: nach destroy() klappt init() wieder", doppel.erneut === "ok");

// --- Hilfe-Modal: Fokus bleibt im Dialog ----------------------------------
await load();
await page.click(".kommentare-fab");
await page.evaluate(() => {
  [...document.querySelectorAll(".kommentare-toolbar .kommentare-btn")]
    .find((b) => b.getAttribute("aria-label") === "Hilfe anzeigen").click();
});
const fokusStart = await page.evaluate(() =>
  document.querySelector(".kommentare-help").contains(document.activeElement));
// mehrfach Tab: der Fokus darf den Dialog nicht verlassen
for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
const fokusVorwaerts = await page.evaluate(() =>
  document.querySelector(".kommentare-help").contains(document.activeElement));
await page.keyboard.press("Shift+Tab");
await page.keyboard.press("Shift+Tab");
const fokusRueckwaerts = await page.evaluate(() =>
  document.querySelector(".kommentare-help").contains(document.activeElement));
check("Hilfe-Modal: Fokus startet im Dialog", fokusStart === true);
check("Hilfe-Modal: Tab verlässt den Dialog nicht", fokusVorwaerts === true);
check("Hilfe-Modal: Shift+Tab verlässt den Dialog nicht", fokusRueckwaerts === true);
await page.keyboard.press("Escape");

// --- Sammelstelle: 64-KiB-Grenze wird nicht überschritten -----------------
const HOOK2 = "https://beispiel.test/gross";
const gross = [];
await page.route(HOOK2, async (route) => {
  gross.push((route.request().postData() || "").length);
  await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
});
await load();
const buendel = await page.evaluate((url) => {
  const host = document.createElement("div");
  host.id = "gr"; host.innerHTML = "<p>Ein Satz für viele Kommentare hier.</p>";
  document.querySelector(".wrap").appendChild(host);
  const inst = window.Kommentare.init({ container: "#gr", notes: "floating", autor: "G", webhook: url });
  // 300 Einträge -> deutlich über 64 KiB in einer einzelnen Sendung
  const viele = [];
  for (let i = 0; i < 300; i++) {
    viele.push(inst._webhookEntry({ id: "id" + i, kind: "text", quote: "Stelle " + i,
      body: "Kommentar Nummer " + i + " mit etwas Text.", author: "G", created: "" }, "neu"));
  }
  const einzeln = JSON.stringify({ eintraege: viele }).length;
  const teile = inst._webhookBuendel(viele);
  const groessen = teile.map((t) => new Blob([inst._webhookPayload(t)]).size);
  const gesendet = inst._webhookSend(viele);
  // ein einzelner überlanger Eintrag lässt sich nicht teilen
  const riese = inst._webhookEntry({ id: "riese", kind: "text", quote: "x",
    body: "ä".repeat(80000), author: "G", created: "" }, "neu");
  const riesenTeile = inst._webhookBuendel([riese]).length;
  const res = {
    ungeteiltBytes: einzeln, teile: teile.length, groessen,
    maxTeil: Math.max(...groessen), summeEintraege: teile.reduce((n, t) => n + t.length, 0),
    gesendet, riesenTeile
  };
  inst.destroy(); host.remove();
  return res;
}, HOOK2);
for (let i = 0; i < 40 && gross.length < buendel.teile; i++) await page.waitForTimeout(100);
check("Sammelstelle: große Menge wird gebündelt", buendel.teile > 1 && buendel.ungeteiltBytes > 65536);
check("Sammelstelle: jedes Bündel bleibt unter 64 KiB", buendel.maxTeil < 65536);
check("Sammelstelle: kein Eintrag geht beim Bündeln verloren", buendel.summeEintraege === 300);
check("Sammelstelle: alle Bündel erreichen die Adresse",
  buendel.gesendet === true && gross.length === buendel.teile);
check("Sammelstelle: einzelner überlanger Eintrag bleibt eine Sendung", buendel.riesenTeile === 1);

// Überlanger Einzelkommentar (>64 KiB) kommt trotzdem an (ohne keepalive)
const riesig = [];
const HOOK3 = "https://beispiel.test/riesig";
await page.route(HOOK3, async (route) => {
  riesig.push((route.request().postData() || "").length);
  await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
});
await page.evaluate((url) => {
  const host = document.createElement("div");
  host.id = "ri"; host.innerHTML = "<p>Kurzer Satz.</p>";
  document.querySelector(".wrap").appendChild(host);
  const inst = window.Kommentare.init({ container: "#ri", notes: "floating", autor: "R", webhook: url });
  inst._webhookSend([inst._webhookEntry({ id: "r1", kind: "text", quote: "x",
    body: "y".repeat(120000), author: "R", created: "" }, "neu")]);
  inst.destroy(); host.remove();
}, HOOK3);
for (let i = 0; i < 40 && !riesig.length; i++) await page.waitForTimeout(100);
check("Sammelstelle: Sendung über 64 KiB geht trotzdem raus",
  riesig.length === 1 && riesig[0] > 65536);

// --- <body> als Container darf niemals ausgehängt werden -----------------
const bodySchutz = await page.evaluate(() => {
  // Demo-Instanz weicht; wir prüfen auf dem echten <body> dieser Seite
  window.instanz.destroy();
  let fehler = null, inst = null;
  try {
    inst = window.Kommentare.init({ container: "body", notes: "inline",
                                    toolbarMode: "floating", autor: "B" });
  } catch (e) { fehler = e.message; }
  const res = {
    initFehler: fehler,
    bodyLebt: document.body !== null,
    bodyAmHtml: document.body && document.body.parentNode === document.documentElement,
    // der Schutz greift, indem auf schwebende Notizen umgeschaltet wird
    notizenSchweben: inst ? inst.notesMode === "floating" : null,
    // fremder Code muss danach weiterhin mit document.body arbeiten können
    fremdesSkript: (function () {
      try { var d = document.createElement("div"); document.body.appendChild(d);
            document.body.removeChild(d); return "ok"; }
      catch (e) { return e.message; }
    })()
  };
  if (inst) inst.destroy();
  return res;
});
check("body-Schutz: init wirft nicht", bodySchutz.initFehler === null);
check("body-Schutz: document.body bleibt erhalten", bodySchutz.bodyLebt === true);
check("body-Schutz: <body> hängt weiter am <html>", bodySchutz.bodyAmHtml === true);
check("body-Schutz: Notizen schalten auf schwebend um", bodySchutz.notizenSchweben === true);
check("body-Schutz: fremder Code kann document.body weiter nutzen", bodySchutz.fremdesSkript === "ok");

// --- Ungültiger Container-Selektor wirft nicht ---------------------------
await load();
const selektor = await page.evaluate(() => {
  const versuch = (sel) => {
    try { const i = window.Kommentare.init({ container: sel, notes: "floating" });
          i.destroy(); return "init"; }
    catch (e) { return e.constructor.name; }
  };
  return { kaputt: versuch(".a,"), leer: versuch("#gibtesnicht") };
});
check("Selektor: ungültiger Selektor wirft nur die eigene Meldung",
  selektor.kaputt === "Error" && selektor.leer === "Error");

// --- Meldung an die Sammelstelle: URL, Löschen, Sitzungskennung ----------
const HOOK4 = "https://beispiel.test/datenschutz";
const ds = [];
await page.route(HOOK4, async (route) => {
  ds.push(JSON.parse(route.request().postData() || "{}"));
  await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
});
await load();
const dsMeldung = await page.evaluate((url) => {
  const host = document.createElement("div");
  host.id = "dsx"; host.innerHTML = "<p>Ein Satz zum Melden hier.</p>";
  document.querySelector(".wrap").appendChild(host);
  // ohne Sammelstelle darf keine Sitzungskennung entstehen
  const ohne = window.Kommentare.init({ container: "#dsx", notes: "floating", autor: "O" });
  const ohneSitzung = ohne._sitzung;
  ohne.destroy();

  const inst = window.Kommentare.init({ container: "#dsx", notes: "floating", autor: "D", webhook: url });
  const tn = host.querySelector("p").firstChild;
  const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, 8);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  host.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  inst._composeText.value = "Geheimer Kommentartext.";
  inst._saveComment();
  const id = [...inst.annos.keys()][0];
  inst._removeAnno(id);
  const res = { ohneSitzung, mitSitzung: inst._sitzung };
  inst.destroy(); host.remove();
  return res;
}, HOOK4);
for (let i = 0; i < 40 && ds.length < 2; i++) await page.waitForTimeout(100);
const neu = (ds[0] || {}).eintraege ? ds[0].eintraege[0] : {};
const weg = (ds[1] || {}).eintraege ? ds[1].eintraege[0] : {};
check("Meldung: Sitzungskennung nur mit Sammelstelle",
  dsMeldung.ohneSitzung === "" && dsMeldung.mitSitzung.length > 1);
check("Meldung: Seiten-URL ohne Abfrageteil und Fragment",
  typeof neu.seitenUrl === "string" && neu.seitenUrl.indexOf("?") === -1 &&
  neu.seitenUrl.indexOf("#") === -1);
check("Meldung: Löschen überträgt den Kommentartext nicht erneut",
  weg.aktion === "gelöscht" && weg.kommentar === "" && weg.stelle === "" &&
  weg.kommentarId === neu.kommentarId);

// --- Import verkraftet unerwartete Inhalte ------------------------------
const importRobust = await page.evaluate(() => {
  const inst = window.instanz;
  const versuch = (wert) => { try { return inst.import(wert); } catch (e) { return e.constructor.name; } };
  return {
    zahl: versuch(42), nullwert: versuch(null), leer: versuch({}),
    falscheListe: versuch({ annotations: "keine Liste" }),
    muell: versuch([null, 5, "x", {}]),
    kaputtesJson: versuch("{nicht json")
  };
});
check("Import: unerwartete Werte werfen nicht",
  importRobust.zahl === 0 && importRobust.nullwert === 0 && importRobust.leer === 0 &&
  importRobust.falscheListe === 0 && importRobust.muell === 0);
check("Import: kaputtes JSON meldet sich weiterhin", importRobust.kaputtesJson === "SyntaxError");

await browser.close();
const failed = results.filter((r) => !r[1]);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
