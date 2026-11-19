/* Era-Locked Conversational Decks: categories, filtering and the cut-out cardstock layout.

   A deck is a set of conversation cards anchored to the resident's birth era and life history (js and data from CogniReminiscence). Here
   each card is sorted into one of four categories that staff can filter and sort by, and the whole deck can be laid out for cardstock:
   four cards to a Letter page (3.75 x 5 in), single dashed cut lines, a back page of caregiver notes mirrored so that two-sided printing
   lines up, and a small response row on every front: [+] Positive  [=] Neutral  [!] Story elicited. No network, no storage. */

export const VERSION = "1.0.0";
export const CATEGORIES = Object.freeze([
  { code: "hometown", label: "Hometown", glyph: "H", kinds: ["place"], frame: "solid", tint: "#cfe8e5" },
  { code: "career", label: "Career", glyph: "C", kinds: ["work"], frame: "double", tint: "#f6cdb4" },
  { code: "music", label: "Music", glyph: "M", kinds: ["era"], frame: "bars", tint: "#dfe0f7" },
  { code: "family", label: "Family", glyph: "F", kinds: ["home", "pastime"], frame: "round", tint: "#f3e6b3" }
]);
export const RESPONSES = Object.freeze([{ mark: "+", label: "Positive" }, { mark: "=", label: "Neutral" }, { mark: "!", label: "Story elicited" }]);
export const CARD = Object.freeze({ widthIn: 3.75, heightIn: 4.85, perPage: 4, cols: 2, marginIn: 0.5 });
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* The category of a card, from the kind the reminiscence engine gave it. */
export function categoryOf(card) { const k = card && card.kind; return CATEGORIES.find((c) => c.kinds.includes(k)) || CATEGORIES[3]; }
export const categoryByCode = (code) => CATEGORIES.find((c) => c.code === code) || null;
/* Keep only the chosen categories (all of them when none is given), optionally grouped by category in the order Hometown, Career, Music, Family. */
export function filterCards(cards, chosen, sort) {
  const set = new Set((Array.isArray(chosen) && chosen.length ? chosen : CATEGORIES.map((c) => c.code)));
  let out = (Array.isArray(cards) ? cards : []).filter((c) => set.has(categoryOf(c).code));
  if (sort) { const order = CATEGORIES.map((c) => c.code); out = out.map((c, i) => [c, i]).sort((a, b) => order.indexOf(categoryOf(a[0]).code) - order.indexOf(categoryOf(b[0]).code) || a[1] - b[1]).map((x) => x[0]); }
  return out;
}
export function countsOf(cards) { const o = Object.fromEntries(CATEGORIES.map((c) => [c.code, 0])); (cards || []).forEach((c) => { o[categoryOf(c).code]++; }); return o; }
/* A tag a facilitator can read at a glance and still tell apart in black and white: a shape-free letter in a badge, plus the word. */
export const tagHtml = (cat) => `<span class="dk-tag dk-${cat.code}"><i aria-hidden="true">${cat.glyph}</i>${esc(cat.label)}</span>`;

export function responseRow() { return `<div class="dk-resp" aria-label="Response tracking">${RESPONSES.map((r) => `<span class="dk-r"><span class="dk-box" aria-hidden="true"></span><b>${esc(r.mark)}</b> ${esc(r.label)}</span>`).join("")}</div>`; }

/* ---------- the cardstock layout ---------- */
const lvl = (t) => (t === 1 ? "t1" : t === 3 ? "t3" : "t2");
export function frontHtml(card, i, n, o) {
  const cat = categoryOf(card), t = (o && o.tier) || 2;
  return `<div class="dk-card dk-front dk-${cat.code} dk-${lvl(t)}" data-cat="${cat.code}"><div class="dk-frame">
    <div class="dk-top">${tagHtml(cat)}<span class="dk-no">${i + 1} of ${n}</span></div>
    <h3 class="dk-title">${esc(card.title)}</h3>
    <div class="dk-art">${o && o.art ? o.art(card, t) : ""}</div>
    <p class="dk-invite">${esc(card.invite)}</p>
    ${responseRow()}</div></div>`;
}
export function backHtml(card, o) {
  const cat = categoryOf(card), song = card.song || {};
  return `<div class="dk-card dk-back dk-${cat.code}" data-cat="${cat.code}"><div class="dk-frame">
    <div class="dk-top">${tagHtml(cat)}<span class="dk-no">For the caregiver</span></div>
    <h3 class="dk-title dk-sm">${esc(card.title)}</h3>
    <ol class="dk-starters">${(card.starters || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    ${song.title ? `<p><b>Song:</b> ${esc(song.title)}${song.artist ? ", " + esc(song.artist) : ""}</p>` : ""}
    ${card.touch && card.touch.prompt ? `<p><b>Touch:</b> ${esc(card.touch.prompt)} <i>${esc(card.touch.safety || "")}</i></p>` : ""}
    ${card.refs && card.refs.length ? `<p><b>From their time and place:</b> ${card.refs.map(esc).join(" &middot; ")}</p>` : ""}
    ${o && o.footer ? `<p class="dk-foot">${esc(o.footer)}</p>` : ""}</div></div>`;
}
/* deckPages(cards, { tier, art, who, color, back }) -> [{ html, role }]: a front page of four cards, then (if back) its back page with the columns swapped,
   so a long-edge two-sided print puts each card's notes behind it. Empty places on the last page are drawn as blank cells with the cut lines. */
export function deckPages(cards, o = {}) {
  const list = Array.isArray(cards) ? cards : [], n = list.length, pages = [], per = CARD.perPage, cls = "sheet dk-sheet" + (o.color ? " dk-color" : "");
  const cell = (inner) => inner || `<div class="dk-card dk-blank"></div>`;
  for (let p = 0; p * per < n; p++) {
    const slice = list.slice(p * per, p * per + per), idx = (k) => p * per + k;
    const fronts = Array.from({ length: per }, (_, k) => (slice[k] ? frontHtml(slice[k], idx(k), n, o) : ""));
    pages.push({ role: "front", html: `<div class="${cls}" data-dk-page="${p + 1}"><div class="dk-grid">${fronts.map(cell).join("")}</div><p class="dk-note">Cut on the dashed lines. Cards ${p * per + 1} to ${Math.min(n, p * per + per)} of ${n}.</p></div>` });
    if (o.back !== false) {
      const backs = Array.from({ length: per }, (_, k) => (slice[k] ? backHtml(slice[k], { footer: o.who || "" }) : "")), swapped = [backs[1], backs[0], backs[3], backs[2]];
      pages.push({ role: "back", html: `<div class="${cls} dk-backpage" data-dk-page="${p + 1}"><div class="dk-grid">${swapped.map(cell).join("")}</div><p class="dk-note">Print two-sided, flipping on the long edge: each card's notes land behind it.</p></div>` });
    }
  }
  return pages;
}
export { esc };
