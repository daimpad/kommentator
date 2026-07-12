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
  const i2 = Kommentare.init({ container: "#content", autor: "CB", margin: undefined, onChange: () => { count++; } });
  i2.import({ annotations: [{ id: "cb-1", creator: { name: "CB" }, body: [{ value: "x" }],
    target: { selector: [{ type: "TextQuoteSelector", exact: "Platzhaltertext" }] } }] });
  const after = count;
  i2.destroy();
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

await browser.close();
const failed = results.filter((r) => !r[1]);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length ? 1 : 0);
