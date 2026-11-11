#!/usr/bin/env node
/* =====================================================================
   The residents folder (js/residentFolder.js, on the roster screen of the
   Packet Builder): in a real browser.

   A real folder needs a person to pick it, so the browser's own private
   file area for this site stands in for it: the folder picker is replaced
   by one that hands back a folder there. Everything after the pick is the
   real code: the files written, read, merged and removed.

     choose     the roster offers it, with the passphrase and the honest limits; a short passphrase is refused
     files      one locked file a resident, "resident-<code>.cognicopia", and a note; no file name or file holds a
                name; each opens with the passphrase and with no other
     saves      a change here rewrites that resident's file and no other; a save in the profile form does too
     newer      a newer copy written by another computer replaces this one; an older one is replaced by this one
     arrives    a resident another computer added appears on the roster
     deletes    a resident deleted here leaves the folder
     returns    with this browser's residents gone, choosing the folder again with the passphrase brings them back;
                the wrong passphrase is refused
     restarts   when the browser asks again for the folder, the screen says so and one button asks
     stops      stopping forgets the folder here and leaves the files
     elsewhere  a browser without folders says so and offers the handoff file
     fingers    52 px; nothing is requested from outside the page; no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-resident-folder-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
/* An ordinary browser profile kept on disk, as a facility's computer has: in Playwright's usual private profile this
   Chromium stops outright when it reads a stored folder handle back, which a real browser does every time it opens. */
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "cg-folder-profile-"));
const main = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
const browser = await chromium.launch();                     // a second, plain browser for the one without folders
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const PASS = "maple court evening shift", TEST_DIR = "cg-residents-folder-test";

const person = (id, name, when, extra) => Object.assign({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-10-01T10:00:00Z", updatedAt: when,
  tier1_core: { preferredName: name, cognitiveTier: 2, unitNumber: "12", topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: 1938, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "", people: [] } }, extra || {});
const DOT = person("res-dot", "Dorothy Example", "2026-11-01T10:00:00Z"), WAL = person("res-wal", "Walter Sample", "2026-11-01T10:00:00Z");

/* the stand-in folder, handed back by the folder picker */
const PICKER = dir => {
  window.showDirectoryPicker = async () => { window.__picked = (window.__picked || 0) + 1; return (await navigator.storage.getDirectory()).getDirectoryHandle(dir, { create: true }); };
};
async function open(file, opts) {
  opts = opts || {};
  const ctx = opts.ctx || (opts.plain ? await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" }) : main);
  if (!opts.ctx && !ctx.__ready) {
    ctx.__ready = true;
    await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
    await ctx.addInitScript(PICKER, TEST_DIR);
  }
  const p = await ctx.newPage();
  if (opts.init) await p.addInitScript(opts.init);
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1200);
  return { ctx, p };
}
/* what is in the stand-in folder: each file's name, size, time and text */
const folder = p => p.evaluate(async dir => {
  const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(dir, { create: true }), out = [];
  for await (const [name, h] of d.entries()) if (h.kind === "file") { const f = await h.getFile(); out.push({ name, size: f.size, mtime: f.lastModified, text: await f.text() }); }
  return out.sort((a, b) => a.name < b.name ? -1 : 1);
}, TEST_DIR);
const opened = (p, text, pass) => p.evaluate(async x => { try { const r = await window.CogniSecureStore.readRoster(x.text, x.pass); return { ok: true, ids: r.profiles.map(q => q.id), names: r.profiles.map(q => q.tier1_core.preferredName), updated: r.profiles.map(q => q.updatedAt), notes: r.profiles.map(q => q.tier3_deep.notes) }; } catch (e) { return { ok: false, why: e.message }; } }, { text, pass });
const fileOf = (p, id) => p.evaluate(id2 => window.CogniResidentFolder.fileFor(id2), id);
const seed = (p, list) => p.evaluate(l => { l.forEach(x => window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); return window.CogniSecureStore.flush(); }, list);
const local = (p, id) => p.evaluate(id2 => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_" + id2) || "null"), id);
/* another computer writes a resident into the folder, as its own sync would */
const fromElsewhere = (p, prof) => p.evaluate(async x => {
  const env = await window.CogniSecureStore.exportRoster([x.prof], x.pass), name = await window.CogniResidentFolder.fileFor(x.prof.id);
  const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(x.dir, { create: true }), fh = await d.getFileHandle(name, { create: true }), w = await fh.createWritable();
  await new Promise(r => setTimeout(r, 30)); await w.write(JSON.stringify(env)); await w.close(); return name;
}, { prof, pass: PASS, dir: TEST_DIR });
const openRoster = async p => { await p.evaluate(() => { const d = document.getElementById("rsFolder"); if (d) d.open = true; }); await p.waitForTimeout(500); };
const body = p => p.$eval("#rsFolder", e => e.innerText.replace(/\s+/g, " "));
const sync = p => p.evaluate(() => window.CogniResidentFolder.sync());

try {
  /* ----- choose ----- */
  const a = await open("builder.html#/roster");
  for (const pg of main.pages()) if (pg !== a.p) await pg.close();          // the profile's own first, empty tab
  await seed(a.p, [DOT, WAL]); await a.p.reload({ waitUntil: "load" }); await a.p.waitForSelector("#rsList .rs-res"); await a.p.waitForTimeout(800);
  await openRoster(a.p);
  const first = await body(a.p);
  ok(/Keep residents in a folder on this computer/.test(first) && /A passphrase for the files/.test(first) && !!(await a.p.$("#rsFoChoose")), "the roster offers to keep residents in a folder, with a passphrase for the files");
  ok(/named by a code and never by a name/.test(first) && /same folder there/.test(first) && /asks again/.test(first) && /OneDrive, Dropbox, Google Drive/.test(first) && /copies the locked files to the internet/.test(first) && /Photos stay on this computer/.test(first) && /puts it back/.test(first),
    "and says plainly what it does and does not do: codes for names, sharing, the browser asking again, online drives, photos, deleting");
  await a.p.fill("#rsFoPass", "short"); await a.p.click("#rsFoChoose"); await a.p.waitForTimeout(500);
  ok(/at least 10 characters/.test(await a.p.textContent("#rsFoMsg")) && (await folder(a.p)).length === 0 && !(await a.p.evaluate(() => window.__picked)), "a short passphrase is refused before any folder is asked for");
  await a.p.fill("#rsFoPass", PASS); await a.p.click("#rsFoChoose");
  await a.p.waitForFunction(() => /The folder is in use/.test(document.getElementById("rsFoMsg").textContent), null, { timeout: 30000 }).catch(() => {});
  ok(/2 saved to it/.test(await a.p.textContent("#rsFoMsg")), `choosing the folder saves both residents to it (${await a.p.textContent("#rsFoMsg")})`);
  ok(new RegExp("kept in the folder .?" + TEST_DIR).test(await body(a.p)) && !!(await a.p.$("#rsFoSync")) && !!(await a.p.$("#rsFoStop")), "the section now says which folder is in use, with Check now and Stop");
  const sizes = await a.p.$$eval("#rsFolder summary, #rsFolder .btn", e => e.map(x => Math.round(x.getBoundingClientRect().height)));
  ok(sizes.length >= 3 && sizes.every(h => h >= 52), `its controls are 52 px tall (${sizes.join(", ")})`);

  /* ----- files ----- */
  let fs1 = await folder(a.p);
  const res = fs1.filter(f => /\.cognicopia$/.test(f.name));
  ok(res.length === 2 && res.every(f => /^resident-[0-9a-f]{12}\.cognicopia$/.test(f.name)) && fs1.some(f => f.name === "About these files.txt"), `one locked file a resident, named by a code, and a note (${fs1.map(f => f.name).join(", ")})`);
  ok(fs1.every(f => !/Dorothy|Walter|Scobey|Gardening/i.test(f.name + f.text)), "no file name and no file holds a name, a town or anything else about them in plain text");
  ok(res.every(f => { try { const o = JSON.parse(f.text); return o.format === "cognicopia-locked" && o.kind === "residents" && o.kdf.name === "PBKDF2" && o.cipher.name === "AES-GCM"; } catch (e) { return false; } }), "each is the handoff's locked file (AES-GCM, a key made from the passphrase)");
  const dotFile = await fileOf(a.p, "res-dot"), walFile = await fileOf(a.p, "res-wal");
  const o1 = await opened(a.p, fs1.find(f => f.name === dotFile).text, PASS), o2 = await opened(a.p, fs1.find(f => f.name === dotFile).text, "not the right passphrase");
  ok(o1.ok && o1.ids.join() === "res-dot" && o1.names[0] === "Dorothy Example", "her file opens with the passphrase and holds her, and only her");
  ok(!o2.ok && o2.why === "passphrase", "and no other passphrase opens it");
  ok(/These files are residents saved by Cognicopia/.test(fs1.find(f => f.name === "About these files.txt").text), "the note says what the files are and how to open them elsewhere");

  /* ----- saves: only the changed resident is written again ----- */
  const walTime = fs1.find(f => f.name === walFile).mtime;
  await seed(a.p, [Object.assign({}, DOT, { updatedAt: new Date().toISOString(), tier3_deep: { notes: "Likes the morning paper.", people: [] } })]);
  await a.p.evaluate(() => window.CogniResidentFolder.soon()); await a.p.waitForTimeout(2500);
  fs1 = await folder(a.p);
  ok((await opened(a.p, fs1.find(f => f.name === dotFile).text, PASS)).notes[0] === "Likes the morning paper.", "a change to her is written to her file");
  ok(fs1.find(f => f.name === walFile).mtime === walTime, "and his file, unchanged, is left alone");

  /* ----- newer and older copies from another computer ----- */
  await fromElsewhere(a.p, Object.assign({}, WAL, { updatedAt: "2099-01-01T00:00:00Z", tier3_deep: { notes: "Written on the second computer.", people: [] } }));
  await fromElsewhere(a.p, Object.assign({}, DOT, { updatedAt: "2026-10-15T00:00:00Z", tier3_deep: { notes: "An old copy.", people: [] } }));
  const r1 = await sync(a.p);
  ok((await local(a.p, "res-wal")).tier3_deep.notes === "Written on the second computer." && r1.updated >= 1, `a newer copy of him from another computer replaces this one (${JSON.stringify(r1)})`);
  ok((await local(a.p, "res-dot")).tier3_deep.notes === "Likes the morning paper.", "an older copy of her does not replace this computer's newer one");
  fs1 = await folder(a.p);
  ok((await opened(a.p, fs1.find(f => f.name === dotFile).text, PASS)).notes[0] === "Likes the morning paper.", "and her file is written again with the newer copy");

  /* ----- arrives ----- */
  await fromElsewhere(a.p, person("res-ruth", "Ruth Example", "2026-11-05T10:00:00Z"));
  await sync(a.p); await a.p.waitForTimeout(600);
  ok(await a.p.$('.rs-res[data-id="res-ruth"]') !== null, "a resident another computer added appears on the roster");

  /* ----- deletes ----- */
  await a.p.evaluate(() => { window.CogniSecureStore.storage.removeItem("cognicopia_resident_res-dot"); return window.CogniSecureStore.flush(); });
  const r2 = await sync(a.p); fs1 = await folder(a.p);
  ok(!fs1.some(f => f.name === dotFile) && fs1.some(f => f.name === walFile) && r2.removed === 1, "a resident deleted here leaves the folder, and the others stay");

  /* ----- a save in the profile form is written too ----- */
  const pf = await open("profile.html?edit=res-wal", { ctx: a.ctx });
  await pf.p.waitForSelector("#rapName"); await pf.p.waitForTimeout(900);
  for (let i = 0; i < 8; i++) { const at = await pf.p.evaluate(() => +document.querySelector('#rapSteps button[aria-current="step"]').getAttribute("data-go")); if (at === 6) break; await pf.p.evaluate(() => document.getElementById("rapNext").click()); await pf.p.waitForTimeout(300); }
  const before = (await folder(pf.p)).find(f => f.name === walFile).mtime;
  await pf.p.evaluate(() => document.getElementById("rapNext").click()); await pf.p.waitForTimeout(3500);
  const afterSave = (await folder(pf.p)).find(f => f.name === walFile);
  const savedHere = (await local(pf.p, "res-wal")).updatedAt, inFile = (await opened(pf.p, afterSave.text, PASS)).updated[0];
  ok(afterSave.mtime > before && inFile === savedHere && !/^2099/.test(inFile), `saving him in the profile form writes his file again, with the copy just saved (${inFile})`);
  await pf.p.close();

  /* ----- returns: a browser whose residents are gone ----- */
  await a.p.evaluate(() => { const s = window.CogniSecureStore.storage, ks = []; for (let i = 0; i < s.length; i++) { const k = s.key(i); if (/^cognicopia_resident_|^cognicopia_folder/.test(k)) ks.push(k); } ks.forEach(k => s.removeItem(k)); return window.CogniSecureStore.flush(); });
  await a.p.reload({ waitUntil: "load" }); await a.p.waitForTimeout(1200); await openRoster(a.p);
  ok(!!(await a.p.$("#rsFoChoose")) && (await a.p.$$("#rsList .rs-res")).length === 0, "with this browser's residents and settings gone, the roster is empty and offers the folder again");
  await a.p.fill("#rsFoPass", "the wrong passphrase here"); await a.p.click("#rsFoChoose"); await a.p.waitForTimeout(2500);
  ok(/does not open the residents already in this folder/.test(await a.p.textContent("#rsFoMsg")) && (await a.p.$$("#rsList .rs-res")).length === 0, "the wrong passphrase is refused, and nothing is taken from the folder");
  await a.p.fill("#rsFoPass", PASS); await a.p.click("#rsFoChoose");
  await a.p.waitForFunction(() => /The folder is in use/.test(document.getElementById("rsFoMsg").textContent), null, { timeout: 30000 }).catch(() => {});
  await a.p.waitForTimeout(600);
  const back = await a.p.$$eval("#rsList .rs-res", e => e.map(x => x.dataset.id).sort().join());
  ok(back === "res-ruth,res-wal", `the right one brings the residents back from the folder (${back})`);
  ok((await local(a.p, "res-wal")).tier3_deep.notes === "Written on the second computer.", "as they were last saved");

  /* ----- restarts: the browser asks again ----- */
  const rs = await open("builder.html#/roster", { ctx: a.ctx, init: () => {
    window.__asked = 0;
    const H = window.FileSystemHandle && window.FileSystemHandle.prototype; if (!H) return;
    H.queryPermission = async function () { return window.__allowed ? "granted" : "prompt"; };
    H.requestPermission = async function () { window.__asked++; window.__allowed = true; return "granted"; };
  } });
  await openRoster(rs.p);
  ok(/needs to be allowed again/.test(await body(rs.p)) && !!(await rs.p.$("#rsFoReconnect")), "after the browser restarts the section says it must be allowed again, with one button");
  await rs.p.click("#rsFoReconnect"); await rs.p.waitForTimeout(1500);
  ok(await rs.p.evaluate(() => window.__asked) === 1 && /is in use again/.test(await rs.p.textContent("#rsFoMsg")) && !!(await rs.p.$("#rsFoSync")), "the button asks the browser once and the folder is in use again");
  await rs.p.close();

  /* ----- stops ----- */
  await a.p.reload({ waitUntil: "load" }); await a.p.waitForTimeout(1200); await openRoster(a.p);
  const n0 = (await folder(a.p)).length;
  await a.p.click("#rsFoStop"); await a.p.waitForTimeout(800);
  ok(/no longer uses the folder/.test(await a.p.textContent("#rsFoMsg")) && !!(await a.p.$("#rsFoChoose")) && (await folder(a.p)).length === n0 && await a.p.evaluate(() => window.CogniSecureStore.storage.getItem("cognicopia_folder")) === null,
    "stopping forgets the folder and its passphrase here and leaves the files as they are");
  ok(await a.p.evaluate(() => { const s = window.localStorage; for (let i = 0; i < s.length; i++) if (/cognicopia_folder/.test(s.key(i)) || /maple court/.test(s.getItem(s.key(i)) || "")) return false; return true; }), "the passphrase was never in plain browser storage");

  /* ----- elsewhere: a browser without folders ----- */
  const e = await open("builder.html#/roster", { plain: true, init: () => { try { delete window.showDirectoryPicker; } catch (x) { /* ignore */ } window.showDirectoryPicker = undefined; } });
  await openRoster(e.p);
  ok(/cannot keep residents in a folder/.test(await body(e.p)) && /Chrome or Microsoft Edge/.test(await body(e.p)) && /handoff file/.test(await body(e.p)) && !(await e.p.$("#rsFoChoose")), "a browser without folders says so, names the browsers that can, and points to the handoff file");
  await e.ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await main.close(); await browser.close(); srv.close(); try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

console.log(problems.length ? `residents folder check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `residents folder check passed: ${passed} checks in a real browser, a private folder standing in for a chosen one (locked files named by codes, a passphrase and no other; only what changed is written; the newer copy wins both ways; a resident added elsewhere arrives, one deleted here leaves; the profile form's save; residents brought back, the wrong passphrase refused; the browser asking again; stop; a browser without folders; 52 px; nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
