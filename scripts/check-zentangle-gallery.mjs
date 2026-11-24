#!/usr/bin/env node
/* =====================================================================
   The Zentangle Gallery's files (the owner's Zen Tangle coloring books, kept exactly as drawn): no browser needed. Run: node scripts/check-zentangle-gallery.mjs

     the list      assets/zentangle/manifest.json is what the folders say (scripts/build-zentangle.mjs), every book has its line, its title and its group, and
                   no title or note says cover, test, crown, Baron or Zentangle Coloring (the owner's exclusions of November 20, 2026)
     the pictures  every page is a lossless WebP (the print-exact form of a black and white picture) 1656 pixels wide and 3:4 to within a few percent (most are 1656 x 2160; a book drawn on a slightly taller page keeps its own page), each page has its small
                   picture, no file is a stray, no page is over 400 KB and the whole shelf stays under 260 MB so the repository stays workable
     the door      the Packets door lists it (HUBS in scripts/site-nav.mjs, the Ctrl+K index in js/nav-index.js), the Packet Builder routes it, and the offline
                   list carries its script and manifest
     the packet     the gallery's pages are a queue activity (zentangle-gallery-page) registered by builder.html, and printing waits for every picture to load
     the module    js/zentangleGallery.js makes no request to any other site and prints through BookUI.print (so a print counts as a packet)
   Whether a page is a real coloring design (not blank, not a test or title page) is read in a real browser by scripts/check-zentangle-ui.mjs.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { read, BOOKS } from "./build-zentangle.mjs";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/zentangle");
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const { problems: p0, manifest } = read();
p0.forEach(m => problems.push(m));
const have = fs.existsSync(path.join(DIR, "manifest.json")) ? fs.readFileSync(path.join(DIR, "manifest.json"), "utf8") : "";
ok(have === JSON.stringify(manifest, null, 1) + "\n", "assets/zentangle/manifest.json is not what the folders say: run npm run zentangle");
ok(manifest.books.length >= 20, `the shelf holds ${manifest.books.length} books`);

const BAD = /\b(cover|test|crown|baron|zentangle coloring|color test)\b/i;
for (const b of BOOKS) {
  ok(!BAD.test(b.title + " " + (b.note || "") + " " + (b.why || "")), `${b.slug}: its title or note carries a word the owner ruled out`);
  ok(!BAD.test(b.slug), `${b.slug}: the folder name carries a word the owner ruled out`);
}

/* a WebP's own header tells its kind and size: "VP8L" is the lossless kind */
function webp(file) {
  const fd = fs.openSync(file, "r"), b = Buffer.alloc(32); fs.readSync(fd, b, 0, 32, 0); fs.closeSync(fd);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8L") { const v = b.readUInt32LE(21); return { kind, w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  if (kind === "VP8 ") return { kind, w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return { kind, w: 0, h: 0 };
}
let bytes = 0, pages = 0, biggest = 0, wrongKind = 0, wrongSize = 0, thumbBad = 0;
for (const b of manifest.books) {
  for (let i = 1; i <= b.pages; i++) {
    const n = String(i).padStart(2, "0") + ".webp", f = path.join(DIR, b.slug, n), t = path.join(DIR, b.slug, "t", n);
    const st = fs.statSync(f); bytes += st.size; pages++; biggest = Math.max(biggest, st.size);
    const h = webp(f); if (!h || h.kind !== "VP8L") wrongKind++; else if (h.w !== manifest.size[0] || h.w / h.h < 0.73 || h.w / h.h > 0.78) wrongSize++;
    const th = webp(t); if (!th || th.w < 120 || th.w > 400 || Math.abs(th.w / th.h - 0.767) > 0.04) thumbBad++;
    bytes += fs.statSync(t).size;
  }
}
ok(wrongKind === 0, `${wrongKind} pages are not lossless WebP (print pictures must not be re-compressed)`);
ok(wrongSize === 0, `${wrongSize} pages are not ${manifest.size[0]} pixels wide and about 3:4`);
ok(thumbBad === 0, `${thumbBad} small pictures are missing, the wrong size or not 3:4`);
ok(biggest <= 400 * 1024, `the largest page is ${Math.round(biggest / 1024)} KB (limit 400 KB)`);
ok(bytes <= 260 * 1024 * 1024, `the shelf is ${Math.round(bytes / 1048576)} MB (limit 260 MB)`);

const nav = fs.readFileSync(path.join(ROOT, "scripts/site-nav.mjs"), "utf8"), idx = fs.readFileSync(path.join(ROOT, "js/nav-index.js"), "utf8");
ok(/key: "zentangle", +label: "Zentangle Gallery"[^}]*route: "zentangle"/.test(nav), "the Packets door does not list the Zentangle Gallery (HUBS in scripts/site-nav.mjs)");
ok(/"k":"zentangle"/.test(idx), "the Ctrl+K index does not carry the Zentangle Gallery: run npm run nav");
const bld = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
ok(/"zentangle": renderZentangle/.test(bld) && /js\/zentangleGallery\.js/.test(bld), "builder.html does not route #/zentangle or load js/zentangleGallery.js");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
ok(/js\/zentangleGallery\.js/.test(sw) && /assets\/zentangle\/manifest\.json/.test(sw), "sw.js does not keep the gallery's script and list for offline use");
const mod = fs.readFileSync(path.join(ROOT, "js/zentangleGallery.js"), "utf8");
ok(!/https?:\/\//.test(mod.replace(/\/\*[\s\S]*?\*\//g, "")), "js/zentangleGallery.js names another site");
ok(/print\(urls\.map\(sheet\)/.test(mod) && /deps\.print/.test(mod), "the gallery must print through BookUI.print (the packet count and the license gate)");
ok(/ACTIVITY\s*=\s*\{[\s\S]*id:\s*"zentangle-gallery-page"/.test(mod) && /ACT_INDEX\[window\.CogniZentangle\.ACTIVITY\.id\]/.test(bld) && /queue:\s*queueZentangle/.test(bld), "the gallery's pages must be a packet-queue activity that builder.html registers, so they can be added to a resident's packet");
ok(/function imagesReady/.test(bld) && /BookUI\.imagesReady\(root\)/.test(bld), "the print window must wait for pictures to load (a blank preview otherwise)");
ok(!/\bstaff\s*:\s*true/.test(mod), "a gallery print is a packet of pages for a resident, never a staff document");

console.log(problems.length ? `zentangle gallery check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")
  : `zentangle gallery check passed: ${passed} checks, ${manifest.books.length} books, ${pages} pages (${Math.round(bytes / 1048576)} MB, all lossless, 1656 wide)`);
process.exit(problems.length ? 1 : 0);
