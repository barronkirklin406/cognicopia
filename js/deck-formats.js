/* Conversation deck formats: index cards (4 x 6 and 5 x 7 in) printed one to a page for direct feeding into a printer, and a QR code on each
   front that opens an audio prompt which plays on the device itself.

   The audio is made by the site's own offline sound engine (js/tabletSound.js: Web Audio, nothing downloaded): the QR code holds a site-relative address,
   builder.html#/audio/<sound>, so it works wherever the Cognicopia site is open, with no internet needed on that device. */
import { qrSvg } from "./qr.js";
import { categoryOf, tagHtml, responseRow, backHtml, esc } from "./era-decks.js";

export const INDEX_CARDS = Object.freeze({ "4x6": { w: 4, h: 6, label: "4 x 6 in index card", cls: "dk-i4x6" }, "5x7": { w: 5, h: 7, label: "5 x 7 in index card", cls: "dk-i5x7" } });
export const SOUNDS = Object.freeze([
  { id: "guitar", name: "An acoustic guitar, picked gently", era: "any", words: /music|radio|song|dance|swing|band|sing|guitar|play/i },
  { id: "train", name: "A steam whistle down the line", era: "any", words: /train|travel|station|trip|vacation|depot|railroad|work|job|career/i },
  { id: "bells", name: "Church bells across town", era: "any", words: /church|wedding|town|hometown|sunday|neighbor|school|bell/i },
  { id: "bird", name: "A songbird on a branch", era: "any", words: /farm|barn|garden|country|bird|animal|field|spring|outdoor/i },
  { id: "chimes", name: "Wind chimes in a breeze", era: "any", words: /home|kitchen|cook|bak|family|house|quilt|porch|window/i }
]);
export const audioPath = (id) => "builder.html#/audio/" + String(id).replace(/[^a-z0-9-]/gi, "");
/* Which sound suits a card: by what the card is about, then by its kind. */
export function soundFor(card) {
  const t = [card && card.title, card && card.invite].join(" "), hit = SOUNDS.find((s) => s.words.test(t));
  if (hit) return hit; const k = card && card.kind; return SOUNDS.find((s) => s.id === (k === "era" ? "guitar" : k === "work" ? "train" : k === "place" ? "bells" : "chimes")) || SOUNDS[4];
}
export function qrHtml(card, o = {}) { const s = soundFor(card); return `<figure class="dk-qr">${qrSvg(audioPath(s.id), { scale: o.scale || 3, label: "Scan to hear " + s.name })}<figcaption>Scan to hear<br>${esc(s.name)}</figcaption></figure>`; }
export function indexFront(card, i, n, o = {}) {
  const cat = categoryOf(card), t = o.tier || 2, cfg = INDEX_CARDS[o.size] || INDEX_CARDS["4x6"];
  return `<div class="sheet dk-index ${cfg.cls} dk-t${t}" data-cat="${cat.code}" data-index-card="${esc(o.size || "4x6")}"><div class="dk-frame dk-${cat.code}">
    <div class="dk-top">${tagHtml(cat)}<span class="dk-no">${i + 1} of ${n}</span></div><h3 class="dk-title">${esc(card.title)}</h3>
    <div class="dk-art">${o.art ? o.art(card, t) : ""}</div><p class="dk-invite">${esc(card.invite)}</p>${o.qr === false ? "" : qrHtml(card)}${responseRow()}</div></div>`;
}
export function indexBack(card, o = {}) { const cfg = INDEX_CARDS[o.size] || INDEX_CARDS["4x6"]; return `<div class="sheet dk-index ${cfg.cls} dk-indexback" data-index-card="${esc(o.size || "4x6")}">${backHtml(card, { footer: o.who || "" })}</div>`; }
/* indexCardPages(cards, { size: "4x6" | "5x7", art, tier, who, back, qr }) -> [{ role, html, w, h }]: each card is a page the size of the card, front then back. */
export function indexCardPages(cards, o = {}) {
  const cfg = INDEX_CARDS[o.size] || INDEX_CARDS["4x6"], list = Array.isArray(cards) ? cards : [], out = [];
  list.forEach((c, i) => { out.push({ role: "front", w: cfg.w, h: cfg.h, html: indexFront(c, i, list.length, o) }); if (o.back !== false) out.push({ role: "back", w: cfg.w, h: cfg.h, html: indexBack(c, o) }); });
  return out;
}
