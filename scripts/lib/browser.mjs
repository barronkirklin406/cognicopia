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
