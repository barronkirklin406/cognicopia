#!/usr/bin/env node
/* =====================================================================
   "More of their story" in the resident profile, and where it goes: in a real browser.

   The profile's last step has an optional, closed section: moments in their life, a dish they were known for and
   what comforts them. Each person or pet can also have a photo. All of it is saved in the sealed store with the
   rest of the profile, and the Activity Page Studio's life pages use it.

     closed     the section is closed until asked for, and the form is no longer for people who skip it
     saves      moments (with or without a year), a dish, comforts ticked and typed are in the saved profile
     photo      a picture is made smaller and gray on this computer, sealed apart from the profile, and only its
                name is kept in the profile; nothing of it is in plain browser storage
     returns    opening the resident again shows it all, with the section open and the picture in its row
     older      a profile saved before this change opens and saves as before, and loses nothing
     pages      in the Studio her life story follows her moments in order of year, the dish page is her own dish in
                her own steps, the comfort page is her own comforts, and who's who prints her daughter's photo
     removes    taking the photo off deletes the sealed picture; deleting the resident deletes every picture of theirs
     fingers    the new controls are at least 52 px
     private    nothing was requested from outside the page, no script errors
   Made-up people only. Needs Playwright. Run: node scripts/check-profile-story-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const watch = pg => { pg.on("pageerror", e => errors.push(e.message)); pg.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); }); pg.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); }); };
  const p = await ctx.newPage(); watch(p);
  await p.goto(base + "profile.html", { waitUntil: "load" }); await p.waitForSelector("#rapName"); await p.waitForTimeout(900);
  /* move to a step the way a person does: Next until it is reached (a later step's own button is off until then), the step's button to go back */
  const goOn = async (pg, n) => {
    for (let i = 0; i < 8; i++) {
      const at = await pg.evaluate(() => +document.querySelector('#rapSteps button[aria-current="step"]').getAttribute("data-go"));
      if (at === n) return;
      if (at < n && await pg.evaluate(n2 => document.querySelector('[data-go="' + n2 + '"]').disabled, n)) await pg.evaluate(() => document.getElementById("rapNext").click());
      else await pg.evaluate(n2 => document.querySelector('[data-go="' + n2 + '"]').click(), n);
      await pg.waitForTimeout(300);
    }
    throw new Error("the form would not move to step " + n + ": " + await pg.evaluate(() => [...document.querySelectorAll(".rap-error")].map(e => e.textContent).filter(Boolean).join("; ")));
  };
  const go = n => goOn(p, n);
  const saved = id => p.evaluate(i => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_" + i)), id);
  const listIds = () => p.evaluate(() => { const s = window.CogniSecureStore.storage, out = []; for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k.indexOf("cognicopia_resident_") === 0) out.push(k.slice(20)); } return out; });

  /* ----- an older profile, saved before this change ----- */
  const OLD = { schema: "cognicopia.residentProfile", version: 2, id: "res-old", createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
    tier1_core: { preferredName: "Walter", cognitiveTier: 2, topHobbies: [], printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" }, difficulty: { level: 3 } },
    tier2_enrichment: { birthYear: 1931 }, tier3_deep: { notes: "Likes the paper.", people: [{ name: "June Example", relationship: { code: "sibling", label: "Brother or sister" }, isPet: false, passedAway: false }] } };
  await p.evaluate(x => { window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x)); return window.CogniSecureStore.flush(); }, OLD);

  /* ----- a new resident: the basics ----- */
  await p.fill("#rapName", "Dorothy"); await p.fill("#rapBorn", "1938");
  await go(2); await p.fill("#rapTown", "Scobey, Montana");
  await go(3);
  await p.click("#rapAddPerson"); await p.waitForTimeout(200);
  await p.fill('#rapPeople .rap-person [data-person="name"]', "Sarah Example");
  await p.selectOption('#rapPeople .rap-person [data-person="rel"]', "daughter");
  ok(await p.$eval("#rapPeople .rap-person [data-photo-label]", e => e.textContent) === "Add a photo" && await p.$eval("#rapPeople .rap-person [data-photo-img]", e => e.hidden), "a person's row offers a photo, and shows none until one is added");

  /* a large colour picture, made here so no file is needed */
  await p.evaluate(async () => {
    const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1200; const c = cv.getContext("2d");
    c.fillStyle = "#c8323c"; c.fillRect(0, 0, 1600, 1200); c.fillStyle = "#2f66c9"; c.fillRect(300, 200, 800, 700); c.fillStyle = "#f2d14b"; c.beginPath(); c.arc(1200, 400, 220, 0, 6.3); c.fill();
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), dt = new DataTransfer(); dt.items.add(new File([blob], "sarah.png", { type: "image/png" }));
    const input = document.querySelector("#rapPeople [data-photo-file]"); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForFunction(() => /Added/.test(document.querySelector("#rapPeople [data-photo-note]").textContent), null, { timeout: 8000 }).catch(() => {});
  const thumb = await p.$eval("#rapPeople [data-photo-img]", e => ({ hidden: e.hidden, jpeg: /^data:image\/jpeg/.test(e.src), w: e.getBoundingClientRect().width }));
  ok(!thumb.hidden && thumb.jpeg && Math.round(thumb.w) === 52, `the chosen picture shows in the row at once (${JSON.stringify(thumb)})`);
  ok(/Change the photo/.test(await p.textContent("#rapPeople [data-photo-label]")) && !(await p.$eval("#rapPeople [data-photo-remove]", e => e.hidden)), "the row now offers to change or remove it");

  /* ----- the optional section ----- */
  await go(6);
  ok(await p.$eval("#rapMore", d => !d.open) && await p.$eval("#rapMoments", e => e.getBoundingClientRect().height === 0), "More of their story is closed until asked for");
  await p.click("#rapMore > summary"); await p.waitForTimeout(250);
  for (const [y, t] of [["1962", "Married Harold in Scobey"], ["1957", "Finished college in Bozeman"], ["", "Taught third grade for thirty years"]]) {
    await p.click("#rapAddMoment"); await p.waitForTimeout(120);
    const row = p.locator("#rapMoments .rap-moment").last();
    await row.locator('[data-moment="year"]').fill(y); await row.locator('[data-moment="text"]').fill(t);
  }
  await p.fill("#rapDishName", "Rhubarb pie"); await p.fill("#rapDishIn", "rhubarb, sugar, flour, butter"); await p.fill("#rapDishSteps", "Roll the crust\nFill with rhubarb\nBake until it bubbles");
  await p.check('input[name="comforts"][value="warm-tea"]', { force: true }); await p.check('input[name="comforts"][value="music"]', { force: true });
  await p.fill("#rapComfortOther", "the porch swing, peppermint");
  const sizes = await p.$$eval("#rapMore summary, #rapAddMoment, #rapMoments input, #rapMoments [data-remove-moment], #rapDishName, #rapComforts .rap-check, #rapComfortOther", els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  ok(sizes.length >= 20 && sizes.every(h => h >= 52), `every new control is at least 52 px tall (the smallest is ${Math.min(...sizes)})`);
  await go(3);
  const photoSizes = await p.$$eval("#rapPeople .rap-photo-btn", els => els.filter(e => !e.hidden).map(e => Math.round(e.getBoundingClientRect().height)));
  ok(photoSizes.length === 2 && photoSizes.every(h => h >= 52), `the photo buttons are at least 52 px (${photoSizes.join(", ")})`);
  await go(6);

  /* ----- save ----- */
  await p.click("#rapNext"); await p.waitForTimeout(1500);
  const ids = (await listIds()).filter(i => i !== "res-old" && !/^photo_/.test(i));
  ok(ids.length === 1, `one new resident was saved (${ids.join(", ")})`);
  const id = ids[0], dot = await saved(id), t3 = dot.tier3_deep;
  ok(t3.milestones.length === 3 && t3.milestones[0].year === 1962 && t3.milestones[1].year === 1957 && t3.milestones[2].year === null && /thirty years/.test(t3.milestones[2].text), `the three moments are saved, a year as a number and none where none was given (${JSON.stringify(t3.milestones).slice(0, 120)})`);
  ok(t3.signatureDish.name === "Rhubarb pie" && t3.signatureDish.ingredients === "rhubarb, sugar, flour, butter" && t3.signatureDish.steps.length === 3 && t3.signatureDish.steps[1] === "Fill with rhubarb", "the dish is saved with what goes in and its steps, one to a line");
  ok(t3.comforts.map(c => c.label).join("|") === "Warm tea|Music playing|the porch swing|peppermint", `the comforts ticked and typed are saved (${t3.comforts.map(c => c.label).join("|")})`);
  const photoName = t3.people[0].photo || "";
  ok(t3.people.length === 1 && t3.people[0].name === "Sarah Example" && photoName.indexOf("cognicopia_resident_photo_" + id + "_") === 0, `her daughter is saved with the name of her sealed picture (${photoName.slice(0, 60)})`);
  ok(!JSON.stringify(dot).includes("data:image"), "the profile holds the picture's name, never the picture");
  const pic = await p.evaluate(async n => {
    const d = await window.CogniSecureStore.getBlob(n); if (!d) return null;
    const im = new Image(); await new Promise(r => { im.onload = r; im.src = d; });
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const c = cv.getContext("2d"); c.drawImage(im, 0, 0);
    const px = c.getImageData(0, 0, cv.width, cv.height).data; let colour = 0;
    for (let i = 0; i < px.length; i += 4 * 97) if (Math.abs(px[i] - px[i + 1]) > 6 || Math.abs(px[i + 1] - px[i + 2]) > 6) colour++;
    return { w: im.naturalWidth, h: im.naturalHeight, jpeg: /^data:image\/jpeg/.test(d), kb: Math.round(d.length / 1024), colour };
  }, photoName);
  ok(pic && pic.jpeg && pic.w === 800 && pic.h === 600, `the sealed picture is a JPEG made smaller, 800 px on its long side (${JSON.stringify(pic)})`);
  ok(pic && pic.colour === 0, "and it is gray: no colour is left in it");
  const plain = await p.evaluate(() => Object.keys(localStorage).map(k => k + "=" + localStorage.getItem(k)).join("\n"));
  ok(!/Sarah Example|Rhubarb|data:image|Married Harold/.test(plain), "none of it is in plain browser storage: the profile and the picture are sealed");

  /* ----- comes back ----- */
  await p.goto(base + "profile.html?edit=" + encodeURIComponent(id), { waitUntil: "load" }); await p.waitForSelector("#rapName"); await p.waitForTimeout(1300);
  await go(6);
  const back = await p.evaluate(() => ({ open: document.getElementById("rapMore").open, moments: [...document.querySelectorAll("#rapMoments .rap-moment")].map(r => r.querySelector('[data-moment="year"]').value + ":" + r.querySelector('[data-moment="text"]').value),
    dish: document.getElementById("rapDishName").value, steps: document.getElementById("rapDishSteps").value, ticks: [...document.querySelectorAll('input[name="comforts"]:checked')].map(x => x.value), other: document.getElementById("rapComfortOther").value }));
  ok(back.open && back.moments.length === 3 && back.moments[0] === "1962:Married Harold in Scobey" && back.moments[2] === ":Taught third grade for thirty years", `opening her again shows her moments, with the section open (${back.moments.join(" | ")})`);
  ok(back.dish === "Rhubarb pie" && back.steps.split("\n").length === 3 && back.ticks.join() === "warm-tea,music" && back.other === "the porch swing, peppermint", "and her dish and her comforts");
  await go(3); await p.waitForTimeout(600);
  ok(await p.$eval("#rapPeople [data-photo-img]", e => !e.hidden && /^data:image\/jpeg/.test(e.src)), "and her daughter's picture, read back from the sealed store");

  /* ----- the older profile opens and saves as before ----- */
  const o = await ctx.newPage(); watch(o);
  await o.goto(base + "profile.html?edit=res-old", { waitUntil: "load" }); await o.waitForSelector("#rapName"); await o.waitForTimeout(1200);
  ok(await o.$eval("#rapName", e => e.value) === "Walter", "a profile saved before this change opens");
  await goOn(o, 6);
  ok(await o.$eval("#rapMore", d => !d.open) && await o.$$eval("#rapMoments .rap-moment", r => r.length) === 0, "with the optional section closed and empty");
  await o.click("#rapNext"); await o.waitForTimeout(1200);
  const old2 = await o.evaluate(() => JSON.parse(window.CogniSecureStore.storage.getItem("cognicopia_resident_res-old")));
  ok(old2.tier1_core.preferredName === "Walter" && old2.tier2_enrichment.birthYear === 1931 && old2.tier3_deep.notes === "Likes the paper." && old2.tier3_deep.people.length === 1 && old2.tier3_deep.people[0].name === "June Example" && old2.createdAt === "2026-09-01T10:00:00Z", "saving it again keeps what it held");
  ok(Array.isArray(old2.tier3_deep.milestones) && old2.tier3_deep.milestones.length === 0 && old2.tier3_deep.signatureDish.name === "" && old2.tier3_deep.comforts.length === 0 && !("photo" in old2.tier3_deep.people[0]), "and adds nothing it was not given");
  await o.close();

  /* ----- the Studio's pages use it ----- */
  const s = await ctx.newPage(); watch(s);
  await s.goto(base + "activity-studio.html", { waitUntil: "load" }); await s.waitForSelector("#asSheet svg"); await s.waitForTimeout(1200);
  await s.evaluate(() => document.querySelectorAll("details.as-acc").forEach(d => { d.open = true; }));
  await s.selectOption("#asResident", id); await s.waitForTimeout(900);
  const only = async kind => { await s.evaluate(k => document.querySelectorAll('input[name="mix"]').forEach(c => { if (c.checked !== (c.value === k)) c.click(); }), kind); await s.waitForTimeout(700); };
  const text = () => s.$eval("#asSheet svg", e => e.textContent);
  await s.evaluate(() => document.querySelector('input[name="stage"][value="1"]').click()); await s.waitForTimeout(300);
  await only("lifestory");
  const life = await text();
  ok(/The years, in order/.test(life) && life.indexOf("1957") > 0 && life.indexOf("1957") < life.indexOf("1962") && /Finished college in/.test(life) && /Married Harold in/.test(life) && /thirty years/.test(life), `her life story page is her own moments, the earlier year first (${life.slice(0, 150)})`);
  await only("dish");
  const dish = await text();
  ok(/Rhubarb pie/.test(dish) && /A dish from my own kitchen/.test(dish) && /Fill with rhubarb/.test(dish) && /sugar/i.test(dish), `the dish page is her own dish, in her own steps (${dish.slice(0, 130)})`);
  await s.evaluate(() => document.querySelector('input[name="stage"][value="2"]').click()); await s.waitForTimeout(300);
  await only("comfort");
  const comf = await text();
  ok(/Things I like/.test(comf) && /Warm tea/.test(comf) && /the porch swing/.test(comf), `the comfort page offers her own comforts first (${comf.slice(0, 120)})`);
  await only("whoswho"); await s.waitForTimeout(900);
  const who = await s.$eval("#asSheet svg", e => ({ text: e.textContent, images: [...e.querySelectorAll("image")].map(i => ({ jpeg: /^data:image\/jpeg/.test(i.getAttribute("href") || ""), w: Number(i.getAttribute("width")), h: Number(i.getAttribute("height")) })) }));
  ok(/Sarah Example/.test(who.text) && /My daughter/.test(who.text) && who.images.length === 1 && who.images[0].jpeg && who.images[0].w > 200, `who's who prints her daughter's photo in its frame (${JSON.stringify(who.images)})`);
  ok(!/A photo can go here/.test(who.text), "and the frame no longer asks for a photo");
  /* a photograph fills its frame and is counted as ink, so a page that is mostly photo has less white space to score; it must still be ready */
  const score = +((/Clinical readiness: (\d+) \/ 100/.exec(await s.textContent("#asReady")) || [])[1] || 0);
  ok(score >= 80 && !/Needs work/i.test(await s.textContent("#asReady")), `the page with a photo still scores as ready (${score} / 100)`);
  /* the photo reaches the PDF */
  const dl = s.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await s.click("#asPdf"); const got = await dl;
  ok(!!got, "a PDF of the page with the photo is made");
  await s.close();

  /* ----- taking the photo off, then deleting the resident ----- */
  await p.bringToFront();
  await p.click("#rapPeople [data-photo-remove]"); await p.waitForTimeout(200);
  ok(await p.$eval("#rapPeople [data-photo-img]", e => e.hidden) && /Removed/.test(await p.textContent("#rapPeople [data-photo-note]")), "Remove the photo takes it off the row and says to save");
  await go(6); await p.click("#rapNext"); await p.waitForTimeout(1500);
  const after = await saved(id);
  ok(!("photo" in after.tier3_deep.people[0]) && await p.evaluate(n => window.CogniSecureStore.getBlob(n), photoName) === null, "after saving, the profile names no picture and the sealed picture is gone");
  /* add one again, save, then delete the resident: no picture of theirs may be left behind */
  await go(3);
  await p.evaluate(async () => {
    const cv = document.createElement("canvas"); cv.width = 300; cv.height = 400; cv.getContext("2d").fillRect(0, 0, 300, 400);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), dt = new DataTransfer(); dt.items.add(new File([blob], "again.png", { type: "image/png" }));
    const input = document.querySelector("#rapPeople [data-photo-file]"); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForFunction(() => /Added/.test(document.querySelector("#rapPeople [data-photo-note]").textContent), null, { timeout: 8000 }).catch(() => {});
  await go(6); await p.click("#rapNext"); await p.waitForTimeout(1500);
  const names1 = await p.evaluate(i => window.CogniSecureStore.blobNames("cognicopia_resident_photo_" + i + "_"), id);
  ok(names1.length === 1, `a second picture was sealed (${names1.length})`);
  p.once("dialog", d => d.accept());
  await p.evaluate(i => document.querySelector('[data-delete="' + i + '"]').click(), id); await p.waitForTimeout(1200);
  const names2 = await p.evaluate(i => window.CogniSecureStore.blobNames("cognicopia_resident_photo_" + i + "_"), id);
  ok(!(await listIds()).includes(id) && names2.length === 0, `deleting the resident deletes their pictures too (${names2.length} left)`);

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
  await ctx.close();
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `profile story check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `profile story check passed: ${passed} checks in a real browser (moments, a dish and comforts saved and shown again; a photo made small and gray, sealed apart from the profile; an older profile untouched; the Studio's pages made from them, a photo in its frame; pictures deleted with their owner)`);
process.exit(problems.length ? 1 : 0);
