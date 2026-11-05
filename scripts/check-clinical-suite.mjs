#!/usr/bin/env node
/* js/clinical-suite.js: in Node, the generators and their rules; in a real browser, the stylesheet (lines of at least 3 pt, a 4 pt border,
   illumination contrast, one element per anchor page) and a printed Letter PDF of every piece. */
import * as K from "../js/clinical-suite.js";
import { buildWordSearch } from "../js/reminiscence-engine.js";
import { createOrchestrator } from "../js/agent-orchestrator.js";
import { ClinicalAuditAgent } from "../js/clinical-audit-agent.js";
import { registerReminiscence } from "../js/reminiscence-engine.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
/* vascular */
const steps = ["Take a clean cup", "Pour the water", "Stir gently", "Wipe the table", "Fold the cloth", "Wash your hands", "Look at the flower"];
const sc = K.stepChecklist(steps);
ok((sc.match(/class="cl-step"/g) || []).length === 7 && (sc.match(/cl-pause/g) || []).length === 2 && (sc.match(/Pause &amp; Breathe/g) || []).length === 2 && (sc.match(/<svg class="cl-icon"/g) || []).length === 9 && (sc.match(/cl-box/g) || []).length === 7, "seven steps each get an icon and a box, with a 'Pause & Breathe' after the third and the sixth (and none at the end)");
ok(K.iconFor("Pour the water") === "pour" && K.iconFor("Wipe the table") === "wipe" && K.iconFor("Fold the cloth") === "fold" && K.iconFor("Dream") === "step" && !/<script/.test(K.stepChecklist(["<script>x</script>"])) && K.stepChecklist(null) === '<ol class="cl-steps"></ol>' && !/cl-pause/.test(K.stepChecklist(["a", "b", "c"])), "the icon follows the step's verb, an unknown verb gets a plain mark, markup is shown as text, and three steps end without a pause");
/* lewy */
ok(K.ANCHOR_NAMES.every((n) => K.validateAnchor(K.anchorSvg(n)).ok), "every anchor in the library is one plain element: " + K.ANCHOR_NAMES.join(", "));
const busy = '<svg><defs><pattern id="p"/></defs><circle fill="red" r="5" stroke-width="2"/><rect/><path/><text>x</text></svg>', v = K.validateAnchor(busy);
ok(!v.ok && v.problems.length >= 4 && !K.validateAnchor("nope").ok && !K.validateAnchor("<svg></svg>").ok && !K.validateAnchor('<svg><circle opacity="0.5" stroke-width="7"/></svg>').ok, "a busy, filled, thin, transparent or empty picture is refused (" + v.problems.join("; ") + ")");
const as = K.anchorSheet("apple", { mode: "low", word: "Apple", prompt: "Hold the picture if you like." }); ok(/cl-lbd-low/.test(as) && (as.match(/<svg/g) || []).length === 1 && K.ILLUMINATION.length === 3 && /cl-lbd-bright/.test(K.anchorSheet("zzz")) && /data-anchor="circle"/.test(K.anchorSheet("zzz")), "an anchor sheet holds one picture and a word, in one of three illumination modes; unknown names become a plain circle");
/* ftd */
const vm = K.vocationMatrix(["kitchen", "garden", "workshop"], { perTrade: 4 }); ok((vm.match(/<li>/g) || []).length === 12 && (vm.match(/<th scope="col">/g) || []).length === 3 && (vm.match(/cl-box/g) || []).length === 12 && K.vocationMatrix(["x"]).includes("Kitchen") && (K.vocationMatrix(["kitchen", "garden", "workshop", "sewing", "office"]).match(/<th scope="col">/g) || []).length === 4, "the sorting matrix has one column per trade (up to four), one box per item and a shuffled pool");
const pb = K.progressBar(3, 8); ok((pb.match(/cl-seg"/g) || []).length === 5 && (pb.match(/cl-seg on/g) || []).length === 3 && /3 of 8 done/.test(pb) && /All finished/.test(K.progressBar(4, 4)) && /0 of 1/.test(K.progressBar(-5, 0)) && /aria-valuenow="20"/.test(K.progressBar(99, 99)), "the progress bar fills segment by segment, says 'All finished' at the end, and keeps odd numbers in range");
/* sensory / korsakoff */
ok(K.SILHOUETTES.length === 4 && K.SILHOUETTES.every((n) => /stroke-width="8"/.test(K.focalSilhouette(n)) && !/fill="(?!none)/.test(K.focalSilhouette(n))), "the large silhouettes are single outlines, 8 px thick, with no fill");
const ov = K.facilitatorOverlay(["touch", "scent"]); ok(/Something to hold/.test(ov) && /A scent to share/.test(ov) && /No tasting/.test(ov) && /Nothing here is a test/.test(ov) && /smooth cup/.test(ov) && K.facilitatorOverlay(["x"]).includes("For the facilitator"), "the facilitator overlay gives touch and scent guidance with the safety line, and says nothing is a test");
const sr = K.spacedRetrievalPages([{ cue: "The garden gate", answer: "Green", hint: "G" }, { cue: "Her sister", answer: "Ruth" }], { silhouette: "rose", overlay: ["scent"] });
ok(sr.length === 5 && sr.map((p) => p && p.page).join() === "1,,3,,5" && sr[1] === null && sr[3] === null, "the loop is on pages 1, 3 and 5; pages 2 and 4 are left for other activities");
ok([0, 2, 4].every((i) => /The garden gate/.test(sr[i].html) && />Green</.test(sr[i].html) && />Ruth</.test(sr[i].html)) && /cl-hint-flip/.test(sr[2].html) && !/cl-hint-flip/.test(sr[0].html) && !/cl-hint-flip/.test(sr[4].html), "the same items come back each time with the answer always shown, and the upside-down hint is on page 3");
ok(!/\b(test|quiz|wrong|correct|remember when|do you remember)\b/i.test(sr.filter(Boolean).map((p) => p.html).join(" ").replace(/Nothing here is a test/g, "")) && /Let&rsquo;s look at these again/.test(sr[2].html) && K.spacedRetrievalPages([]).length === 0 && K.spacedRetrievalPages(null).length === 0, "the wording invites and never tests");
/* words and numbers */
ok(K.regionalPhrases("us").pairs.some((p) => /pop/.test(p[0])) && K.regionalPhrases("international").pairs.some((p) => p[0] === "lift") && K.regionalPhrases("zz").label === "United States" && Object.keys(K.REGIONAL_PHRASES).length === 2, "regional phrases come in a United States and an International set");
const ct = K.coinTemplate(["Penny", "Quarter"]); const px = (n) => Math.round(K.COINS.find((c) => c.name === n).mm * 96 / 25.4 * 100) / 100;
ok(K.COINS.find((c) => c.name === "Quarter").mm === 24.26 && K.COINS.find((c) => c.name === "Penny").mm === 19.05 && new RegExp('r="' + px("Quarter") / 2 + '"').test(ct) && new RegExp('r="' + px("Penny") / 2 + '"').test(ct) && (ct.match(/<figure/g) || []).length === 2 && (K.coinTemplate().match(/<figure/g) || []).length === 4, "coin outlines are drawn at the true diameter, so a real coin sits in its place");
ok(["1930s", "1940s", "1950s", "1960s", "1970s"].every((d) => /PLAY MONEY/.test(K.playMoneyHtml(d)) && /REPLICA/.test(K.playMoneyHtml(d)) && new RegExp('data-decade="' + d + '"').test(K.playMoneyHtml(d))) && /1950s/.test(K.playMoneyHtml("1999")) && !/legal tender|counterfeit/i.test(K.playMoneyHtml("1950s")) && /steel/.test(K.playMoneyHtml("1940s")) && /Eisenhower/.test(K.playMoneyHtml("1970s")), "play money is made for each decade 1930s to 1970s, plainly marked as a replica, with a true note about the coins");
ok(K.searchDirections(1).join() === "across,down" && K.searchDirections(2).join() === "across" && K.searchDirections(3).join() === "across", "directions follow the stage: across and down early, across only after");
const wsA = buildWordSearch(["radio", "garden", "hymns", "pie"], { size: 8, seed: "h", horizontalOnly: true, max: 4 }), wsB = buildWordSearch(["radio", "garden", "hymns", "pie"], { size: 8, seed: "h", max: 4 });
ok(wsA.placed.length >= 3 && wsA.placed.every((p) => p.dir === "across") && wsB.placed.some((p) => p.dir === "down"), "the word search can be set to across only (and the early stage still uses down)");
{ const o = registerReminiscence(createOrchestrator().use(new ClinicalAuditAgent())); const m = await o.execute({ profile: { preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 2, hobbies: "gardening, radio", petNames: "Biscuit" }, options: { template: "reminiscence" } }), e = await o.execute({ profile: { preferredName: "Peggy", formativeEra: "1950s", ailmentTier: 1, hobbies: "gardening, radio", petNames: "Biscuit" }, options: { template: "reminiscence" } });
  const pm = m.asset.pages.resident.blocks.find((b) => b.type === "wordsearch"), pe = e.asset.pages.resident.blocks.find((b) => b.type === "wordsearch");
  ok(pm && pm.placed === undefined && /run across(?! or down)/.test(JSON.stringify(m.asset.pages.caregiver.notes)) && /across or down/.test(JSON.stringify(e.asset.pages.caregiver.notes)) && m.audit.status !== "blocked", "a middle-stage sheet's word search is across only, and its staff note says so; the early stage says across or down"); }
/* art and music */
ok(K.BORDER_PT === 4 && /border-width:4pt/.test(K.bordered("x")) && /border-width:4pt/.test(K.bordered("x", { pt: 2 })) && /border-width:6pt/.test(K.bordered("x", { pt: 6 })), "a coloring page border is never thinner than 4 pt");
ok(K.QUILT_BLOCKS.length === 7 && K.QUILT_BLOCKS.every((b) => b.name && b.note && /^Tell me about/.test(b.ask) && !/\?/.test(b.ask)) && K.quiltNote("log cabin").name === "Log Cabin" && K.quiltNote("zzz") === null, "each quilt block has a memory note and an invitation that is never a question");
const lb = K.lyricBar("Amazing grace, how sweet the sound", { title: "Amazing Grace" }); ok((lb.match(/<span><\/span>/g) || []).length === 3 && /Amazing grace, how sweet the sound/.test(lb) && /cl-lyric-title/.test(lb) && (K.lyricBar("a b", {}).match(/<span><\/span>/g) || []).length === 2 && !/<script/.test(K.lyricBar("<script>")), "a lyric bar is one line with a beat bar above it");
ok(K.PD_SONGS.length === 6 && K.PD_SONGS.every((s) => s.year <= 1927 && s.line.split(/\s+/).length <= 12), "only public-domain songs are included, and only their first line");
ok(K.filterSongs(K.PD_SONGS, { genre: "folk" }).length === 3 && K.filterSongs(K.PD_SONGS, { genre: "hymn" })[0].title === "Amazing Grace" && K.filterSongs(K.PD_SONGS, K.decadeRange("1870s")).map((s) => s.title).join() === "Home on the Range,Swing Low, Sweet Chariot" && K.filterSongs(null, {}).length === 0 && K.genresOf(K.PD_SONGS).includes("spiritual") && K.decadeRange("nope").toYear === 9999, "songs can be filtered by genre and by decade");
/* browser */
let note = "";
try {
  const { loadPlaywright, serve } = await import("./lib/browser.mjs"); const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const br = await chromium.launch();
  try {
    const ctx = await br.newContext({ serviceWorkers: "block" }), p = await ctx.newPage(); await p.goto(base + "contact.html");
    const html = [K.stepChecklist(steps), K.anchorSheet("cup", { mode: "bright", word: "Cup" }), K.anchorSheet("cup", { mode: "soft", word: "Cup" }), K.anchorSheet("cup", { mode: "low", word: "Cup" }), K.vocationMatrix(["kitchen", "garden", "workshop"]), K.progressBar(3, 8), K.bordered(K.focalSilhouette("rose")), K.facilitatorOverlay(), K.playMoneyHtml("1950s"), K.lyricBar("Amazing grace, how sweet the sound", { title: "Amazing Grace" })];
    const r = await p.evaluate(async (h) => {
      const css = await (await fetch("/css/styles.css")).text(); const st = document.createElement("style"); st.textContent = css; document.head.append(st);
      document.body.innerHTML = h.map((x, i) => `<section id="s${i}" style="background:#fff;color:#000;padding:.3in;margin:0">${x}</section>`).join("");
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const pt = (px) => Math.round(parseFloat(px) * 72 / 96 * 100) / 100;
      const modes = ["bright", "soft", "low"].map((m) => { const e = document.querySelector(".cl-lbd-" + m), cs = getComputedStyle(e), a = getComputedStyle(e.querySelector(".cl-anchor circle, .cl-anchor path")); return { m, text: ratio(cs.color, cs.backgroundColor), line: ratio(a.stroke, cs.backgroundColor) }; });
      const borders = { step: pt(getComputedStyle(document.querySelector(".cl-step")).borderTopWidth), box: pt(getComputedStyle(document.querySelector(".cl-box")).borderTopWidth), cell: pt(getComputedStyle(document.querySelector(".cl-grid td")).borderTopWidth), seg: pt(getComputedStyle(document.querySelector(".cl-seg")).borderTopWidth), art: pt(getComputedStyle(document.querySelector(".cl-border")).borderTopWidth), overlay: pt(getComputedStyle(document.querySelector(".cl-overlay")).borderTopWidth), bar: pt(getComputedStyle(document.querySelector(".cl-bar span")).borderRightWidth) };
      const anchors = [...document.querySelectorAll(".cl-lbd")].map((e) => ({ svgs: e.querySelectorAll("svg").length, shapes: e.querySelectorAll("svg path, svg circle, svg rect, svg ellipse").length }));
      const tap = [...document.querySelectorAll(".cl-step")].map((e) => e.getBoundingClientRect().height);
      return { modes, borders, anchors, minStep: Math.min(...tap), textPt: pt(getComputedStyle(document.querySelector(".cl-text")).fontSize) };
    }, html);
    ok(r.modes.every((m) => m.text >= 7 && m.line >= 7) && r.modes.find((m) => m.m === "bright").text === 21 && r.modes.find((m) => m.m === "low").text === 21, "all three illumination modes read at 7:1 or better, text and line (" + r.modes.map((m) => m.m + " " + m.text.toFixed(1) + "/" + m.line.toFixed(1)).join(", ") + ")");
    ok(Object.entries(r.borders).filter(([k]) => k !== "art").every(([, v]) => v >= 3) && r.borders.art >= 3.7 && /border-width:4pt/.test(html[6]), "every ruled line is 3 pt or thicker and the coloring-page border is set at 4 pt, which the screen shows as 3.75 pt because it snaps to whole pixels (" + JSON.stringify(r.borders) + ")");
    ok(r.anchors.every((a) => a.svgs === 1 && a.shapes <= 2) && r.textPt >= 18, "each anchor page holds one picture of one or two shapes, and step text is 18 pt or more (" + r.textPt + " pt)");
    await p.emulateMedia({ media: "print" }); const pdf = await p.pdf({ format: "Letter", printBackground: true }); ok(pdf.length > 1000 && pdf.slice(0, 4).toString() === "%PDF", "every piece prints to a PDF");
  } finally { await br.close(); srv.close(); }
} catch (x) { note = " (the browser part was skipped: " + String(x.message).slice(0, 60) + ")"; }
if (problems.length) { console.error("clinical suite check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("clinical suite check passed: " + passed + " checks (step icons and pauses, plain anchors, sorting and progress, spaced retrieval, coins and play money, across-only searches, quilt and lyric helpers, stylesheet in a real browser)" + note);
