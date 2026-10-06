#!/usr/bin/env node
/* =====================================================================
   License and promo-code check.  Run: node scripts/check-license.mjs
   (part of npm test and npm run build)

   The license manager (assets/services/licenseManager.js, configured by
   src/config/license.js) is loaded the way a page loads it, in a sandbox
   with no fetch and no XMLHttpRequest, a stand-in localStorage, and a
   promo hash swapped for the hash of a test code so the real code never
   appears in the repository. Checked:
     1. the config: well-formed hashes, one paid hash shared with
        index.html and builder.html, the storage names the spec asks for;
     2. the manager makes no network request and reads no clock but the
        activation time;
     3. SHA-256 agrees with Node's on hundreds of strings, accents and emoji
        included;
     4. a wrong, empty or oversized code is refused with the plain message
        and writes nothing; the right code (any case, any spaces) is accepted
        and writes cognicopia_license_active, _type, _activation_date;
     5. the license survives a reload (a new page reading the same storage),
        and a bare flag, an edited date or type, or a changed master code
        unlocks nothing;
     6. blocked or failing browser storage never throws: the unlock lasts the
        page and the person is told so;
     7. the paid code still works and the two kinds do not disturb each other;
     8. index.html and builder.html open every gate for a promo, close the buy
        screen when one arrives, and offer the promo window from the buy
        screen; every page with a top bar loads the manager; the offline
        cache keeps both files.
   Node built-ins only. Exits non-zero on any failure.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import crypto from "crypto";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const sha = s => crypto.createHash("sha256").update(s, "utf8").digest("hex");
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

const CONFIG = read("src/config/license.js"), MANAGER = read("assets/services/licenseManager.js");
const TEST_PROMO = "TEST-PROMO-CODE", TEST_PAID = "PAID-TEST-CODE";

/* ---------- 1. the config ---------- */
const realCtx = vm.createContext({}); vm.runInContext(CONFIG, realCtx);
const real = realCtx.CognicopiaLicenseConfig;
ok(/^[0-9a-f]{64}$/.test(real.PROMO_SHA256) && /^[0-9a-f]{64}$/.test(real.ACCESS_SHA256), "the config holds two SHA-256 hashes");
ok(real.PROMO_SHA256 !== real.ACCESS_SHA256, "the promo and paid codes must differ");
ok(real.PROMO_TYPE === "promo", "the promo type is 'promo'");
ok(real.KEYS.active === "cognicopia_license_active" && real.KEYS.type === "cognicopia_license_type" && real.KEYS.date === "cognicopia_activation_date", "the storage names are the ones asked for");
ok(Object.isFrozen(real) && Object.isFrozen(real.KEYS), "the config is frozen");
for (const f of ["index.html", "builder.html"]) ok(new RegExp('ACCESS_SHA\\s*=\\s*"' + real.ACCESS_SHA256 + '"').test(read(f)), `${f} uses the paid hash in src/config/license.js`);

/* ---------- 2. no network, no stray clock ---------- */
for (const [what, re] of Object.entries({ fetch: /\bfetch\s*\(/, XMLHttpRequest: /XMLHttpRequest/, sendBeacon: /sendBeacon/, WebSocket: /WebSocket/, "Math.random": /Math\.random/, eval: /\beval\s*\(|new Function/, "remote url": /https?:\/\//i }))
  ok(!re.test(MANAGER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/buy\.stripe\.com/g, "")), `licenseManager.js uses ${what}`);
ok(!/https?:\/\//i.test(CONFIG.replace(/\/\*[\s\S]*?\*\//g, "")), "the config holds a web address");

/* ---------- a page, in a sandbox ---------- */
function makeStorage(){
  const m = new Map();
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
}
function page(opts = {}){
  const storage = opts.storage || makeStorage(), events = [];
  const cfg = CONFIG.replace(real.PROMO_SHA256, sha(opts.promo || TEST_PROMO)).replace(real.ACCESS_SHA256, sha(opts.paid || TEST_PAID));
  const sandbox = {
    localStorage: storage, console, Date, JSON, Object, String, Math, Array, isNaN, parseInt,
    fetch() { throw new Error("network"); }, XMLHttpRequest: function(){ throw new Error("network"); }
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  if (opts.brokenStorage) Object.defineProperty(sandbox, "localStorage", { get(){ throw new Error("blocked"); } });
  const ctx = vm.createContext(sandbox);
  vm.runInContext(cfg, ctx); vm.runInContext(MANAGER, ctx);
  return { L: ctx.CognicopiaLicense, storage, ctx };
}

/* ---------- 3. SHA-256 ---------- */
{
  const { L } = page();
  ok(L.sha256("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "sha256 of nothing");
  ok(L.sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "sha256 of abc");
  let s = 12345, r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff, bad = 0, n = 0;
  const pool = "abcXYZ 0189-_!é€漢🙂\n\t";
  for (let i = 0; i < 400; i++){ let t = ""; const len = Math.floor(r() * (i % 7 === 0 ? 300 : 70)); for (let j = 0; j < len; j++) t += [...pool][Math.floor(r() * [...pool].length)]; n++; if (L.sha256(t) !== sha(t)) bad++; }
  ok(bad === 0, `sha256 differs from Node's on ${bad} of ${n} strings`);
  for (const len of [55, 56, 57, 63, 64, 65, 119, 120, 128]) ok(L.sha256("a".repeat(len)) === sha("a".repeat(len)), `sha256 at length ${len}`);
}

/* ---------- 4. refusing and accepting ---------- */
{
  const { L, storage } = page(), K = real.KEYS;
  ok(L.isPromoActive() === false && L.isLicensed() === false, "a new page is not licensed");
  for (const bad of ["", "   ", null, undefined, "wrong", "TEST-PROMO-COD", "TEST-PROMO-CODE-", "TEST PROMO CODE", "x".repeat(500), "FULL-ACCESS"]){
    const r = L.validateAndApplyPromo(bad);
    ok(r.ok === false, `${JSON.stringify(String(bad).slice(0, 20))} was accepted`);
    if (bad == null || String(bad).trim() === "") ok(r.reason === "empty" && /promo code/i.test(r.message), "an empty code gets its own message");
    else ok(r.message === "Invalid code. Please check your code and try again." && r.reason === "invalid", `the refusal for ${JSON.stringify(String(bad).slice(0, 12))}: ${r.message}`);
  }
  ok(storage.m.size === 0 && !L.isLicensed(), "a refused code wrote something");
  const before = Date.now();
  const r = L.validateAndApplyPromo("  test-Promo-CODE \n");
  ok(r.ok === true && r.persisted === true && r.message === "Code Applied Successfully!", "the right code, in any case with spaces, is accepted");
  ok(storage.getItem(K.active) === "true" && storage.getItem(K.type) === "promo", "the active and type keys are written");
  const when = storage.getItem(K.date);
  ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(when) && new Date(when).toISOString() === when && Math.abs(Date.parse(when) - before) < 5000, `the activation date is an ISO time: ${when}`);
  ok(L.isPromoActive() && L.isLicensed() && !L.isPaidActive(), "the promo licenses this page");
  const st = L.status();
  ok(st.licensed && st.promo && !st.paid && st.type === "promo" && st.activatedAt === when, "status says promo");
  const r2 = L.validateAndApplyPromo(TEST_PROMO);
  ok(r2.ok && L.isPromoActive(), "applying the code again is harmless");
}

/* ---------- 5. persistence and tampering ---------- */
{
  const a = page(), K = real.KEYS;
  a.L.validateAndApplyPromo(TEST_PROMO);
  const b = page({ storage: a.storage });
  ok(b.L.isPromoActive() && b.L.isLicensed(), "a reloaded page is still licensed");
  const bare = makeStorage(); bare.setItem(K.active, "true");
  ok(!page({ storage: bare }).L.isLicensed(), "a bare flag unlocked something");
  bare.setItem(K.type, "promo");
  ok(!page({ storage: bare }).L.isLicensed(), "a flag and a type without a date or proof unlocked something");
  bare.setItem(K.date, new Date().toISOString()); bare.setItem(K.proof, "0".repeat(64));
  ok(!page({ storage: bare }).L.isLicensed(), "a made-up proof unlocked something");
  for (const [key, val] of [[K.date, "2020-01-01T00:00:00.000Z"], [K.type, "paid"], [K.active, "yes"], [K.proof, ""], [K.date, "not a date"]]){
    const s2 = makeStorage(); a.storage.m.forEach((v, k) => s2.setItem(k, v)); s2.setItem(key, val);
    ok(!page({ storage: s2 }).L.isLicensed(), `editing ${key} to ${val} left the page licensed`);
  }
  const rotated = page({ storage: a.storage, promo: "A-DIFFERENT-CODE" });
  ok(!rotated.L.isPromoActive(), "changing the master code did not end an earlier promo activation");
  const gone = a.L.revokePromo();
  ok(!gone.licensed && !a.L.isPromoActive() && [K.active, K.type, K.date, K.proof].every(k => a.storage.getItem(k) === null), "removing the promo clears its keys");
}

/* ---------- 6. storage that refuses ---------- */
{
  const p = page({ brokenStorage: true });
  let threw = false, r;
  try { r = p.L.validateAndApplyPromo(TEST_PROMO); } catch (e){ threw = true; }
  ok(!threw && r.ok === true && r.persisted === false && /only until this page is closed/.test(r.message), "blocked storage: the code is accepted for this page and the person is told");
  ok(p.L.isPromoActive(), "blocked storage: the unlock lasts the page");
  const full = makeStorage(); full.setItem = () => { throw new Error("quota"); };
  const q = page({ storage: full }); let r3;
  try { r3 = q.L.validateAndApplyPromo(TEST_PROMO); } catch (e){ r3 = { thrown: true }; }
  ok(!r3.thrown && r3.ok && r3.persisted === false && q.L.isPromoActive(), "a full store: accepted for the page, never an error");
  const hostile = { getItem(){ throw new Error("x"); }, setItem(){ throw new Error("x"); }, removeItem(){ throw new Error("x"); } };
  const h = page({ storage: hostile });
  let ok3 = true; try { h.L.isLicensed(); h.L.status(); h.L.revokePromo(); } catch (e){ ok3 = false; }
  ok(ok3 && !h.L.isLicensed(), "storage that throws on every call never throws out of the manager");
}

/* ---------- 7. the paid code ---------- */
{
  const p = page(), K = real.KEYS;
  ok(!p.L.isPaidActive(), "no paid code stored");
  p.storage.setItem(K.paid, "nope"); ok(!p.L.isPaidActive() && !p.L.isLicensed(), "a wrong paid code unlocked something");
  p.storage.setItem(K.paid, TEST_PAID);
  ok(p.L.isPaidActive() && p.L.isLicensed() && !p.L.isPromoActive() && p.L.status().type === "paid", "the paid code licenses the page and is not a promo");
  p.L.validateAndApplyPromo(TEST_PROMO);
  ok(p.L.status().promo && p.L.status().paid, "both can be active");
  p.L.revokePromo(); ok(p.L.isLicensed() && p.L.isPaidActive(), "removing the promo leaves the paid license alone");
}

/* ---------- 8. the pages ---------- */
{
  const idx = read("index.html"), bld = read("builder.html");
  ok(/function promoActive\(\)[^\n]*isPromoActive/.test(idx) && /function unlocked\(\)\s*\{\s*return isSubscribed\(\) \|\| promoActive\(\);/.test(idx), "index.html: unlocked() does not honor the promo");
  ok(/function isLicensed\(\)\s*\{\s*return sha256\(rawGet\("cognicopia_license",""\)\) === ACCESS_SHA \|\| promoActive\(\);/.test(bld), "builder.html: isLicensed() does not honor the promo");
  for (const [f, h] of [["index.html", idx], ["builder.html", bld]]){
    ok(/addEventListener\("cognicopia:license"/.test(h), `${f} does not listen for a license change`);
    ok(h.indexOf('<script src="src/config/license.js"></script>') > 0 && h.indexOf('<script src="src/config/license.js"></script>') < h.indexOf('<script src="assets/services/licenseManager.js"></script>'), `${f} must load the config, then the manager`);
  }
  ok(/id="licPromo"/.test(idx) && /id="gatePromo"/.test(bld) && /id="setPromo"/.test(bld), "the buy screens and settings do not offer the promo window");
  const sw = read("sw.js");
  ok(sw.includes('"src/config/license.js"') && sw.includes('"assets/services/licenseManager.js"'), "the offline cache does not keep the license files");
  /* every page with a top bar loads the manager, with the right path, config first */
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.name === ".git" || e.name === "node_modules" ? [] : e.isDirectory() ? walk(path.posix.join(d, e.name)) : e.name.endsWith(".html") ? [path.posix.join(d, e.name)] : []);
  let withBar = 0;
  for (const f of walk(".")){
    const h = read(f);
    if (!/class="cg-topbar/.test(h)) continue;
    withBar++;
    const P = "../".repeat(f.split("/").length - 1), a = h.indexOf(`<script src="${P}src/config/license.js"></script>`), b = h.indexOf(`<script src="${P}assets/services/licenseManager.js"></script>`);
    ok(a > 0 && b > a, `${f} does not load the license manager`);
  }
  ok(withBar >= 25, `only ${withBar} pages have a top bar`);
}

console.log(`License check: ${pass} checks passed`);
if (fails.length){
  console.log(`${fails.length} FAILED:`);
  fails.slice(0, 40).forEach(f => console.log("  - " + f));
  process.exit(1);
}
