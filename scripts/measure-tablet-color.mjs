#!/usr/bin/env node
/* Prints the library pictures that have too few shapes for Color a Picture to offer: the list that belongs in COLOR_SKIP in
   js/tabletBanks.js. See scripts/lib/tablet-color-measure.mjs. Needs Playwright (not installed by npm; see docs/dev-setup.md). */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { measure, sparse, MIN_SHAPES, MAX_SHAPES } from "./lib/tablet-color-measure.mjs";
const { chromium } = loadPlaywright(), { srv, base } = await serve(), browser = await chromium.launch();
try {
  const page = await browser.newPage(); await page.goto(base + "tablet.html");
  const m = await measure(page), ids = Object.keys(m), over = ids.filter(id => Math.max(m[id][2], m[id][3]) > MAX_SHAPES);
  console.log(`${ids.length} pictures measured; fewer than ${MIN_SHAPES} shapes at a level the tablet uses:`);
  console.log(JSON.stringify(sparse(m)));
  console.log(over.length ? `more than ${MAX_SHAPES} shapes (too many to color): ${over.join(", ")}` : `none has more than ${MAX_SHAPES} shapes`);
} finally { await browser.close(); srv.close(); }
