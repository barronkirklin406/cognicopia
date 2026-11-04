#!/usr/bin/env node
/* =====================================================================
   The local database (assets/services/localDb.js), in a real browser,
   against the real IndexedDB and the real encrypted store.

     - a resident is saved, read back, listed by first name, updated (the
       created time stays) and deleted, with their packets
     - a packet is saved for a resident, listed newest first, and refused
       for a resident who is not saved
     - bad input is refused with a code and a plain message
     - everything is still there after the page reloads
     - sealed at rest: the stored rows hold only the id, the care level, the
       times and the template list; the name, the life story and the pages
       are in the encrypted store, and nowhere in the rows
     - with a passphrase set and the store locked, reads and writes say
       "locked"; after the unlock they work
     - a sealed record that will not open is shown as unreadable, not hidden
     - with no encrypted store (a browser that cannot encrypt), rows are kept
       plain and info() says so
     - nothing is requested from outside the page's own site

   Needs Playwright. Where it is missing this exits 2 and npm run build
   skips it. Run: node scripts/check-localdb-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const NAME = "Margaret", STORY = "taught third grade in Duluth", PAGE_WORDS = "A quiet afternoon of birds and big band";

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const open = async () => {
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(e.message));
    p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
    await p.goto(base + "index.html"); await p.waitForFunction(() => window.CogniSecureStore, null, { timeout: 15000 });
    await p.evaluate(() => CogniSecureStore.ready());
    await p.addScriptTag({ url: base + "assets/services/localDb.js" });
    return p;
  };
  const rawRows = p => p.evaluate(() => new Promise((resolve, reject) => {
    const q = indexedDB.open("CognicopiaLocalDB");
    q.onerror = () => reject(q.error);
    q.onsuccess = () => {
      const d = q.result, out = { stores: [...d.objectStoreNames], residents: [], packets: [], indexes: [], version: d.version };
      const t = d.transaction(["residents", "generatedPackets"], "readonly");
      t.objectStore("residents").getAll().onsuccess = e => { out.residents = e.target.result; };
      t.objectStore("generatedPackets").getAll().onsuccess = e => { out.packets = e.target.result; };
      out.indexes = [...t.objectStore("generatedPackets").indexNames];
      t.oncomplete = () => { d.close(); resolve(out); };
    };
  }));
  const fails = (p, code, fn) => p.evaluate(async ({ code, fn }) => { try { await new Function("L", "return (" + fn + ")(L)")(CogniLocalDb); return "no error"; } catch (e) { return e.code === code ? "ok" : `${e.name}/${e.code}: ${e.message}`; } }, { code, fn });

  let p = await open();
  ok(await p.evaluate(() => typeof CogniLocalDb === "object" && ["saveResident", "getResident", "getAllResidents", "savePacket", "getPacketsForResident"].every(k => typeof CogniLocalDb[k] === "function")), "the page has the five functions");
  ok((await p.evaluate(() => CogniLocalDb.info())).sealed === true, "with the encrypted store open, the database seals what it keeps");
  await p.evaluate(() => CogniLocalDb.clearAll());

  /* ---- residents ---- */
  const a = await p.evaluate(async ({ NAME, STORY }) => CogniLocalDb.saveResident({ firstName: NAME, hometown: "Duluth, Minnesota", pastOccupation: STORY, hobbies: "Gardening, cards", cognitiveTier: "moderate", interests: ["Big band", "Birds"] }), { NAME, STORY });
  ok(/^res_/.test(a.id) && a.firstName === NAME && a.cognitiveTier === "Moderate" && a.createdAt === a.updatedAt, "a saved resident comes back with an id, the stored care-level spelling and its times: " + JSON.stringify(a).slice(0, 120));
  const got = await p.evaluate(id => CogniLocalDb.getResident(id), a.id);
  ok(got && got.firstName === NAME && got.hometown === "Duluth, Minnesota" && got.pastOccupation === STORY && got.hobbies === "Gardening, cards" && got.interests.join() === "Big band,Birds", "the resident reads back exactly");
  ok(await p.evaluate(() => CogniLocalDb.getResident("res_nobody")) === null, "a resident who is not saved reads back as null");
  const b = await p.evaluate(async () => CogniLocalDb.saveResident({ firstName: "Arthur", cognitiveTier: "Mild" }));
  const c = await p.evaluate(async () => CogniLocalDb.saveResident({ firstName: "Bea", cognitiveTier: "Advanced", interests: ["Hymns"] }));
  ok((await p.evaluate(() => CogniLocalDb.getAllResidents())).map(r => r.firstName).join() === "Arthur,Bea,Margaret", "everyone is listed by first name");
  await p.waitForTimeout(15);
  const a2 = await p.evaluate(async id => CogniLocalDb.saveResident({ id, firstName: "Margaret", hometown: "Fargo", cognitiveTier: "Advanced" }), a.id);
  ok(a2.id === a.id && a2.createdAt === a.createdAt && a2.updatedAt > a.createdAt && a2.hometown === "Fargo", "saving with the same id updates the profile and keeps the time it was created");
  ok((await p.evaluate(() => CogniLocalDb.getAllResidents())).length === 3, "an update does not add a second copy");

  /* ---- packets ---- */
  const html = `<html><body><h1>${PAGE_WORDS}</h1></body></html>`;
  const k1 = await p.evaluate(async ({ id, html }) => CogniLocalDb.savePacket({ residentId: id, htmlContent: html, selectedTemplates: ["Word Search", "Coloring"], timestamp: 1790000000000 }), { id: a.id, html });
  const k2 = await p.evaluate(async ({ id, html }) => CogniLocalDb.savePacket({ residentId: id, htmlContent: html + "2", selectedTemplates: ["Crossword"], timestamp: 1790000100000 }), { id: a.id, html });
  await p.evaluate(async ({ id, html }) => CogniLocalDb.savePacket({ residentId: id, htmlContent: html, selectedTemplates: [] }), { id: b.id, html });
  ok(/^pkt_/.test(k1.id) && k1.timestamp === 1790000000000, "a saved packet comes back with an id and its time");
  const list = await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), a.id);
  ok(list.length === 2 && list[0].id === k2.id && list[1].id === k1.id, "a resident's packets are listed newest first");
  ok(list[1].htmlContent === html && list[1].selectedTemplates.join() === "Word Search,Coloring" && list[0].selectedTemplates.join() === "Crossword", "the pages and the template list read back exactly");
  ok((await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), c.id)).length === 0, "a resident with no packets gets an empty list");
  ok((await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), b.id)).length === 1, "packets are kept apart by resident");
  ok(await fails(p, "not-found", `L => L.savePacket({ residentId: "res_nobody", htmlContent: "<p>x</p>" })`) === "ok", "a packet for a resident who is not saved is refused as not-found");

  /* ---- refusals ---- */
  ok(await fails(p, "invalid", `L => L.saveResident({ cognitiveTier: "Mild" })`) === "ok", "a resident with no first name is refused");
  ok(await fails(p, "invalid", `L => L.saveResident({ firstName: "Al", cognitiveTier: "Severe" })`) === "ok", "an unknown care level is refused");
  ok(await fails(p, "invalid", `L => L.savePacket({ residentId: "r", htmlContent: "" })`) === "ok", "a packet with no pages is refused");
  ok(await fails(p, "invalid", `L => L.getResident("has space")`) === "ok", "an id with odd characters is refused");
  const msg = await p.evaluate(async () => { try { await CogniLocalDb.saveResident({ cognitiveTier: "Mild" }); } catch (e) { return e.message; } });
  ok(/first name/.test(msg || ""), "the message is plain: " + msg);

  /* ---- sealed at rest ---- */
  const raw = await rawRows(p), dump = JSON.stringify(raw);
  ok(raw.version === 1 && raw.stores.join() === "generatedPackets,residents" && raw.indexes.includes("byResident") && raw.indexes.includes("byTimestamp"), "the real database is CognicopiaLocalDB version 1, with both stores and the indexes: " + JSON.stringify({ v: raw.version, s: raw.stores, i: raw.indexes }));
  ok(raw.residents.length === 3 && raw.residents.every(r => r.sealed === true && !("data" in r)), "every resident row is marked sealed and holds no details");
  ok(raw.packets.length === 3 && raw.packets.every(r => r.sealed === true && !("htmlContent" in r)), "every packet row is marked sealed and holds no pages");
  ok(!dump.includes(NAME) && !dump.includes("Duluth") && !dump.includes(STORY) && !dump.includes("Big band") && !dump.includes(PAGE_WORDS), "no name, life story or page text is readable in the stored rows");
  ok(!(await p.evaluate(() => Object.keys(localStorage).some(k => /localdb/i.test(k) || /Margaret/.test(localStorage.getItem(k) || "")))), "nothing was written to plain localStorage");
  ok((await p.evaluate(() => CogniSecureStore.blobNames("cognicopia_localdb_"))).length === 6, "the six sealed records (three residents, three packets) are in the encrypted store");

  /* ---- survives a reload ---- */
  await p.close(); p = await open();
  ok((await p.evaluate(() => CogniLocalDb.getAllResidents())).map(r => r.firstName).join() === "Arthur,Bea,Margaret", "the residents are still there after the page reloads");
  ok((await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), a.id)).length === 2, "and so are the packets");

  /* ---- a sealed record that will not open ---- */
  await p.evaluate(id => CogniSecureStore.deleteBlob("cognicopia_localdb_resident_" + id), c.id);
  await p.evaluate(id => CogniSecureStore.deleteBlob("cognicopia_localdb_packet_" + id), k1.id);
  const all = await p.evaluate(() => CogniLocalDb.getAllResidents());
  const bea = all.find(r => r.id === c.id);
  ok(bea && bea.unreadable === true && bea.firstName === "" && bea.cognitiveTier === "Advanced", "a resident whose sealed details are gone is listed as unreadable, not hidden");
  const pk = await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), a.id);
  ok(pk.find(x => x.id === k1.id).unreadable === true && pk.find(x => x.id === k2.id).htmlContent === html + "2", "a packet whose pages are gone is marked unreadable, and the others still open");

  /* ---- locked ---- */
  await p.evaluate(async () => { await CogniSecureStore.flush(); await CogniSecureStore.setPassphrase("shared station passphrase"); await CogniSecureStore.lock(); });
  ok(await fails(p, "locked", `L => L.getAllResidents()`) === "ok" && await fails(p, "locked", `L => L.getResident("${a.id}")`) === "ok", "with the store locked, reading says locked");
  ok(await fails(p, "locked", `L => L.saveResident({ firstName: "Al", cognitiveTier: "Mild" })`) === "ok" && await fails(p, "locked", `L => L.savePacket({ residentId: "${a.id}", htmlContent: "<p>x</p>" })`) === "ok", "with the store locked, saving says locked, and nothing is written in plain");
  ok((await rawRows(p)).residents.length === 3, "a refused save wrote no row");
  await p.evaluate(() => CogniSecureStore.unlock("shared station passphrase"));
  ok((await p.evaluate(id => CogniLocalDb.getResident(id), a.id)).firstName === "Margaret", "after the unlock the saved resident opens again");
  await p.evaluate(() => CogniSecureStore.removePassphrase("shared station passphrase"));

  /* ---- delete, with the packets ---- */
  ok(await p.evaluate(id => CogniLocalDb.deletePacket(id), k2.id) === true && await p.evaluate(id => CogniLocalDb.deletePacket(id), k2.id) === false, "a packet can be deleted, once");
  const k3 = await p.evaluate(async ({ id, html }) => CogniLocalDb.savePacket({ residentId: id, htmlContent: html }), { id: a.id, html });
  ok(await p.evaluate(id => CogniLocalDb.deleteResident(id), a.id) === 2, "deleting a resident reports the packets that went with them (2)");
  ok(await p.evaluate(id => CogniLocalDb.getResident(id), a.id) === null && (await p.evaluate(id => CogniLocalDb.getPacketsForResident(id), a.id)).length === 0, "the resident and their packets are gone");
  ok((await p.evaluate(() => CogniSecureStore.blobNames("cognicopia_localdb_"))).join().includes(k3.id) === false && !(await p.evaluate(() => CogniSecureStore.blobNames("cognicopia_localdb_"))).some(n => n.endsWith(a.id)), "and their sealed records are erased too");
  ok((await p.evaluate(() => CogniLocalDb.getResident("" + "x".repeat(8)))) === null, "another resident is untouched by a delete");

  /* ---- clear everything ---- */
  await p.evaluate(() => CogniLocalDb.clearAll());
  const after = await rawRows(p);
  ok(after.residents.length === 0 && after.packets.length === 0 && (await p.evaluate(() => CogniSecureStore.blobNames("cognicopia_localdb_"))).length === 0, "clearAll erases every row and every sealed record");

  /* ---- speed: 150 residents ---- */
  const ms = await p.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 150; i++) await CogniLocalDb.saveResident({ firstName: "Resident" + String(i).padStart(3, "0"), hometown: "Town " + i, cognitiveTier: ["Mild", "Moderate", "Advanced"][i % 3], interests: ["a", "b"] });
    const t1 = performance.now(); const n = (await CogniLocalDb.getAllResidents()).length; const t2 = performance.now();
    await CogniLocalDb.clearAll();
    return { save: Math.round(t1 - t0), list: Math.round(t2 - t1), n };
  });
  ok(ms.n === 150 && ms.list < 1500, `150 sealed residents are listed in ${ms.list} ms (saving them took ${ms.save} ms)`);
  await p.close();

  /* ---- a browser that cannot encrypt: plain rows, and it says so ---- */
  p = await ctx.newPage(); p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  await p.goto(base + "license-desk.html");                      // a page that does not load the encrypted store
  await p.addScriptTag({ url: base + "assets/services/localDb.js" });
  ok(await p.evaluate(() => typeof CogniSecureStore === "undefined"), "the test page has no encrypted store");
  ok((await p.evaluate(() => CogniLocalDb.info())).sealed === false, "without the encrypted store, info() says the rows are not sealed");
  const plain = await p.evaluate(async () => CogniLocalDb.saveResident({ firstName: "Walter", cognitiveTier: "Mild", hometown: "Bismarck" }));
  const praw = await rawRows(p);
  ok(praw.residents.length === 1 && praw.residents[0].sealed === false && praw.residents[0].data.firstName === "Walter", "the fallback keeps a plain row and marks it sealed:false");
  ok((await p.evaluate(id => CogniLocalDb.getResident(id), plain.id)).hometown === "Bismarck", "and it reads back");
  await p.evaluate(() => CogniLocalDb.clearAll());
  ok((await rawRows(p)).residents.length === 0, "and clears");
  await p.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("a request left the site: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length) { console.log(`local database check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`local database check passed: ${passed} checks in a real browser (residents and packets saved, read, updated and deleted; sealed at rest; locked and unlocked; damaged records shown; nothing leaves the page)`);
