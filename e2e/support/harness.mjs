/* =====================================================================
   The browser harness: starts the repository on a free local port, opens a
   page in a fresh Chromium context, and records everything that would make a
   visitor's page fail or break the offline-first promise.

   Recorded for every page (read them from opened.seen):
     pageErrors     an uncaught exception
     consoleErrors  console.error output that is not just a failed request
     badStatus      a request to this site that answered 400 or more (a 404)
     outside        a request to anywhere else: the three tools must make none
     mailto         a mailto: link the page tried to open
   Nothing here weakens a check: a problem is recorded, never filtered away.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, serve, ROOT } from "../../scripts/lib/browser.mjs";
import config from "../e2e.config.mjs";

export { config, ROOT };

/* Start the server and the browser. Always call close() (node:test: in an after() hook). */
export async function launch() {
  const { chromium } = loadPlaywright();       // exits with code 2 where Playwright is not installed
  const { srv, base } = await serve();
  const browser = await chromium.launch(config.launch);
  return { browser, base, async close() { await browser.close(); srv.close(); } };
}

/* opts: viewport ("laptop" | "phone" | { width, height }), night (Night Shift on), reducedMotion, route (a function given the context before navigation) */
export async function openPage(h, pagePath, opts = {}) {
  const viewport = typeof opts.viewport === "object" ? opts.viewport : config.viewports[opts.viewport || "laptop"];
  const context = await h.browser.newContext({ viewport, serviceWorkers: config.serviceWorkers, reducedMotion: opts.reducedMotion ? "reduce" : "no-preference", permissions: ["clipboard-read", "clipboard-write"] });
  const stored = Object.assign({}, config.storage, opts.night ? { [config.nightShiftKey]: "1" } : {});
  await context.addInitScript((kv) => { try { for (const k in kv) localStorage.setItem(k, kv[k]); } catch (e) { /* storage blocked */ } }, stored);
  if (opts.route) await opts.route(context);

  const page = await context.newPage();
  const seen = { pageErrors: [], consoleErrors: [], badStatus: [], outside: [], mailto: [] };
  page.on("pageerror", (e) => seen.pageErrors.push(String(e && e.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) seen.consoleErrors.push(m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(h.base)) seen.badStatus.push(r.status() + " " + r.url().slice(h.base.length)); });
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith(h.base) && !/^(data|blob|about):/.test(u) && !/^mailto:/.test(u)) seen.outside.push(r.method() + " " + u); });
  const cdp = await context.newCDPSession(page); await cdp.send("Page.enable");
  cdp.on("Page.frameRequestedNavigation", (e) => { if (/^mailto:/.test(e.url)) seen.mailto.push(decodeURIComponent(e.url)); });

  await page.goto(h.base + pagePath, { waitUntil: "load" });
  await page.waitForTimeout(opts.settle ?? config.timeouts.settle);
  return { page, context, seen, async close() { await context.close(); } };
}

/* The problems recorded so far, as one list of readable lines (empty means a clean page). */
export function problems(seen) {
  return [].concat(seen.pageErrors.map((x) => "page error: " + x), seen.consoleErrors.map((x) => "console error: " + x),
    seen.badStatus.map((x) => "failed request: " + x), seen.outside.map((x) => "request leaving the site: " + x));
}

/* A sideways scrollbar at this size? */
export const overflowsSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

/* Save a screenshot for a failing check, in the git-ignored artifacts folder. Returns the path. */
export async function snap(page, name) {
  const dir = path.join(ROOT, config.artifacts); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name.replace(/[^\w.-]+/g, "_") + ".png");
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}
