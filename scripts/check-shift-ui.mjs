#!/usr/bin/env node
/* =====================================================================
   The Shift board (builder.html#/shift), in a real browser: what a staff
   member does with it, and what it keeps. (scripts/check-services.mjs
   proves the logic of CogniDailyOps; this proves the screen and the
   storage around it.)

     - initials come first (and lapse after 15 minutes without use); a note
       and a task are added, edited, finished, deleted and restored; open
       tasks carry forward to the next day; two tabs on one board never
       write over each other
     - a resident's name in a note is caught, and offered back as the alias
     - the board is encrypted at rest: its record is in the encrypted store
       and nowhere in plain localStorage, and no note's words are readable
       in what is stored
     - the retention rule runs when the board opens
     - the handoff sheet prints on whole US Letter pages with nothing clipped
     - a locked backup file round-trips, and a wrong passphrase is refused
     - with a passphrase set and the store locked, the board opens after the
       unlock and not before
     - every control is at least 52 px, and a phone has no sideways scroll

   Needs Playwright. Where it is not installed this exits 2 and says so, and
   npm run build skips it. Serves the repository on a free local port.
   Run: node scripts/check-shift-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const errors = [], problems = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const NOTE_WORDS = "restless after lunch";

const resident = (id, name, unit) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: unit, cognitiveTier: 2, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], other: "" }, difficulty: { level: 3 } },
  tier2_enrichment: { birthYear: 1936, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
const open = async (w = 1366, h = 1000) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });   // the print window is not what is tested
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("dialog", d => d.accept());                          // confirm() prompts: the person agrees
  return p;
};
const go = async (p, hash = "#/shift") => { await p.goto(base + "builder.html" + hash); await p.waitForSelector("#view h1", { timeout: 8000 }); await p.waitForTimeout(250); };
const seedResidents = (p, list) => p.evaluate(l => { l.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); }, list);
const useInitials = async (p, who) => { await p.fill("#shfInit", who); await p.click("#shfMeForm button[type=submit]"); await p.waitForTimeout(80); };
const addNote = async (p, text, { kind = "pass", about = "" } = {}) => {
  await p.click(`label:has(input[name=shfKind][value="${kind}"])`);
  if (about) await p.selectOption("#shfNAbout", about);
  await p.fill("#shfNText", text); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(120);
};
const count = (p, sel) => p.$$eval(sel, n => n.length);
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
const shown = (p, sel) => p.$eval(sel, e => !e.hidden && e.getBoundingClientRect().height > 0).catch(() => false);
/* the sealed records, as stored: names and the bytes of each (never the key) */
const stored = p => p.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("cognicopia-secure");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(["records"], "readonly"), st = tx.objectStore("records"), keys = st.getAllKeys(), vals = st.getAll();
    tx.oncomplete = () => res({ keys: keys.result, bytes: vals.result.map(v => Array.from(new Uint8Array(v.data)).map(c => String.fromCharCode(c)).join("")).join("\u0000") });
    tx.onerror = () => rej(tx.error);
  };
}));
const board = p => p.evaluate(() => JSON.parse(CG_LS.getItem("cognicopia_dailyops") || "null"));
/* the board's own day: a night shift before 7 am still belongs to the day before, so "yesterday" is counted from that day */
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - (d.getHours() < 7 ? 2 : 1)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

try {
  /* ---------- the first visit: initials come first ---------- */
  let p = await open();
  await go(p);
  await seedResidents(p, [resident("res-a", "Margaret", "302-B"), resident("res-b", "Peggy", "")]);
  await p.reload(); await p.waitForSelector("#view h1", { timeout: 8000 }); await p.waitForTimeout(300);
  ok((await text(p, "#view h1")) === "Shift board", "the screen opens as the Shift board");
  ok((await p.$eval(".sb-link[aria-current='page']", e => e.dataset.route)) === "shift" && (await p.$eval("details.sb-hub[open]", e => e.dataset.hub)) === "facility", "the sidebar marks Shift board, under Facility");
  ok((await text(p, "#shfWho")).includes("No initials on this board yet"), "with no initials on the board it says so");
  await p.fill("#shfNText", NOTE_WORDS); await p.click("#shfNote button[type=submit]");
  ok((await count(p, "#shfNotes .shf-entry")) === 0 && (await text(p, "#toast")).includes("Choose your initials first"), "a note cannot be added before choosing initials");
  await useInitials(p, "mr");
  ok((await p.$eval('input[name=shfMe][value="MR"]', e => e.checked)) && (await text(p, "#shfNoteAs")) === "Writing as MR", "initials are cleaned, chosen and shown: " + (await text(p, "#shfNoteAs")));
  /* a note */
  await addNote(p, NOTE_WORDS, { kind: "watch" });
  let entry = await text(p, "#shfNotes .shf-entry");
  ok((await count(p, "#shfNotes .shf-entry")) === 1 && entry.includes("Keep an eye on") && entry.includes(NOTE_WORDS) && entry.includes("Written by MR"), "a note is added with its kind named, its words and who wrote it: " + entry);
  ok((await p.$eval("#shfNotes .shf-entry svg", e => e.getAttribute("aria-hidden"))) === "true" && (await p.$eval("#shfNotes .shf-entry", e => e.classList.contains("shf-k-watch"))), "each kind has an icon and a name as well as a colour");
  ok((await p.$eval("#shfNText", e => e.value)) === "" && (await p.evaluate(() => document.activeElement.id)) === "shfNText", "the form is cleared and ready for the next note");
  ok((await text(p, "#shfSum")).includes("1 note, 0 open tasks"), "the summary counts the notes: " + (await text(p, "#shfSum")));
  /* the alias list: both residents are offered by alias, never by name */
  const opts = await p.$$eval("#shfNAbout option", o => o.map(x => x.textContent));
  ok(opts.includes("Resident 302-B") && opts.some(o => /^Resident [0-9A-Z]{4}$/.test(o)) && !opts.some(o => /Margaret|Peggy/.test(o)), "residents are offered by alias, never by name: " + opts.join(" | "));

  /* ---------- a name in a note ---------- */
  await p.fill("#shfNText", "Margaret was calm after the music"); await p.waitForTimeout(450);
  ok((await shown(p, "#shfNWarn .shf-warn")) && (await text(p, "#shfNWarn")).includes("Margaret"), "typing a resident's name shows a warning at once");
  await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(120);
  ok((await count(p, "#shfNotes .shf-entry")) === 1 && (await p.evaluate(() => document.activeElement.dataset.fix)) === "note", "saving with a name asks first, and puts focus on the choice");
  await p.click("[data-fix=note]"); await p.waitForTimeout(100);
  ok((await p.$eval("#shfNText", e => e.value)) === "Resident 302-B was calm after the music" && !(await shown(p, "#shfNWarn .shf-warn")), "'Use the alias' swaps the name for the resident's alias: " + (await p.$eval("#shfNText", e => e.value)));
  await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(150);
  ok((await count(p, "#shfNotes .shf-entry")) === 2 && !(await text(p, "#shfNotes")).includes("Margaret"), "the note is saved with the alias and without the name");
  await p.fill("#shfNText", "Peggy was calm after the music"); await p.waitForTimeout(450); await p.click("[data-fix=note]"); await p.waitForTimeout(100);
  const fixed = await p.$eval("#shfNText", e => e.value);
  ok(/^Resident [0-9A-Z]{4} was calm after the music$/.test(fixed), "a resident with no room number goes by a short code: " + fixed);
  await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(150);
  ok((await count(p, "#shfNotes .shf-entry")) === 3 && !(await text(p, "#shfNotes")).includes("Peggy"), "that note too is saved without the name");
  await p.fill("#shfNText", "Peggy sat by the window"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(100);
  await p.click("[data-keep=note]"); await p.waitForTimeout(150);
  ok((await count(p, "#shfNotes .shf-entry")) === 4 && (await text(p, "#shfNotes")).includes("Peggy sat by the window"), "'Keep as written and save' saves the note as typed: the board warns, it does not refuse");
  await p.fill("#shfNText", "She refused the afternoon walk"); await p.waitForTimeout(450);
  ok((await text(p, "#shfNWarn")).includes("Declined"), "a judging word gets a gentler suggestion, and does not stop the save");
  await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(120);
  ok((await count(p, "#shfNotes .shf-entry")) === 5, "a wording tip never blocks a save");

  /* ---------- tasks ---------- */
  await useInitials(p, "kt");
  await p.fill("#shfTWhat", "Set up the music cart"); await p.selectOption("#shfTFor", "KT"); await p.click("#shfTask button[type=submit]"); await p.waitForTimeout(120);
  let task = await text(p, "#shfTasks .shf-entry");
  ok((await count(p, "#shfTasks .shf-entry")) === 1 && task.includes("Set up the music cart") && task.includes("For KT") && task.includes("Added by KT"), "a task is added for a teammate: " + task);
  ok((await text(p, "#shfSum")).includes("1 open task"), "an open task is counted");
  await p.click("label.shf-done"); await p.waitForTimeout(120);
  task = await text(p, "#shfTasks .shf-entry");
  ok(/Done \d{1,2}:\d{2} (am|pm) by KT/.test(task) && (await p.$eval("label.shf-done input", e => e.checked)) && (await text(p, "#shfSum")).includes("0 open tasks"), "marking a task done says when and by whom: " + task);
  ok((await p.evaluate(() => document.activeElement.dataset.done)) !== undefined, "focus stays on the task after it is ticked");
  await p.click("label.shf-done"); await p.waitForTimeout(120);
  ok(!(await p.$eval("label.shf-done input", e => e.checked)) && (await text(p, "#shfSum")).includes("1 open task"), "a task can be reopened");
  /* carried forward: a task for yesterday that is still open shows today */
  await p.fill("#shfTWhat", "Print the Maple 2 packets"); await p.fill("#shfTDay", yesterday()); await p.click("#shfTask button[type=submit]"); await p.waitForTimeout(150);
  ok((await text(p, "#toast")).includes("Task added for"), "a task for another day says which day it is for");
  await p.click("[data-day=today]"); await p.waitForTimeout(100);
  ok((await text(p, "#shfTasks")).includes("Carried forward") && (await text(p, "#shfTasks")).includes("Print the Maple 2 packets"), "an open task from yesterday is carried forward to today");
  ok((await text(p, "#shfSum")).includes("2 open tasks (1 carried forward)"), "the summary counts the carried task: " + (await text(p, "#shfSum")));
  await p.click("[data-day='-1']"); await p.waitForTimeout(100);
  ok((await p.$eval("#shfDay", e => e.value)) === yesterday() && (await count(p, "#shfTasks .shf-entry")) === 1 && !(await text(p, "#shfTasks")).includes("Carried"), "yesterday shows its own task and no carried ones");
  await p.click("[data-day=today]"); await p.waitForTimeout(100);

  /* ---------- edit, delete, undo ---------- */
  await p.click("#shfNotes [data-edit] >> nth=0"); await p.waitForTimeout(100);
  ok((await p.$eval("#shfNText", e => e.value.length)) > 0 && (await text(p, "#shfNoteForm legend")).includes("Change this note") && (await p.evaluate(() => document.activeElement.id)) === "shfNText", "Edit fills the form with the note and puts focus in it");
  const before = await p.$eval("#shfNText", e => e.value);
  await p.fill("#shfNText", before + " (corrected)"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(150);
  ok((await text(p, "#shfNotes")).includes("(corrected)") && (await text(p, "#shfNotes")).includes("edited by KT") && (await count(p, "#shfNotes .shf-entry")) === 5, "an edit keeps one note, and names the editor when it is not the author");
  await p.click("#shfNotes [data-del] >> nth=0"); await p.waitForTimeout(120);
  ok((await count(p, "#shfNotes .shf-entry")) === 4 && (await text(p, "#toast")).includes("Note deleted"), "a note can be deleted");
  await p.click("#toastAct"); await p.waitForTimeout(150);
  ok((await count(p, "#shfNotes .shf-entry")) === 5 && (await text(p, "#toast")).includes("Restored"), "Undo brings it back");

  /* ---------- what is stored ---------- */
  const plain = await p.evaluate(() => Object.keys(localStorage).filter(k => /dailyops/.test(k) || /restless|Maple 2|music cart/i.test(localStorage.getItem(k) || "")));
  ok(plain.length === 0, "nothing of the board is in plain localStorage: " + plain.join(", "));
  await p.evaluate(() => CogniSecureStore.flush());
  const s = await stored(p);
  ok(s.keys.includes("cognicopia_dailyops"), "the board is a sealed record in the encrypted store");
  ok(!/restless|music cart|Maple 2|calm after|afternoon walk|window/.test(s.bytes), "no note's or task's words can be read in the stored bytes");
  const b = await board(p);
  ok(b && b.schema === "cognicopia.dailyOps" && b.notes.length === 5 && b.tasks.length === 2 && b.staff.slice().sort().join() === "KT,MR", "the stored board is the one on screen: " + JSON.stringify(b && { n: b.notes.length, t: b.tasks.length, s: b.staff }));
  const js = JSON.stringify(b);
  ok(!/Margaret/.test(js) && (js.match(/Peggy/g) || []).length === 1, "the only name kept is the one staff chose to keep as written");

  /* ---------- the handoff sheet ---------- */
  await p.click("#shfPrint"); await p.waitForTimeout(600);
  ok((await p.evaluate(() => window.__printed)) === 1, "Print handoff sheet opens the print window");
  const sheet = await p.evaluate(() => {
    const root = document.getElementById("printRoot"), keep = root.style.cssText;
    root.style.cssText = "display:block;position:absolute;left:-10000px;top:0";            // as the page measures it: off screen, but laid out
    const s = [...root.querySelectorAll(".ops-sheet")];
    const out = { n: s.length, text: s.map(x => x.textContent.replace(/\s+/g, " ")).join(" "), clipped: s.map(x => { const b = x.querySelector(".ops-body"); return b.scrollHeight - b.clientHeight; }), box: s[0] && [s[0].offsetWidth, s[0].offsetHeight] };
    root.style.cssText = keep; return out;
  });
  ok(sheet.n >= 1 && sheet.box[0] === 816 && sheet.box[1] === 1056, "the sheet is one US Letter page (8.5 x 11 in)");
  ok(/Shift handoff/.test(sheet.text) && /All shifts/.test(sheet.text) && /Keep an eye on/.test(sheet.text) && sheet.text.includes(NOTE_WORDS) && /Open tasks/.test(sheet.text) && /Set up the music cart/.test(sheet.text) && /carried from Oct/.test(sheet.text), "the sheet carries the notes, the open tasks and the carried one");
  ok(sheet.clipped.every(c => c <= 0), "nothing is cut off at the foot of any page: " + sheet.clipped.join(","));
  const pdf = path.join(os.tmpdir(), "shift-handoff-check.pdf");
  await p.emulateMedia({ media: "print" });
  fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true }));
  await p.emulateMedia({ media: "screen" });
  ok(fs.statSync(pdf).size > 3000 && fs.readFileSync(pdf).subarray(0, 5).toString() === "%PDF-", "the sheet makes a PDF");
  fs.writeFileSync(path.join(os.tmpdir(), "shift-handoff-pages.txt"), String(sheet.n));

  /* ---------- a backup file, and a wrong passphrase ---------- */
  await p.fill("#shfBkPass", "short"); await p.click("#shfBk"); await p.waitForTimeout(100);
  ok((await text(p, "#shfBkMsg")).includes("at least 10 characters"), "a short passphrase is refused for the file");
  await p.fill("#shfBkPass", "a long enough passphrase");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#shfBk")]);
  const file = path.join(os.tmpdir(), "shift-board-check.cognicopia"); await dl.saveAs(file);
  const env = JSON.parse(fs.readFileSync(file, "utf8"));
  ok(/\.cognicopia$/.test(dl.suggestedFilename()) && env.format === "cognicopia-locked" && env.kind === "dailyops" && env.cipher.name === "AES-GCM" && env.kdf.iterations >= 600000, "the backup is a locked .cognicopia file of kind dailyops: " + dl.suggestedFilename());
  ok(!fs.readFileSync(file, "utf8").match(/restless|music cart|Maple/), "nothing in the backup file is readable without the passphrase");
  await p.click("#shfClear"); await p.waitForTimeout(150);
  ok((await count(p, "#shfNotes .shf-entry")) === 0 && (await board(p)) === null && (await text(p, "#toast")).includes("cleared"), "Clear the board empties it, and the record is gone");
  await p.setInputFiles("#shfRsFile", file); await p.fill("#shfRsPass", "the wrong passphrase"); await p.click("#shfRs"); await p.waitForTimeout(2500);
  ok((await text(p, "#shfBkMsg")).includes("does not open this file") && (await count(p, "#shfNotes .shf-entry")) === 0, "a wrong passphrase is refused and adds nothing");
  await p.fill("#shfRsPass", "a long enough passphrase"); await p.click("#shfRs"); await p.waitForTimeout(2500);
  ok((await count(p, "#shfNotes .shf-entry")) === 5 && (await count(p, "#shfTasks .shf-entry")) >= 1 && (await text(p, "#shfBkMsg")).includes("Added 5 notes and 2 tasks"), "the right passphrase adds the notes and tasks back: " + (await text(p, "#shfBkMsg")));
  await p.setInputFiles("#shfRsFile", file); await p.fill("#shfRsPass", "a long enough passphrase"); await p.click("#shfRs"); await p.waitForTimeout(2500);
  ok((await count(p, "#shfNotes .shf-entry")) === 5 && (await text(p, "#shfBkMsg")).includes("Added 0 notes and 0 tasks"), "opening the same file again adds nothing twice");
  const wrongKind = path.join(os.tmpdir(), "shift-not-a-board.cognicopia");
  fs.writeFileSync(wrongKind, "this is not a locked file");
  await p.setInputFiles("#shfRsFile", wrongKind); await p.fill("#shfRsPass", "a long enough passphrase"); await p.click("#shfRs"); await p.waitForTimeout(300);
  ok((await text(p, "#shfBkMsg")).includes("not a locked Cognicopia file"), "a file that is not locked is refused with a plain message");

  /* ---------- retention runs when the board opens ---------- */
  await p.evaluate(async () => {
    const D = CogniDailyOps, day = n => { const d = new Date(D.slotAt().day + "T12:00:00"); d.setDate(d.getDate() - n); return D.isoDay(d); };
    const mk = (id, n, o) => D.normalizeNote(Object.assign({ id, day: day(n), text: "kept " + id, by: "MR" }, o));
    const t = (id, n, o) => D.normalizeTask(Object.assign({ id, day: day(n), what: "task " + id, by: "MR" }, o));
    const b = Object.assign(D.emptyBoard(), { keepDays: 14, staff: ["MR"], notes: [mk("old1", 40), mk("old2", 15), mk("new1", 3), mk("today", 0)], tasks: [t("openold", 40), t("doneold", 40, { done: true, doneAt: new Date(Date.now() - 39 * 864e5).toISOString() }), t("donenew", 40, { done: true, doneAt: new Date().toISOString() })] });
    CG_LS.setItem(D.STORE_KEY, JSON.stringify(b)); await CogniSecureStore.flush();
  });
  await go(p, "#/roster"); await go(p);
  const kept = await board(p);
  ok(kept.notes.map(n => n.id).sort().join() === "new1,today" && kept.tasks.map(t => t.id).sort().join() === "donenew,openold", "on opening: notes older than 14 days and long-finished tasks go; an open task and one finished today stay: " + JSON.stringify([kept.notes.map(n => n.id), kept.tasks.map(t => t.id)]));
  await p.selectOption("#shfKeep", "7"); await p.waitForTimeout(150);
  ok((await board(p)).keepDays === 7 && (await board(p)).notes.map(n => n.id).join() === "new1,today", "choosing 7 days keeps the choice (and the 3-day-old note)");
  await p.selectOption("#shfKeep", "90"); await p.waitForTimeout(150);
  ok((await board(p)).keepDays === 90, "and 90 days");

  /* ---------- a heavy day, in every kind of text: nothing is cut off ---------- */
  const layout = await p.evaluate(async () => {
    await Promise.all(["400", "700", "italic 400"].map(w => document.fonts.load(w + ' 16px "Atkinson Hyperlegible"')));
    const D = CogniDailyOps, now = new Date(), day = D.slotAt().day;
    const seeds = { prose: "An observation of ordinary length, written the way people write it. ", caps: "AN OBSERVATION OF ORDINARY LENGTH WRITTEN BY SOMEONE WHO TYPES IN CAPITALS. ", wide: "Mmm WWW mmm WWW mmm WWW mmm WWW mmm WWW mmm WWW mmm WWW mmm WWW. ", mixed: "Resident 12 walked the hall (3x) with RN; BP 128/76, pulse 72. Said NO to lunch. " };
    const over = pages => { const host = document.createElement("div"); host.style.cssText = "position:absolute;left:-10000px;top:0"; host.innerHTML = pages.join(""); document.body.appendChild(host); const o = [...host.querySelectorAll(".ops-body")].map(b => b.scrollHeight - b.clientHeight); host.remove(); return Math.max(...o); };
    const out = {};
    for (const [k, seed] of Object.entries(seeds)){
      let b = D.emptyBoard();
      for (let i = 0; i < 40; i++) b = D.withNote(b, D.makeNote({ day, time: String(7 + (i % 15)).padStart(2, "0") + ":" + String(10 + (i % 40)), kind: ["watch", "pass", "worked"][i % 3], about: i % 4 ? "Room " + i : "", text: seed.repeat(1 + (i % 7)).slice(0, 60 + i * 11), by: "MR" }, new Date(now.getTime() + i)).note);
      for (let i = 0; i < 16; i++) b = D.withTask(b, D.makeTask({ day: D.addDays(day, -(i % 3)), what: seed.slice(0, 30 + i * 9), by: "MR", assignee: i % 2 ? "KT" : "", shift: ["", "day", "evening", "night"][i % 4] }, now).task);
      const pages = D.handoffPages(D.handoff(b, day, "all", now), { facility: "", today: day });
      out[k] = { pages: pages.length, over: over(pages) };
    }
    return out;
  });
  ok(Object.values(layout).every(l => l.over <= 0 && l.pages >= 4), "a heavy day in prose, capitals, wide letters or clinical shorthand is laid out with nothing cut off: " + JSON.stringify(layout));
  /* if the real type were wider than the estimate, the print step lays the pages out again with room to spare */
  await p.evaluate(async () => {
    const D = CogniDailyOps, now = new Date(), day = D.slotAt().day; let b = D.emptyBoard();
    for (let i = 0; i < 30; i++) b = D.withNote(b, D.makeNote({ day, time: "09:" + String(10 + i), kind: "pass", about: "Room " + i, text: "An observation of ordinary length, written the way people write it. ".repeat(1 + (i % 6)), by: "MR" }, new Date(now.getTime() + i)).note);
    CG_LS.setItem(D.STORE_KEY, JSON.stringify(b)); await CogniSecureStore.flush();
  });
  await go(p, "#/roster"); await go(p);
  await p.addStyleTag({ content: ".ops-text{font-size:13.5pt !important}" });             // type wider than the estimate expects
  await p.click("#shfPrint"); await p.waitForTimeout(900);
  const refit = await p.evaluate(() => { const root = document.getElementById("printRoot"), keep = root.style.cssText; root.style.cssText = "display:block;position:absolute;left:-10000px;top:0"; const s = [...root.querySelectorAll(".ops-sheet")]; const o = { n: s.length, over: Math.max(...s.map(x => { const b = x.querySelector(".ops-body"); return b.scrollHeight - b.clientHeight; })), rows: s.reduce((n, x) => n + x.querySelectorAll(".ops-row").length, 0) }; root.style.cssText = keep; return o; });
  ok(refit.over <= 0 && refit.rows === 30, "wider type than expected: the pages are laid out again with room to spare, nothing cut off and all 30 notes printed: " + JSON.stringify(refit));

  /* ---------- the same page on a phone, in Night Shift ---------- */
  await p.close();
  p = await open(390, 844);
  await go(p);
  await useInitials(p, "ab"); await addNote(p, "A note on a small screen");
  await p.click(".cg-night-shift-toggle").catch(() => {});
  const phone = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll("#shfRoot button, #shfRoot select, #shfRoot input:not([type=radio]):not([type=checkbox]), #shfRoot textarea, #shfRoot label.shf-done, #shfRoot .seg label")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && !e.closest("[hidden]") && (b.height < 51.5 || b.width < 51.5); }).map(e => (e.id || e.className || e.tagName) + ":" + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)) }));
  ok(phone.over <= 0, "no sideways scroll on a phone: " + phone.over);
  ok(phone.small.length === 0, "every control is at least 52 px on a phone: " + phone.small.join(", "));
  await p.close();

  /* ---------- the keyboard alone ---------- */
  p = await open();
  await go(p);
  await p.focus("#shfInit"); await p.keyboard.type("jd"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  ok((await text(p, "#shfNoteAs")) === "Writing as JD" && (await p.$eval('input[name=shfMe][value="JD"]', e => e.checked)), "initials typed and entered with the keyboard");
  await p.focus('input[name=shfKind][value="pass"]'); await p.keyboard.press("ArrowLeft");
  ok(await p.$eval('input[name=shfKind][value="watch"]', e => e.checked), "the arrow keys move between the kinds of note");
  await p.focus("#shfNText"); await p.keyboard.type("Typed without a mouse"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
  await p.focus("#shfTWhat"); await p.keyboard.type("Fill the water jug"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  ok((await count(p, "#shfTasks .shf-entry")) === 1, "Enter in the task field adds the task");
  await p.focus("label.shf-done input"); await p.keyboard.press("Space"); await p.waitForTimeout(150);
  ok((await p.$eval("label.shf-done input", e => e.checked)) && (await text(p, "#shfTasks")).includes("Done"), "Space ticks a task done");
  ok((await p.evaluate(() => document.activeElement.hasAttribute("data-done"))), "and the focus is still on that task afterwards");
  await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(120);
  ok((await count(p, "#shfNotes .shf-entry")) === 1 && (await text(p, "#shfNotes")).includes("Keep an eye on"), "the note chosen by keyboard is added as that kind");
  await p.close();

  /* ---------- initials are forgotten after 15 minutes without use ---------- */
  const ctxI = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: "block" });
  p = await ctxI.newPage();
  p.on("pageerror", e => errors.push(e.message));
  await p.clock.install();
  await go(p);
  await useInitials(p, "mr");
  await addNote(p, "Written as MR");
  ok((await count(p, "#shfNotes .shf-entry")) === 1, "initials in use: a note is added");
  await p.evaluate(() => window.CognicopiaSession.setLimit(30 * 24 * 3600 * 1000));      // the page's own 15-minute timeout (js/sessionTimeout.js) would reset the screen; this step is about the board's own rule
  await p.clock.fastForward(16 * 60 * 1000); await p.waitForTimeout(100);
  await p.fill("#shfNText", "Written after a long gap"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(100);
  ok((await count(p, "#shfNotes .shf-entry")) === 1 && (await text(p, "#toast")).includes("Choose your initials first"), "after 15 minutes without use the initials are forgotten, so a note is not written under them");
  await p.click('label:has(input[name=shfMe][value="MR"])'); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(100);
  ok((await count(p, "#shfNotes .shf-entry")) === 2, "choosing them again is one tap");
  await ctxI.close();

  /* ---------- two tabs on one board: neither writes over the other ---------- */
  const ctxT = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: "block" });
  const t1 = await ctxT.newPage(), t2 = await ctxT.newPage();
  for (const t of [t1, t2]) t.on("pageerror", e => errors.push(e.message));
  await go(t1); await go(t2);
  await useInitials(t1, "mr"); await useInitials(t2, "kt");
  await t2.focus("#shfNText");                                           // typing here: this tab does not redraw when the other changes the board
  await addNote(t1, "From the first tab"); await t1.evaluate(() => CogniSecureStore.flush()); await t2.waitForTimeout(700);
  ok((await count(t2, "#shfNotes .shf-entry")) === 0, "the second tab, being typed in, still shows the old board");
  await t2.fill("#shfNText", "From the second tab"); await t2.click("#shfNote button[type=submit]"); await t2.waitForTimeout(300);
  ok((await count(t2, "#shfNotes .shf-entry")) === 2 && (await board(t2)).notes.length === 2, "adding in the second tab keeps the first tab's note: both are stored and shown");
  await t2.evaluate(() => CogniSecureStore.flush()); await t1.waitForTimeout(700);
  ok((await count(t1, "#shfNotes .shf-entry")) === 1, "the first tab, being typed in, waits");
  await t1.evaluate(() => document.activeElement.blur()); await t1.waitForTimeout(400);
  ok((await count(t1, "#shfNotes .shf-entry")) === 2, "and shows both as soon as the person stops typing");
  await ctxT.close();

  /* ---------- a passphrase, a locked store: the board waits for the unlock ---------- */
  p = await open();
  await go(p);
  await useInitials(p, "mr"); await addNote(p, "Locked store note", { kind: "worked" });
  await p.evaluate(async () => { await CogniSecureStore.flush(); await CogniSecureStore.setPassphrase("shared station passphrase"); await CogniSecureStore.lock(); });
  await p.reload(); await p.waitForTimeout(900);                    // what Settings > Lock now does, so no name stays on screen
  ok(await shown(p, "#cssPass"), "with a passphrase set and the store locked, the unlock prompt shows first");
  ok((await text(p, "body")).indexOf("Locked store note") < 0, "the board's words are not on screen while locked");
  const dlg = await p.evaluate(() => [...document.querySelectorAll("#cssPass, #cssKeep, #cssSkip, form[role=dialog] button[type=submit]")].map(e => Math.round(e.getBoundingClientRect().height)));
  ok(dlg.length === 4 && dlg.every(h => h >= 52), "the unlock prompt's controls are at least 52 px: " + dlg.join(","));
  await p.fill("#cssPass", "wrong guess here"); await p.click("form[role=dialog] button[type=submit]"); await p.waitForTimeout(2500);
  ok((await text(p, "#cssMsg")).length > 0 && await shown(p, "#cssPass"), "a wrong passphrase leaves the prompt open, with a message");
  await p.fill("#cssPass", "shared station passphrase"); await p.click("form[role=dialog] button[type=submit]"); await p.waitForTimeout(2500);
  await p.waitForSelector("#shfRoot", { timeout: 6000 });
  ok((await text(p, "#shfNotes")).includes("Locked store note"), "after the unlock the board is there, as it was left");
  await p.close();
} finally {
  await browser.close(); srv.close();
}

if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length){ console.log(`shift board check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`shift board check passed: ${passed} checks in a real browser (add, name check, edit, undo, carry forward, keyboard, initials lapse, two tabs, encrypted at rest, retention, print layout, locked backup, locked store, phone)`);
