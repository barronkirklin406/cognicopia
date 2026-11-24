#!/usr/bin/env node
/* =====================================================================
   The Zentangle Gallery's list of books (assets/zentangle/manifest.json), written from the folders in assets/zentangle/<book>/.

   The pictures themselves are made by scripts/zentangle-pages.py from the owner's Canva interior files (one book at a time); this script only counts what
   is on disk and attaches each book's plain title and group. A book that is on disk but not in BOOKS below is an error (add its line), and so is a book in
   BOOKS with no folder, so the manifest can never say something the folders do not.

   The owner's rule for what goes in (November 20, 2026): only the coloring designs of a book whose Canva title says "Interior" and also "ZTC" or "Zen
   Tangle". Never a cover, never a color test page, never a title page, never the crown ("Baron Crafts") brand pages, never a blank page. Those cannot be
   in a book folder: scripts/check-zentangle-gallery.mjs reads every picture to prove it.

   Run: node scripts/build-zentangle.mjs          (writes the manifest)
        node scripts/build-zentangle.mjs --check  (fails if the manifest is not what the folders say)
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/zentangle");
const FRIGHT = "Preview before offering";

/* slug, title, group (the order is the order on the screen), and a note for books whose subjects some residents or families may not welcome */
export const BOOKS = [
  ["dogs", "Dogs", "Pets and farm"], ["puppies", "Puppies", "Pets and farm"], ["kittens", "Kittens", "Pets and farm"],
  ["birds", "Birds", "Wild animals"], ["butterfly-summer", "Butterflies in Summer", "Wild animals"], ["insects", "Insects", "Wild animals"],
  ["frogs", "Frogs", "Wild animals"], ["turtles", "Turtles", "Wild animals"], ["reptiles", "Reptiles", "Wild animals"], ["wildlife", "Wild Life", "Wild animals"],
  ["lions", "Lions", "Wild animals"], ["grizzly-bears", "Grizzly Bears", "Wild animals"], ["african-rhino", "African Rhino", "Wild animals"],
  ["jellyfish", "Jellyfish", "The sea"], ["cephalopod", "Cephalopods", "The sea"], ["ocean-life", "Ocean Life", "The sea"],
  ["trees", "Trees", "Nature and seasons"], ["flowers", "Flowers and Flora", "Nature and seasons"], ["forest-nature", "Forest and Nature", "Nature and seasons"],
  ["urban-jungle", "Urban Jungle", "Nature and seasons"], ["autumn", "Autumn", "Nature and seasons"], ["christmas", "Christmas", "Nature and seasons"],
  ["dinosaurs", "Dinosaurs", "Long ago"], ["middle-ages", "Middle Ages", "Long ago"],
  ["unicorns", "Unicorns", "Fantasy"], ["dragons", "Dragons, Drakes and Wyverns", "Fantasy"], ["elven", "Elven", "Fantasy"], ["dwarven", "Dwarven", "Fantasy"],
  ["knights", "Knights", "Fantasy"],
  ["orcish", "Orcish", "Fantasy", FRIGHT, "Orcs and goblins, drawn in detail. Look through the pages first and choose the ones that suit the person."],
  ["zombie-nation", "Zombie Nation", "Fantasy", FRIGHT, "Zombies and other frightening figures, drawn in detail. Look through the pages first and choose only what suits the person; many residents will not want these."]
].map(([slug, title, group, note, why]) => ({ slug, title, group, ...(note ? { note, why } : {}) }));

const PAGE = /^\d\d\.webp$/;
export function read() {
  const on = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(d => fs.statSync(path.join(DIR, d)).isDirectory()).sort() : [];
  const known = BOOKS.map(b => b.slug), problems = [];
  for (const d of on) if (!known.includes(d)) problems.push(`assets/zentangle/${d}/ is a book with no line in BOOKS (scripts/build-zentangle.mjs)`);
  const books = [];
  for (const b of BOOKS) {
    if (!on.includes(b.slug)) { problems.push(`${b.slug}: no folder in assets/zentangle/`); continue; }
    const files = fs.readdirSync(path.join(DIR, b.slug)).filter(f => PAGE.test(f)).sort();
    const small = fs.existsSync(path.join(DIR, b.slug, "t")) ? fs.readdirSync(path.join(DIR, b.slug, "t")).filter(f => PAGE.test(f)).sort() : [];
    if (!files.length) problems.push(`${b.slug}: no pages`);
    files.forEach((f, i) => { if (f !== String(i + 1).padStart(2, "0") + ".webp") problems.push(`${b.slug}: pages must be numbered 01, 02, ... with no gap (found ${f} at place ${i + 1})`); });
    if (small.join() !== files.join()) problems.push(`${b.slug}: every page needs a small picture in t/ and nothing else (${files.length} pages, ${small.length} small)`);
    books.push({ ...b, pages: files.length });
  }
  return { problems, manifest: { version: 1, size: [1656, 2160], books } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { problems, manifest } = read();
  const text = JSON.stringify(manifest, null, 1) + "\n", file = path.join(DIR, "manifest.json");
  if (process.argv.includes("--check")) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (have !== text) problems.push("assets/zentangle/manifest.json is not what the folders say: run npm run zentangle");
  } else if (!problems.length) fs.writeFileSync(file, text);
  if (problems.length) { console.error("zentangle manifest FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
  console.log(`zentangle manifest ${process.argv.includes("--check") ? "is current" : "written"}: ${manifest.books.length} books, ${manifest.books.reduce((n, b) => n + b.pages, 0)} pages`);
}
