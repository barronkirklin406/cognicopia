/* =====================================================================
   Print preview modal (ES module, offline-first, no dependencies).

   Shows an activity exactly as it will print: US Letter (8.5 x 11 in) with 0.75 in
   margins on all sides, strict sans-serif type (the resident's page is set in the
   asset's own size, 18 pt or more), pure black on white. Three pages:

     Page 1  Resident Activity Sheet
     Page 2  Caregiver Facilitation Protocol & Daily Notes
     Page 3  Sensory Guidance

   The header carries two things staff asked for:
     Facility Toner Optimizer   the ink the sheet really uses, measured from the
                                 sheet itself (a picture of it is drawn off screen and
                                 its dark pixels are averaged), and whether any gray
                                 fill is present. It is a measurement, not a promise;
                                 where a browser will not allow the measurement the badge
                                 says so instead of showing a number.
     Customization Summary      the personal details that reached the page (name, family
                                 names, pets, career, hometown, anchors, era), read
                                 from the finished text.

   The clinical audit's verdict is shown too. A blocked sheet cannot be printed from
   here: the way out is Adjust Parameters.

   Everything a person typed is escaped before it is drawn. Nothing is sent anywhere.

   Use:
     import { openPreview } from "./print-preview-modal.js";
     const { action } = await openPreview(result, { beforePrint, onConfirm, onAdjust });
     // result: what AgentOrchestrator.execute returns (or a bare asset)
   As the "preview" stage: orchestrator.use(new PrintPreviewAgent()), then
   execute({ ..., options: { preview: true } }).
   Like every module script, a browser will not load this from file://.
   ===================================================================== */
import { CognicopiaAgent } from "./agent-orchestrator.js";

export const SHEET = Object.freeze({ widthIn: 8.5, heightIn: 11, marginIn: 0.75, dpi: 96, widthPx: 816, heightPx: 1056, marginPx: 72 });
export const PAGES = Object.freeze([
  { key: "resident", tab: "Page 1", name: "Resident Activity Sheet" },
  { key: "caregiver", tab: "Page 2", name: "Caregiver Facilitation Protocol & Daily Notes" },
  { key: "sensory", tab: "Page 3", name: "Sensory Guidance" }
]);
const FONT = '"Atkinson Hyperlegible","Segoe UI",Arial,Helvetica,sans-serif';
const px = (pt) => Math.round(pt * 96 / 72 * 10) / 10;
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* The sheet's own CSS: black on white, sans-serif, lines at least 3 pt (4 px). It is inlined wherever a sheet is drawn, so the
   preview, the printout and the ink measurement all see the same page. */
export const SHEET_CSS = `
.cgpp-sheet{box-sizing:border-box;width:${SHEET.widthPx}px;height:${SHEET.heightPx}px;padding:${SHEET.marginPx}px;background:#fff;color:#000;overflow:hidden;font-family:${FONT};font-size:${px(12)}px;line-height:1.35;position:relative}
.cgpp-sheet *{box-sizing:border-box;color:#000;background:transparent;font-family:inherit}
.cgpp-brand{display:flex;align-items:center;gap:12px;padding-bottom:8px;margin-bottom:10px;border-bottom:4px solid #000;font-weight:700;font-size:${px(11)}px}
.cgpp-brand img{max-height:48px;max-width:160px;object-fit:contain}
.cgpp-h1{margin:0 0 4px;font-size:${px(22)}px;line-height:1.15;font-weight:700}
.cgpp-sub{margin:0 0 12px;font-size:${px(11)}px}
.cgpp-rule{border:0;border-top:4px solid #000;margin:8px 0 14px}
.cgpp-block{margin:0 0 14px}
.cgpp-h2{margin:0 0 6px;font-size:1.05em;font-weight:700}
.cgpp-list{margin:0;padding-left:1.2em}.cgpp-list li{margin:0 0 6px}
.cgpp-cards{display:flex;flex-wrap:wrap;gap:10px}.cgpp-card{flex:1 1 30%;min-width:30%;border:4px solid #000;border-radius:8px;padding:10px 12px;font-weight:700}
.cgpp-choice{display:flex;gap:12px;margin:0 0 10px}.cgpp-choice div{flex:1;border:4px solid #000;border-radius:8px;padding:12px;text-align:center;font-weight:700}
.cgpp-ws{border-collapse:collapse;margin:0 auto 10px}.cgpp-ws td{width:30px;height:30px;text-align:center;font-weight:700;font-size:1.1em;border:0}
.cgpp-words{display:flex;flex-wrap:wrap;gap:6px 18px;font-weight:700}
.cgpp-pairs{display:flex;gap:30px}.cgpp-pairs ol{margin:0;padding-left:1.4em;flex:1}.cgpp-pairs li{margin:0 0 10px}
.cgpp-step{display:flex;gap:12px;border:4px solid #000;border-radius:8px;padding:10px 12px;margin:0 0 10px}.cgpp-step b{flex:none;width:2em;height:2em;border:4px solid #000;border-radius:50%;text-align:center;line-height:1.6em}
.cgpp-notice{border:4px solid #000;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-weight:700}
.cgpp-lines div{height:30px;border-bottom:2px solid #000}
.cgpp-foot{position:absolute;left:${SHEET.marginPx}px;right:${SHEET.marginPx}px;bottom:${Math.round(SHEET.marginPx / 2)}px;font-size:${px(9)}px;display:flex;justify-content:space-between;border-top:2px solid #000;padding-top:4px}
`;

const FOOT = "Supports staff. Not medical advice; it does not replace a resident's care plan.";

function brandHtml(b) {
  if (!b || (!b.facilityName && !b.headerText && !b.logoDataUrl)) return "";
  const logo = b.logoDataUrl && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(b.logoDataUrl) ? `<img src="${b.logoDataUrl}" alt=""/>` : "";
  return `<div class="cgpp-brand">${logo}<span>${esc(b.facilityName || "")}${b.facilityName && b.headerText ? " &#183; " : ""}${esc(b.headerText || "")}</span></div>`;
}
function blockHtml(b) {
  if (!b || typeof b !== "object") return "";
  const head = b.title ? `<h3 class="cgpp-h2">${esc(b.title)}</h3>` : "";
  const items = Array.isArray(b.items) ? b.items : [];
  switch (b.type) {
    case "anchors": return `<div class="cgpp-block">${head}<div class="cgpp-cards">${items.map((i) => `<div class="cgpp-card">${esc(i)}</div>`).join("")}</div></div>`;
    case "prompts": return `<div class="cgpp-block">${head}<ul class="cgpp-list">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
    case "choices": return `<div class="cgpp-block">${head}${items.map((c) => `<div class="cgpp-choice"><div>${esc(c && c.a)}</div><div>${esc(c && c.b)}</div></div>`).join("")}</div>`;
    case "wordsearch": { const g = Array.isArray(b.grid) ? b.grid : []; return `<div class="cgpp-block">${head}<table class="cgpp-ws" role="presentation">${g.map((row) => `<tr>${String(row).split("").map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table><div class="cgpp-words">${(b.words || []).map((w) => `<span>${esc(w)}</span>`).join("")}</div></div>`; }
    case "matching": return `<div class="cgpp-block">${head}<div class="cgpp-pairs"><ol>${items.map((p) => `<li>${esc(p && p.left)}</li>`).join("")}</ol><ol type="A">${(b.rightOrder || items.map((p) => p && p.right)).map((r) => `<li>${esc(r)}</li>`).join("")}</ol></div></div>`;
    case "note": return `<div class="cgpp-block">${head}<p>${esc(b.text)}</p></div>`;
    default: return items.length ? `<div class="cgpp-block">${head}<ul class="cgpp-list">${items.map((i) => `<li>${esc(typeof i === "string" ? i : JSON.stringify(i))}</li>`).join("")}</ul></div>` : "";
  }
}
/* One printed page, as markup that is also valid XML (the ink measurement draws it inside an SVG). */
export function renderPageHtml(asset, key, pageNo, total) {
  const a = asset || {}, pg = (a.pages && a.pages[key]) || {}, meta = PAGES.find((p) => p.key === key) || PAGES[0], n = pageNo || PAGES.indexOf(meta) + 1;
  let body = "", title = pg.heading || meta.name, fontPt = 12;
  if (key === "resident") {
    fontPt = Math.max(18, Number(pg.fontPt) || 18);
    body = (pg.blocks || []).map(blockHtml).join("");
  } else if (key === "caregiver") {
    const steps = Array.isArray(pg.steps) ? pg.steps : [];
    body = steps.map((s, i) => `<div class="cgpp-step"><b>${i + 1}</b><div><strong>${esc(s.label)}</strong><br/>${esc(s.text)}</div></div>`).join("")
      + `<div class="cgpp-notice"><span>Validation therapy safety notice</span><br/>${esc(pg.safetyNotice || "")}</div>`
      + ((pg.notes || []).length ? `<div class="cgpp-block"><h3 class="cgpp-h2">Staff notes</h3><ul class="cgpp-list">${pg.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "")
      + `<div class="cgpp-block"><h3 class="cgpp-h2">Daily notes</h3><div class="cgpp-lines"><div></div><div></div><div></div><div></div><div></div></div></div>`;
  } else {
    body = `<div class="cgpp-block"><ul class="cgpp-list">${(pg.items || []).map((i) => `<li><strong>${esc(i.sense)}.</strong> ${esc(i.text)}</li>`).join("")}</ul></div>` + (pg.safety ? `<div class="cgpp-notice"><span>Safety</span><br/>${esc(pg.safety)}</div>` : "");
  }
  return `<section class="cgpp-sheet" data-page="${esc(key)}" style="font-size:${px(fontPt)}px">${brandHtml(a.branding)}<h2 class="cgpp-h1">${esc(title)}</h2><p class="cgpp-sub">${esc(a.title || "")} &#183; Page ${n} of ${total || 3}</p><hr class="cgpp-rule"/>${body}<div class="cgpp-foot"><span>${esc(FOOT)}</span><span>${esc(meta.name)}</span></div></section>`;
}
export const renderAllPagesHtml = (asset) => PAGES.map((p, i) => renderPageHtml(asset, p.key, i + 1, PAGES.length)).join("");

/* ---------- the ink measurement ---------- */
/* Draw markup off screen and measure it. Resolves { percent, grayFillPercent, pureBlackWhite } or { percent: null, reason }. */
export async function inkOfHtml(html, w = SHEET.widthPx, h = SHEET.heightPx, css = SHEET_CSS) {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${html}</div></foreignObject></svg>`;
    const img = new Image(); img.decoding = "sync";
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error("the page could not be drawn")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, w, h).data;
    let ink = 0; for (let i = 0; i < d.length; i += 4) ink += (255 - (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])) / 255;
    let grayBlocks = 0, blocks = 0;     // a flat gray patch (6 x 6 pixels, all alike, neither black nor white) is a fill: line art has none
    for (let by = 0; by + 6 <= h; by += 6) for (let bx = 0; bx + 6 <= w; bx += 6) {
      blocks++; const o0 = (by * w + bx) * 4, v = d[o0]; let flat = v > 40 && v < 215, i = 0;
      for (let y = 0; y < 6 && flat; y++) for (let x = 0; x < 6; x++) { const o = ((by + y) * w + bx + x) * 4; if (Math.abs(d[o] - v) > 3 || Math.abs(d[o + 1] - d[o0 + 1]) > 3 || Math.abs(d[o + 2] - d[o0 + 2]) > 3) { flat = false; break; } i++; }
      if (flat) grayBlocks++;
    }
    const percent = Math.round(ink / (w * h) * 1000) / 10, gray = Math.round(grayBlocks / blocks * 10000) / 100;
    return { percent, grayFillPercent: gray, pureBlackWhite: gray < 0.1 };
  } catch (e) { return { percent: null, reason: e && e.name === "SecurityError" ? "this browser does not allow the measurement" : "the measurement could not be made" }; }
}
export async function inkOfAsset(asset) {
  const per = []; for (let i = 0; i < PAGES.length; i++) per.push(await inkOfHtml(renderPageHtml(asset, PAGES[i].key, i + 1, PAGES.length)));
  const ok = per.every((p) => p.percent != null);
  return { pages: per, average: ok ? Math.round(per.reduce((s, p) => s + p.percent, 0) / per.length * 10) / 10 : null, pureBlackWhite: ok ? per.every((p) => p.pureBlackWhite) : null, reason: ok ? "" : (per.find((p) => p.percent == null) || {}).reason };
}

/* ---------- the modal ---------- */
let counter = 0;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function ensureSheetStyle() { if (!document.getElementById("cgpp-sheet-style")) { const s = el("style"); s.id = "cgpp-sheet-style"; s.textContent = SHEET_CSS; document.head.appendChild(s); } }

export function openPreview(input, opts = {}) {
  if (typeof document === "undefined" || typeof HTMLDialogElement === "undefined" || typeof HTMLDialogElement.prototype.showModal !== "function") return Promise.resolve({ action: "unsupported" });
  const result = input && input.asset ? input : { asset: input, audit: input && input.audit };
  const asset = result.asset || {}, audit = result.audit || { status: "not_run", problems: [], fixes: [] };
  const blocked = audit.status === "blocked";
  ensureSheetStyle();
  const id = "cgpp" + (++counter), opener = document.activeElement;
  const dlg = el("dialog", "cgpp-modal"); dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", id + "T"); dlg.setAttribute("aria-describedby", id + "D");

  const head = el("header", "cgpp-head"), hl = el("div", "cgpp-headtext");
  const h2 = el("h2", "cgpp-title", "Print Preview"); h2.id = id + "T";
  const desc = el("p", "cgpp-desc", "Exact size: 8.5 by 11 inches, with 0.75 inch margins. Nothing is sent anywhere."); desc.id = id + "D";
  hl.append(h2, desc);
  const toner = el("div", "cgpp-toner"); toner.setAttribute("role", "status"); toner.setAttribute("aria-live", "polite");
  const tTitle = el("strong", "cgpp-toner-title", "Facility Toner Optimizer"), tText = el("span", "cgpp-toner-text", "Measuring ink use…");
  toner.append(tTitle, tText); head.append(hl, toner);

  const tag = el("div", "cgpp-tag"); tag.setAttribute("role", "group"); tag.setAttribute("aria-label", "Customization summary");
  tag.append(el("strong", "cgpp-tag-title", "Customization summary"));
  const cust = Array.isArray(asset.customization) ? asset.customization : [];
  if (cust.length) cust.forEach((c) => { const chip = el("span", "cgpp-chip"); chip.append(el("b", "", c.label + ": "), document.createTextNode(String(c.value))); tag.append(chip); });
  else tag.append(el("span", "cgpp-chip cgpp-chip-plain", "No personal details were added: this is a general sheet."));

  const aud = el("div", "cgpp-audit cgpp-audit-" + (audit.status || "not_run")); aud.setAttribute("role", "status");
  const fixes = (audit.fixes || []).length, probs = (audit.problems || []).map((p) => (typeof p === "string" ? p : p.rule));
  aud.textContent = blocked ? "This sheet cannot be printed yet: " + [...new Set(probs)].join("; ") + ". Choose Adjust Parameters."
    : audit.status === "fixed" ? "Reviewed: " + fixes + " wording repair" + (fixes === 1 ? " was" : "s were") + " made automatically so the sheet invites and never tests."
    : audit.status === "pass" ? "Reviewed: the dignity and errorless-learning checks found nothing to change."
    : "The clinical review was not run. Read the sheet before printing.";

  const tabs = el("div", "cgpp-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Packet pages");
  const tabEls = PAGES.map((p, i) => { const b = el("button", "cgpp-tab"); b.type = "button"; b.id = id + "tab" + i; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", id + "panel"); b.append(el("span", "cgpp-tab-n", p.tab), el("span", "cgpp-tab-name", p.name)); tabs.append(b); return b; });
  const zoomBtn = el("button", "cgpp-btn cgpp-zoom", "Actual size"); zoomBtn.type = "button"; zoomBtn.setAttribute("aria-pressed", "false");

  const view = el("div", "cgpp-viewport"); view.id = id + "panel"; view.setAttribute("role", "tabpanel"); view.tabIndex = 0;
  const stage = el("div", "cgpp-stage"), holder = el("div", "cgpp-holder"); stage.append(holder); view.append(stage);

  const foot = el("footer", "cgpp-actions");
  const bClose = el("button", "cgpp-btn", "Close Preview"), bAdjust = el("button", "cgpp-btn", "Adjust Parameters"), bPrint = el("button", "cgpp-btn cgpp-btn-primary", "Confirm & Print");
  [bClose, bAdjust, bPrint].forEach((b) => { b.type = "button"; });
  if (blocked) { bPrint.setAttribute("aria-disabled", "true"); bPrint.classList.add("is-disabled"); }
  foot.append(bClose, bAdjust, bPrint);
  const bar = el("div", "cgpp-bar"); bar.append(tabs, zoomBtn);
  dlg.append(head, tag, aud, bar, view, foot); document.body.append(dlg);

  let cur = 0, actual = false, inkDone = null;
  const fit = () => {
    const sc = actual ? 1 : Math.min(1, Math.max(0.3, (view.clientWidth - 24) / SHEET.widthPx));
    holder.style.transform = "scale(" + sc + ")"; holder.style.width = SHEET.widthPx + "px"; holder.style.height = SHEET.heightPx + "px";
    stage.style.width = Math.round(SHEET.widthPx * sc) + "px"; stage.style.height = Math.round(SHEET.heightPx * sc) + "px";
  };
  const show = (i, focus) => {
    cur = (i + PAGES.length) % PAGES.length;
    tabEls.forEach((b, j) => { b.setAttribute("aria-selected", String(j === cur)); b.tabIndex = j === cur ? 0 : -1; b.classList.toggle("is-active", j === cur); });
    view.setAttribute("aria-labelledby", id + "tab" + cur);
    holder.innerHTML = renderPageHtml(asset, PAGES[cur].key, cur + 1, PAGES.length); fit(); view.scrollTop = 0;
    if (focus) tabEls[cur].focus();
    paintInk();
  };
  const paintInk = () => {
    if (!inkDone) { tText.textContent = "Measuring ink use…"; return; }
    if (inkDone.average == null) { tText.textContent = "Ink estimate is not available here (" + inkDone.reason + ")."; return; }
    const p = inkDone.pages[cur];
    tText.textContent = "This page about " + p.percent + "% ink · whole packet about " + inkDone.average + "% · " + (inkDone.pureBlackWhite ? "black line art only, no gray fills" : "gray fill found: use black line art to save toner");
    toner.classList.toggle("is-warn", !inkDone.pureBlackWhite);
  };
  tabEls.forEach((b, i) => { b.addEventListener("click", () => show(i, false)); });
  tabs.addEventListener("keydown", (e) => { const k = e.key; if (k === "ArrowRight" || k === "ArrowLeft" || k === "Home" || k === "End") { e.preventDefault(); show(k === "Home" ? 0 : k === "End" ? PAGES.length - 1 : cur + (k === "ArrowRight" ? 1 : -1), true); } });
  zoomBtn.addEventListener("click", () => { actual = !actual; zoomBtn.setAttribute("aria-pressed", String(actual)); zoomBtn.textContent = actual ? "Fit to window" : "Actual size"; fit(); });
  const onResize = () => fit(); window.addEventListener("resize", onResize);

  return new Promise((resolve) => {
    let done = false, printing = null;
    const finish = (action) => {
      if (done) return; done = true; window.removeEventListener("resize", onResize);
      if (printing) { printing(); }
      try { if (dlg.open) dlg.close(); } catch (e) { /* closed already */ }
      dlg.remove(); document.documentElement.classList.remove("cgpp-open");
      /* Adjust sends focus to the form instead of back to the button */
      if (action !== "adjust" && opener && opener.isConnected && typeof opener.focus === "function") { try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      resolve({ action });
    };
    bClose.addEventListener("click", () => finish("close"));
    bAdjust.addEventListener("click", () => { finish("adjust"); if (typeof opts.onAdjust === "function") { try { opts.onAdjust(result); } catch (e) { /* the form is still there */ } } });   // after the close: closing returns focus to the old button, and the callback moves it on to the form
    bPrint.addEventListener("click", () => {
      if (blocked) { aud.classList.add("cgpp-shake"); aud.focus && aud.setAttribute("tabindex", "-1"); aud.focus(); return; }
      if (typeof opts.beforePrint === "function") {    // a chance to stop the print (for example, the free allowance is used up); the preview closes first so a window behind it can show
        let go = true; try { go = opts.beforePrint(result) !== false; } catch (e) { go = true; }
        if (!go) { finish("blocked"); return; }
      }
      if (typeof opts.onConfirm === "function") { try { opts.onConfirm(result); } catch (e) { /* a logger must not stop a print */ } }
      const stageEl = el("div"); stageEl.id = "cgpp-print-stage"; stageEl.innerHTML = renderAllPagesHtml(asset); document.body.append(stageEl);
      document.documentElement.classList.add("cgpp-printing");
      const cleanup = () => { document.documentElement.classList.remove("cgpp-printing"); stageEl.remove(); printing = null; window.removeEventListener("afterprint", cleanup); };
      printing = cleanup; window.addEventListener("afterprint", cleanup);
      try { window.print(); } finally { if (opts.keepOpenAfterPrint) { cleanup(); } else { cleanup(); finish("print"); } }
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish("close"); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg && opts.backdropClose !== false) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finish("close"); } });
    document.documentElement.classList.add("cgpp-open");
    dlg.showModal(); show(0, true);
    inkOfAsset(asset).then((r) => { inkDone = r; if (!done) paintInk(); }, () => { inkDone = { average: null, reason: "the measurement could not be made" }; if (!done) paintInk(); });
  });
}

/* ---------- the "preview" stage of the pipeline ---------- */
export class PrintPreviewAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "PrintPreviewAgent", stage: "preview", role: "Layout and print engine", goal: "Show exactly what will print, how much ink it uses, and what was personalised.", capabilities: ["preview", "ink-estimate"], ...o }); this.options = o.options || {}; }
  async handle(ctx) {
    ctx.preview = await openPreview({ asset: ctx.asset, audit: ctx.audit }, this.options);
    return ctx;
  }
}
export default openPreview;
