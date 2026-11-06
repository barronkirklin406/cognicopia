/* Progress report for a family or clinical conference: the last 90 days (three months) of engagement, frustration and eye fatigue as a graph that
   still reads in black and white (a different line style and marker for each), the trend table, the recommendation (if any) and the monthly
   notes. reportPages() makes printable pages for the builder's print window; reportPdf() draws the same report straight into a jsPDF document
   as vector lines and text. It reports what staff recorded; it is not an assessment. */
import * as C from "./studio-core.js";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const SERIES = Object.freeze([{ key: "engagement", label: "Engagement", dash: "", marker: "circle" }, { key: "frustration", label: "Frustration", dash: "14 8", marker: "square" }, { key: "fatigue", label: "Eye fatigue", dash: "3 8", marker: "triangle" }]);
export function pointsFor(entries, today, months = 3) {
  const list = C.monthsBack(today, months), by = new Map((entries || []).map((e) => [e.month, e]));
  return list.map((m) => ({ month: m, label: C.monthLabel(m).split(" ")[0], entry: by.get(m) || null }));
}
const mk = (shape, x, y) => shape === "circle" ? `<circle cx="${x}" cy="${y}" r="7" fill="#000"/>` : shape === "square" ? `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="#fff" data-bw="white" stroke="#000" stroke-width="4"/>` : `<path d="M${x} ${y - 9}L${x + 9} ${y + 7}L${x - 9} ${y + 7}z" fill="#fff" data-bw="white" stroke="#000" stroke-width="4"/>`;
/* months: 3 for the 90-day graph, 12 for the year. */
export function graphSvg(entries, today, months = 3, o = {}) {
  const W = o.width || 640, H = o.height || 320, L = 70, R = 60, T = 20, B = 70, pts = pointsFor(entries, today, months), n = pts.length, x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), y = (v) => T + (H - T - B) * (1 - v / 4);
  const grid = [0, 1, 2, 3, 4].map((v) => `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#000" stroke-width="${v === 0 ? 4 : 1.5}"/><text x="${L - 10}" y="${y(v) + 6}" text-anchor="end" font-size="18" font-family="Arial,sans-serif">${v}</text>`).join("");
  const xl = pts.map((p, i) => `<text x="${x(i)}" y="${H - B + 28}" text-anchor="middle" font-size="${months > 6 ? 13 : 18}" font-family="Arial,sans-serif">${esc(months > 6 ? p.label.slice(0, 3) : p.label)}</text>`).join("");
  const lines = SERIES.map((s) => { const run = []; pts.forEach((p, i) => { if (p.entry) run.push([x(i), y(p.entry[s.key])]); });
    const path = run.length > 1 ? `<polyline points="${run.map((r) => r.join(",")).join(" ")}" fill="none" stroke="#000" stroke-width="4" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round"/>` : ""; return path + run.map(([a, b]) => mk(s.marker, a, b)).join(""); }).join("");
  const lg = SERIES.map((s, i) => { const lx = L + i * 190; return `<line x1="${lx}" y1="${H - 14}" x2="${lx + 40}" y2="${H - 14}" stroke="#000" stroke-width="4" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>${mk(s.marker, lx + 20, H - 14)}<text x="${lx + 50}" y="${H - 8}" font-size="17" font-family="Arial,sans-serif">${esc(s.label)}</text>`; }).join("");
  return `<svg class="tr-graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Engagement, frustration and eye fatigue over ${months === 3 ? "the last 90 days" : "the last " + months + " months"}, each from 0 to 4"><rect width="${W}" height="${H}" fill="#fff" data-bw="white"/>${grid}${xl}${lines}${lg}</svg>`;
}
const stageLabel = (c) => (C.STAGES.find((s) => s.code === c) || {}).label || "Not set";
/* model: { name, entries, today, facility?, preparedBy? } */
export function reportPages(model) {
  const m = model || {}, today = m.today || new Date(), a = C.analyze(m.entries || [], today), rec = a.recommendation, w3 = a.windows[3], d = (x) => x.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const from = new Date(today.getTime() - 90 * 86400000), trendRow = (w) => { const x = a.windows[w]; return `<tr><th scope="row">${w} months</th><td>${x.n}</td>${["engagement", "frustration", "fatigue"].map((k) => `<td>${x.n ? x[k] + " (" + x.trends[k] + ")" : "&ndash;"}</td>`).join("")}</tr>`; };
  const logRows = pointsFor(m.entries, today, 12).filter((p) => p.entry).reverse().map((p) => `<tr><th scope="row">${esc(C.monthLabel(p.month))}</th><td>${esc(stageLabel(p.entry.stage))}</td><td>${p.entry.engagement}</td><td>${p.entry.frustration}</td><td>${p.entry.fatigue}</td><td>${esc(p.entry.triggers.join(", ")) || "&ndash;"}</td></tr>`).join("");
  const notes = pointsFor(m.entries, today, 12).filter((p) => p.entry && p.entry.note).reverse().map((p) => `<li><b>${esc(C.monthLabel(p.month))}.</b> ${esc(p.entry.note)}</li>`).join("");
  const foot = (n, t) => `<footer class="tr-foot"><span>${esc(m.facility || "Cognicopia")} &middot; Progress report</span><b>Page ${n} of ${t}</b></footer>`;
  const p1 = `<div class="sheet tr-sheet"><header class="tr-head"><p class="tr-kicker">Progress report</p><h1>${esc(m.name || "Resident")}</h1><p>${esc(d(from))} to ${esc(d(today))} &middot; ${esc(stageLabel(a.stage))}</p></header>
    <h2>The last 90 days</h2>${graphSvg(m.entries, today, 3)}
    <h2>Trends</h2><table class="tr-table"><thead><tr><th scope="col">Window</th><th scope="col">Months logged</th><th scope="col">Engagement (0 to 4)</th><th scope="col">Frustration (0 to 4)</th><th scope="col">Eye fatigue (0 to 4)</th></tr></thead><tbody>${[3, 6, 12].map(trendRow).join("")}</tbody></table>
    ${rec.banner ? `<div class="tr-rec"><b>${esc(rec.banner)}</b><p>${esc(rec.reason)}</p></div>` : `<p class="tr-rec-none">${esc(rec.reason || "")}</p>`}
    ${w3.triggers.length ? `<p><b>Most often noted:</b> ${esc(w3.triggers.map((t) => t.trigger.toLowerCase()).join(", "))}.</p>` : ""}
    ${foot(1, 2)}</div>`;
  const p2 = `<div class="sheet tr-sheet"><h2>Month by month</h2><table class="tr-table"><thead><tr><th scope="col">Month</th><th scope="col">Stage</th><th scope="col">Engaged</th><th scope="col">Frustration</th><th scope="col">Eye fatigue</th><th scope="col">What brought it on</th></tr></thead><tbody>${logRows || `<tr><td colspan="6">Nothing has been logged yet.</td></tr>`}</tbody></table>
    <h2>The year</h2>${graphSvg(m.entries, today, 12)}
    ${notes ? `<h2>What staff noticed</h2><ul class="tr-notes">${notes}</ul>` : ""}
    <p class="tr-note">${esc(rec.note || "A pattern in what staff recorded, to talk over with the care team. It is not an assessment.")}</p>${foot(2, 2)}</div>`;
  return [{ role: "report", html: p1 }, { role: "report", html: p2 }];
}
/* The same report, drawn straight into a jsPDF document (Letter, inches) as vector lines and text. */
export function reportPdf(doc, model) {
  const m = model || {}, today = m.today || new Date(), a = C.analyze(m.entries || [], today), rec = a.recommendation, mg = { l: 0.75, r: 0.5 }, W = 8.5 - mg.l - mg.r;
  const text = (s, x, y, pt, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(pt); doc.text(String(s), x, y); };
  const wrap = (s, pt, w) => { doc.setFontSize(pt); return doc.splitTextToSize(String(s), w); };
  text("Progress report", mg.l, 0.9, 12, true); text(m.name || "Resident", mg.l, 1.35, 26, true);
  text(C.monthLabel(C.monthKey(new Date(today.getTime() - 90 * 86400000))) + " to " + C.monthLabel(C.monthKey(today)) + " - " + stageLabel(a.stage), mg.l, 1.65, 12, false);
  const gx = mg.l + 0.5, gy = 2.0, gw = W - 0.7, gh = 3.2, pts = pointsFor(m.entries, today, 3), x = (i) => gx + (pts.length === 1 ? gw / 2 : (i * gw) / (pts.length - 1)), y = (v) => gy + gh * (1 - v / 4);
  doc.setLineWidth(0.04); doc.setDrawColor(0); for (let v = 0; v <= 4; v++) { doc.setLineWidth(v === 0 ? 0.04 : 0.015); doc.line(gx, y(v), gx + gw, y(v)); text(v, gx - 0.25, y(v) + 0.05, 11, false); }
  pts.forEach((p, i) => text(p.label, x(i) - 0.25, gy + gh + 0.3, 12, false));
  SERIES.forEach((s, si) => { doc.setLineWidth(0.04); doc.setLineDashPattern(si === 0 ? [] : si === 1 ? [0.14, 0.08] : [0.03, 0.08], 0); let prev = null; pts.forEach((p, i) => { if (!p.entry) { prev = null; return; } const px = x(i), py = y(p.entry[s.key]); if (prev) doc.line(prev[0], prev[1], px, py); prev = [px, py]; }); doc.setLineDashPattern([], 0);
    pts.forEach((p, i) => { if (!p.entry) return; const px = x(i), py = y(p.entry[s.key]); if (s.marker === "circle") doc.circle(px, py, 0.07, "F"); else if (s.marker === "square") doc.rect(px - 0.07, py - 0.07, 0.14, 0.14, "S"); else doc.triangle(px, py - 0.09, px + 0.09, py + 0.07, px - 0.09, py + 0.07, "S"); });
    doc.setLineDashPattern(si === 0 ? [] : si === 1 ? [0.14, 0.08] : [0.03, 0.08], 0); doc.line(gx + si * 2.1, gy + gh + 0.65, gx + si * 2.1 + 0.4, gy + gh + 0.65); doc.setLineDashPattern([], 0); text(s.label, gx + si * 2.1 + 0.5, gy + gh + 0.7, 12, false); });
  let yy = gy + gh + 1.2; if (rec.banner) { text("Recommendation", mg.l, yy, 13, true); yy += 0.28; for (const l of wrap(rec.banner + " " + rec.reason, 12, W)) { text(l, mg.l, yy, 12, false); yy += 0.22; } yy += 0.1; }
  for (const l of wrap(rec.note || "A pattern in what staff recorded, to talk over with the care team. It is not an assessment.", 11, W)) { text(l, mg.l, yy, 11, false); yy += 0.2; }
  text((m.facility || "Cognicopia") + " - Progress report", mg.l, 10.4, 10, false); text("Page 1", 8.5 - mg.r - 0.6, 10.4, 10, false);
  return doc;
}
