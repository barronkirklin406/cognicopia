#!/usr/bin/env node
/* =====================================================================
   The roster handoff, proved with two computers.

   A facility's residents never leave the device, so moving them to another
   station is a locked file carried by hand. This check plays both stations:
   two browser contexts that share nothing (separate storage, as two real
   computers would), made-up residents only.

     lock       the first station locks its roster with a passphrase; a short passphrase is refused
     the file   what comes out is a locked file: no resident's name can be read in it
     refuse     the second station cannot open it with a wrong passphrase, or with none, or a different file
     open       with the right passphrase every resident arrives, with their details
     merge      opening it again adds nobody twice; a copy changed later on the second station is kept, not overwritten
     private    nothing was sent anywhere
   Needs Playwright. Run: node scripts/check-roster-handoff-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* made-up people only */
const resident = (id, name, unit, tier, updatedAt) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: updatedAt || "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: unit, cognitiveTier: tier, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], other: "" }, difficulty: { level: tier } },
  tier2_enrichment: { birthYear: 1936, hometown: { place: "Testville" } }, tier3_deep: { notes: "Likes the porch swing.", people: [] } });
const PEOPLE = [resident("r1", "Dorothy Quillfeather", "201-A", 2), resident("r2", "Walter Bramblewick", "202-B", 1), resident("r3", "Evelyn Thistledown", "203-A", 3)];
const PASS = "porch swing at dusk 1957";

async function station(people) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/roster", { waitUntil: "load" }); await p.waitForSelector("#rsScreen", { timeout: 8000 });
  if (people.length) {
    await p.evaluate(list => list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))), people);
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#rsScreen", { timeout: 8000 });
  }
  await p.waitForTimeout(300);
  await p.evaluate(() => { const d = document.querySelector("#rsHandoff"); if (d) d.open = true; });
  return { ctx, p };
}
const names = p => p.$$eval("#rsList .rs-res b", e => e.map(x => x.textContent.trim()));
const msg = p => p.$eval("#rsHoMsg", e => e.textContent.trim());
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-"));

try {
  /* ----- station one: lock the roster ----- */
  const one = await station(PEOPLE);
  ok((await names(one.p)).length === 3, "station one shows its three residents");
  await one.p.fill("#rsHoFrom", "Maple Unit, evening shift");
  await one.p.fill("#rsHoPass", "short");
  await one.p.click("#rsHoOut"); await one.p.waitForTimeout(500);
  ok(/passphrase|characters|at least/i.test(await msg(one.p)), `a short passphrase is refused with a reason ("${await msg(one.p)}")`);

  await one.p.fill("#rsHoPass", PASS);
  const [dl] = await Promise.all([one.p.waitForEvent("download", { timeout: 20000 }), one.p.click("#rsHoOut")]);
  const file = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(file);
  const raw = fs.readFileSync(file, "utf8");
  ok(/\.cognicopia$/.test(dl.suggestedFilename()), `the file is a .cognicopia file (${dl.suggestedFilename()})`);
  ok(!/Quillfeather|Bramblewick|Thistledown|Dorothy|Walter|Evelyn|porch swing|Testville/i.test(raw), "no name, place or note can be read in the locked file");
  ok(!raw.includes(PASS), "the passphrase is not in the file");
  ok(/locked|salt|iv|cipher/i.test(raw), "the file looks locked (it carries a salt and a sealed body)");
  ok(/Downloaded, locked: 3 residents/.test(await msg(one.p)), `station one says what it did: "${await msg(one.p)}"`);
  ok(await one.p.$eval("#rsHoPass", e => e.value === ""), "the passphrase box is cleared after the file is made");
  await one.ctx.close();

  /* ----- station two: nothing here yet ----- */
  const two = await station([]);
  ok((await names(two.p)).length === 0, "station two starts with no residents");
  const pick = f => two.p.setInputFiles("#rsHoFile", f);

  await pick(file); await two.p.fill("#rsHoInPass", "porch swing at dusk 1958"); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(1500);
  ok(/does not open/i.test(await msg(two.p)), `a wrong passphrase is refused: "${await msg(two.p)}"`);
  ok((await names(two.p)).length === 0, "a wrong passphrase adds no one");

  await two.p.fill("#rsHoInPass", ""); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(800);
  ok(/does not open|passphrase/i.test(await msg(two.p)), `no passphrase is refused: "${await msg(two.p)}"`);

  const notOurs = path.join(tmp, "notes.cognicopia"); fs.writeFileSync(notOurs, JSON.stringify({ hello: "world" }));
  await pick(notOurs); await two.p.fill("#rsHoInPass", PASS); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(800);
  ok(/not a Cognicopia/i.test(await msg(two.p)), `a file that is not ours is refused: "${await msg(two.p)}"`);

  /* ----- the right passphrase ----- */
  await pick(file); await two.p.fill("#rsHoInPass", PASS); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(2000);
  ok(/3 added/.test(await msg(two.p)), `the right passphrase adds all three: "${await msg(two.p)}"`);
  ok(/Maple Unit/.test(await msg(two.p)), "station two is told where the file came from");
  const arrived = await names(two.p);
  ok(["Dorothy Quillfeather", "Walter Bramblewick", "Evelyn Thistledown"].every(n => arrived.includes(n)) && arrived.length === 3, `all three arrive and are listed by name (${arrived.join(", ")})`);
  const real = await two.p.evaluate(() => ["r1", "r2", "r3"].map(id => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_" + id)).tier1_core.preferredName));
  ok(real.join("|") === "Dorothy Quillfeather|Walter Bramblewick|Evelyn Thistledown", `each resident's real name arrived in their profile (${real.join(", ")})`);
  const kept = await two.p.evaluate(() => { const k = "cognicopia_resident_r1"; return window.CogniSecureStore.storage.getItem(k); });
  const back = JSON.parse(kept || "{}");
  ok(back.tier1_core && back.tier1_core.unitNumber === "201-A" && back.tier2_enrichment.hometown.place === "Testville" && back.tier3_deep.notes === "Likes the porch swing.", "a resident arrives with their room, hometown and notes intact");
  const sealed = await two.p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("cognicopia_resident_")).map(k => localStorage.getItem(k)).join(""));
  ok(!/Quillfeather|Bramblewick|Thistledown/.test(sealed), "on station two the residents are sealed in the encrypted store, not left in plain browser storage");

  /* ----- opening it again, and a newer copy ----- */
  await pick(file); await two.p.fill("#rsHoInPass", PASS); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(2000);
  ok(/0 added, 0 updated/.test(await msg(two.p)) && /3 kept/.test(await msg(two.p)), `opening it twice adds nobody twice: "${await msg(two.p)}"`);
  ok((await names(two.p)).length === 3, "still three residents, not six");

  await two.p.evaluate(() => {
    const k = "cognicopia_resident_r2", p = JSON.parse(window.CogniSecureStore.storage.getItem(k));
    p.updatedAt = "2026-11-01T09:00:00Z"; p.tier3_deep.notes = "Changed on station two."; window.CogniSecureStore.storage.setItem(k, JSON.stringify(p));
  });
  await two.p.reload({ waitUntil: "load" }); await two.p.waitForSelector("#rsScreen"); await two.p.evaluate(() => { document.querySelector("#rsHandoff").open = true; });
  await pick(file); await two.p.fill("#rsHoInPass", PASS); await two.p.click("#rsHoIn"); await two.p.waitForTimeout(2000);
  const r2 = JSON.parse(await two.p.evaluate(() => window.CogniSecureStore.storage.getItem("cognicopia_resident_r2")));
  ok(r2.tier3_deep.notes === "Changed on station two.", "a copy changed later on station two is kept, not overwritten by the older file");
  ok(await two.p.$eval('[data-privacy-choice="rsHoNames"] input[value="keep"]', e => e.checked), "the handoff keeps names by default: the file is locked, and a resident should arrive whole");
  await two.ctx.close();

  /* ----- the safer-to-share file: aliases, and what that costs ----- */
  const three = await station(PEOPLE);
  await three.p.fill("#rsHoPass", PASS);
  await three.p.check('[data-privacy-choice="rsHoNames"] input[value="alias"]', { force: true });
  const [dl2] = await Promise.all([three.p.waitForEvent("download", { timeout: 20000 }), three.p.click("#rsHoOut")]);
  const aliasFile = path.join(tmp, "alias-" + dl2.suggestedFilename()); await dl2.saveAs(aliasFile);
  ok(/aliases in place of names/.test(await msg(three.p)) && /will not bring the real names back/.test(await msg(three.p)), `choosing aliases says plainly what it costs: "${await msg(three.p)}"`);
  ok(/aliases/.test(dl2.suggestedFilename()), `the alias file is named for it (${dl2.suggestedFilename()})`);
  await three.ctx.close();
  const four = await station([]);
  await four.p.setInputFiles("#rsHoFile", aliasFile); await four.p.fill("#rsHoInPass", PASS); await four.p.click("#rsHoIn"); await four.p.waitForTimeout(2000);
  const aliased = await four.p.evaluate(() => ["r1", "r2", "r3"].map(id => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_" + id)).tier1_core.preferredName));
  ok(aliased.every(n => /^Resident /.test(n)) && !/Quillfeather|Bramblewick|Thistledown/.test(aliased.join("")), `an alias file really carries no real names (${aliased.join(", ")})`);
  await four.ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(problems.length ? `roster handoff check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `roster handoff check passed: ${passed} checks with two separate browsers (the file is locked, wrong or missing passphrases are refused, every resident arrives whole by default and sealed, an alias file really drops the names and says so, nobody is added twice, a newer copy is kept, nothing leaves the page)`);
process.exit(problems.length ? 1 : 0);
