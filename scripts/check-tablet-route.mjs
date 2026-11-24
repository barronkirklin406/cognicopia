#!/usr/bin/env node
/* =====================================================================
   The Tablet Activities button never ends on a 404, in a real browser.
   Four cases, each against a small server that answers a missing file the way GitHub Pages does
   (status 404 with the body of 404.html):
     - normal: the Tablet Activities link in the top bar's Today door opens tablet.html and its menu shows
     - tablet.html missing: the same button, on the front page (index.html) and in the packet tool (packet.html),
       lands in the packet tool (packet.html) with Tablet Interactive Mode open
     - a mistyped tablet address (Tablet.html) lands there too
     - any other missing page shows the friendly 404 page with working links
   Also: the files a deploy needs for this exist (tablet.html, its two scripts, 404.html, sw.js, packet.html), and
   the top bar's Tablet Activities link on index.html and packet.html is written by scripts/site-nav.mjs. Nothing is requested from outside.

   Needs Playwright. Where it is missing this exits 2 and npm run build skips it.
   Run: node scripts/check-tablet-route.mjs
   ===================================================================== */
import fs from "fs";
import http from "http";
import path from "path";
import { loadPlaywright, ROOT } from "./lib/browser.mjs";

const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

for (const f of ["tablet.html", "js/tablet.js", "js/tabletEngine.js", "404.html", "sw.js", "packet.html"]) ok(fs.existsSync(path.join(ROOT, f)), `${f} is in the repository`);
const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const pkt = fs.readFileSync(path.join(ROOT, "packet.html"), "utf8");
ok(/id="cgHub-today"[\s\S]{0,2400}?href="tablet\.html"/.test(idx), "index.html: the top bar has Tablet Activities in the Today door (written by scripts/site-nav.mjs)");
ok(/id="cgHub-today"[\s\S]{0,2400}?href="tablet\.html"/.test(pkt), "packet.html: the top bar has Tablet Activities in the Today door (written by scripts/site-nav.mjs)");
ok(!/lp-btn-tablet/.test(idx), "the hero no longer carries a second Tablet Activities button: the link moved to the top bar");
ok(/\.id = "tabletMode"/.test(pkt) && /#tablet-fallback/.test(pkt), "packet.html holds Tablet Interactive Mode and opens it at #tablet-fallback");

const { chromium } = loadPlaywright();
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const serve = hide => new Promise(done => {
  const srv = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html";
    const f = path.join(ROOT, u);
    const exact = () => fs.readdirSync(path.dirname(f)).includes(path.basename(f));   /* GitHub Pages matches letter case; Windows and macOS disks do not */
    const missing = !f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory() || !exact() || (hide && u === "/tablet.html");
    if (missing){ r.writeHead(404, { "content-type": TYPES[".html"] }); r.end(fs.readFileSync(path.join(ROOT, "404.html"))); return; }
    r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(f).pipe(r);
  }).listen(0, "127.0.0.1", () => done({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
});

const browser = await chromium.launch();
async function visit(label, hide, start, click){
  const { srv, base } = await serve(hide);
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });   /* the top bar (1280 px and up), where the link is */
  const errors = [], outside = [];
  p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { if (!r.url().startsWith(base) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url()); });
  await p.goto(base + start); await p.waitForTimeout(700);
  if (click){ await p.click("#cgHub-today > summary"); await p.waitForTimeout(250); await p.click(click); await p.waitForTimeout(2200); }   // open the Today door, then its link
  const s = await p.evaluate(() => ({ path: location.pathname, menu: !!document.getElementById("tbMenu"), inpage: !!document.getElementById("tabletMode"), h1: (document.querySelector("h1") || {}).textContent || "", links: Array.from(document.querySelectorAll("main a")).map(a => a.getAttribute("href")) }));
  ok(errors.length === 0, `${label}: no script error (${errors[0] || ""})`);
  ok(outside.length === 0, `${label}: nothing is requested from outside the site (${outside[0] || ""})`);
  await p.close(); srv.close();
  return s;
}
try {
  const LINK = '#cgHub-today a[href="tablet.html"]';
  let s = await visit("normal", false, "/index.html", LINK);
  ok(s.path === "/tablet.html" && s.menu, "the top bar's link opens the tablet page and its menu shows");
  s = await visit("packet tool, normal", false, "/packet.html", LINK);
  ok(s.path === "/tablet.html" && s.menu, "the packet tool's top bar link opens the tablet page and its menu shows");
  s = await visit("tablet page missing", true, "/index.html", LINK);
  ok(s.path === "/packet.html" && s.inpage, "with tablet.html missing, the front page's link ends in Tablet Interactive Mode inside the packet tool (packet.html)");
  s = await visit("tablet page missing, from the packet tool", true, "/packet.html", LINK);
  ok(s.path === "/packet.html" && s.inpage, "with tablet.html missing, the packet tool's own link ends in Tablet Interactive Mode inside the packet tool (packet.html)");
  s = await visit("mistyped address", true, "/Tablet.html", null);
  ok(s.path === "/packet.html" && s.inpage, "a mistyped tablet address ends in Tablet Interactive Mode in the packet tool (packet.html) too");
  s = await visit("other missing page", true, "/nope.html", null);
  ok(/not here/i.test(s.h1) && s.links.includes("/index.html") && s.links.includes("/packet.html#tablet-fallback"), "any other missing page shows the friendly page with a way home and a way to the tablet mode in the packet tool (packet.html)");
} finally { await browser.close(); }

if (problems.length){ console.error(`tablet route check FAILED: ${problems.length} problem(s), ${passed} passed`); problems.forEach(m => console.error("  - " + m)); process.exit(1); }
console.log(`tablet route check passed: ${passed} checks in a real browser (the tablet button opens the tablet page, and falls back to the tablet mode in the packet tool (packet.html), never a 404)`);
