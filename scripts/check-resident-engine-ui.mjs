#!/usr/bin/env node
/* =====================================================================
   The resident profile engine, driven in a real browser (Playwright; exit 2 where it is not installed):

     the one resident   chosen once in "Working with" (or in the Roster), it stays chosen across tools for this tab only (session
                        storage, never the disk) and fills the Packet Builder's form, the Life Planner and the Life Journal, and
                        opens Session Notes, the Memory Digest, Reminiscence Cards and the Roster on them
     the record         the Roster holds a stage, today's schedule and a record of what they took part in and how they were; a note
                        that names them is refused; a Shift board entry about them (by alias) lands there too; a packet printed for
                        them is noted; the suggested tier gives its reasons, changes nothing until accepted, and then changes the profile
     the staff pages    three pages (cover, facilitation, calming) print apart from the resident's packet, with the alias and no name,
                        in pure black
     the two groups     "Resident tools" and "Staff & family portal" head the hubs in the Builder's menu; the planner's care companion
                        has its own address and opens on its staff tab
     all                nothing is requested from outside the page, and no page script fails
   ===================================================================== */
import fs from "fs";
import { serve, loadPlaywright } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const outside = [], errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block", acceptDownloads: true });
const pg = await ctx.newPage();
pg.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
pg.on("pageerror", e => errors.push(e.message));
pg.on("dialog", d => d.accept());
await pg.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; window.__printHtml = (document.getElementById("printRoot") || {}).innerHTML || ""; }; });
const go = async hash => { await pg.goto(base + "builder.html" + hash); await pg.waitForTimeout(1300); };
const tmp = "/tmp/cognicopia-resident-engine-census.csv";
fs.writeFileSync(tmp, 'Alias,Preferred Name,GDS,Life Era,Hobbies,Wing,Room\n"Resident 201-A",Dorothy,5,"1940s-1950s","gardening; church choir",Memory Care Unit A,201-A\nResident 202-B,Walter,3,1960s,"fishing",Memory Care Unit A,202-B\n');

/* ---------- two residents, from a census ---------- */
await go("#/roster");
await pg.click("#rsCs > summary"); await pg.setInputFiles("#rsCsFile", tmp); await pg.click("#rsCsRead"); await pg.waitForSelector("#rsCsGo"); await pg.click("#rsCsGo"); await pg.waitForTimeout(500);
ok(await pg.$$eval("#rsList .rs-res", e => e.length) === 2, "two residents are on the roster");
ok(await pg.$eval("#arSel", s => s.options.length) === 3, "the Working with list offers both, and a blank");

/* ---------- the two headings in the Builder's menu ---------- */
const heads = await pg.$$eval(".sb-grp", e => e.map(x => x.textContent.trim()));
ok(heads.join("|") === "Resident tools|Staff & family portal", `the menu has the two headings: ${heads.join(" | ")}`);
ok((await pg.$$eval("#sidebar .sb-hub[data-hub='facility'] .sb-link", e => e.map(x => x.textContent.trim()))).some(t => /Family digest/.test(t)) && (await pg.$$eval("#sidebar .sb-hub[data-hub='facility'] .sb-link", e => e.map(x => x.textContent.trim()))).some(t => /Care cues/.test(t)), "the family digest and the care cues are on the staff side");
ok(!(await pg.$$eval("#sidebar .sb-hub[data-hub='studio'] .sb-link", e => e.map(x => x.textContent))).some(t => /digest/i.test(t)), "and no longer under the resident tools");
const order = await pg.$$eval("#sidebar .sb-nav > *", e => e.map(x => x.className.indexOf("sb-grp") >= 0 ? "G:" + x.dataset.grp : x.dataset.hub || "?"));
ok(order.join(",") === "G:resident,today,studio,packets,G:staff,facility,academy,resources,?", `the hubs fall under their headings: ${order.join(",")}`);

/* ---------- choosing the one resident ---------- */
const dorothy = await pg.$eval("#arSel", s => [...s.options].filter(o => /Dorothy/.test(o.textContent)).map(o => o.value)[0]);
ok(!!dorothy, "Dorothy is in the list");
await pg.selectOption("#arSel", dorothy); await pg.waitForTimeout(500);
ok(await pg.evaluate(() => sessionStorage.getItem("cgb_active_resident")) === dorothy, "the choice is kept for this tab (session storage)");
ok(!(await pg.evaluate(() => { for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).indexOf("active") >= 0 && localStorage.getItem(localStorage.key(i)) === "") return false; for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) || "").indexOf("cgb_active") >= 0) return true; return false; })), "and it is not written to the disk");
ok((await pg.textContent(".rs-name")).indexOf("Dorothy") >= 0, "the Roster opens on them");

/* ---------- the record ---------- */
ok(await pg.$(".tr-panel") !== null && await pg.$("#trStage") !== null, "the Roster carries the daily record");
ok(/Tier 2 · Guided/.test(await pg.textContent(".tr-suggest")), "with a suggested tier that starts from the stage on the census (GDS 5 reads as Tier 2)");
await pg.selectOption("#trStage", "5"); await pg.waitForTimeout(200);
await pg.fill("#trAct", "Singing together"); await pg.selectOption("#trPart", "engaged"); await pg.fill("#trNote", "Dorothy hummed along"); await pg.click("#trAdd"); await pg.waitForTimeout(200);
ok(/name/i.test(await pg.textContent("#trMsg")) && await pg.$$eval(".tr-log li", e => e.length) === 0, "a note that names the resident is refused, with the reason");
await pg.fill("#trNote", "Hummed along the whole time"); await pg.selectOption("#trPillar", "music"); await pg.selectOption("#trMood", "calm"); await pg.click("#trAdd"); await pg.waitForTimeout(250);
ok(await pg.$$eval(".tr-log li", e => e.length) === 1 && /Singing together/.test(await pg.textContent(".tr-log")), "a clean note is added to the record");
ok(/Done/.test(await pg.$eval("#trSlot-afternoon, #trSlot-morning, #trSlot-evening", e => e.options[e.selectedIndex].textContent) + (await pg.$$eval(".tr-slots select", s => s.map(x => x.options[x.selectedIndex].textContent).join(" ")))), "and settles that part of today as done");
ok(/two weeks|too few/.test(await pg.textContent(".tr-suggest")) || /Only one session/.test(await pg.textContent(".tr-suggest")), "one session is too few for a suggestion to change");
/* five unsettled sessions: the suggestion moves a step, says why, and waits to be accepted */
for (let i = 0; i < 5; i++) { await pg.fill("#trAct", "Chair yoga " + i); await pg.selectOption("#trPart", "watched"); await pg.selectOption("#trMood", i % 2 ? "restless" : "distracted"); await pg.fill("#trNote", ""); await pg.click("#trAdd"); await pg.waitForTimeout(120); }
const sg = (await pg.textContent(".tr-suggest")).replace(/\s+/g, " ");
ok(/Suggested support tier: Tier 3/.test(sg) && /restlessness|watched/.test(sg) && /never changes anything by itself/.test(sg), `the suggestion moves one step, says why, and says it is only a suggestion: ${sg.slice(0, 220)}`);
ok(/Tier 2/.test(await pg.textContent(".rs-tier-2, .rs-res")), "the profile is still Tier 2 until it is accepted");
await pg.click("#trUse"); await pg.waitForTimeout(500);
ok(await pg.$(".rs-tier-3") !== null, "accepting changes the profile's tier");
await pg.click(".tr-log li button"); await pg.waitForTimeout(150);
ok(await pg.$$eval(".tr-log li", e => e.length) === 5, "an entry can be removed");

/* ---------- the Shift board feeds the record, by alias ---------- */
await go("#/shift");
await pg.fill("#shfInit", "MR"); await pg.click("#shfMeForm button[type=submit]");
await pg.selectOption("#shfEWho", "Resident 201-A"); await pg.fill("#shfEAct", "Sing-along");
await pg.check('input[name="shfEPart"][value="joined"]', { force: true }); await pg.check('input[name="shfEMood"][value="overstimulated"]', { force: true });
await pg.click("#shfEng button[type=submit]"); await pg.waitForTimeout(400);
await go("#/roster");
ok(/Sing-along/.test(await pg.textContent(".tr-log").catch(() => "")), "a Shift board record about them (by alias) lands in their record");

/* ---------- the tools open on them ---------- */
await go("#/planner");
ok(/Dorothy/.test(await pg.$eval("#lpName", e => e.value).catch(() => "")), "the Life Planner opens filled in for the resident we are working with");
await go("#/journal");
ok(/Dorothy/.test(await pg.$eval("#lj-name", e => e.value).catch(() => "")), "the Life Journal too");
await go("#/clinical");
ok(await pg.$eval("#clWho", e => e.value) === dorothy, "Session Notes opens on them");
await go("#/heirloom");
ok(await pg.$eval("#hlWho", e => e.value) === dorothy, "the Memory Digest too");
await go("#/reminiscence");
ok(await pg.$eval("#rmWho", e => e.value) === dorothy, "and Reminiscence Cards");
/* changing the one resident changes what the next tool opens on, and a form holding someone else offers to be filled in */
await pg.selectOption("#arSel", await pg.$eval("#arSel", s => [...s.options].filter(o => /Walter/.test(o.textContent)).map(o => o.value)[0])); await pg.waitForTimeout(400);
ok(await pg.$eval("#rmWho", e => e.value) !== dorothy, "choosing Walter changes the tool on screen");
await go("#/planner");
ok(await pg.$(".ar-banner") !== null, "the planner, holding Dorothy's details, offers to fill itself in for Walter");
await pg.click(".ar-banner button"); await pg.waitForTimeout(500);
ok(/Walter/.test(await pg.$eval("#lpName", e => e.value)) && await pg.$(".ar-banner") === null, "one click fills it in for Walter");

/* ---------- a packet: the form opens on them, printing notes it, the staff companion prints apart ---------- */
await go("#/category/word");
await pg.click(".act-card, [data-act]").catch(() => {}); await pg.waitForTimeout(400);
const first = await pg.$("[data-act]"); if (first) await first.click(); await pg.waitForTimeout(500);
ok(/Walter/.test(await pg.$eval("#cfgName", e => e.value).catch(() => "")) && /1960s/.test(await pg.$eval("#cfgEra", e => e.options[e.selectedIndex].textContent).catch(() => "")), "the Packet Builder's form opens with their name and their era");
await pg.click("#cfgAdd, [data-add-packet], button:has-text('Add to Packet')").catch(() => {}); await pg.waitForTimeout(400);
await pg.evaluate(() => document.getElementById("openPacket").click()); await pg.waitForTimeout(300);
ok(await pg.$eval("#staffCompanion", e => !e.disabled).catch(() => false), "with a page in the packet, the staff companion can be printed");
await pg.click("#staffCompanion"); await pg.waitForTimeout(700);
const staff = await pg.evaluate(() => ({ n: window.__printed || 0, html: window.__printHtml || "", sheets: document.querySelectorAll("#printRoot .lp-sheet").length }));
ok(staff.sheets >= 4 && staff.sheets <= 7, `the three staff pages print, with a notes page for the packet's pages (${staff.sheets})`);
ok(/Resident 202-B|Resident/.test(staff.html) && !/Walter/.test(staff.html), "they carry the alias, and not the name");
ok(/Session overview/.test(staff.html) && /Facilitation and care tips/.test(staff.html) && /If they become unsettled/.test(staff.html), "cover, facilitation and calming, in that order");
ok(!/Guest/.test(staff.html), "no Guest label");
await pg.evaluate(() => document.getElementById("generatePdf").click()); await pg.waitForTimeout(800);
const packetMade = await pg.evaluate(() => { for (let i = 0; i < CG_LS.length; i++) { const k = CG_LS.key(i); if (k.indexOf("cognicopia_track_") === 0 && /"packets":\[\{/.test(CG_LS.getItem(k))) return true; } return false; });
ok(packetMade, "printing the packet noted it in the resident's record");
await pg.emulateMedia({ media: "print" });
const resident = await pg.evaluate(() => { const r = document.getElementById("printRoot"); return r ? { text: r.innerText, clean: r.classList.contains("res-clean"), anchors: r.querySelectorAll(".sh-anchor,[data-staffline]").length, shown: [...r.querySelectorAll(".sh-anchor,[data-staffline],.care-coaching-footer,.sh-ans,.sh-sensory,.art-sensory")].filter(e => getComputedStyle(e).display !== "none").length } : { text: "", clean: false, anchors: 0, shown: 0 }; });
await pg.emulateMedia({ media: "screen" });
ok(resident.clean && resident.anchors > 0, "the packet's pages are marked to keep staff lines off");
ok(resident.shown === 0, "every staff line on them is hidden in print");
ok(!/Staff companion|GDS|Tier \d|Therapy:|Clinical Tip|For staff/.test(resident.text), "the resident's own printed pages carry no staff words, stage or tier");

/* ---------- the care companion has its own address ---------- */
await go("#/planner-care-companion");
ok(await pg.$eval("#lpTab-3", e => e.getAttribute("aria-selected")) === "true", "the planner's care companion opens on its staff tab");
ok(await pg.$eval('.sb-link[data-route="planner-care-companion"]', e => e.getAttribute("aria-current")) === "page", "and its menu link is marked");

ok(outside.length === 0, "nothing was requested from outside the page" + (outside.length ? ": " + outside.slice(0, 3).join(", ") : ""));
ok(errors.length === 0, "no script error" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
await browser.close(); srv.close();
console.log(problems.length ? `resident engine screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `resident engine screen check passed: ${passed} checks in a real browser (one resident across the tools, the daily record and the suggested tier, the staff companion apart from the resident's pages, the two menu groups, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
