#!/usr/bin/env node
/* =====================================================================
   js/pillar4-maintenance-agents.js in a real browser (Playwright; exit code 2 where it is not installed).

     compat    this browser reports full support, and the real behaviors (a dialog opens and closes, details
               toggles, a required field is invalid, a custom property sizes, :has() matches) all work
     cache     the real Cache API holds the site's own files with checksums, finds a changed file, prunes old versions
               and refuses another site's file
     backup    real WebCrypto makes and opens an encrypted backup of profiles saved through the real storage adapter
     monitor   long-task watching is available, and no request leaves the site
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), outside = [], errs = [];
  p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base + "index.html"); await p.waitForSelector("#previewPacketBtn"); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const m = await import("/js/pillar4-maintenance-agents.js"), p2 = await import("/js/pillar2-functionality-agents.js"), out = {};
    const dt = new m.DomCompatibilityTester(); out.report = dt.featureReport(window); out.smoke = dt.smokeTest(window);
    const cm = new m.OfflineCacheManager({ version: "ui-test" });
    out.pre = await cm.precache(["/index.html", "/css/styles.css", "/js/agent-orchestrator.js", "https://example.com/x.js", "/does-not-exist.js"]);
    out.verify1 = await cm.verify();
    const c = await caches.open(cm.cacheName()); await c.put("/css/styles.css", new Response("tampered")); out.verify2 = await cm.verify();
    await caches.open("cognicopia-old-one"); out.pruned = await cm.prune(); out.status = await cm.status();
    await caches.delete(cm.cacheName());
    const ls = p2.webStorage(localStorage, "p4ui_"), hub = new p2.ProfileHub({ storage: ls }), sen = new m.ProfileIntegritySentinel({ storage: ls, iterations: 5000 });
    const id = hub.save("Room 9", { preferredName: "Peggy" }); hub.addNote(id, "likes hymns");
    const snap = await sen.snapshot(), file = await sen.encrypt(snap, "a long passphrase"), open = await sen.decrypt(file, "a long passphrase"), wrong = await sen.decrypt(file, "not the passphrase");
    out.backup = { ok: open.ok && (await sen.verifySnapshot(open.bundle)).ok, wrong: wrong.ok, leaks: /Peggy|hymns/.test(file), check: sen.check().ok };
    for (const k of ls.keys()) ls.remove(k);
    const pf = new m.PerformanceProfiler(), lt = pf.observeLongTasks(window); out.longTasks = lt.supported; lt.stop();
    out.measure = await pf.measure(() => new Promise((r) => setTimeout(r, 5)), { runs: 3 });
    return out;
  });
  ok(r.report.level === "full" && r.report.missing.length === 0 && r.report.ua.family === "chrome", "this browser reports full support (missing: " + r.report.missing.join(",") + ")");
  ok(r.smoke.ok && r.smoke.results.length === 6, "the real behaviors all work: " + r.smoke.results.map((x) => (x.ok ? "ok " : "FAIL ") + x.name).join("; "));
  ok(r.pre.cached.length === 3 && r.pre.failed.length === 2 && r.pre.failed.some((f) => /not a file of this site/.test(f.reason)) && r.pre.failed.some((f) => /404/.test(f.reason)) && r.pre.bytes > 100000, `the real cache holds the site's own files (${r.pre.cached.length} files, ${r.pre.bytes} bytes), refuses another site's and reports a missing one`);
  ok(r.verify1.ok && r.verify1.files === 3 && !r.verify2.ok && r.verify2.changed.join() === "/css/styles.css", "verification passes, then finds the one file that was changed");
  ok(r.pruned.includes("cognicopia-old-one") && r.status.files === 3 && r.status.bytes === r.pre.bytes, "an old cache is pruned and the status counts the files");
  ok(r.backup.ok && !r.backup.wrong && !r.backup.leaks && r.backup.check, "a real encrypted backup opens with its passphrase, not with another, and shows no resident detail");
  ok(r.longTasks === true && r.measure.n === 3 && r.measure.median >= 4, "long-task watching is available and timing works (" + r.measure.median + " ms)");
  ok(outside.length === 0 && errs.length === 0, "no request left the site and no script failed (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error("pillar 4 UI check FAILED: " + problems.length + " problem(s), " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("pillar 4 UI check passed: " + passed + " checks in a real browser (full support and real behaviors, the Cache API, encrypted backup, long tasks, no outside request)");
