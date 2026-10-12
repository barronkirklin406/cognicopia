#!/usr/bin/env node
/* =====================================================================
   COGNICOPIA SITE NAVIGATION: one source for every page's sidebar
   Run:  npm run nav             write the sidebar, breadcrumbs and their
                                 styles into every page
         node scripts/site-nav.mjs --check
                                 fail if any page is out of date (npm run
                                 build runs this)

   Navigation is six hubs (HUBS below), the same on every page: Today,
   Studio, Activity Packets, Facility, Academy and Resources. A hub with
   several places is a collapsible group and the one holding the current page
   is open; a hub with one place is a plain link. The Packet Builder
   (builder.html) gets the same six, with its activity categories under
   Activity Packets. All reference and educational reading lives under
   Resources: a collapsible group in the sidebar and a tabbed hub page at
   resources/ (interactive tools on one tab, the reference library on the
   other), with each module at its own nested route, resources/<slug>/. The
   packet tool's Ailment-Specific Activities stay in its sidebar, under
   Today: that part of the block is left as the page has it.

   Each page gets generated blocks, between markers, never edited by hand:
   the sidebar (with its menu button and script), the breadcrumb bar (hub
   and module pages), the hub's module cards (resources/index.html), a
   <style id="cg-nav-css"> and the license manager's two scripts in the head. The
   rest of every page is left exactly as it is. In builder.html only the
   sidebar's navigation is generated (its brand, hooks and styles are the
   page's own). --check also proves the six hubs are the same on every page,
   that exactly one is open, and that every link leads somewhere real.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* The prices and links the top bar's buttons use come from src/config/license.js, the one place they are set. */
const LIC = (() => { const box = {}; box.globalThis = box; vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8"), box); return box.CognicopiaLicenseConfig; })();
export const CTA = {
  primary: `Get Full Access ($${LIC.PRICES.monthly.amount}/mo or $${LIC.PRICES.annual.amount}/yr) &#x2192;`,
  invoice: "Request Corporate Invoice / W-9",
  pricing: LIC.PRICING_PATH, invoicePath: LIC.INVOICE_PATH
};

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
  // the hub's modules: the Research Center and the nine reference modules
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
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  academy: '<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8"/><path d="M22 9v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cards: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 21h10M9 9h6M8 13h8"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  microscope: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>'
};

/* The tools, as the hub page's cards use them (the sidebar draws HUBS). */
export const TOOLS = [
  { key: "profile",  label: "Resident Profiles",       href: "profile.html" },
  { key: "roster",   label: "Resident Roster",         href: "builder.html#/roster" },
  { key: "journals", label: "Cognitive Life Journals", href: "cognitive-journals.html" },
  { key: "planners", label: "12-Month Life Planners",  href: "life-planners.html" }
];

/* The six hubs: the whole navigation. Every page shows them in this order.
   An item's `key` is what a page marks as current; an item with a `route` is
   a screen inside the Packet Builder (builder.html#/<route>). A hub with one
   item is drawn as a plain link. On the static pages, Activity Packets is
   one link to the Packet Builder (its categories live inside it), and
   Resources lists the whole reference library (HUB, GROUPS and MODULES
   below); inside the Packet Builder, Resources is two links. Contact is a footer link under the six, on every page. */
const B = "builder.html";
export const HUBS = [
  { id: "today",     label: "Today",            icon: "sun",      items: [
      { key: "home",         label: "Personalized Packet Tool", href: "index.html",        icon: "home" },
      { key: "profile",      label: "Resident Profiles",        href: "profile.html",      icon: "profile" } ] },
  { id: "studio",    label: "Studio",           icon: "palette",  items: [
      { key: "coloring",     label: "Cognicopia Coloring",      href: B + "#/coloring",     route: "coloring",     icon: "palette" },
      { key: "planner",      label: "12-Month Life Planner",    href: B + "#/planner",      route: "planner",      icon: "calendar" },
      { key: "journal",      label: "Cognitive Life Journal",   href: B + "#/journal",      route: "journal",      icon: "journal" },
      { key: "reminiscence", label: "Reminiscence cards",       href: B + "#/reminiscence", route: "reminiscence", icon: "cards" },
      { key: "heirloom",     label: "Memory digest & book",     href: B + "#/heirloom",     route: "heirloom",     icon: "books" } ] },
  { id: "packets",   label: "Activity Packets", icon: "builder",  items: [
      { key: "builder",      label: "Packet Builder",           href: B,                    icon: "builder" } ] },
  { id: "facility",  label: "Facility",         icon: "building", items: [
      { key: "facility",     label: "Facility Portal",          href: B + "#/facility",     route: "facility",     icon: "building" },
      { key: "shift",        label: "Shift board",              href: B + "#/shift",        route: "shift",        icon: "clipboard" },
      { key: "roster",       label: "Resident roster",          href: B + "#/roster",       route: "roster",       icon: "roster" },
      { key: "clinical",     label: "Session notes (SLP)",      href: B + "#/clinical",     route: "clinical",     icon: "stethoscope" },
      { key: "settings",     label: "Settings & defaults",      href: B + "#/settings",     route: "settings",     icon: "gear" },
      { key: "pricing",      label: "Plans & pricing",          href: "pricing.html",       icon: "award" } ] },
  { id: "academy",   label: "Academy",          icon: "academy",  items: [
      { key: "academy",      label: "Caregiver & Pro Academy",  href: B + "#/academy",      route: "academy",      icon: "academy" } ] },
  { id: "resources", label: "Resources",        icon: "library",  items: [] }   // the hub, its modules and Contact: see sidebar() and builderSidebar()
];
/* The categories the Packet Builder draws under Activity Packets (its own list, with counts, is built in the page; these are the ids it uses). */
const CONTACT = { key: "contact", label: "Contact Kirk Barron", href: "contact.html", icon: "support" };

/* The informational hub: the reference modules in three groups. `legacy` is
   the page's old address, which now forwards to its route (the Research
   Center is new, so it has none). */
export const HUB = { href: "resources/", title: "Resource & Clinical Hub" };
export const GROUPS = [
  { id: "clinical",   label: "Clinical & quality",        blurb: "The evidence, standards and clinical thinking behind every page." },
  { id: "facilities", label: "Facilities & publishing",   blurb: "How Cognicopia works for busy communities, and who stands behind it." },
  { id: "guides",     label: "Guides & help",             blurb: "What the tools do, what they make, and answers to common questions." }
];
export const MODULES = [
  { slug: "research",               label: "Clinical Science & Research Center", group: "clinical", icon: "microscope",
    desc: "Evidence summaries, whitepapers and case scenarios with sources and limits, and a one-click board packet for facility boards." },
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

/* The coloring library's size, from its catalog, so the hub page never states a stale one. */
const COLORING_PICTURES = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/cognicopia_coloring_catalog.json"), "utf8")).counts.designs; } catch (e) { return null; } })();

/* The interactive generators, shown on the hub's first tab, apart from the
   reading. `href` is from the site root. */
export const GENERATORS = [
  { key: "coloring", label: "Cognicopia Coloring",      href: "builder.html#/coloring", icon: "palette",
    desc: "Dignified, adult line art at three support tiers, printed with a binding gutter and optional color guides.", meta: [COLORING_PICTURES ? COLORING_PICTURES + " pictures" : "Picture library", "3 tiers", "Vector PDF"] },
  { key: "reminiscence", label: "Reminiscence Cards", href: "builder.html#/reminiscence", icon: "journal",
    desc: "Cards about a resident's own work, hometown region and best-remembered years, each with conversation starters, a song and something to hold.", meta: ["Era × region × vocation", "Caregiver cues"] },
  { key: "heirloom", label: "Memory Digest & Book", href: "builder.html#/heirloom", icon: "books",
    desc: "A resident's words, stories and finished coloring pages, kept as they happen: a monthly digest for the family and a print-on-demand hardcover.", meta: ["Monthly digest", "Hardcover PDF"] },
  { key: "clinical", label: "Session Notes (SLP)", href: "builder.html#/clinical", icon: "stethoscope",
    desc: "GDS and FAST staging mapped to support tiers, a session log, and SOAP notes built only from what staff record.", meta: ["Staff-recorded SOAP", "Code checks"] },
  { key: "planners", label: "12-Month Life Planners",  href: "life-planners.html",     icon: "calendar",
    desc: "A personalized year-long memory book, with a separate care companion for staff and family.", meta: ["Memory book", "Care companion"] },
  { key: "journals", label: "Life Story Journals",     href: "cognitive-journals.html", icon: "journal",
    desc: "The Cognitive Life Journal: a life story in four sections, from early roots to daily comfort.", meta: ["4 sections", "Family notes"] },
  { key: "facility", label: "Facility Portal",         href: "builder.html#/facility", icon: "building",
    desc: "For activity directors: wings and resident groups by acuity tier, a balanced month of six-pillar sessions in one click, and a week of group packets printed at once.", meta: ["4 acuity tiers", "Month scheduler", "Week packets"] },
  { key: "academy",  label: "Caregiver & Professional Academy", href: "builder.html#/academy", icon: "academy",
    desc: "Narrated masterclasses for care teams with transcripts, companion guides, knowledge checks and in-service certificates, plus short guides and toolkits for family caregivers.", meta: ["6 masterclasses", "Family track", "Training records"] },
  { key: "roster",   label: "Resident Roster",         href: "builder.html#/roster",   icon: "roster",
    desc: "Every saved resident in one list: choose a resident, choose a book, and print at their tier.", meta: ["3 clicks to print"] },
  { key: "profile",  label: "Resident Profiles",       href: "profile.html",           icon: "profile",
    desc: "The details that personalize every page, kept on this computer only.", meta: ["Stays on this device"] },
  { key: "builder",  label: "Packet Builder",          href: "builder.html",           icon: "builder",
    desc: "Word, number, music and art activities, added one version at a time into a printable packet.", meta: ["Activity library"] }
];

/* The Research Center's reader pages, one per document, from its built content
   (assets/services/researchCenter.js, the same source the pages are made from). */
export function researchDocs(){
  const f = path.join(ROOT, "assets/services/researchCenter.js");
  if (!fs.existsSync(f)) return [];
  const box = {}; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(f, "utf8"), box);
  return box.CogniResearch.DOCS.map(d => ({ slug: d.slug, crumb: d.crumb }));
}
const RESEARCH = MODULES.find(m => m.slug === "research");

/* Every page that carries the shared sidebar, with what it marks as current. */
export const PAGES = [
  { file: "index.html",              current: "home", ownTopbar: true },   // the packet tool draws its own top bar (license box and buy buttons)
  { file: "profile.html",            current: "profile" },
  { file: "cognitive-journals.html", current: null, hub: "studio" },     // the journal's own page: Studio is open, no link is "here" (its link opens the tool)
  { file: "life-planners.html",      current: null, hub: "studio" },
  { file: "contact.html",            current: "contact" },
  { file: "pricing.html",            current: "pricing" },
  { file: "activate.html",           current: null, hub: "facility" },        // where a purchase is turned into a license key: the one page that may use the internet
  { file: "zentangle-art.html",      current: null, hub: "studio" },
  { file: "builder.html",            builder: true },
  { file: HUB.href + "index.html",   current: "hub", crumbs: [] },
  ...MODULES.map(m => ({ file: moduleHref(m) + "index.html", current: m.slug, crumbs: [m] })),
  ...researchDocs().map(d => ({ file: moduleHref(RESEARCH) + d.slug + "/index.html", current: RESEARCH.slug, crumbs: [RESEARCH, { label: d.crumb }] }))
];

/* ---------- 2. The generated blocks ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const prefixOf = file => "../".repeat(file.split("/").length - 1);
const here = (on, cls) => on ? ` class="${cls ? cls + " " : ""}active" aria-current="page"` : cls ? ` class="${cls}"` : "";
const START = "<!-- cg-nav:start: generated by scripts/site-nav.mjs. Edit that file and run npm run nav; changes made here are overwritten. -->";
const END = "<!-- cg-nav:end -->";
const CRUMB_START = "<!-- cg-crumbs:start: generated by scripts/site-nav.mjs -->", CRUMB_END = "<!-- cg-crumbs:end -->";
const LICENSE_START = "<!-- cg-license:start: generated by scripts/site-nav.mjs -->", LICENSE_END = "<!-- cg-license:end -->";
const licenseBlock = page => `${LICENSE_START}
<script src="${prefixOf(page.file)}src/config/license.js"></script>
<script src="${prefixOf(page.file)}assets/services/licenseManager.js"></script>
${LICENSE_END}`;
const CTA_START = "<!-- cg-cta:start: generated by scripts/site-nav.mjs -->", CTA_END = "<!-- cg-cta:end -->";
const ctaBlock = page => `${CTA_START}
  <a class="cg-cta" data-upgrade-prompt href="${prefixOf(page.file)}${CTA.pricing}" target="_blank" rel="noopener">${CTA.primary}</a>
  <a class="cg-cta cg-cta-alt" data-upgrade-prompt href="${prefixOf(page.file)}${CTA.invoicePath}">${CTA.invoice}</a>
  ${CTA_END}`;
const DESIGN_START = "<!-- cg-design:start: generated by scripts/site-nav.mjs -->", DESIGN_END = "<!-- cg-design:end -->";
const designBlock = page => `${DESIGN_START}
<link rel="stylesheet" href="${prefixOf(page.file)}css/styles.css">
${DESIGN_END}`;
/* The shared design system (css/styles.css): one link, written the same way into every page, the Packet Builder included. */
function withDesign(out, page){
  const block = designBlock(page), old = between(out, DESIGN_START, DESIGN_END);
  if (old) return out.slice(0, old.i) + block + out.slice(old.j);
  return out.replace("</head>", block + "\n</head>");
}
const PAGE_TOOLS_START = "<!-- cg-nav:page-tools: this page's own tools, kept as they are -->", PAGE_TOOLS_END = "<!-- cg-nav:page-tools-end -->";

/* The hub a page sits in: the one that is open. */
export const hubOf = page => page.hub
  || (page.current && (HUBS.find(h => h.items.some(i => i.key === page.current)) || {}).id)
  || (page.current === "hub" || MODULES.some(m => m.slug === page.current) ? "resources" : null);

export function sidebar(page, pageTools){
  const P = prefixOf(page.file), cur = page.current, open = hubOf(page);
  const link = (href, label, key, icon) => `    <li><a href="${P}${href}"${here(cur === key)}>${icon ? svg(ICON[icon], 14, "cg-sb-ico") : '<span class="cg-bullet" aria-hidden="true">&#x203A;</span>'}<span>${esc(label)}</span></a></li>`;
  const groups = GROUPS.map(g => `          <li class="cg-sb-grp"><span class="cg-sb-glabel" id="cgGrp-${g.id}">${esc(g.label)}</span>
            <ul aria-labelledby="cgGrp-${g.id}">
${MODULES.filter(m => m.group === g.id).map(m => "      " + link(moduleHref(m), m.label, m.slug, m.icon)).join("\n")}
            </ul></li>`).join("\n");
  const group = (h, inner) => `    <li class="cg-hub-li" data-hub="${h.id}">
      <details class="cg-sb-acc cg-hub" id="cgHub-${h.id}"${open === h.id ? " open data-here" : ""}>
        <summary class="cg-sb-section cg-sb-acc-head">${svg(ICON[h.icon], 15, "cg-sb-ico", 2.2)}<span class="cg-sb-acc-title">${esc(h.label)}</span>${svg(ICON.chevron, 14, "cg-sb-chev")}</summary>
        <ul class="cg-sb-sub">
${inner}
        </ul>
      </details>
    </li>`;
  const single = (h, it) => `    <li class="cg-hub-li" data-hub="${h.id}"><a href="${P}${it.href}"${here(cur === it.key, "cg-hub-link")}>${svg(ICON[h.icon], 15, "cg-sb-ico", 2.2)}<span>${esc(h.label)}</span></a></li>`;
  const hubs = HUBS.map(h => {
    if (h.id === "resources") return group(h, `${link(HUB.href, "Browse all resources", "hub", "grid").replace("<a ", '<a data-hub-index ')}
${groups}`);
    if (h.items.length === 1) return single(h, h.items[0]);
    const links = h.items.map(it => link(it.href, it.label, it.key, it.icon)).join("\n");
    const tools = h.id === "today" && pageTools ? '\n    <li><div class="cg-sb-divider"></div></li>\n' + PAGE_TOOLS_START + "\n    " + pageTools.trim() + "\n" + PAGE_TOOLS_END : "";
    return group(h, links + tools);
  }).join("\n");
  return `${START}
<button type="button" class="cg-sidebar-toggle" id="cgSbToggle" aria-label="Open Menu" aria-controls="cgSidebar" aria-expanded="false">
  ${svg(ICON.menu, 20, "", 2.2)}
  <span class="cg-sidebar-toggle-text">Menu</span>
</button>
<div class="cg-sb-overlay" id="cgSbOverlay" aria-hidden="true"></div>
<aside class="cg-sidebar" id="cgSidebar" aria-label="Site navigation">
  <a href="${P}index.html" class="cg-sidebar-brand">
    <img src="${P}assets/cognicopia-logo.jpg" alt="Cognicopia Logo">
    <span>Cognicopia</span>
  </a>
  <nav class="cg-sb-nav" aria-label="Sections">
  <ul class="cg-sidebar-nav cg-hubs">
${hubs}
    <li class="cg-hub-foot"><a href="${P}${CONTACT.href}"${here(cur === CONTACT.key)}>${svg(ICON[CONTACT.icon], 14, "cg-sb-ico")}<span>${esc(CONTACT.label)}</span></a></li>
  </ul>
  </nav>
</aside>
<script id="cg-nav-js">
(function(){
  "use strict";
  var toggle = document.getElementById("cgSbToggle"), sidebar = document.getElementById("cgSidebar"), overlay = document.getElementById("cgSbOverlay");
  if (toggle && sidebar && overlay){
    var open = function(){ sidebar.classList.add("is-open"); overlay.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); toggle.setAttribute("aria-label", "Close Menu"); };
    var close = function(){ sidebar.classList.remove("is-open"); overlay.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Open Menu"); };
    toggle.addEventListener("click", function(){ sidebar.classList.contains("is-open") ? close() : open(); });
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && sidebar.classList.contains("is-open")){ close(); toggle.focus(); } });
  }
  /* One hub open at a time: opening a hub closes the others. In the Menu drawer the one holding this page starts open; across the top of a wide
     window every drop-down starts closed (that hub is underlined instead), and a click elsewhere, Escape or moving the keyboard on closes it.
     Without scripts every hub can still be opened. */
  var hubs = [].slice.call(document.querySelectorAll("details.cg-hub"));
  hubs.forEach(function(d){
    d.addEventListener("toggle", function(){ if (d.open) hubs.forEach(function(o){ if (o !== d && o.open) o.open = false; }); });
  });
  var wide = window.matchMedia ? window.matchMedia("(min-width:1100px)") : { matches: false };
  var settle = function(){ hubs.forEach(function(d){ d.open = !wide.matches && d.hasAttribute("data-here"); }); };
  settle();
  if (wide.addEventListener) wide.addEventListener("change", settle);
  document.addEventListener("click", function(e){ if (wide.matches) hubs.forEach(function(d){ if (d.open && !d.contains(e.target)) d.open = false; }); });
  document.addEventListener("keydown", function(e){
    if (e.key !== "Escape" || !wide.matches) return;
    hubs.forEach(function(d){ if (d.open){ d.open = false; d.querySelector("summary").focus(); } });
  });
  hubs.forEach(function(d){
    d.addEventListener("focusout", function(e){ if (wide.matches && d.open && e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false; });
  });
})();
</script>
${END}`;
}

/* The Packet Builder's navigation: the same six hubs in its own markup and
   classes (the page's styles and script own the look and the behavior). Its
   hooks stay as the page uses them: #catNav, #navPacket, #navCount, #navColoringCount,
   .sb-link[data-route]. Activity Packets holds the activity categories (drawn
   by the page, with counts) and the queue; Resources is two links; Contact is a footer link, not a hub. */
export const BNAV_START = "<!-- cg-bnav:start: generated by scripts/site-nav.mjs. Edit that file and run npm run nav; changes made here are overwritten. -->";
export const BNAV_END = "<!-- cg-bnav:end -->";
export function builderSidebar(){
  const ico = (name, size) => svg(ICON[name], size || 18, "", 2);
  const link = it => `        <li><a class="sb-link"${it.route ? ` href="#/${it.route}" data-route="${it.route}"` : ` href="${it.href}"`}>${ico(it.icon)}<span>${esc(it.label)}</span>${it.route === "coloring" ? '<span class="tag live" id="navColoringCount"></span>' : ""}</a></li>`;
  const group = (h, inner, openNow) => `    <details class="sb-hub" data-hub="${h.id}"${openNow ? " open" : ""}>
      <summary class="sb-hub-head">${ico(h.icon, 20)}<span>${esc(h.label)}</span>${svg(ICON.chevron, 14, "sb-hub-chev", 2.2)}</summary>
${inner}
    </details>`;
  const hubs = HUBS.map(h => {
    if (h.id === "packets") return group(h, `      <ul class="sb-list" id="catNav" aria-label="Activity categories"></ul>
      <ul class="sb-list">
        <li><button class="sb-link" type="button" id="navPacket">${ico("builder")}<span>Packet queue</span><span class="badge" id="navCount">0</span></button></li>
      </ul>`, true);
    if (h.id === "academy") { const it = h.items[0]; return `    <a class="sb-link sb-hub-link" data-hub="${h.id}" href="#/${it.route}" data-route="${it.route}">${ico(h.icon, 20)}<span>${esc(h.label)}</span></a>`; }
    if (h.id === "resources") return group(h, `      <ul class="sb-list">
${[{ label: HUB.title, href: HUB.href, icon: "library" }, { label: RESEARCH.label, href: moduleHref(RESEARCH), icon: "microscope" }].map(link).join("\n")}
      </ul>`);
    return group(h, `      <ul class="sb-list">
${h.items.map(link).join("\n")}
      </ul>`);
  }).join("\n");
  return `${BNAV_START}
<aside class="sidebar" id="sidebar" aria-label="Packet Builder navigation">
  <a class="brand" href="#/">
    <img src="assets/cognicopia-logo.jpg" alt="">
    <span><b>Cognicopia</b><small>Packet Builder</small></span>
  </a>
  <nav class="sb-nav" aria-label="Sections">
${hubs}
    <ul class="sb-list sb-foot">
${link(CONTACT)}
    </ul>
  </nav>
</aside>
${BNAV_END}`;
}

export function crumbs(page){
  if (!page.crumbs) return "";
  const P = prefixOf(page.file), m = page.crumbs[0], doc = page.crumbs[1];   // a module, and a page inside it (the Research Center's documents)
  const items = [`<li><a href="${P}index.html">${svg(ICON.home, 13)}Dashboard</a></li>`,
    m ? `<li><a href="${P}${HUB.href}">${esc(HUB.title)}</a></li>` : `<li><span aria-current="page">${esc(HUB.title)}</span></li>`]
    .concat(m && doc ? [`<li><a href="${P}${moduleHref(m)}">${esc(m.label)}</a></li>`, `<li><span aria-current="page">${esc(doc.label)}</span></li>`]
      : m ? [`<li><span aria-current="page">${esc(m.label)}</span></li>`] : []);
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
/* Site navigation: the six hubs, breadcrumbs and the top bar's buy links.
   On a wide window (1100 px and up) the six hubs run across a light top bar,
   each a drop-down; on anything narrower they are the Menu drawer. The markup
   is the same at every width (one <aside>, the hubs as <details>), so a
   keyboard, a screen reader and the checks meet one structure.
   Every link and button is at least 52 px (--tap) tall, for touchscreens.
   Generated by scripts/site-nav.mjs; the sidebar's base styles stay in each page
   and are overridden here (html:root and "html body" outrank them).
   Several pages set "color: #fff !important" and "p, li { font-size }" on every
   element, so the parts added here pin their own colors and sizes to look the
   same on every page. Colors come from css/styles.css (light: charcoal text on
   white, 16:1; deep green accents, 7.9:1 or more). */
html:root{--sb-w:0px;--sb-bg:#ffffff;--sb-border:#ddd1ba;--sb-accent:#2d5a44;--sb-hover:#f4efe6;--sb-open:#ebe3d3;--sb-active:#e3f1e8;
  --sb-txt:#1a202c;--sb-muted:#343b49;--cg-nav-h:68px}
html body{padding-left:0}
.cg-sb-nav{flex:1 0 auto;display:flex;flex-direction:column}
.cg-sb-nav .cg-sidebar-nav{flex:1}
.cg-sidebar-nav a{min-height:var(--tap,52px);align-items:center}
.cg-sidebar-home{min-height:var(--tap,52px)}
.cg-sidebar-toggle{height:var(--tap,52px)!important;min-width:var(--tap,52px)}
.cg-sb-acc > summary{min-height:var(--tap,52px);box-sizing:border-box;display:flex;align-items:center}
.cg-hub-li{margin:0;list-style:none}
.cg-hub > summary,.cg-sidebar-nav a.cg-hub-link{display:flex;align-items:center;gap:10px;box-sizing:border-box;min-height:var(--tap,52px);margin:3px 6px 0;padding:8px 10px;border:0;border-radius:8px;font:700 11.5pt/1.25 var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)!important;letter-spacing:0!important;text-transform:none!important;color:var(--sb-txt)!important;text-decoration:none;cursor:pointer}
.cg-hub > summary:hover,.cg-sidebar-nav a.cg-hub-link:hover{background:var(--sb-hover)}
.cg-hub[open] > summary{background:var(--sb-open)}
.cg-sidebar-nav a.cg-hub-link.active{background:var(--sb-active);box-shadow:inset 3px 0 0 var(--sb-accent)}
/* the light theme for what each page's own sidebar styles drew for a dark one */
html body .cg-sidebar{background:var(--sb-bg);border-color:var(--sb-border);color:var(--sb-txt);-webkit-backdrop-filter:none;backdrop-filter:none}
html body .cg-sidebar-brand{color:var(--cg-green-700,#1b382b)!important;font:600 23px/1.1 var(--cg-font-display,Georgia,serif)!important;letter-spacing:-.01em}
html body .cg-sidebar-brand:hover{color:var(--cg-green-600,#2d5a44)!important}
html body .cg-sidebar-nav a{color:var(--sb-txt)!important;font-family:var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)}
html body .cg-sidebar-nav a:hover{background:var(--sb-hover);color:var(--sb-txt)!important}
html body .cg-sidebar-nav a.active{background:var(--sb-active);color:var(--cg-green-700,#1b382b)!important;font-weight:700}
html body .cg-sidebar .cg-sb-section{color:var(--sb-muted)!important}
html body .cg-sidebar .cg-hub > summary{color:var(--sb-txt)!important}
html body .cg-sidebar details{border:0;margin:0}
/* some pages paint every span and li white (!important); inside the navigation they take the color of the link they sit in */
html body .cg-sidebar :is(span,li,strong,em,b){color:inherit!important}
html body .cg-sidebar .cg-ailment-card{color:var(--sb-txt)!important;font-family:var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)}
html body .cg-sidebar .cg-ailment-card:hover{background:var(--sb-hover);color:var(--sb-txt)!important;border-color:var(--sb-border)}
html body .cg-sidebar .cg-ailment-card.active-ailment{background:var(--sb-active);color:var(--cg-green-700,#1b382b)!important;border-color:var(--sb-accent)}
html body .cg-sidebar .cg-ailment-card:focus-visible{outline:3px solid var(--cg-focus,#f5b800);outline-offset:2px;box-shadow:0 0 0 6px var(--cg-focus-dark,#10241a)}
.cg-hub .cg-sb-ico,.cg-sidebar-nav a.cg-hub-link .cg-sb-ico{color:var(--sb-accent)}
.cg-hub > .cg-sb-sub{padding:2px 0 8px}
.cg-hubs{padding-top:6px}
.cg-hub-foot{margin:8px 0 0;padding-top:6px;border-top:1px solid var(--sb-border,rgba(216,243,220,.15));list-style:none}
.cg-sidebar-nav a .cg-sb-ico{flex:none;margin-top:1px;color:var(--sb-muted);transition:color .13s}
.cg-sidebar-nav a:hover .cg-sb-ico,.cg-sidebar-nav a.active .cg-sb-ico{color:var(--sb-accent)}
.cg-sb-acc > summary{list-style:none;cursor:pointer;margin:4px 6px 0;padding:10px 8px 8px;border-radius:6px;transition:background .15s}
.cg-sb-acc > summary::-webkit-details-marker{display:none}
.cg-sb-acc > summary:hover{background:var(--sb-hover)}
.cg-sb-acc > summary:focus-visible,.cg-sidebar-nav a:focus-visible,.cg-sidebar-brand:focus-visible{outline:3px solid var(--cg-focus,#f5b800);outline-offset:2px;box-shadow:0 0 0 6px var(--cg-focus-dark,#10241a)}
.cg-sb-acc-title{flex:1;min-width:0}
.cg-sb-count{flex:none;min-width:18px;padding:1px 6px;border-radius:9px;background:rgba(82,183,136,.2);color:var(--sb-txt)!important;font-size:8pt;letter-spacing:0;text-align:center}
.cg-sb-chev{flex:none;transition:transform .15s}
.cg-sb-acc[open] > summary .cg-sb-chev{transform:rotate(90deg)}
.cg-sb-sub,.cg-sb-sub ul{list-style:none;margin:0;padding:0}
.cg-sb-sub a[data-hub]{font-weight:600}
.cg-sb-glabel{display:block;padding:10px 14px 3px 20px;font:700 12px var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--sb-muted)!important}
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
/* the action bar under the navigation: light, like the navigation, with the buy links in the brand's deep green */
.cg-topbar{height:auto!important;min-height:52px;flex-wrap:wrap;row-gap:6px;padding-top:8px;padding-bottom:8px}
html body .cg-topbar{background:#fbf8f2;border-bottom:1px solid var(--sb-border);-webkit-backdrop-filter:none;backdrop-filter:none}
html body .cg-topbar a,html body .cg-topbar button.linklike{color:var(--sb-txt)}
.cg-topbar .cg-cta{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:var(--tap,52px);padding:8px 18px;border:2px solid var(--cg-green-700,#1b382b);border-radius:var(--cg-radius-md,12px);background:var(--cg-green-700,#1b382b);color:#ffffff!important;font:700 15px/1.25 var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif);text-align:center;text-decoration:none;box-shadow:var(--cg-shadow-1,0 1px 2px rgba(0,0,0,.22))}
.cg-topbar .cg-cta:hover{background:var(--cg-green-600,#2d5a44);border-color:var(--cg-green-600,#2d5a44)}
.cg-topbar .cg-cta-alt{background:#ffffff;border-color:var(--cg-green-700,#1b382b);color:var(--cg-green-700,#1b382b)!important;box-shadow:none}
.cg-topbar .cg-cta-alt:hover{background:var(--cg-sage-100,#e3f1e8);border-color:var(--cg-green-700,#1b382b)}
.cg-topbar .cg-cta:focus-visible{outline:3px solid var(--cg-focus,#f5b800);outline-offset:3px;box-shadow:0 0 0 6px var(--cg-focus-dark,#10241a)}
html.cg-night-shift .cg-topbar .cg-cta{background:#332312!important;border-color:#d6a64b!important;color:#ffedcc!important;box-shadow:none}
html.cg-night-shift .cg-topbar .cg-cta-alt{background:transparent!important;border-color:#9b7136!important;color:#ffedcc!important}
html.cg-night-shift .cg-topbar .cg-cta:focus-visible{outline-color:#ffd477}
@media print{.cg-topbar .cg-cta{display:none}}

/* ---------- a wide window: the six hubs across the top, each a drop-down ---------- */
@media (min-width:1100px){
  html body .cg-sidebar{position:sticky;top:0;left:auto;z-index:950;width:auto;height:var(--cg-nav-h);flex-direction:row;align-items:center;gap:20px;
    padding:0 max(24px,calc(50% - 640px));border-right:0;border-bottom:1px solid var(--sb-border);overflow:visible;transform:none;
    box-shadow:0 1px 0 rgba(255,255,255,.9),0 8px 24px rgba(79,64,48,.07)}
  html body .cg-sidebar-brand{flex:none;gap:10px;padding:0;border:0;min-height:var(--tap,52px)}
  html body .cg-sidebar-brand img{width:36px;height:30px}
  html body .cg-sb-nav{flex:1 1 auto;flex-direction:row;align-items:center;min-width:0}
  html body .cg-sidebar-nav.cg-hubs{display:flex;flex-direction:row;align-items:center;gap:2px;flex:1;padding:0;margin:0}
  .cg-hubs > .cg-hub-li{position:relative}
  .cg-hubs > .cg-hub-li > .cg-hub > summary,.cg-hubs > .cg-hub-li > a.cg-hub-link{margin:0;padding:8px 14px;white-space:nowrap;border-radius:10px;box-shadow:none;
    font:600 16px/1.2 var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)!important}
  .cg-hubs > .cg-hub-li > .cg-hub > summary .cg-sb-ico,.cg-hubs > .cg-hub-li > a.cg-hub-link .cg-sb-ico{display:none}
  .cg-hubs > .cg-hub-li > .cg-hub > summary .cg-sb-chev{transform:rotate(90deg);color:var(--sb-accent)}
  .cg-hubs > .cg-hub-li > .cg-hub[open] > summary .cg-sb-chev{transform:rotate(-90deg)}
  /* the hub that holds this page: a deep green underline, and its name in green */
  html body .cg-hubs > .cg-hub-li > .cg-hub[data-here] > summary,html body .cg-hubs > .cg-hub-li > a.cg-hub-link.active{color:var(--cg-green-700,#1b382b)!important;background:transparent;box-shadow:inset 0 -3px 0 var(--sb-accent)}
  .cg-hubs > .cg-hub-li > .cg-hub[open] > summary{background:var(--sb-open)}
  /* a drop-down */
  .cg-hubs > .cg-hub-li > .cg-hub > .cg-sb-sub{position:absolute;top:calc(100% + 10px);left:0;z-index:960;box-sizing:border-box;min-width:300px;
    max-height:calc(100vh - var(--cg-nav-h) - 24px);overflow:auto;padding:8px;background:#ffffff;border:1px solid var(--sb-border);border-radius:16px;
    box-shadow:0 18px 48px rgba(79,64,48,.18),0 4px 12px rgba(79,64,48,.08)}
  .cg-hub .cg-sb-sub a,.cg-hub .cg-sb-sub .cg-ailment-card{gap:12px;margin:0;padding:10px 14px;border:0;border-radius:10px;
    font:500 16px/1.3 var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)!important;white-space:normal}
  html body .cg-hub .cg-sb-sub a.active{box-shadow:inset 3px 0 0 var(--sb-accent)}
  .cg-hub .cg-sb-sub .cg-sb-ico{width:18px;height:18px}
  .cg-hub .cg-sb-sub .cg-ailment-card{width:100%}
  .cg-hub .cg-sb-sub .cg-sb-section{padding:12px 14px 4px;font-size:12px}
  .cg-hub .cg-sb-sub .cg-sb-divider{margin:6px 8px}
  /* Resources: a wide panel, the library in its three groups */
  .cg-hubs > .cg-hub-li[data-hub="resources"] > .cg-hub > .cg-sb-sub{left:auto;right:0;width:min(880px,calc(100vw - 48px));display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 16px;padding:16px}
  .cg-hubs > .cg-hub-li[data-hub="resources"] > .cg-hub > .cg-sb-sub > li:first-child{grid-column:1/-1}
  .cg-hub-foot{margin:0 0 0 auto;padding:0;border:0}
  html body .cg-hub-foot a{margin:0;padding:8px 14px;border:0;border-radius:10px;white-space:nowrap;font:600 16px/1.2 var(--cg-font-ui,"Trebuchet MS","Segoe UI",sans-serif)}
  .cg-hub-foot .cg-sb-ico{display:none}
  .cg-sidebar-toggle,.cg-sb-overlay{display:none!important}
  /* the action bar scrolls away under the navigation; the packet tool's, which carries Instant Soothe, stays in reach */
  html body .cg-topbar{position:relative;top:auto}
  html body .cg-topbar:has(.arb-sticky-crisis){position:sticky;top:var(--cg-nav-h)}
}

/* ---------- anything narrower: the same hubs in the Menu drawer ---------- */
@media (max-width:1099px){
  html body .cg-sidebar{position:fixed;top:0;left:0;z-index:900;width:min(320px,86vw);height:100vh;padding-top:68px;transform:translateX(-100%);
    transition:transform .22s ease;box-shadow:6px 0 32px rgba(26,32,44,.28);border-right:1px solid var(--sb-border)}
  html body .cg-sidebar.is-open{transform:translateX(0)}
  html body .cg-sidebar-toggle{display:flex;position:fixed;top:10px;left:12px;z-index:1100;width:auto;gap:8px;padding:8px 14px;
    background:var(--cg-green-700,#1b382b);color:#ffffff;border:2px solid var(--cg-green-700,#1b382b);border-radius:10px;
    font:700 15px/1 var(--cg-font-ui,"Segoe UI",system-ui,sans-serif)}
  html body .cg-sidebar-toggle svg{color:#ffffff}
  .cg-sb-overlay{display:none;position:fixed;inset:0;z-index:850;background:rgba(26,32,44,.45)}
  .cg-sb-overlay.is-open{display:block}
}
/* the Menu button floats over the start of the action bar: keep that place clear (each page's own style already does it on a phone) */
@media (min-width:701px) and (max-width:1099px){html body .cg-topbar{padding-left:128px}}
@media (prefers-reduced-motion:reduce){html body .cg-sidebar{transition:none}}

/* ---------- Night Shift: the bar, its drop-downs and the action bar after dark (complete here, so a page that
   does not run assets/services/nightShift.js still gets a readable bar) ---------- */
html.cg-night-shift body .cg-sidebar,html.cg-night-shift body .cg-topbar{background:#211910!important;border-color:#684a26!important;box-shadow:none}
html.cg-night-shift body .cg-sidebar a,html.cg-night-shift body .cg-topbar a,html.cg-night-shift body .cg-topbar button.linklike{color:#ffedcc!important}
html.cg-night-shift body .cg-sidebar a:hover,html.cg-night-shift body .cg-hub[open] > summary{background:#3a2917!important}
html.cg-night-shift .cg-sidebar-brand{color:#ffedcc!important}
html.cg-night-shift .cg-hub > .cg-sb-sub{background:#211910!important;border-color:#684a26!important}
html.cg-night-shift .cg-sidebar-nav a.active,html.cg-night-shift .cg-sidebar .cg-ailment-card.active-ailment{background:#3a2917!important;color:#fff1cf!important}
html.cg-night-shift .cg-sidebar .cg-ailment-card,html.cg-night-shift .cg-sidebar .cg-sb-section,html.cg-night-shift .cg-sidebar .cg-sb-glabel{color:#ffedcc!important}
html.cg-night-shift .cg-sidebar .cg-ailment-card:hover{background:#3a2917!important}
html.cg-night-shift body .cg-sidebar .cg-hub > summary,html.cg-night-shift body .cg-hubs > .cg-hub-li > .cg-hub[data-here] > summary,html.cg-night-shift body .cg-hubs > .cg-hub-li > a.cg-hub-link.active{color:#ffedcc!important}
html.cg-night-shift body .cg-hubs > .cg-hub-li > .cg-hub[data-here] > summary,html.cg-night-shift body .cg-hubs > .cg-hub-li > a.cg-hub-link.active{box-shadow:inset 0 -3px 0 #d6a64b}
html.cg-night-shift .cg-sb-ico,html.cg-night-shift .cg-sb-chev{color:#d6a64b!important}
html.cg-night-shift .cg-sidebar-toggle{background:#332312!important;border-color:#d6a64b!important;color:#ffedcc!important}
@media print{.cg-sidebar,.cg-sidebar-toggle,.cg-sb-overlay{display:none!important}}
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
  if (page.builder){                                   // the Packet Builder: only the navigation inside its sidebar is generated
    const block = builderSidebar(), old = between(s, BNAV_START.slice(0, 18), BNAV_END);
    if (old) return withDesign(s.slice(0, old.i) + block + s.slice(old.j), page);
    const i = s.indexOf('<aside class="sidebar" id="sidebar"'), j = s.indexOf("</aside>", i);   // the first time: the handwritten sidebar
    if (i < 0 || j < 0) throw new Error(page.file + ": no sidebar found");
    return withDesign(s.slice(0, i) + block + s.slice(j + "</aside>".length), page);
  }
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
  // the top bar's two buy links
  if (!page.ownTopbar){
    const cta = ctaBlock(page), oldCta = between(out, CTA_START, CTA_END);
    if (oldCta) out = out.slice(0, oldCta.i) + cta + out.slice(oldCta.j);
    else {
      const t = out.indexOf('<div class="cg-topbar"'), open = t < 0 ? -1 : out.indexOf(">", t) + 1, close = t < 0 ? -1 : out.indexOf("</div>", t);
      if (t < 0 || close < 0 || out.slice(open, close).indexOf("<div") >= 0) throw new Error(page.file + ": top bar not found");
      out = out.slice(0, open) + "\n  " + cta + "\n" + out.slice(close);
    }
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
  // the license manager: the Promo Code button and badge in the top bar, and one answer to "is this computer licensed?"
  const lic = licenseBlock(page), oldLic = between(out, LICENSE_START, LICENSE_END);
  if (oldLic) out = out.slice(0, oldLic.i) + lic + out.slice(oldLic.j);
  else out = out.replace("</head>", lic + "\n</head>");
  return withDesign(out, page);
}

/* ---------- 4. Proof: the six hubs are the same everywhere and lead somewhere real ---------- */
export function validate(){
  const problems = [], read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
  const ids = HUBS.map(h => h.id).join(",");
  // every place a hub points exists, and every Packet Builder route is a route the page has
  const table = /const routes = \{([^}]*)\}/.exec(read("builder.html"));
  const routes = new Set(table ? [...table[1].matchAll(/"([a-z]*)"\s*:/g)].map(m => m[1]) : []);
  if (!routes.size) problems.push("builder.html: could not read its routes table");
  for (const it of HUBS.flatMap(h => h.items).concat([CONTACT])){
    const file = it.href.replace(/[?#].*$/, "") || "index.html";
    if (!fs.existsSync(path.join(ROOT, file))) problems.push(`${it.label}: ${file} does not exist`);
    if (it.route && !routes.has(it.route)) problems.push(`${it.label}: the Packet Builder has no route "${it.route}"`);
  }
  let links = 0;
  for (const page of PAGES){
    const f = path.join(ROOT, page.file); if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, "utf8"), a = html.indexOf(page.builder ? BNAV_START.slice(0, 18) : START.slice(0, 16)), b = html.indexOf(page.builder ? BNAV_END : END, a);
    if (a < 0 || b < 0){ problems.push(`${page.file}: no generated navigation block`); continue; }
    if (!html.includes(`<link rel="stylesheet" href="${prefixOf(page.file)}css/styles.css">`)) problems.push(`${page.file}: does not link css/styles.css`);
    const block = html.slice(a, b), got = [...block.matchAll(/data-hub="([a-z]+)"/g)].map(m => m[1]).join(",");
    if (got !== ids) problems.push(`${page.file}: the hubs are ${got || "missing"}, not ${ids}`);
    if (page.builder){
      const used = [...block.matchAll(/data-route="([a-z]+)"/g)].map(m => m[1]), want = HUBS.flatMap(h => h.items).filter(i => i.route).map(i => i.route);
      used.filter(r => !routes.has(r)).forEach(r => problems.push(`${page.file}: a link goes to the route "${r}", which the page does not have`));
      want.filter(r => !used.includes(r)).forEach(r => problems.push(`${page.file}: no link to the route "${r}"`));
      links += used.length;
    } else {
      const open = hubOf(page), here = (block.match(/<details[^>]*\sdata-here\b/g) || []).length, cur = (block.match(/aria-current="page"/g) || []).length;
      const isGroup = open && HUBS.find(h => h.id === open) && (open === "resources" || HUBS.find(h => h.id === open).items.length > 1);
      if (isGroup && !new RegExp(`id="cgHub-${open}"[^>]*\\bopen\\b`).test(block)) problems.push(`${page.file}: the ${open} hub should be open and is not`);
      if (here !== (isGroup ? 1 : 0)) problems.push(`${page.file}: ${here} hubs are marked as the one holding this page (expected ${isGroup ? 1 : 0})`);
      if (cur !== (page.current ? 1 : 0)) problems.push(`${page.file}: ${cur} links are marked as the current page (expected ${page.current ? 1 : 0})`);
      links += (block.match(/<a /g) || []).length;
    }
  }
  return { problems, links };
}

/* ---------- 5. Command line ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])){
  const check = process.argv.includes("--check"), stale = [];
  for (const page of PAGES){
    const f = path.join(ROOT, page.file);
    if (!fs.existsSync(f)){ stale.push(page.file + " (missing)"); continue; }
    const s = fs.readFileSync(f, "utf8"), out = render(s, page);
    if (out !== s){ if (check) stale.push(page.file); else { fs.writeFileSync(f, out); console.log("updated " + page.file); } }
  }
  if (check && stale.length){ console.error("Navigation out of date in: " + stale.join(", ") + ". Run: npm run nav"); process.exit(1); }
  const { problems, links } = validate();
  if (problems.length){ console.error("Navigation problems:\n  - " + problems.join("\n  - ")); process.exit(1); }
  if (check) console.log("Navigation is current on all " + PAGES.length + " pages: the same " + HUBS.length + " hubs, one open, " + links + " links checked.");
}
