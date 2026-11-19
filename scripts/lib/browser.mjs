/* =====================================================================
   Browser helpers for the scripts that drive a real page: where Playwright
   is, and a static server for the repository on a free local port. They
   make no request but to that port. Node built-ins only.
   ===================================================================== */
import fs from "fs";
import http from "http";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Playwright is not a dependency of the repository (the checks that run in npm test need no browser). It is found in
   node_modules, or where the cloud sandbox keeps it. Exit code 2 means "not installed here": callers may skip. */
export function loadPlaywright(){
  for (const base of [ROOT + "/", "/opt/node22/lib/node_modules/", "/usr/lib/node_modules/", "/usr/local/lib/node_modules/"]){
    try { return createRequire(base)("playwright"); } catch (e) { /* try the next place */ }
  }
  console.error("Playwright was not found. Install it (npm install --no-save playwright) or run where it is available.");
  process.exit(2);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain" };

/* A browser where the staff member has already agreed to the terms. Since the owner's playbook (Phase 2) the agreement
   is asked in a window at the first print or PDF on a computer (js/legal.js); a check about something else starts past
   it, as a returning staff member would. scripts/check-terms.mjs is the one that proves the window itself.
   Use: const ctx = await browser.newContext({...}); await agreed(ctx); */
export const TERMS_KEY = "cognicopia_eula_accepted";
export async function agreed(ctx){
  await ctx.addInitScript(k => { try { localStorage.setItem(k, "true"); } catch (e) { /* storage blocked: nothing to set */ } }, TERMS_KEY);
  return ctx;
}

/* A person who agrees to every question the page asks. The site asks its questions in its own windows (js/dialogs.js, CogniDialog) and not with the
   browser's confirm(), so Playwright's "dialog" event never fires for them: this presses "yes" in each one as it opens, the way
   p.on("dialog", d => d.accept()) used to. target: a context or a page; call it before the page loads. */
export async function agreeToDialogs(target){
  await target.addInitScript(() => {
    const press = () => { const y = document.querySelector("dialog.cg-dlg[open] .cg-dlg-yes"); if (y) setTimeout(() => { try { y.click(); } catch (e) { /* the window closed first */ } }, 30); };
    const start = () => new MutationObserver(press).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
  });
  return target;
}

/* Serve the repository: resolves { srv, base }. Close srv when done. */
export function serve(root = ROOT){
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, "127.0.0.1", () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
