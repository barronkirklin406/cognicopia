/* Clinical suite generators: visual pacing, hallucination-safe anchors, spaced retrieval, tactile templates, word and number modules,
   art and music helpers.

   Each function returns a piece of printable HTML (or plain data) in pure black on white, with lines of at least 3 pt, built from the small
   set of classes in css/styles.css (.cl-*). They support staff judgment; they are not treatment. Nothing is sent anywhere.

     Vascular        stepChecklist(): an icon beside every step, a box to tick, and a "Pause & Breathe" pause after every third step
     Lewy body       anchorSheet(): one high-contrast element on a plain page; validateAnchor() refuses anything busy or ambiguous;
                     ILLUMINATION lists the three screen modes
     Frontotemporal  vocationMatrix(): a sorting grid by trade; progressBar(): a segmented completion bar to channel a fixed focus
     Sensory/Korsakoff focalSilhouette(), facilitatorOverlay(), spacedRetrievalPages(): the same few items on pages 1, 3 and 5, with the
                     answer always shown and an upside-down hint
     Words & numbers REGIONAL_PHRASES, coinTemplate(), playMoneyHtml(), searchDirections()
     Art & music     bordered(), QUILT_BLOCKS, lyricBar(), filterSongs() */

export const VERSION = "1.0.0";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const STROKE = 'fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';   // 5 px at 96 dpi is 3.75 pt

/* ---------- Vascular: step icons and pauses ---------- */
const ICONS = Object.freeze({
  pick: `<path d="M12 36V20a4 4 0 0 1 8 0v8M20 26a4 4 0 0 1 8 0v4M28 28a4 4 0 0 1 8 0v8c0 8-5 12-12 12-6 0-12-4-12-12z" ${STROKE}/>`,
  pour: `<path d="M10 14h22l-4 26H14zM32 18h6a4 4 0 0 1 0 12h-6" ${STROKE}/>`,
  fold: `<path d="M8 12h32v26H8zM8 25h32M24 12v26" ${STROKE}/>`,
  sort: `<rect x="8" y="10" width="14" height="14" ${STROKE}/><rect x="26" y="24" width="14" height="14" ${STROKE}/><path d="M24 18h10M24 32h-10" ${STROKE}/>`,
  wipe: `<path d="M8 34c8-12 16-12 24 0M30 14l8 8M24 20l8 8" ${STROKE}/>`,
  stir: `<ellipse cx="22" cy="34" rx="14" ry="6" ${STROKE}/><path d="M22 34L36 8" ${STROKE}/>`,
  open: `<path d="M10 40V10h20v30M30 14l10 4v22l-10 0" ${STROKE}/><circle cx="25" cy="26" r="1.5" ${STROKE}/>`,
  wash: `<path d="M8 28h32v10H8zM16 28v-8a8 8 0 0 1 16 0v8" ${STROKE}/>`,
  look: `<path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z" ${STROKE}/><circle cx="24" cy="24" r="5" ${STROKE}/>`,
  step: `<circle cx="24" cy="24" r="14" ${STROKE}/><path d="M18 24l5 5 8-10" ${STROKE}/>`
});
const VERBS = [[/\b(pick|take|grab|hold|gather|get)\b/i, "pick"], [/\b(pour|fill|add)\b/i, "pour"], [/\b(fold|smooth)\b/i, "fold"], [/\b(sort|match|group|put .* in)\b/i, "sort"], [/\b(wipe|dry|clean|dust)\b/i, "wipe"], [/\b(stir|mix|whisk)\b/i, "stir"], [/\b(open|close|unlock)\b/i, "open"], [/\b(wash|rinse|soap)\b/i, "wash"], [/\b(look|find|notice|check)\b/i, "look"]];
export const iconFor = (text) => { const v = VERBS.find(([re]) => re.test(String(text))); return v ? v[1] : "step"; };
export const iconSvg = (name) => `<svg class="cl-icon" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${esc(name)}">${ICONS[name] || ICONS.step}</svg>`;
export const pauseHtml = () => `<li class="cl-pause" role="separator"><svg class="cl-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><path d="M8 24c6-12 10 12 16 0s10 12 16 0" ${STROKE}/></svg><div><b>Pause &amp; Breathe</b><p>Breathe in slowly for 4. Breathe out slowly for 6. Take your time.</p></div></li>`;
/* steps: strings. A pause follows every third step (and never comes last). */
export function stepChecklist(steps, o = {}) {
  const list = (Array.isArray(steps) ? steps : []).map((s) => clip(s, 160)).filter(Boolean).slice(0, 12), every = o.pauseEvery || 3;
  return `<ol class="cl-steps">${list.map((s, i) => `<li class="cl-step"><span class="cl-num">${i + 1}</span>${iconSvg(iconFor(s))}<span class="cl-text">${esc(s)}</span><span class="cl-box" aria-hidden="true"></span></li>${(i + 1) % every === 0 && i + 1 < list.length ? pauseHtml() : ""}`).join("")}</ol>`;
}

/* ---------- Lewy body: single, plain, high-contrast anchors ---------- */
export const ILLUMINATION = Object.freeze([{ code: "bright", label: "Bright", note: "Pure black on white, for good light." }, { code: "soft", label: "Soft", note: "Black on a warm off-white, for glare." }, { code: "low", label: "Low light", note: "White on black, for dim rooms and evenings." }]);
const ANCHORS = Object.freeze({
  circle: `<circle cx="100" cy="100" r="70" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`,
  apple: `<path d="M100 60c-30-20-62 4-54 44 6 30 30 52 54 40 24 12 48-10 54-40 8-40-24-64-54-44z M100 60c0-14 6-24 16-30" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`,
  cup: `<path d="M50 60h90v70c0 22-16 36-45 36s-45-14-45-36zM140 76h18a18 18 0 0 1 0 36h-18" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`,
  flower: `<path d="M100 60c-20-40 30-40 0 0zM140 100c40-20 40 30 0 0zM100 140c20 40-30 40 0 0zM60 100c-40 20-40-30 0 0zM100 80a20 20 0 1 0 .1 0z" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/><path d="M100 150v36" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`,
  house: `<path d="M40 100L100 44l60 56v70H40zM88 170v-40h24v40" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`,
  heart: `<path d="M100 164C40 124 40 70 74 64c18-3 26 8 26 8s8-11 26-8c34 6 34 60-26 100z" ${STROKE.replace('stroke-width="5"', 'stroke-width="7"')}/>`
});
export const ANCHOR_NAMES = Object.freeze(Object.keys(ANCHORS));
/* One element, on a plain page. Nothing else on the page: no pattern, no border design, no second picture, so nothing can be read as something else. */
export function anchorSvg(name) { const body = ANCHORS[name] || ANCHORS.circle; return `<svg class="cl-anchor" viewBox="0 0 200 200" role="img" aria-label="${esc(ANCHORS[name] ? name : "circle")}">${body}</svg>`; }
export function anchorSheet(name, o = {}) {
  const mode = ILLUMINATION.some((m) => m.code === o.mode) ? o.mode : "bright";
  return `<div class="cl-lbd cl-lbd-${mode}" data-anchor="${esc(ANCHORS[name] ? name : "circle")}">${anchorSvg(name)}<p class="cl-lbd-word">${esc(clip(o.word || name, 30))}</p>${o.prompt ? `<p class="cl-lbd-prompt">${esc(clip(o.prompt, 90))}</p>` : ""}</div>`;
}
/* An SVG fails if it is busy or ambiguous: more than two shapes, gradients, patterns, filters, text inside it, fills that are not none, a stroke under 4 px,
   or several separate pictures. This is the rule the library above is held to. */
export function validateAnchor(svg) {
  const s = String(svg == null ? "" : svg), problems = [], shapes = (s.match(/<(path|circle|rect|ellipse|polygon|polyline|line)\b/gi) || []).length;
  if (!/<svg\b/i.test(s)) return { ok: false, problems: ["not an SVG"] };
  if (shapes === 0) problems.push("nothing is drawn"); if (shapes > 2) problems.push("more than two shapes (" + shapes + ")");
  if (/<(linearGradient|radialGradient|pattern|filter|image|text|use|mask|clipPath)\b/i.test(s)) problems.push("a gradient, pattern, filter, image or text");
  if (/fill\s*=\s*["'](?!none)/i.test(s)) problems.push("a filled shape");
  if ([...s.matchAll(/stroke-width\s*=\s*["']([\d.]+)/gi)].some((m) => Number(m[1]) < 4)) problems.push("a line thinner than 4 px");
  if (/opacity/i.test(s)) problems.push("transparency");
  return { ok: problems.length === 0, problems, shapes };
}

/* ---------- Frontotemporal: sorting and progress ---------- */
export const TRADES = Object.freeze([{ code: "kitchen", label: "Kitchen", items: ["whisk", "rolling pin", "ladle", "colander", "apron"] }, { code: "garden", label: "Garden", items: ["trowel", "seed packet", "watering can", "gloves", "rake"] }, { code: "workshop", label: "Workshop", items: ["hammer", "screwdriver", "nails", "tape measure", "sandpaper"] }, { code: "sewing", label: "Sewing", items: ["thimble", "spool of thread", "buttons", "scissors", "pin cushion"] }, { code: "office", label: "Office", items: ["stapler", "envelope", "ledger", "rubber stamp", "paper clips"] }]);
/* trades: codes (up to 4). Items are shown in a shuffled order beside a grid with one column per trade and a box per item. */
export function vocationMatrix(trades, o = {}) {
  const picked = (Array.isArray(trades) ? trades : []).map((c) => TRADES.find((t) => t.code === c)).filter(Boolean).slice(0, 4), chosen = picked.length ? picked : ["kitchen", "garden", "workshop"].map((c) => TRADES.find((t) => t.code === c)), per = Math.max(2, Math.min(5, o.perTrade || 4));
  const all = chosen.flatMap((t, ti) => t.items.slice(0, per).map((it, i) => ({ it, ti, k: (ti * 7 + i * 3 + (o.seed || 0)) % 11 }))).sort((a, b) => a.k - b.k || a.it.localeCompare(b.it));
  return `<div class="cl-matrix"><div class="cl-pool"><b>Things to sort</b><ul>${all.map((x) => `<li>${esc(x.it)}</li>`).join("")}</ul></div><table class="cl-grid"><thead><tr>${chosen.map((t) => `<th scope="col">${esc(t.label)}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: per }, () => `<tr>${chosen.map(() => `<td><span class="cl-box" aria-hidden="true"></span></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export function progressBar(done, total, o = {}) {
  const t = Math.max(1, Math.min(20, Math.round(total) || 1)), d = Math.max(0, Math.min(t, Math.round(done) || 0));
  return `<div class="cl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${d}" aria-label="${esc(o.label || "Progress")}"><div class="cl-segs">${Array.from({ length: t }, (_, i) => `<span class="cl-seg${i < d ? " on" : ""}"></span>`).join("")}</div><p>${d} of ${t} done${d === t ? ". All finished." : ""}</p></div>`;
}

/* ---------- Sensory and Korsakoff ---------- */
const SIL = Object.freeze({ teacup: `<path d="M30 70h110v56c0 28-22 44-55 44s-55-16-55-44zM140 86h22a22 22 0 0 1 0 44h-22M20 186h130" ${STROKE.replace('stroke-width="5"', 'stroke-width="8"')}/>`, rose: `<path d="M100 30c-30 0-44 30-30 52 6 10 18 14 30 14s24-4 30-14c14-22 0-52-30-52zM100 96v94M100 150c-24 0-36-10-40-24M100 130c24 0 36-10 40-24" ${STROKE.replace('stroke-width="5"', 'stroke-width="8"')}/>`, bird: `<path d="M30 110c20-40 70-50 100-20l30-20-10 36c-6 40-40 60-80 50l-20 24 4-34c-14-8-24-20-24-36z" ${STROKE.replace('stroke-width="5"', 'stroke-width="8"')}/>`, key: `<circle cx="60" cy="90" r="34" ${STROKE.replace('stroke-width="5"', 'stroke-width="8"')}/><path d="M92 90h92v28M150 90v28" ${STROKE.replace('stroke-width="5"', 'stroke-width="8"')}/>` });
export const SILHOUETTES = Object.freeze(Object.keys(SIL));
/* A single large outline, 8 px thick, to look at for as long as they like. */
export const focalSilhouette = (name) => `<svg class="cl-sil" viewBox="0 0 200 200" role="img" aria-label="${esc(SIL[name] ? name : "teacup")}">${SIL[name] || SIL.teacup}</svg>`;
export const OVERLAYS = Object.freeze({
  touch: { title: "Something to hold", how: "Offer one real object, such as a smooth cup or a soft cloth. Place it in their hands and let them explore it, or not.", safety: "Nothing small enough to swallow, no sharp edges, nothing hot. Stay with them." },
  scent: { title: "A scent to share", how: "Hold a warm cup, a sprig of lavender or a slice of orange a little way from them. Let them lean in if they wish.", safety: "No tasting. Check for allergies or sensitivities first, keep it away from the eyes, and stop if they turn away." },
  sound: { title: "A sound they know", how: "Play or hum one familiar tune very softly. Let them join in if they want to.", safety: "Lower the volume the moment they seem unsettled." }
});
export function facilitatorOverlay(kinds) {
  const k = (Array.isArray(kinds) && kinds.length ? kinds : ["touch", "scent"]).filter((x) => OVERLAYS[x]);
  return `<aside class="cl-overlay" aria-label="For the facilitator"><b>For the facilitator</b>${k.map((x) => `<div><h4>${esc(OVERLAYS[x].title)}</h4><p>${esc(OVERLAYS[x].how)}</p><p class="cl-safe">${esc(OVERLAYS[x].safety)}</p></div>`).join("")}<p class="cl-safe">Whatever they say or do, join them. Nothing here is a test.</p></aside>`;
}
/* items: [{ cue, answer }] (up to 4). Pages 1, 3 and 5 show the same items: page 1 introduces each with its answer visible, page 3 shows the cue with a hint
   (printed upside down, to be read when turned over) and the answer beneath, and page 5 shows the cue and the answer once more. The answer is on every page: nothing
   can be got wrong, and nothing is called a test. Pages 2 and 4 are for the other activities in the packet; they are returned as null so a caller can fill them. */
export function spacedRetrievalPages(items, o = {}) {
  const list = (Array.isArray(items) ? items : []).map((x) => ({ cue: clip(x && x.cue, 80), answer: clip(x && x.answer, 60), hint: clip(x && x.hint, 60) })).filter((x) => x.cue && x.answer).slice(0, 4);
  if (!list.length) return [];
  const card = (x, mode) => `<div class="cl-sr"><p class="cl-sr-cue">${esc(x.cue)}</p><p class="cl-sr-ans">${esc(x.answer)}</p>${mode === 3 ? `<p class="cl-hint-flip" aria-label="Hint, printed upside down">${esc(x.hint || x.answer.charAt(0) + "…")}</p>` : ""}</div>`;
  const head = { 1: "Let&rsquo;s look at these together", 3: "Let&rsquo;s look at these again", 5: "One more look" }, note = { 1: "Read each one aloud, together. The answer is right there.", 3: "Read each one aloud together. Turn the page over for a hint if they would like one.", 5: "Read each one aloud, together, as long as they enjoy it." };
  return [1, 2, 3, 4, 5].map((n) => (n % 2 === 0 ? null : { page: n, html: `<section class="cl-sr-page" data-page="${n}"><h2>${head[n]}</h2><p class="cl-sr-note">${note[n]}</p>${list.map((x) => card(x, n)).join("")}${o.silhouette ? focalSilhouette(o.silhouette) : ""}${o.overlay ? facilitatorOverlay(o.overlay) : ""}</section>` }));
}

/* ---------- words and numbers ---------- */
export const REGIONAL_PHRASES = Object.freeze({
  us: { label: "United States", pairs: [["soda or pop", "A fizzy drink"], ["sofa or davenport", "A long seat in the living room"], ["sneakers or tennis shoes", "Shoes for walking and play"], ["faucet or spigot", "Where the water comes from"], ["supper or dinner", "The evening meal"], ["highway or interstate", "A long road between towns"]] },
  international: { label: "International", pairs: [["lift", "An elevator"], ["biscuit", "A cookie"], ["torch", "A flashlight"], ["jumper", "A sweater"], ["pavement", "A sidewalk"], ["tea", "A hot drink, or the evening meal"]] }
});
export const regionalPhrases = (region) => (REGIONAL_PHRASES[region] || REGIONAL_PHRASES.us);
/* Real coin diameters in millimeters (U.S. Mint): the outlines are drawn at true size so a real coin can be set on its place. */
export const COINS = Object.freeze([{ name: "Penny", mm: 19.05 }, { name: "Nickel", mm: 21.21 }, { name: "Dime", mm: 17.91 }, { name: "Quarter", mm: 24.26 }, { name: "Half dollar", mm: 30.61 }, { name: "Silver dollar", mm: 38.1 }]);
const MM = 96 / 25.4;
export function coinTemplate(names) {
  const list = (Array.isArray(names) && names.length ? names : ["Penny", "Nickel", "Dime", "Quarter"]).map((n) => COINS.find((c) => c.name === n)).filter(Boolean).slice(0, 6);
  return `<div class="cl-coins">${list.map((c) => { const d = Math.round(c.mm * MM * 100) / 100; return `<figure class="cl-coin"><svg viewBox="0 0 ${d + 8} ${d + 8}" width="${d + 8}" height="${d + 8}" role="img" aria-label="Place the ${esc(c.name)} here"><circle cx="${(d + 8) / 2}" cy="${(d + 8) / 2}" r="${d / 2}" ${STROKE.replace('stroke-width="5"', 'stroke-width="4"')}/></svg><figcaption>${esc(c.name)}</figcaption></figure>`; }).join("")}</div>`;
}
export const CURRENCY_DECADES = Object.freeze({ "1930s": { coins: ["Penny", "Nickel", "Dime", "Quarter"], bill: "One dollar", note: "A silver certificate dollar was a common note." }, "1940s": { coins: ["Penny", "Nickel", "Dime", "Quarter", "Half dollar"], bill: "One dollar", note: "Pennies were made of steel for a time in 1943." }, "1950s": { coins: ["Penny", "Nickel", "Dime", "Quarter", "Half dollar"], bill: "One dollar", note: "In 1957 “In God We Trust” was added to paper money." }, "1960s": { coins: ["Penny", "Nickel", "Dime", "Quarter", "Half dollar"], bill: "One dollar", note: "Silver was taken out of the dime and quarter in 1965." }, "1970s": { coins: ["Penny", "Nickel", "Dime", "Quarter", "Half dollar"], bill: "One dollar", note: "The Eisenhower dollar coin came out in 1971." } });
/* Play money for counting and sorting. It is drawn as a plain, clearly marked replica of a different design and size, never a copy of real paper money. */
export function playMoneyHtml(decade, o = {}) {
  const d = CURRENCY_DECADES[decade] || CURRENCY_DECADES["1950s"], n = Math.max(1, Math.min(6, o.bills || 3));
  return `<div class="cl-money" data-decade="${esc(CURRENCY_DECADES[decade] ? decade : "1950s")}"><p class="cl-money-head">Play money, ${esc(CURRENCY_DECADES[decade] ? decade : "1950s")} style</p><div class="cl-bills">${Array.from({ length: n }, () => `<div class="cl-bill" aria-label="Play money replica"><b>PLAY MONEY</b><span>${esc(d.bill)}</span><i>REPLICA</i></div>`).join("")}</div>${coinTemplate(d.coins)}<p class="cl-small">${esc(d.note)}</p></div>`;
}
/* Directions a word search may use: across only from the middle stage on, across and down at the earliest stage. */
export const searchDirections = (tier) => (Number(tier) >= 2 ? ["across"] : ["across", "down"]);

/* ---------- art and music ---------- */
export const BORDER_PT = 4;
export const bordered = (html, o = {}) => `<div class="cl-border" style="border-width:${Math.max(BORDER_PT, Number(o.pt) || BORDER_PT)}pt">${html}</div>`;
export const QUILT_BLOCKS = Object.freeze([
  { name: "Log Cabin", note: "Strips are added around a center square. The center is often red, said to stand for the hearth.", ask: "Tell me about a fireplace or stove you sat beside." },
  { name: "Ohio Star", note: "A star made from small triangles around a center square, a favorite for scrap fabric.", ask: "Tell me about a quilt, or a blanket, that was in your home." },
  { name: "Nine Patch", note: "Nine equal squares in three rows. It is one of the first blocks many quilters learn.", ask: "Tell me about something you learned to make with your hands." },
  { name: "Flying Geese", note: "Rows of triangles that look like birds in flight.", ask: "Tell me about birds you used to watch." },
  { name: "Double Wedding Ring", note: "Interlocking rings of small patches, often made as a wedding gift.", ask: "Tell me about a wedding you went to." },
  { name: "Bear Paw", note: "A block with four small “toes” around a larger square.", ask: "Tell me about the woods or the outdoors where you grew up." },
  { name: "Dresden Plate", note: "Petal-shaped wedges sewn in a circle, like a flower or a plate.", ask: "Tell me about a flower you loved." }
]);
export const quiltNote = (name) => QUILT_BLOCKS.find((b) => b.name.toLowerCase() === String(name).toLowerCase()) || null;
/* A single line of words with a beat bar over it: for singing along, never for reading music. lyric: one short line. */
export function lyricBar(lyric, o = {}) {
  const words = clip(lyric, 80).split(/\s+/).filter(Boolean), beats = Math.max(2, Math.min(8, o.beats || Math.ceil(words.length / 2)));
  return `<div class="cl-lyric" role="group" aria-label="Sing along"><div class="cl-bar" aria-hidden="true">${Array.from({ length: beats }, () => `<span></span>`).join("")}</div><p>${esc(words.join(" "))}</p>${o.title ? `<p class="cl-lyric-title">${esc(clip(o.title, 60))}</p>` : ""}</div>`;
}
/* Public-domain songs only: the first line is all that is printed. */
export const PD_SONGS = Object.freeze([
  { title: "Amazing Grace", year: 1835, decade: "1830s", genres: ["hymn", "gospel"], line: "Amazing grace, how sweet the sound" },
  { title: "Home on the Range", year: 1876, decade: "1870s", genres: ["folk", "country"], line: "Oh, give me a home where the buffalo roam" },
  { title: "Oh! Susanna", year: 1848, decade: "1840s", genres: ["folk"], line: "I come from Alabama with a banjo on my knee" },
  { title: "Red River Valley", year: 1896, decade: "1890s", genres: ["folk", "country"], line: "From this valley they say you are going" },
  { title: "Swing Low, Sweet Chariot", year: 1870, decade: "1870s", genres: ["spiritual", "gospel"], line: "Swing low, sweet chariot, coming for to carry me home" },
  { title: "Take Me Out to the Ball Game", year: 1908, decade: "1900s", genres: ["sing-along", "sports"], line: "Take me out to the ball game" }
]);
/* songs: [{ title, year, genres }] (your own catalog, or PD_SONGS). Filters by genre and by decade of the song or of the years the resident lived through. */
export function filterSongs(songs, o = {}) {
  const g = o.genre ? String(o.genre).toLowerCase() : "", from = Number(o.fromYear) || 0, to = Number(o.toYear) || 9999;
  return (Array.isArray(songs) ? songs : []).filter((s) => s && (!g || (s.genres || []).map((x) => String(x).toLowerCase()).includes(g)) && (!s.year || (s.year >= from && s.year <= to)));
}
export const decadeRange = (decade) => { const m = /^(\d{3})0s$/.exec(String(decade)); return m ? { fromYear: Number(m[1]) * 10, toYear: Number(m[1]) * 10 + 9 } : { fromYear: 0, toYear: 9999 }; };
export const genresOf = (songs) => [...new Set((Array.isArray(songs) ? songs : []).flatMap((s) => (s && s.genres) || []).map((g) => String(g).toLowerCase()))].sort();
export { esc };
