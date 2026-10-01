#!/usr/bin/env node
/* =====================================================================
   CLINICAL SCIENCE & RESEARCH CENTER: the pages
   Run:  npm run research          write resources/research/ (the library)
                                   and one reader page per document
         node scripts/research-pages.mjs --check
                                   fail if a page is out of date (npm run
                                   build runs this)

   The content lives in src/services/researchCenter.ts (built to
   assets/services/researchCenter.js). This script turns it into static
   pages that read, print and link without scripts, and gives each page
   the site's sidebar and breadcrumbs through scripts/site-nav.mjs. The
   pages' behavior (reading settings, focus mode, collapsible sections,
   citation previews, copying, the library's filters and the board
   packet) is assets/research-center.js. Pages are never edited by hand.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { render, PAGES, MODULES, moduleHref } from "./site-nav.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const box = {}; box.globalThis = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/services/researchCenter.js"), "utf8"), box);
const R = box.CogniResearch;
const RESEARCH = MODULES.find(m => m.slug === "research");
const HOME = moduleHref(RESEARCH);                                     // resources/research/

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const svg = (d, size, cls) => `<svg${cls ? ` class="${cls}"` : ""} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  quote: '<path d="M7 7h4v4H9a2 2 0 0 0-2 2v2M15 7h4v4h-2a2 2 0 0 0-2 2v2"/>',
  expand: '<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  external: '<path d="M14 4h6v6M10 14 20 4M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};

/* ---------- text: escaping, citations and links ---------- */
/* ctx: { nums: Map(key -> number), prefix: path to resources/research/ from this page } */
function inline(text, ctx){
  let out = "", last = 0;
  const src = String(text).replace(/\s+(\[@)/g, "$1");               // a citation sits against the word before it
  const re = /\[@([^\]]+)\]|\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let m;
  while ((m = re.exec(src))){
    out += esc(src.slice(last, m.index)); last = re.lastIndex;
    if (m[1]) out += cites(m[1].split(";").map(s => s.trim().replace(/^@/, "")), ctx);
    else {
      const d = R.docOf(m[2]);
      out += `<a href="${ctx.prefix}${m[2]}/">${esc(m[3] || (d ? d.crumb : m[2]))}</a>`;
    }
  }
  return out + esc(src.slice(last));
}
function cites(keys, ctx){
  const links = keys.map(k => {
    const n = ctx.nums.get(k), r = R.refOf(k);
    if (!n || !r) throw new Error("uncited or unknown reference " + k);
    return `<a class="rc-cite" href="#ref-${n}" aria-label="Reference ${n}: ${esc(R.shortRef(r))}">${n}</a>`;
  });
  return `<sup class="rc-cites">${links.join('<span aria-hidden="true">,</span>')}</sup>`;
}
const sourceLine = (cite, ctx) => {
  const keys = R.citeKeys(cite);
  return `<span class="rc-src">${keys.length > 1 ? "Sources" : "Source"}: ${keys.map(k => esc(R.shortRef(R.refOf(k)))).join("; ")}${cites(keys, ctx)}</span>`;
};
const levelChip = lv => `<span class="rc-chip rc-lv lv-${lv}">${esc(R.LEVELS[lv].label)}</span>`;
const typeChip = t => `<span class="rc-chip rc-type">${esc(R.TYPES[t].label)}</span>`;

/* ---------- blocks ---------- */
let tableN = 0;
function block(b, ctx){
  if ("p" in b) return `<p>${inline(b.p, ctx)}</p>`;
  if ("list" in b) return `<ul class="rc-list">${b.list.map(t => `<li>${inline(t, ctx)}</li>`).join("")}</ul>`;
  if ("steps" in b) return `<ol class="rc-list">${b.steps.map(t => `<li>${inline(t, ctx)}</li>`).join("")}</ol>`;
  if ("figure" in b) return figure(b.figure, ctx);
  if ("note" in b) return `<div class="rc-note is-${b.note.tone || "info"}" role="note"><p class="rc-note-t">${esc(b.note.title)}</p><p>${inline(b.note.text, ctx)}</p></div>`;
  if ("study" in b){
    const s = b.study, row = (k, v) => `<div><dt>${k}</dt><dd>${inline(v, ctx)}</dd></div>`;
    return `<aside class="rc-study" aria-label="Study at a glance: ${esc(s.title)}">
          <p class="rc-study-k">Study at a glance</p>
          <h3 class="rc-study-t">${esc(s.title)}${inline(s.cite, ctx)}</h3>
          <dl class="rc-study-dl">${row("Design", s.design)}${row("Participants", s.who)}${row("Measured", s.measured)}${row("Found", s.found)}${row("Caveats", s.caveat)}</dl>
        </aside>`;
  }
  if ("table" in b){
    const t = b.table, id = "tbl-" + (++tableN);
    return `<div class="rc-table-wrap" role="region" aria-labelledby="${id}" tabindex="0"><table>
          <caption id="${id}">${inline(t.caption, ctx)}</caption>
          <thead><tr>${t.head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${t.rows.map(r => `<tr>${r.map((c, k) => k === 0 ? `<th scope="row">${inline(c, ctx)}</th>` : `<td>${inline(c, ctx)}</td>`).join("")}</tr>`).join("\n          ")}</tbody>
        </table></div>${t.note ? `\n        <p class="rc-table-note">${inline(t.note, ctx)}</p>` : ""}`;
  }
  throw new Error("unknown block " + JSON.stringify(b).slice(0, 60));
}
const figure = (f, ctx) => `<figure class="rc-fig"><p class="rc-fig-v">${esc(f.value)}</p><figcaption>${inline(f.label, ctx)} ${sourceLine(f.cite, ctx)}</figcaption></figure>`;

/* ---------- the page shell ---------- */
const SIDEBAR_CSS = fs.readFileSync(path.join(ROOT, "scripts/lib/sidebar-base.css"), "utf8").trim();
function css(P){
  const face = (file, style, weight) => `@font-face{font-family:"Atkinson Hyperlegible";src:url("${P}fonts/${file}") format("truetype");font-style:${style};font-weight:${weight};font-display:swap}`;
  return [face("AtkinsonHyperlegible-Regular.ttf", "normal", 400), face("AtkinsonHyperlegible-Bold.ttf", "normal", 700), face("AtkinsonHyperlegible-Italic.ttf", "italic", 400), face("AtkinsonHyperlegible-BoldItalic.ttf", "italic", 700)].join("\n") + "\n" + SIDEBAR_CSS + "\n" + READER_CSS;
}
const HEAD_JS = `(function(){try{var s=JSON.parse(localStorage.getItem("cg_rc_reader")||"{}"),d=document.documentElement,o={size:["large","largest"],lead:["wide"],theme:["dark","max"]};for(var k in o)if(o[k].indexOf(s[k])>=0)d.setAttribute("data-rc-"+k,s[k]);}catch(e){}})();`;
function shell({ file, title, description, body, canonical }){
  const P = "../".repeat(file.split("/").length - 1);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} - Cognicopia</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <script>${HEAD_JS}</script>
  <style id="rc-style">
${css(P)}
  </style>
</head>
<body data-root="${P}">
<a class="rc-skip" href="#main">Skip to the content</a>
<!-- cg-nav:start -->
<!-- cg-nav:end -->
<!-- ══ COGNICOPIA TOP BAR ══ -->
<div class="cg-topbar" role="banner">
  <a href="https://buy.stripe.com/9B614oaJV7lr0RX1ODew801" target="_blank" rel="noopener" style="background:#286E75;color:#fff;padding:6px 14px;border-radius:5px;font-weight:700;font-size:9.5pt;">Get Full Access →</a>
</div>
<!-- cg-crumbs:start: generated by scripts/site-nav.mjs -->
<!-- cg-crumbs:end -->
<button type="button" class="rc-exit" id="rcExit" hidden>${svg(ICON.focus, 18)}Leave focus mode</button>
<main id="main" class="rc-main">
${body}
</main>
<div class="rc-sr" aria-live="polite" id="rcLive"></div>
<footer class="site-footer">Cognicopia is made by BarronCrafts. Everything happens inside your browser.</footer>
<script src="${P}assets/research-center.js" defer></script>
</body>
</html>
`;
  const page = PAGES.find(p => p.file === file);
  if (!page) throw new Error(file + " is not in site-nav's PAGES");
  return render(html, page);
}

/* ---------- the reader's toolbar ---------- */
function tools(){
  const radio = (name, value, label, checked) => `<label class="rc-opt"><input type="radio" name="rc-${name}" value="${value}"${checked ? " checked" : ""}><span>${label}</span></label>`;
  return `<div class="rc-tools">
      <details class="rc-settings">
        <summary class="rc-btn">${svg(ICON.settings, 18)}Reading settings</summary>
        <div class="rc-settings-panel">
          <fieldset><legend>Text size</legend>${radio("size", "standard", "Standard", true)}${radio("size", "large", "Large")}${radio("size", "largest", "Largest")}</fieldset>
          <fieldset><legend>Line spacing</legend>${radio("lead", "comfortable", "Comfortable", true)}${radio("lead", "wide", "Wide")}</fieldset>
          <fieldset><legend>Colors</legend>${radio("theme", "paper", "Paper", true)}${radio("theme", "dark", "Dark")}${radio("theme", "max", "Maximum contrast")}</fieldset>
          <p class="rc-hint">Settings are kept in this browser, for every Research Center page. <button type="button" class="rc-link-btn" data-rc="reset" data-rc-js hidden>Reset</button></p>
        </div>
      </details>
      <button type="button" class="rc-btn" data-rc="focus" aria-pressed="false" data-rc-js hidden>${svg(ICON.focus, 18)}Focus mode</button>
      <button type="button" class="rc-btn" data-rc="expand" data-rc-js hidden>${svg(ICON.expand, 18)}<span>Expand all sections</span></button>
      <button type="button" class="rc-btn" data-rc="print" data-rc-js hidden>${svg(ICON.print, 18)}Print or save as PDF</button>
      <a class="rc-btn" href="#cite">${svg(ICON.quote, 18)}Cite this page</a>
    </div>`;
}

/* ---------- a reader page ---------- */
function readerPage(d){
  tableN = 0;
  const refs = R.refsOf(d), nums = new Map(refs.map((k, i) => [k, i + 1])), ctx = { nums, prefix: "../" };
  const file = HOME + d.slug + "/index.html";
  const audience = d.audience.map(a => R.AUDIENCES[a]).join(", ");
  const secs = d.sections.map(s => `
    <section class="rc-sec" id="s-${s.id}" aria-labelledby="h-${s.id}">
      <h2 class="rc-sec-h" id="h-${s.id}"><span class="rc-sec-t">${esc(s.title)}</span><span class="rc-sec-min">${R.sectionMinutes(s)} min</span></h2>
      <p class="rc-brief"><b>In brief:</b> ${inline(s.brief, ctx)}</p>
      <div class="rc-sec-b" id="b-${s.id}">
        ${s.blocks.map(b => block(b, ctx)).join("\n        ")}
      </div>
    </section>`).join("");
  const refList = refs.map((k, i) => {
    const r = R.refOf(k), link = R.refLink(r);
    return `<li id="ref-${i + 1}"><span class="rc-ref-text">${esc(R.formatRef(r))}</span>${link ? ` <a class="rc-ref-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${svg(ICON.external, 14)}View source<span class="rc-sr"> (opens in a new tab)</span></a>` : ""}</li>`;
  }).join("\n        ");
  const related = d.related.map(s => R.docOf(s)).map(r => `<li class="rc-card"><p class="rc-card-top">${typeChip(r.type)}${levelChip(r.level)}</p><h3><a href="../${r.slug}/">${esc(r.title)}</a></h3><p class="rc-card-s">${esc(r.summary)}</p><p class="rc-card-m">${R.minutesOf(r)} min read</p></li>`).join("\n        ");
  const body = `  <article class="rc-paper rc-reader" data-doc="${d.slug}">
    <header class="rc-head">
      <p class="rc-chips">${typeChip(d.type)}${levelChip(d.level)}</p>
      <h1 tabindex="-1">${esc(d.title)}</h1>
      <p class="rc-sub">${esc(d.subtitle)}</p>
      <p class="rc-meta"><span>${R.minutesOf(d)} min read</span><span>${refs.length} ${refs.length === 1 ? "source" : "sources"}</span><span>Reviewed ${esc(R.fmtDate(R.REVIEWED))}</span></p>
      <p class="rc-for"><b>Written for:</b> ${esc(audience)}</p>
      ${tools()}
    </header>
${d.scenario ? `    <div class="rc-scenario" role="note"><p class="rc-note-t">Illustrative scenario</p><p>${esc(d.scenario)}</p></div>\n` : ""}    <section class="rc-box rc-takeaways" aria-labelledby="takeawaysH">
      <h2 id="takeawaysH">Key takeaways</h2>
      <ul class="rc-list">${d.takeaways.map(t => `<li>${inline(t, ctx)}</li>`).join("")}</ul>
    </section>
${d.figures.length ? `    <section class="rc-glance" aria-labelledby="glanceH">
      <h2 id="glanceH">At a glance</h2>
      <div class="rc-figs">${d.figures.map(f => figure(f, ctx)).join("")}</div>
    </section>\n` : ""}    <nav class="rc-toc" aria-labelledby="tocH">
      <h2 id="tocH">In this document</h2>
      <ol>${d.sections.map(s => `<li><a href="#s-${s.id}">${esc(s.title)}</a> <span class="rc-toc-min">${R.sectionMinutes(s)} min</span></li>`).join("")}<li><a href="#practice">What this means for your community</a></li><li><a href="#limits">What this evidence does not show</a></li><li><a href="#references">References</a></li></ol>
    </nav>
    <div class="rc-secs">${secs}
    </div>
    <section class="rc-box rc-practice" id="practice" aria-labelledby="practiceH">
      <h2 id="practiceH">What this means for your community</h2>
      <ul class="rc-list">${d.practice.map(t => `<li>${inline(t, ctx)}</li>`).join("")}</ul>
    </section>
    <section class="rc-box rc-limits" id="limits" aria-labelledby="limitsH">
      <h2 id="limitsH">What this evidence does not show</h2>
      <ul class="rc-list">${d.limits.map(t => `<li>${inline(t, ctx)}</li>`).join("")}</ul>
    </section>
    <section class="rc-refs-sec" id="references" aria-labelledby="refsH">
      <h2 id="refsH">References</h2>
      ${refs.length ? `<ol class="rc-refs">
        ${refList}
      </ol>` : `<p>This scenario draws on the research summaries linked below.</p>`}
    </section>
    <section class="rc-cite-sec" id="cite" aria-labelledby="citeH">
      <h2 id="citeH">How to cite this page</h2>
      <p class="rc-cite-text" id="rcCiteText">Cognicopia. ${esc(d.title)}. Cognicopia Clinical Science &amp; Research Center. Updated ${esc(R.fmtDate(R.REVIEWED))}. Accessed <span id="rcAccessed">[date]</span>. ${esc(R.SITE + "/" + HOME + d.slug + "/")}</p>
      <button type="button" class="rc-btn" data-copy="#rcCiteText" data-rc-js hidden>${svg(ICON.quote, 18)}Copy the citation</button>
    </section>
    <aside class="rc-related" aria-labelledby="relH">
      <h2 id="relH">Related reading</h2>
      <ul class="rc-cards">
        ${related}
      </ul>
      <p><a href="../">All research summaries, whitepapers and case scenarios</a></p>
    </aside>
    <p class="rc-disclaimer">An educational summary for professionals, not medical advice. It reports each source’s findings as the source states them, and was reviewed against its sources on ${esc(R.fmtDate(R.REVIEWED))}. Cognicopia makes the tools this page mentions. Found an error? <a href="../../../contact.html?subject=Research+Center+correction">Tell us</a>.</p>
  </article>`;
  return shell({ file, title: d.title, description: d.summary, body, canonical: R.SITE + "/" + HOME + d.slug + "/" });
}

/* ---------- the library ---------- */
function libraryPage(){
  const file = HOME + "index.html";
  const types = Object.keys(R.TYPES), topics = Object.keys(R.TOPICS).filter(t => R.DOCS.some(d => d.topics.indexOf(t) >= 0));
  const card = d => {
    const refs = R.refsOf(d).length, text = [d.title, d.summary, R.TYPES[d.type].label, R.LEVELS[d.level].label, ...d.topics.map(t => R.TOPICS[t])].join(" ").toLowerCase();
    return `<li class="rc-card" data-type="${d.type}" data-level="${d.level}" data-topics="${d.topics.join(" ")}" data-text="${esc(text)}">
          <p class="rc-card-top">${typeChip(d.type)}${levelChip(d.level)}</p>
          <h3><a href="${d.slug}/">${esc(d.title)}</a></h3>
          <p class="rc-card-s">${esc(d.summary)}</p>
          <p class="rc-card-m">${R.minutesOf(d)} min read · ${refs ? refs + (refs === 1 ? " source" : " sources") : "Illustrative"} · ${esc(d.topics.map(t => R.TOPICS[t]).join(", "))}</p>
        </li>`;
  };
  const field = (id, label, type, hint, attrs) => `<div class="rc-field"><label for="rcB-${id}">${label}</label><input id="rcB-${id}" name="${id}" type="${type}"${attrs || ""}>${hint ? `<span class="rc-hint">${hint}</span>` : ""}</div>`;
  const scale = R.LEVEL_ORDER.map(l => `<tr><th scope="row">${levelChip(l)}</th><td>${esc(R.LEVELS[l].means)}</td><td>${R.DOCS.filter(d => d.level === l).map(d => `<a href="${d.slug}/">${esc(d.crumb)}</a>`).join(", ") || "None yet"}</td></tr>`).join("\n          ");
  const totalRefs = new Set(R.DOCS.reduce((a, d) => a.concat(R.refsOf(d)), [])).size;
  const body = `  <header class="rc-hero">
    <p class="rc-eyebrow">Resource &amp; Clinical Hub</p>
    <h1 tabindex="-1">Clinical Science &amp; Research Center</h1>
    <p class="rc-lede">Evidence summaries for medical directors, compliance officers and activity leaders. What each approach has been shown to do, in whom, and how strongly, and what it has not been shown to do. Every figure is cited, and every summary lists its limits.</p>
    <nav class="rc-quick" aria-label="On this page"><a href="#library">Evidence library</a><a href="#boards">For facility boards</a><a href="#scale">How we rate evidence</a><a href="#method">How we write these summaries</a></nav>
  </header>
  <div class="rc-paper rc-library">
    <section id="library" aria-labelledby="libH">
      <div class="rc-lib-head">
        <h2 id="libH">Evidence library</h2>
        <p class="rc-meta"><span>${R.DOCS.length} documents</span><span>${totalRefs} sources</span><span>Reviewed ${esc(R.fmtDate(R.REVIEWED))}</span></p>
      </div>
      ${tools().replace(/\s*<button type="button" class="rc-btn" data-rc="expand"[^\n]*\n/, "\n").replace(/\s*<a class="rc-btn" href="#cite">[^\n]*\n/, "\n")}
      <div class="rc-filters" data-rc-js hidden>
        <fieldset class="rc-types"><legend>Type</legend>
          <label class="rc-opt"><input type="radio" name="rc-type" value="" checked><span>All</span></label>${types.map(t => `<label class="rc-opt"><input type="radio" name="rc-type" value="${t}"><span>${esc(R.TYPES[t].plural)}</span></label>`).join("")}
        </fieldset>
        <div class="rc-field"><label for="rcTopic">Topic</label><select id="rcTopic"><option value="">All topics</option>${topics.map(t => `<option value="${t}">${esc(R.TOPICS[t])}</option>`).join("")}</select></div>
        <div class="rc-field"><label for="rcLevel">Evidence</label><select id="rcLevel"><option value="">Any strength</option>${R.LEVEL_ORDER.map(l => `<option value="${l}">${esc(R.LEVELS[l].label)}</option>`).join("")}</select></div>
        <div class="rc-field rc-search"><label for="rcQ">Search</label><input id="rcQ" type="search" autocomplete="off" placeholder="For example: alpha, contrast, F679"></div>
      </div>
      <p class="rc-count" id="rcCount" aria-live="polite"></p>
      <ul class="rc-cards" id="rcCards">
        ${R.DOCS.map(card).join("\n        ")}
      </ul>
      <p class="rc-empty" id="rcEmpty" hidden>No document matches those choices. <button type="button" class="rc-link-btn" id="rcClear">Show everything</button></p>
    </section>
    <section id="boards" class="rc-band" aria-labelledby="boardsH">
      <p class="rc-eyebrow">For facility boards</p>
      <h2 id="boardsH">A board packet, in one click</h2>
      <p class="rc-band-lede">An evidence and value summary a director can take to the administrative board: the decision in brief, the evidence behind each approach, regulatory alignment, a value worksheet with the license price and the facility’s own figures, a 90-day plan with measures, answers to the questions boards ask, and every reference. Letter size, ready to print or attach.</p>
      <div class="rc-band-grid">
        <div>
          <h3>What’s inside</h3>
          <ol class="rc-list rc-band-list">
            <li>The decision in brief, with privacy and risk</li>
            <li>The evidence at a glance, rated and cited</li>
            <li>Regulatory alignment: F550 to F947</li>
            <li>The value worksheet: ${esc(R.money(R.PRICE_PER_BUILDING))} a year per building, cost per resident, staff time</li>
            <li>Implementation and measurement over 90 days</li>
            <li>Questions boards ask</li>
            <li>The vendor’s disclosure and every reference</li>
          </ol>
        </div>
        <div class="rc-band-card">
          <button type="button" class="rc-btn rc-btn-hero" id="rcBoardGo" data-rc-js hidden>${svg(ICON.download, 20)}Download the board packet (PDF)</button>
          <p class="rc-board-msg" id="rcBoardMsg" role="status"></p>
          <noscript><p>The board packet is made in your browser and needs JavaScript turned on. Each research summary can still be printed from its own page.</p></noscript>
          <details class="rc-board-more" data-rc-js hidden>
            <summary>Personalize the packet (optional)</summary>
            <form id="rcBoardForm" class="rc-board-form" novalidate>
              ${field("facility", "Community name", "text", "", ' maxlength="80" autocomplete="organization"')}
              ${field("preparedBy", "Prepared by", "text", "", ' maxlength="80" autocomplete="name"')}
              ${field("role", "Their role", "text", "For example: Activity Director", ' maxlength="80"')}
              ${field("meeting", "Board meeting date", "date", "", "")}
              ${field("buildings", "Buildings to license", "number", "", ' min="1" max="50" step="1" inputmode="numeric" placeholder="1"')}
              ${field("residents", "Residents served", "number", "", ' min="1" max="5000" step="1" inputmode="numeric"')}
              ${field("hoursNow", "Staff hours a week preparing activity materials now", "number", "Measured over two typical weeks", ' min="0" max="168" step="0.5" inputmode="decimal"')}
              ${field("hoursWith", "Staff hours a week with Cognicopia", "number", "Measured during a trial", ' min="0" max="168" step="0.5" inputmode="decimal"')}
              ${field("hourlyCost", "Hourly staff cost, with benefits ($)", "number", "", ' min="0" max="500" step="0.01" inputmode="decimal"')}
              <p class="rc-hint">What you type stays in this browser, and is never sent anywhere. Any field left blank prints as a line to fill in by hand. Only the license price is Cognicopia’s; every other figure is yours.</p>
              <button type="submit" class="rc-btn rc-btn-light">${svg(ICON.download, 18)}Download with these details</button>
              <p class="rc-hint">On a shared computer? <button type="button" class="rc-link-btn" id="rcBoardClear">Clear these details</button> from this browser when you are done.</p>
            </form>
          </details>
        </div>
      </div>
    </section>
    <section id="scale" aria-labelledby="scaleH">
      <h2 id="scaleH">How we rate evidence</h2>
      <p>Each document carries one rating: the strength of the evidence it summarizes. A rating describes the research, never Cognicopia’s products, which have not been tested in clinical trials of their own.</p>
      <div class="rc-table-wrap" role="region" aria-labelledby="scaleCap" tabindex="0"><table>
        <caption id="scaleCap">The Research Center’s evidence scale</caption>
        <thead><tr><th scope="col">Rating</th><th scope="col">What it means</th><th scope="col">Documents</th></tr></thead>
        <tbody>
          ${scale}
        </tbody>
      </table></div>
    </section>
    <section id="method" aria-labelledby="methodH">
      <h2 id="methodH">How we write these summaries</h2>
      <ul class="rc-list">
        <li><b>Sources.</b> Peer-reviewed studies, Cochrane systematic reviews, national clinical guidelines, published accessibility standards and the text of federal regulations. Every figure links to its source.</li>
        <li><b>What was measured, in whom.</b> Each study is described by its design, its participants, what it measured, what it found and its caveats, so a reader can judge how far it applies to their residents.</li>
        <li><b>Limits, always.</b> Every summary ends with what the evidence does not show. Where a principle is reasoned from evidence rather than tested directly, the page says so.</li>
        <li><b>Composites are labeled.</b> Case scenarios are composites written to show how evidence can be applied. They describe no real facility or resident, and report no outcomes.</li>
        <li><b>Review.</b> Every summary was checked against its sources on ${esc(R.fmtDate(R.REVIEWED))}. Corrections are welcome through the <a href="../../contact.html?subject=Research+Center+correction">contact page</a>.</li>
        <li><b>Disclosure.</b> Cognicopia makes the activity tools these pages mention, and wrote these summaries. The summaries report what the research found, including where it found little or nothing.</li>
      </ul>
    </section>
    <p class="rc-disclaimer">Educational summaries for professionals, not medical advice. Regulations and guidance change; check the current text before relying on a regulatory summary.</p>
  </div>`;
  return shell({ file, title: "Clinical Science & Research Center", description: "Evidence summaries, whitepapers, case scenarios and a regulatory crosswalk for memory care, with every source cited and every limit stated, and a one-click board packet for facility boards.", body, canonical: R.SITE + "/" + HOME });
}

/* ---------- the reader's styles ---------- */
const READER_CSS = String.raw`
/* ── Clinical Science & Research Center ──
   Reading surfaces are tuned for reviewing clinical material: 19 px Atkinson
   Hyperlegible at 1.65 line height, lines of about 72 characters (33em,
   measured; WCAG 1.4.8 asks for no more than 80), and text
   contrast of at least 7:1 (WCAG AAA) in every color setting: paper
   (16:1 body text), dark (15.7:1) and maximum contrast (21:1). */
:root{
  --rc-bg:#102219; --rc-paper:#fbfaf5; --rc-card:#ffffff; --rc-ink:#15201a; --rc-ink-2:#34433b; --rc-accent:#14532d; --rc-link:#0b4f2e;
  --rc-rule:#cfd9d2; --rc-tint:#ebf4ee; --rc-caution:#fdf3e7; --rc-caution-ink:#7a3a0c; --rc-focus:#0b57d0; --rc-fs:19px; --rc-lh:1.65;
}
html[data-rc-size="large"]{--rc-fs:21px}
html[data-rc-size="largest"]{--rc-fs:24px}
html[data-rc-lead="wide"]{--rc-lh:1.9}
html[data-rc-theme="dark"]{--rc-paper:#131d18;--rc-card:#18241e;--rc-ink:#f1f5f2;--rc-ink-2:#c6d3cc;--rc-accent:#93dbb4;--rc-link:#a5e6c2;--rc-rule:#34473d;--rc-tint:#1d2c24;--rc-caution:#2b2219;--rc-caution-ink:#f2c29a;--rc-focus:#9ecbff}
html[data-rc-theme="max"]{--rc-paper:#ffffff;--rc-card:#ffffff;--rc-ink:#000000;--rc-ink-2:#000000;--rc-accent:#000000;--rc-link:#002f8f;--rc-rule:#000000;--rc-tint:#ffffff;--rc-caution:#ffffff;--rc-caution-ink:#000000;--rc-focus:#002f8f}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--rc-bg);color:#fff;font-family:"Atkinson Hyperlegible","Trebuchet MS","Segoe UI",sans-serif;line-height:1.6}
.rc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.rc-skip{position:absolute;left:12px;top:-60px;z-index:2000;padding:10px 16px;border-radius:8px;background:#fff;color:#0b2a1c;font-weight:700;text-decoration:none}
.rc-skip:focus{top:12px;outline:3px solid #7ad3a4}
.rc-main{max-width:1060px;margin:0 auto;padding:28px 28px 48px}
.site-footer{max-width:900px;margin:0 auto 32px;padding:0 20px;color:#fff;text-align:center;font-size:.9rem}
.rc-paper{background:var(--rc-paper);color:var(--rc-ink);border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,.28);padding:clamp(20px,4.5vw,56px);font-size:var(--rc-fs);line-height:var(--rc-lh);overflow-wrap:break-word}
html[data-rc-theme="max"] .rc-paper{border:2px solid #000;box-shadow:none}
.rc-paper :focus-visible{outline:3px solid var(--rc-focus);outline-offset:2px}
.rc-paper a{color:var(--rc-link);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
.rc-paper a:hover{text-decoration-thickness:2px}
.rc-paper h1,.rc-paper h2,.rc-paper h3{color:var(--rc-ink);line-height:1.22;margin:0}
.rc-paper h1{font-size:1.85em;letter-spacing:-.01em;outline:none}
.rc-paper h2{font-size:1.3em}
.rc-paper h3{font-size:1.06em}
.rc-paper p,.rc-paper li,.rc-paper dd{max-width:33em}
.rc-paper p{margin:.75em 0}
.rc-list{margin:.6em 0;padding-left:1.3em}
.rc-list li{margin:.45em 0;padding-left:.15em}
.rc-list li::marker{color:var(--rc-accent);font-weight:700}
.rc-chip{display:inline-flex;align-items:center;min-height:1.9em;padding:.12em .75em;border-radius:999px;font-size:.74em;font-weight:700;letter-spacing:.02em;line-height:1.3}
.rc-type{border:1.5px solid var(--rc-accent);color:var(--rc-accent)}
.rc-lv{color:#fff;border:1.5px solid transparent}
.lv-strong{background:#14532d}.lv-moderate{background:#1e3a8a}.lv-emerging{background:#7a3a0c}.lv-standard{background:#334155}.lv-regulation{background:#4c1d95}.lv-illustrative{background:#6b2143}
html[data-rc-theme="dark"] .rc-lv{border-color:rgba(255,255,255,.45)}
html[data-rc-theme="max"] .rc-lv{background:#fff;color:#000;border:2px solid #000}
.rc-chips,.rc-card-top{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 .8em}
.rc-sub{font-size:1.12em;color:var(--rc-ink-2);margin:.5em 0 .7em}
.rc-meta{display:flex;flex-wrap:wrap;gap:4px 18px;margin:.4em 0;color:var(--rc-ink-2);font-size:.86em}
.rc-meta span+span::before{content:"·";margin-right:18px;margin-left:-10px;color:var(--rc-ink-2)}
.rc-for{margin:.3em 0 1em;color:var(--rc-ink-2);font-size:.86em}
.rc-tools{display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;margin:1em 0 .4em;font-size:.86em}
.rc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:.45em 1em;border:2px solid var(--rc-accent);border-radius:10px;background:transparent;color:var(--rc-accent);font:inherit;font-weight:700;line-height:1.25;text-decoration:none!important;cursor:pointer}
.rc-btn:hover{background:var(--rc-tint)}
.rc-btn svg{flex:none}
.rc-btn[hidden],[data-rc-js][hidden],.rc-card[hidden]{display:none}
.rc-btn[aria-pressed="true"]{background:var(--rc-accent);color:var(--rc-paper)}
.rc-link-btn{padding:0;border:0;background:none;color:var(--rc-link);font:inherit;text-decoration:underline;cursor:pointer}
.rc-settings{position:relative}
.rc-settings>summary{list-style:none}
.rc-settings>summary::-webkit-details-marker{display:none}
.rc-settings[open]>summary{background:var(--rc-accent);color:var(--rc-paper)}
.rc-settings-panel{position:absolute;z-index:30;top:calc(100% + 8px);left:0;width:min(340px,calc(100vw - 48px));padding:14px 16px;border:2px solid var(--rc-accent);border-radius:12px;background:var(--rc-card);color:var(--rc-ink);box-shadow:0 14px 34px rgba(0,0,0,.22)}
.rc-settings-panel fieldset{margin:0 0 10px;padding:0;border:0}
.rc-settings-panel legend{padding:0;margin:0 0 4px;font-weight:700}
.rc-opt{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin:0 12px 0 0;cursor:pointer}
.rc-opt input{width:20px;height:20px;margin:0;accent-color:var(--rc-accent);flex:none}
.rc-hint{display:block;margin:.3em 0 0;color:var(--rc-ink-2);font-size:.86em}
.rc-box{margin:1.6em 0;padding:1em 1.3em;border-radius:14px}
.rc-box h2{font-size:1.12em;margin-bottom:.2em}
.rc-takeaways{background:var(--rc-tint);border-left:6px solid var(--rc-accent)}
.rc-practice{background:var(--rc-tint);border:1.5px solid var(--rc-rule)}
.rc-limits{background:var(--rc-caution);border:1.5px solid var(--rc-caution-ink)}
.rc-limits h2{color:var(--rc-caution-ink)}
html[data-rc-theme="max"] .rc-box{border:2px solid #000}
.rc-scenario{margin:1.2em 0;padding:.9em 1.2em;border:2px dashed var(--rc-caution-ink);border-radius:12px;background:var(--rc-caution)}
.rc-note-t{margin:0 0 .2em!important;font-weight:700;color:var(--rc-ink)}
.rc-scenario .rc-note-t{color:var(--rc-caution-ink)}
.rc-glance{margin:1.6em 0}
.rc-glance h2{font-size:1.12em;margin-bottom:.6em}
.rc-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:14px}
.rc-fig{margin:1.1em 0;padding:1em 1.1em;border:1.5px solid var(--rc-rule);border-radius:14px;background:var(--rc-card)}
.rc-figs .rc-fig{margin:0}
.rc-fig-v{margin:0 0 .25em!important;font-size:1.5em;font-weight:800;line-height:1.15;color:var(--rc-accent)}
.rc-fig figcaption{font-size:.92em}
.rc-src{display:block;margin-top:.5em;color:var(--rc-ink-2);font-size:.88em}
.rc-toc{margin:1.6em 0;padding:1em 1.3em;border:1.5px solid var(--rc-rule);border-radius:14px}
.rc-toc h2{font-size:1.02em;text-transform:uppercase;letter-spacing:.06em;color:var(--rc-ink-2)}
.rc-toc ol{margin:.5em 0 0;padding-left:1.4em}
.rc-toc li{margin:.25em 0}
.rc-toc-min,.rc-sec-min{color:var(--rc-ink-2);font-size:.8em;font-weight:400;white-space:nowrap}
.rc-secs{margin:1.2em 0}
.rc-sec{border-top:1.5px solid var(--rc-rule);padding:.7em 0 .5em;scroll-margin-top:70px}
.rc-sec:last-child{border-bottom:1.5px solid var(--rc-rule)}
.rc-sec-h{display:flex;align-items:baseline;gap:12px;margin:.2em 0}
.rc-sec-t{flex:1;min-width:0}
.rc-acc{display:flex;align-items:baseline;gap:12px;width:100%;padding:.25em .3em;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.rc-acc:hover{background:var(--rc-tint)}
.rc-chev{flex:none;align-self:center;transition:transform .15s}
.rc-acc[aria-expanded="true"] .rc-chev{transform:rotate(180deg)}
.rc-brief{margin:.2em 0 .4em!important;color:var(--rc-ink-2)}
.rc-brief b{color:var(--rc-ink)}
.rc-sec-b{padding:.2em 0 .6em}
.rc-sec-b[hidden]{padding:0}
.rc-cites{font-size:.72em;line-height:0;margin-left:1px;white-space:nowrap}
.rc-cites a{padding:0 2px;border-radius:3px;font-weight:700;text-decoration:none!important}
.rc-cites a:hover,.rc-cites a:focus-visible{background:var(--rc-tint);text-decoration:underline!important}
.rc-study{margin:1.3em 0;padding:1em 1.2em 1.1em;border:1.5px solid var(--rc-rule);border-left:6px solid var(--rc-accent);border-radius:14px;background:var(--rc-card)}
.rc-study-k{margin:0!important;color:var(--rc-ink-2);font-size:.78em;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.rc-study-t{margin:.15em 0 .5em!important}
.rc-study-dl{display:grid;grid-template-columns:minmax(0,1fr);gap:.55em;margin:0;font-size:.94em}
.rc-study-dl div{display:grid;grid-template-columns:8.5em minmax(0,1fr);gap:1em}
.rc-study-dl dt{font-weight:700;color:var(--rc-ink)}
.rc-study-dl dd{margin:0}
.rc-note{margin:1.1em 0;padding:.85em 1.1em;border-radius:12px;border:1.5px solid var(--rc-rule);background:var(--rc-tint)}
.rc-note p{margin:.2em 0}
.rc-note.is-caution{background:var(--rc-caution);border-color:var(--rc-caution-ink)}
.rc-note.is-caution .rc-note-t{color:var(--rc-caution-ink)}
.rc-table-wrap{position:relative;overflow-x:auto;margin:1.2em 0 .4em;border:1.5px solid var(--rc-rule);border-radius:12px;background:var(--rc-card)}
.rc-table-wrap table{width:100%;border-collapse:collapse;font-size:.88em;line-height:1.5}
.rc-table-wrap caption{padding:.7em .9em;text-align:left;font-weight:700;caption-side:top}
.rc-table-wrap th,.rc-table-wrap td{padding:.6em .9em;border-top:1px solid var(--rc-rule);text-align:left;vertical-align:top;min-width:8em}
.rc-table-wrap thead th{background:var(--rc-tint);white-space:nowrap}
.rc-table-wrap tbody th{font-weight:700}
.rc-table-note{margin:.2em 0 1.2em!important;color:var(--rc-ink-2);font-size:.86em}
.rc-refs{margin:.6em 0;padding-left:1.8em;font-size:.88em;line-height:1.55}
.rc-refs li{margin:.55em 0;scroll-margin-top:80px}
.rc-refs li:target{background:var(--rc-tint);outline:2px solid var(--rc-accent);outline-offset:4px;border-radius:4px}
.rc-ref-text{overflow-wrap:anywhere}
.rc-ref-link{display:inline-flex;align-items:center;gap:4px;margin-left:4px;white-space:nowrap;font-weight:700}
.rc-refs-sec,.rc-cite-sec,.rc-related{margin:2em 0 0}
.rc-cite-text{padding:.8em 1em;border-radius:10px;background:var(--rc-tint);font-size:.9em;overflow-wrap:anywhere}
.rc-cards{list-style:none;margin:.8em 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}
.rc-card{position:relative;display:flex;flex-direction:column;padding:1.05em 1.15em;border:1.5px solid var(--rc-rule);border-radius:16px;background:var(--rc-card)}
.rc-card h3{font-size:1.02em}
.rc-card h3 a{color:var(--rc-ink);text-decoration:none}
.rc-card h3 a::after{content:"";position:absolute;inset:0;border-radius:inherit}
.rc-card:hover{border-color:var(--rc-accent)}
.rc-card:focus-within{outline:3px solid var(--rc-focus);outline-offset:2px}
.rc-card h3 a:focus-visible{outline:none}
.rc-card-top{margin-bottom:.6em}
.rc-card-s{margin:.5em 0!important;font-size:.9em;color:var(--rc-ink-2)}
.rc-card-m{margin:auto 0 0!important;padding-top:.4em;font-size:.8em;color:var(--rc-ink-2)}
.rc-disclaimer{margin:2.2em 0 0!important;padding-top:1em;border-top:1.5px solid var(--rc-rule);color:var(--rc-ink-2);font-size:.86em}
.rc-tip{position:absolute;z-index:1500;max-width:min(440px,calc(100vw - 24px));padding:.7em .9em;border-radius:10px;background:#0b1510;color:#fff;font:15px/1.45 "Atkinson Hyperlegible","Trebuchet MS",sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.35);pointer-events:none}
.rc-tip[hidden]{display:none}
.rc-exit{position:fixed;top:12px;right:12px;z-index:1200;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:2px solid #fff;border-radius:10px;background:#0b1510;color:#fff;font:700 15px "Atkinson Hyperlegible","Trebuchet MS",sans-serif;cursor:pointer}
.rc-exit[hidden]{display:none}
.rc-exit:focus-visible{outline:3px solid #7ad3a4;outline-offset:2px}
html.rc-focus body{padding-left:0}
html.rc-focus .cg-sidebar,html.rc-focus .cg-sidebar-toggle,html.rc-focus .cg-sb-overlay,html.rc-focus .cg-topbar,html.rc-focus .cg-crumbs,html.rc-focus .site-footer{display:none!important}
html.rc-focus .rc-main{max-width:940px;padding-top:64px}
/* the library */
.rc-hero{padding:8px 4px 26px;color:#fff}
.rc-eyebrow{margin:0 0 8px;color:#9fe0bd;font-size:13px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.rc-hero h1{margin:0;font-size:clamp(30px,4vw,44px);line-height:1.12;outline:none}
.rc-lede{max-width:33em;margin:12px 0 0;color:#cfe3d7;font-size:19px;line-height:1.6}
.rc-quick{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.rc-quick a{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1.5px solid rgba(207,227,215,.55);border-radius:999px;color:#fff;font-weight:700;text-decoration:none}
.rc-quick a:hover{background:rgba(159,224,189,.14);border-color:#9fe0bd}
.rc-quick a:focus-visible{outline:3px solid #9fe0bd;outline-offset:2px}
.rc-lib-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px}
.rc-library>section{scroll-margin-top:70px}
.rc-library>section+section{margin-top:2.4em}
.rc-filters{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin:1em 0 .6em;padding:1em 1.1em;border:1.5px solid var(--rc-rule);border-radius:14px;font-size:.9em}
.rc-types{margin:0;padding:0;border:0}
.rc-types legend,.rc-field label{display:block;margin:0 0 4px;padding:0;font-weight:700}
.rc-field input,.rc-field select{width:100%;min-height:46px;padding:8px 12px;border:2px solid var(--rc-ink-2);border-radius:10px;background:var(--rc-card);color:var(--rc-ink);font:inherit}
@media (min-width:980px){.rc-filters{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)}.rc-types{grid-column:1/-1}}
.rc-count{margin:.5em 0;color:var(--rc-ink-2);font-size:.86em}
.rc-empty{padding:1em;border:1.5px dashed var(--rc-rule);border-radius:12px;text-align:center}
.rc-band{padding:clamp(18px,3.5vw,36px);border-radius:18px;background:#173a2a;color:#fff}
.rc-band h2,.rc-band h3{color:#fff}
.rc-band .rc-eyebrow{color:#9fe0bd}
.rc-band a{color:#bff0d4}
.rc-band-lede{color:#e6f1ea}
.rc-band-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;margin-top:1em}
@media (min-width:900px){.rc-band-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.rc-band-list li::marker{color:#9fe0bd}
.rc-band-card{padding:1.1em;border:1.5px solid rgba(207,227,215,.5);border-radius:14px;background:rgba(255,255,255,.05)}
.rc-btn-hero{width:100%;min-height:56px;border-color:#fff;background:#fff;color:#0f3322;font-size:1.02em}
.rc-btn-hero:hover{background:#dff3e7}
.rc-btn-light{border-color:#fff;background:#fff;color:#0f3322}
.rc-btn-light:hover{background:#dff3e7}
.rc-band .rc-btn:focus-visible{outline:3px solid #9fe0bd;outline-offset:3px}
.rc-board-msg{min-height:1.5em;margin:.6em 0!important;color:#e6f1ea;font-size:.9em}
.rc-board-more{margin-top:.6em}
.rc-board-more>summary{display:inline-flex;align-items:center;min-height:44px;cursor:pointer;font-weight:700;color:#fff}
.rc-board-more>summary:focus-visible{outline:3px solid #9fe0bd;outline-offset:2px}
.rc-board-form{display:grid;gap:12px;margin-top:.6em;font-size:.9em}
.rc-board-form label{color:#fff}
.rc-board-form input{border-color:#cfe3d7;background:#fff;color:#15201a}
.rc-board-form .rc-hint{color:#d6e8dd}
.rc-band .rc-link-btn{color:#bff0d4;font-weight:700}
.rc-band .rc-link-btn:focus-visible{outline:3px solid #9fe0bd;outline-offset:2px}
html[data-rc-theme="max"] .rc-band{background:#fff;color:#000;border:2px solid #000}
html[data-rc-theme="max"] .rc-band h2,html[data-rc-theme="max"] .rc-band h3,html[data-rc-theme="max"] .rc-band-lede,html[data-rc-theme="max"] .rc-band .rc-eyebrow,html[data-rc-theme="max"] .rc-board-msg,html[data-rc-theme="max"] .rc-board-more>summary,html[data-rc-theme="max"] .rc-board-form label,html[data-rc-theme="max"] .rc-board-form .rc-hint{color:#000}
html[data-rc-theme="max"] .rc-btn-hero,html[data-rc-theme="max"] .rc-btn-light{border-color:#000;background:#000;color:#fff}
html[data-rc-theme="max"] .rc-band .rc-link-btn{color:#002f8f}
@media (max-width:700px){
  .rc-main{padding:18px 12px 32px}
  .rc-paper{border-radius:14px}
  .rc-study-dl div{grid-template-columns:minmax(0,1fr);gap:.1em}
  .rc-meta span+span::before{display:none}
  .rc-settings-panel{position:static;width:auto;margin-top:8px}
  .rc-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .rc-tools .rc-btn{width:100%;padding-left:.6em;padding-right:.6em;text-align:center}
  .rc-settings[open]{grid-column:1/-1}
}
@media (prefers-reduced-motion:reduce){.rc-chev{transition:none}}
@media print{
  @page{margin:.6in}
  body{padding:0!important;background:#fff!important;color:#000}
  .cg-sidebar,.cg-sidebar-toggle,.cg-sb-overlay,.cg-topbar,.cg-crumbs,.site-footer,.rc-tools,.rc-exit,.rc-skip,.rc-tip,[data-rc-js],.rc-toc,.rc-related,.rc-hero .rc-quick{display:none!important}
  .rc-main{max-width:none;padding:0}
  .rc-paper{box-shadow:none;border:0;border-radius:0;padding:0;background:#fff;color:#000;font-size:11.5pt;line-height:1.5}
  .rc-paper a{color:#000}
  .rc-sec-b{display:block!important;content-visibility:visible!important;padding:.2em 0 .6em!important}
  .rc-sec,.rc-study,.rc-fig,.rc-note,.rc-box,.rc-table-wrap{break-inside:avoid}
  .rc-sec-h,.rc-paper h2{break-after:avoid}
  .rc-band{background:#fff;color:#000;border:1px solid #000}
  .rc-band h2,.rc-band h3,.rc-band-lede{color:#000}
}`;

/* ---------- write, or check ---------- */
const check = process.argv.includes("--check");
const bad = R.problems();
if (bad.length){ console.error("The Research Center's content has problems:\n  - " + bad.join("\n  - ")); process.exit(1); }
const outputs = [[HOME + "index.html", libraryPage()], ...R.DOCS.map(d => [HOME + d.slug + "/index.html", readerPage(d)])];
const stale = [];
for (const [file, html] of outputs){
  const f = path.join(ROOT, file), cur = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  if (cur === html) continue;
  if (check){ stale.push(file); continue; }
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); console.log("wrote " + file);
}
// a document removed from the content leaves no page behind
const dir = path.join(ROOT, HOME), keep = new Set(R.DOCS.map(d => d.slug));
for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []){
  if (!e.isDirectory() || keep.has(e.name)) continue;
  if (check) stale.push(HOME + e.name + "/ (no longer in the content)"); else { fs.rmSync(path.join(dir, e.name), { recursive: true }); console.log("removed " + HOME + e.name + "/"); }
}
if (check && stale.length){ console.error("Research Center pages out of date: " + stale.join(", ") + ". Run: npm run research"); process.exit(1); }
if (check) console.log(`Research Center pages are current: the library and ${R.DOCS.length} documents.`);
