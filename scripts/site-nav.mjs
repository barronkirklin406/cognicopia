#!/usr/bin/env node
/* =====================================================================
   COGNICOPIA SITE NAVIGATION: one source for every page's sidebar
   Run:  npm run nav             write the sidebar, breadcrumbs and their
                                 styles into every page
         node scripts/site-nav.mjs --check
                                 fail if any page is out of date (npm run
                                 build runs this)

   The sidebar keeps the interactive tools first. All reference and
   educational reading lives in one "Resource & Clinical Hub" section: a
   collapsible group in the sidebar and a tabbed hub page at resources/
   (interactive tools on one tab, the reference library on the other), with
   each module at its own nested route, resources/<slug>/. The packet tool's
   Ailment-Specific Activities stay in its sidebar, under the tools: that
   part of the block is left as the page has it.

   Each page gets generated blocks, between markers, never edited by hand:
   the sidebar (with its menu button and script), the breadcrumb bar (hub
   and module pages), the hub's module cards (resources/index.html), and a
   <style id="cg-nav-css"> in the head. The
   rest of every page is left exactly as it is. The Packet Builder
   (builder.html) keeps its own sidebar and links to the hub.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- 1. What the navigation holds ---------- */
const svg = (d, size, cls, sw) => `<svg${cls ? ` class="${cls}"` : ""} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  builder: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="16" y2="13"/><line x1="9" y1="17" x2="14" y2="17"/>',
  tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chevron: '<polyline points="9 6 15 12 9 18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  support: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  // the nine modules
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  stethoscope: '<path d="M5 3H4a1 1 0 0 0-1 1v5a5 5 0 0 0 10 0V4a1 1 0 0 0-1-1h-1"/><path d="M8 14v1a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.6 18.9A2 2 0 0 0 6.3 22h11.4a2 2 0 0 0 1.7-3.1L14 9.5V3"/><path d="M7.5 15h9"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  // the interactive tools
  palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.4 3.4A1.9 1.9 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.3"/><circle cx="11.5" cy="6.5" r="1.3"/><circle cx="16.5" cy="9.5" r="1.3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  journal: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
  roster: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};

/* The interactive tools: always first. */
export const TOOLS = [
  { key: "profile",  label: "Resident Profiles",       href: "profile.html" },
  { key: "roster",   label: "Resident Roster",         href: "builder.html#/roster" },
  { key: "journals", label: "Cognitive Life Journals", href: "cognitive-journals.html" },
  { key: "planners", label: "12-Month Life Planners",  href: "life-planners.html" }
];

/* The informational hub: nine reference modules in three groups. `legacy` is
   the page's old address, which now forwards to its route. */
export const HUB = { href: "resources/", title: "Resource & Clinical Hub" };
export const GROUPS = [
  { id: "clinical",   label: "Clinical & quality",        blurb: "The evidence, standards and clinical thinking behind every page." },
  { id: "facilities", label: "Facilities & publishing",   blurb: "How Cognicopia works for busy communities, and who stands behind it." },
  { id: "guides",     label: "Guides & help",             blurb: "What the tools do, what they make, and answers to common questions." }
];
export const MODULES = [
  { slug: "quality-standards",      label: "Quality Standards Hub",      legacy: "institutional-standards.html", group: "clinical",   icon: "shield",
    desc: "Institutional standards in one place: clinical validation, copier-tested printing and publishing governance." },
  { slug: "clinical-alignment",     label: "Clinical Alignment",         legacy: "clinical-alignment.html",      group: "clinical",   icon: "stethoscope",
    desc: "Evidence-informed engagement formats for memory care: cognitive retention, fine motor skills and dignified reminiscence." },
  { slug: "reminiscence-science",   label: "Reminiscence Science",       legacy: "therapy.html",                 group: "clinical",   icon: "flask",
    desc: "The principles of reminiscence therapy, and how a person’s own history becomes a meaningful activity." },
  { slug: "high-volume-facilities", label: "High-Volume Facilities",     legacy: "high-volume-facilities.html",  group: "facilities", icon: "building",
    desc: "Copier-tested, 8.5 × 11 in print-ready pages built for busy memory care and assisted living communities." },
  { slug: "publishing-excellence",  label: "Publishing Excellence",      legacy: "publishing-excellence.html",   group: "facilities", icon: "award",
    desc: "Editorial standards, quality control and independent geriatric publishing." },
  { slug: "platform-overview",      label: "Platform & Mission Overview", legacy: "about.html",                  group: "facilities", icon: "compass",
    desc: "Why Cognicopia exists and how it supports dignified, meaningful memory care connections." },
  { slug: "activity-feature-guide", label: "Activity Feature Guide",     legacy: "features.html",                group: "guides",     icon: "layout",
    desc: "A tour of the personalized activity generation and print-ready export features." },
  { slug: "resource-catalog",       label: "Master Resource Catalog",    legacy: "resources.html",               group: "guides",     icon: "books",
    desc: "Every clinical and creative resource: botanical art, reminiscence journals and 12-month life planners." },
  { slug: "caregiver-faq",          label: "Caregiver FAQ",              legacy: "faq.html",                     group: "guides",     icon: "help",
    desc: "Answers for nurses, activity directors, caregivers and families: stages, activities, printing, privacy and licensing." }
];
export const moduleHref = m => HUB.href + m.slug + "/";

/* The interactive generators, shown on the hub's first tab, apart from the
   reading. `href` is from the site root. */
export const GENERATORS = [
  { key: "coloring", label: "CogniCore Coloring",      href: "builder.html#/coloring", icon: "palette",
    desc: "Dignified, adult line art at three support tiers, printed with a binding gutter and optional color guides.", meta: ["118 pictures", "3 tiers", "Vector PDF"] },
  { key: "reminiscence", label: "Reminiscence Cards", href: "builder.html#/reminiscence", icon: "journal",
    desc: "Cards about a resident's own work, hometown region and best-remembered years, each with conversation starters, a song and something to hold.", meta: ["Era × region × vocation", "Caregiver cues"] },
  { key: "planners", label: "12-Month Life Planners",  href: "life-planners.html",     icon: "calendar",
    desc: "A personalized year-long memory book, with a separate care companion for staff and family.", meta: ["Memory book", "Care companion"] },
  { key: "journals", label: "Life Story Journals",     href: "cognitive-journals.html", icon: "journal",
    desc: "The Cognitive Life Journal: a life story in four sections, from early roots to daily comfort.", meta: ["4 sections", "Family notes"] },
  { key: "roster",   label: "Resident Roster",         href: "builder.html#/roster",   icon: "roster",
    desc: "Every saved resident in one list: choose a resident, choose a book, and print at their tier.", meta: ["3 clicks to print"] },
  { key: "profile",  label: "Resident Profiles",       href: "profile.html",           icon: "profile",
    desc: "The details that personalize every page, kept on this computer only.", meta: ["Stays on this device"] },
  { key: "builder",  label: "Packet Builder",          href: "builder.html",           icon: "builder",
    desc: "Word, number, music and art activities, added one version at a time into a printable packet.", meta: ["Activity library"] }
];

/* Every page that carries the shared sidebar, with what it marks as current. */
export const PAGES = [
  { file: "index.html",              current: "home" },
  { file: "profile.html",            current: "profile" },
  { file: "cognitive-journals.html", current: "journals" },
  { file: "life-planners.html",      current: "planners" },
  { file: "contact.html",            current: "contact" },
  { file: "zentangle-art.html",      current: null },
  { file: HUB.href + "index.html",   current: "hub", crumbs: [] },
  ...MODULES.map(m => ({ file: moduleHref(m) + "index.html", current: m.slug, crumbs: [m] }))
];

/* ---------- 2. The generated blocks ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const prefixOf = file => "../".repeat(file.split("/").length - 1);
const here = (on, cls) => on ? ` class="${cls ? cls + " " : ""}active" aria-current="page"` : cls ? ` class="${cls}"` : "";
const START = "<!-- cg-nav:start: generated by scripts/site-nav.mjs. Edit that file and run npm run nav; changes made here are overwritten. -->";
const END = "<!-- cg-nav:end -->";
const CRUMB_START = "<!-- cg-crumbs:start: generated by scripts/site-nav.mjs -->", CRUMB_END = "<!-- cg-crumbs:end -->";
const PAGE_TOOLS_START = "<!-- cg-nav:page-tools: this page's own tools, kept as they are -->", PAGE_TOOLS_END = "<!-- cg-nav:page-tools-end -->";

export function sidebar(page, pageTools){
  const P = prefixOf(page.file), cur = page.current, onHub = cur === "hub" || MODULES.some(m => m.slug === cur);
  const link = (href, label, key, icon) => `    <li><a href="${P}${href}"${here(cur === key)}>${icon ? svg(ICON[icon], 14, "cg-sb-ico") : '<span class="cg-bullet" aria-hidden="true">&#x203A;</span>'}<span>${esc(label)}</span></a></li>`;
  const groups = GROUPS.map(g => `          <li class="cg-sb-grp"><span class="cg-sb-glabel" id="cgGrp-${g.id}">${esc(g.label)}</span>
            <ul aria-labelledby="cgGrp-${g.id}">
${MODULES.filter(m => m.group === g.id).map(m => "      " + link(moduleHref(m), m.label, m.slug, m.icon)).join("\n")}
            </ul></li>`).join("\n");
  return `${START}
<button type="button" class="cg-sidebar-toggle" id="cgSbToggle" aria-label="Open Categories Menu" aria-controls="cgSidebar" aria-expanded="false">
  ${svg(ICON.menu, 20, "", 2.2)}
  <span class="cg-sidebar-toggle-text">Categories</span>
</button>
<div class="cg-sb-overlay" id="cgSbOverlay" aria-hidden="true"></div>
<aside class="cg-sidebar" id="cgSidebar" aria-label="Site navigation">
  <a href="${P}index.html" class="cg-sidebar-brand">
    <img src="${P}assets/cognicopia-logo.jpg" alt="Cognicopia Logo">
    <span>Cognicopia</span>
  </a>
  <a href="${P}index.html" id="cgHomeLink"${here(cur === "home", "cg-sidebar-home")}>
    ${svg(ICON.home, 14)}
    Home (Tool)
  </a>
  <a href="${P}builder.html" class="cg-sidebar-home" id="cgBuilderLink">
    ${svg(ICON.builder, 14)}
    Packet Builder
  </a>
  <nav class="cg-sb-nav" aria-label="Tools and resources">
  <ul class="cg-sidebar-nav">
    <li><div class="cg-sb-section">${svg(ICON.tools, 13, "", 2.2)}Tools &amp; Planners</div></li>
${TOOLS.map(t => link(t.href, t.label, t.key)).join("\n")}
${pageTools ? '    <li><div class="cg-sb-divider"></div></li>\n' + PAGE_TOOLS_START + "\n    " + pageTools.trim() + "\n" + PAGE_TOOLS_END : ""}
    <li><div class="cg-sb-divider"></div></li>
    <li>
      <details class="cg-sb-acc" id="cgInfoNav"${onHub ? " open data-here" : ""}>
        <summary class="cg-sb-section cg-sb-acc-head">${svg(ICON.library, 13, "", 2.2)}<span class="cg-sb-acc-title">${esc(HUB.title)}</span><span class="cg-sb-count" aria-label="${MODULES.length} modules">${MODULES.length}</span>${svg(ICON.chevron, 14, "cg-sb-chev")}</summary>
        <ul class="cg-sb-sub">
${"      " + link(HUB.href, "Browse all resources", "hub", "grid").replace("<a ", '<a data-hub ')}
${groups}
        </ul>
      </details>
    </li>
    <li><div class="cg-sb-divider"></div></li>
    <li><div class="cg-sb-section">${svg(ICON.support, 13, "", 2.2)}Support</div></li>
${link("contact.html", "Contact Kirk Barron", "contact")}
  </ul>
  </nav>
</aside>
<script id="cg-nav-js">
(function(){
  "use strict";
  var toggle = document.getElementById("cgSbToggle"), sidebar = document.getElementById("cgSidebar"), overlay = document.getElementById("cgSbOverlay");
  if (toggle && sidebar && overlay){
    var open = function(){ sidebar.classList.add("is-open"); overlay.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); toggle.setAttribute("aria-label", "Close Categories Menu"); };
    var close = function(){ sidebar.classList.remove("is-open"); overlay.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Open Categories Menu"); };
    toggle.addEventListener("click", function(){ sidebar.classList.contains("is-open") ? close() : open(); });
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && sidebar.classList.contains("is-open")){ close(); toggle.focus(); } });
  }
  /* The Resource & Clinical Hub is always open on its own pages; elsewhere it
     opens the way this browser last left it (a convenience, nothing more). */
  var acc = document.getElementById("cgInfoNav"), KEY = "cg_nav_info_open";
  if (acc && !acc.hasAttribute("data-here")){
    try { if (localStorage.getItem(KEY) === "1") acc.open = true; } catch (e){}
    acc.addEventListener("toggle", function(){ try { localStorage.setItem(KEY, acc.open ? "1" : "0"); } catch (e){} });
  }
})();
</script>
${END}`;
}

export function crumbs(page){
  if (!page.crumbs) return "";
  const P = prefixOf(page.file), m = page.crumbs[0];
  const items = [`<li><a href="${P}index.html">${svg(ICON.home, 13)}Dashboard</a></li>`,
    m ? `<li><a href="${P}${HUB.href}">${esc(HUB.title)}</a></li>` : `<li><span aria-current="page">${esc(HUB.title)}</span></li>`]
    .concat(m ? [`<li><span aria-current="page">${esc(m.label)}</span></li>`] : []);
  return `${CRUMB_START}
<nav class="cg-crumbs" aria-label="Breadcrumb"><ol>${items.join("")}</ol></nav>
${CRUMB_END}`;
}

/* The hub page's two tabs: the interactive tools, and every reference
   module by group, from the same lists as the sidebar. Without scripts both
   panels simply show, one after the other. */
const HUB_START = "<!-- cg-hub:start: generated by scripts/site-nav.mjs -->", HUB_END = "<!-- cg-hub:end -->";
const hubCard = (href, label, desc, icon, meta) => `      <li><a class="hub-card" href="${href}"><span class="hub-ico">${svg(ICON[icon], 26)}</span><span class="hub-text"><b>${esc(label)}</b><span>${esc(desc)}</span>${meta && meta.length ? `<span class="hub-meta">${meta.map(t => `<i>${esc(t)}</i>`).join("")}</span>` : ""}</span>${svg(ICON.chevron, 20, "hub-go")}</a></li>`;
export function hubCards(){
  const tabs = [{ id: "reference", label: "Reference library", n: MODULES.length }, { id: "tools", label: "Interactive tools", n: GENERATORS.length }];
  const tablist = `<div class="hub-tabs" role="tablist" aria-label="Hub sections" hidden>${tabs.map((t, k) => `<button type="button" role="tab" id="hubTab-${t.id}" aria-controls="hubPanel-${t.id}" aria-selected="${k === 0}" tabindex="${k === 0 ? 0 : -1}">${esc(t.label)}<span class="hub-n">${t.n}</span></button>`).join("")}</div>`;
  const jump = `<nav class="hub-jump" aria-label="Jump to a group"><ul>${GROUPS.map(g => `<li><a href="#${g.id}">${esc(g.label)}</a></li>`).join("")}</ul></nav>`;
  const sections = GROUPS.map(g => `<section class="hub-group" id="${g.id}" aria-labelledby="hubH-${g.id}">
    <h3 id="hubH-${g.id}">${esc(g.label)}</h3>
    <p class="hub-blurb">${esc(g.blurb)}</p>
    <ul class="hub-cards">
${MODULES.filter(m => m.group === g.id).map(m => hubCard(m.slug + "/", m.label, m.desc, m.icon)).join("\n")}
    </ul>
  </section>`).join("\n  ");
  const tools = `<ul class="hub-cards">
${GENERATORS.map(t => hubCard("../" + t.href, t.label, t.desc, t.icon, t.meta)).join("\n")}
    </ul>`;
  return `${HUB_START}
  ${tablist}
  <section class="hub-panel" id="hubPanel-reference" role="tabpanel" aria-labelledby="hubTab-reference hubH-reference">
  <h2 class="hub-ph" id="hubH-reference">Reference library</h2>
  <p class="hub-blurb">Static reading: the evidence, standards and guides behind the tools.</p>
  ${jump}
  ${sections}
  </section>
  <section class="hub-panel" id="hubPanel-tools" role="tabpanel" aria-labelledby="hubTab-tools hubH-tools">
  <h2 class="hub-ph" id="hubH-tools">Interactive tools</h2>
  <p class="hub-blurb">The generators that make printed pages for a resident. Everything they make stays on this computer.</p>
    ${tools}
  </section>
<script id="cg-hub-js">
(function(){
  "use strict";
  var list = document.querySelector(".hub-tabs"); if (!list) return;
  var tabs = [].slice.call(list.querySelectorAll("[role=tab]"));
  function show(tab, focus, remember){
    tabs.forEach(function(t){
      var on = t === tab, panel = document.getElementById(t.getAttribute("aria-controls"));
      t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    if (remember && history.replaceState) history.replaceState(null, "", "#" + tab.id.replace("hubTab-", ""));
  }
  tabs.forEach(function(t, k){
    t.addEventListener("click", function(){ show(t, false, true); });
    t.addEventListener("keydown", function(e){
      var j = e.key === "ArrowRight" ? k + 1 : e.key === "ArrowLeft" ? k - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if (j < 0 && e.key !== "ArrowLeft") return;
      e.preventDefault(); show(tabs[(j + tabs.length) % tabs.length], true, true);
    });
  });
  /* the address picks the tab: #tools, or a reference group such as #clinical */
  function fromHash(){
    var id = location.hash.slice(1), panel = id && document.getElementById(id);
    var tab = id === "tools" ? tabs[1] : panel && panel.closest && panel.closest("#hubPanel-tools") ? tabs[1] : tabs[0];
    show(tab);
    if (panel && id !== "tools" && id !== "reference") panel.scrollIntoView();
  }
  list.hidden = false;
  document.querySelectorAll(".hub-ph").forEach(function(h){ h.classList.add("hub-sr"); });
  fromHash(); window.addEventListener("hashchange", fromHash);
})();
</script>
  ${HUB_END}`;
}

export const CSS = `<style id="cg-nav-css">
/* Site navigation: tools first, one Resource & Clinical Hub section, breadcrumbs.
   Generated by scripts/site-nav.mjs; the sidebar's base styles stay in each page.
   Several pages set "color: #fff !important" and "p, li { font-size }" on every
   element, so the parts added here pin their own colors and sizes to look the
   same on every page. */
.cg-sb-nav{flex:1 0 auto;display:flex;flex-direction:column}
.cg-sb-nav .cg-sidebar-nav{flex:1}
.cg-sidebar-nav a .cg-sb-ico{flex:none;margin-top:1px;color:var(--sb-muted);transition:color .13s}
.cg-sidebar-nav a:hover .cg-sb-ico,.cg-sidebar-nav a.active .cg-sb-ico{color:var(--sb-accent)}
.cg-sb-acc > summary{list-style:none;cursor:pointer;margin:4px 6px 0;padding:10px 8px 8px;border-radius:6px;transition:background .15s}
.cg-sb-acc > summary::-webkit-details-marker{display:none}
.cg-sb-acc > summary:hover{background:var(--sb-hover)}
.cg-sb-acc > summary:focus-visible{outline:2px solid var(--sb-accent);outline-offset:1px}
.cg-sb-acc-title{flex:1;min-width:0}
.cg-sb-count{flex:none;min-width:18px;padding:1px 6px;border-radius:9px;background:rgba(82,183,136,.2);color:var(--sb-txt)!important;font-size:8pt;letter-spacing:0;text-align:center}
.cg-sb-chev{flex:none;transition:transform .15s}
.cg-sb-acc[open] > summary .cg-sb-chev{transform:rotate(90deg)}
.cg-sb-sub,.cg-sb-sub ul{list-style:none;margin:0;padding:0}
.cg-sb-sub a[data-hub]{font-weight:600}
.cg-sb-glabel{display:block;padding:10px 14px 3px 20px;font:700 8pt "Trebuchet MS","Segoe UI",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--sb-muted)!important}
.cg-crumbs{padding:8px 28px;border-bottom:1px solid var(--sb-border,rgba(216,243,220,.15));background:rgba(8,28,21,.6);font:10pt/20px "Trebuchet MS","Segoe UI",sans-serif}
.cg-crumbs ol{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin:0;padding:0;list-style:none}
.cg-crumbs li,.cg-crumbs a,.cg-crumbs span{font-size:inherit;line-height:inherit}
.cg-crumbs li{display:flex;align-items:center;gap:8px;margin:0;color:#d8f3dc!important}
.cg-crumbs li + li::before{content:"\\203A";color:rgba(216,243,220,.55)}
.cg-crumbs a{display:inline-flex;align-items:center;gap:6px;text-decoration:underline;text-underline-offset:3px;color:#95d5b2!important}
.cg-crumbs a:hover{color:#fff!important}
.cg-crumbs a:focus-visible{outline:2px solid #52b788;outline-offset:2px}
.cg-crumbs [aria-current]{color:#fff!important;font-weight:700}
@media (max-width:768px){.cg-crumbs{padding:8px 16px}}
</style>`;

/* ---------- 3. Writing the blocks into a page ---------- */
function between(s, a, b){ const i = s.indexOf(a), j = i < 0 ? -1 : s.indexOf(b, i); return i < 0 || j < 0 ? null : { i, j: j + b.length, inner: s.slice(i + a.length, j) }; }

/* The page's own tools inside the generated sidebar (the packet tool's
   Ailment-Specific Activities), or, the first time, inside the old one. */
function pageToolsOf(s){
  const kept = between(s, PAGE_TOOLS_START, PAGE_TOOLS_END);
  if (kept) return kept.inner;
  const a = s.indexOf("<!-- AILMENT-SPECIFIC ACTIVITIES -->"), end = s.indexOf("</aside>", a);
  if (a < 0 || end < 0) return "";
  return s.slice(a, s.lastIndexOf("</ul>", end));
}

export function render(s, page){
  const tools = pageToolsOf(s);
  let out = s;
  // the sidebar: replace the generated block, or the first time, the old toggle, overlay, aside and toggle script
  const block = sidebar(page, tools), old = between(out, START.slice(0, 16), END);
  if (old) out = out.slice(0, old.i) + block + out.slice(old.j);
  else {
    const i = out.indexOf('<button type="button" class="cg-sidebar-toggle"'), asideEnd = out.indexOf("</aside>", i);
    if (i < 0 || asideEnd < 0) throw new Error(page.file + ": no sidebar found");
    let j = asideEnd + "</aside>".length;
    const rest = out.slice(j), m = /^\s*<script>\s*(?:\/\*[^*]*Sidebar toggle[^*]*\*\/\s*)?\(function\(\)\{\s*(?:const|var) toggle\s*=[\s\S]*?<\/script>/.exec(rest);
    if (!m) throw new Error(page.file + ": the old sidebar script was not where it was expected");
    j += m[0].length;
    out = out.slice(0, i) + block + out.slice(j);
  }
  // breadcrumbs, right under the top bar
  const cr = crumbs(page), oldCr = between(out, CRUMB_START, CRUMB_END);
  if (oldCr) out = out.slice(0, oldCr.i) + cr + out.slice(oldCr.j);
  else if (cr){
    const t = out.indexOf('<div class="cg-topbar"'), close = out.indexOf("</div>", t);
    if (t < 0 || close < 0 || out.slice(t + 5, close).indexOf("<div") >= 0) throw new Error(page.file + ": top bar not found");
    const at = close + "</div>".length;
    out = out.slice(0, at) + "\n" + cr + out.slice(at);
  }
  // the hub's cards
  if (page.current === "hub"){
    const oldHub = between(out, HUB_START, HUB_END);
    if (!oldHub) throw new Error(page.file + ": no hub cards block");
    out = out.slice(0, oldHub.i) + hubCards() + out.slice(oldHub.j);
  }
  // styles, at the end of the head
  const oldCss = between(out, '<style id="cg-nav-css">', "</style>");
  if (oldCss) out = out.slice(0, oldCss.i) + CSS + out.slice(oldCss.j);
  else out = out.replace("</head>", CSS + "\n</head>");
  return out;
}

/* ---------- 4. Command line ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])){
  const check = process.argv.includes("--check"), stale = [];
  for (const page of PAGES){
    const f = path.join(ROOT, page.file);
    if (!fs.existsSync(f)){ stale.push(page.file + " (missing)"); continue; }
    const s = fs.readFileSync(f, "utf8"), out = render(s, page);
    if (out !== s){ if (check) stale.push(page.file); else { fs.writeFileSync(f, out); console.log("updated " + page.file); } }
  }
  if (check && stale.length){ console.error("Navigation out of date in: " + stale.join(", ") + ". Run: npm run nav"); process.exit(1); }
  if (check) console.log("Navigation is current on all " + PAGES.length + " pages.");
}
