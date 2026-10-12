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
     9. signed license keys (COG1.<payload>.<signature>, ECDSA P-256): the
        browser's pure-JavaScript verifier agrees with Node's on valid and
        damaged signatures; a key signed by anyone else, an edited payload or
        stored record, a truncated or unknown-version key, a withdrawn id and
        a key past its date plus the grace days all unlock nothing; a key
        works offline for months inside the grace days; keys arrive from the
        address (?license_key=, #license_key=, ?session_id=) and the address
        is cleaned; the key, the earlier access code and the promo code all
        go through one box; scripts/license-keygen.mjs and
        scripts/issue-license.mjs make keys the browser accepts.
   Node built-ins only. Exits non-zero on any failure.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { issue, check } from "./issue-license.mjs";

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
{
  /* the config may hold web addresses now: the two Stripe Payment Links and the license service. Nothing else. */
  const urls = CONFIG.replace(/\/\*[\s\S]*?\*\//g, "").match(/https?:\/\/[^"'\s]+/gi) || [];
  ok(urls.length === 3, `the config should hold three web addresses (two Payment Links and the license service), not ${urls.length}`);
  for (const u of urls) ok(/^https:\/\/(buy\.stripe\.com\/|[A-Za-z0-9._-]+\/api\/licenses\/redeem$)/.test(u), `an unexpected web address in the config: ${u}`);
  ok(real.FREE_RUNS === 25, "the free trial is 25 packets");
  ok(real.PRICES.monthly.amount === 39 && real.PRICES.annual.amount === 349 && real.PRICES.annual.saves === 119 && real.PRICES.annual.savesPercent === 25, "the prices are $39 a month and $349 a year, saving $119 (25%)");
  ok(Math.round((1 - 349 / (39 * 12)) * 100) === real.PRICES.annual.savesPercent && 39 * 12 - 349 === real.PRICES.annual.saves, "the stated saving is the real arithmetic");
  ok(Object.keys(real.TIERS).join() === "monthly_facility,annual_facility,enterprise", "the three license tiers");
  ok(real.GRACE_DAYS === 90 && Array.isArray(real.PUBLIC_KEYS) && Array.isArray(real.REVOKED_IDS), "grace days and key lists");
  ok(real.PUBLIC_KEYS.every(k => /^04[0-9a-f]{128}$/.test(k)), "every public key is an uncompressed P-256 point");
  ok(/PUBLIC_KEYS: Object\.freeze\(\[/.test(CONFIG), "PUBLIC_KEYS is written the way the tests and docs expect");
  ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk_(live|test)_|\brk_(live|test)_|\bwhsec_/.test(CONFIG), "the config holds a private key or a Stripe secret");
}

/* ---------- a page, in a sandbox ---------- */
function makeStorage(){
  const m = new Map();
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
}
function page(opts = {}){
  const storage = opts.storage || makeStorage(), events = [];
  let cfg = CONFIG.replace(real.PROMO_SHA256, sha(opts.promo || TEST_PROMO)).replace(real.ACCESS_SHA256, sha(opts.paid || TEST_PAID));
  if (opts.keys) cfg = cfg.replace("PUBLIC_KEYS: Object.freeze([])", "PUBLIC_KEYS: Object.freeze(" + JSON.stringify(opts.keys) + ")");
  if (opts.revoked) cfg = cfg.replace("REVOKED_IDS: Object.freeze([])", "REVOKED_IDS: Object.freeze(" + JSON.stringify(opts.revoked) + ")");
  /* a clock the test can set: new Date() and Date.now() both read opts.now */
  const FakeDate = opts.now == null ? Date : class extends Date { constructor(...a){ if (a.length) super(...a); else super(opts.now); } static now(){ return opts.now; } };
  const sandbox = {
    localStorage: storage, console, Date: FakeDate, JSON, Object, String, Math, Array, isNaN, parseInt,
    fetch() { throw new Error("network"); }, XMLHttpRequest: function(){ throw new Error("network"); }
  };
  if (opts.location){
    sandbox.location = { search: "", hash: "", pathname: "/index.html", replaced: [], replace(u){ this.replaced.push(u); }, ...opts.location };
    sandbox.history = { state: null, calls: [], replaceState(st, t, url){ this.calls.push(url); } };
  }
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  if (opts.brokenStorage) Object.defineProperty(sandbox, "localStorage", { get(){ throw new Error("blocked"); } });
  const ctx = vm.createContext(sandbox);
  vm.runInContext(cfg, ctx); vm.runInContext(MANAGER, ctx);
  return { L: ctx.CognicopiaLicense, storage, ctx, location: sandbox.location, history: sandbox.history };
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
  ok(/function promoActive\(\)[^\n]*isPromoActive/.test(idx) && /function keyActive\(\)[^\n]*isKeyActive/.test(idx) && /function unlocked\(\)\s*\{\s*return isSubscribed\(\) \|\| promoActive\(\) \|\| keyActive\(\);/.test(idx), "index.html: unlocked() does not honor the promo and a signed key");
  ok(/function keyActive\(\)[^\n]*isKeyActive/.test(bld) && /function isLicensed\(\)\s*\{\s*return sha256\(rawGet\("cognicopia_license",""\)\) === ACCESS_SHA \|\| promoActive\(\) \|\| keyActive\(\);/.test(bld), "builder.html: isLicensed() does not honor the promo and a signed key");
  for (const [f, h] of [["index.html", idx], ["builder.html", bld]]){
    ok(/addEventListener\("cognicopia:license"/.test(h), `${f} does not listen for a license change`);
    ok(h.indexOf('<script src="src/config/license.js"></script>') > 0 && h.indexOf('<script src="src/config/license.js"></script>') < h.indexOf('<script src="assets/services/licenseManager.js"></script>'), `${f} must load the config, then the manager`);
  }
  ok(/id="licPromo"/.test(idx) && /id="gatePromo"/.test(bld) && /id="setPromo"/.test(bld), "the buy screens and settings do not offer the promo window");
  const sw = read("sw.js");
  ok(sw.includes('"src/config/license.js"') && sw.includes('"assets/services/licenseManager.js"'), "the offline cache does not keep the license files");
  /* every page with a top bar loads the manager, with the right path, config first */
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.name === ".git" || e.name === "node_modules" || e.name === ".next" ? [] : e.isDirectory() ? walk(path.posix.join(d, e.name)) : e.name.endsWith(".html") ? [path.posix.join(d, e.name)] : []);
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

/* ---------- 9. signed license keys ---------- */
{
  const mk = () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = publicKey.export({ format: "jwk" }), hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
    return { pem: privateKey.export({ type: "pkcs8", format: "pem" }), hex: "04" + hx(jwk.x) + hx(jwk.y) };
  };
  const owner = mk(), other = mk();
  const FACILITY = "Maple Court Ünicode ☃", T0 = Date.parse("2026-10-12T12:00:00Z"), DAYMS = 86400000;
  const ann = issue({ facility: FACILITY, tier: "annual_facility", until: "2027-10-31", issued: "2026-10-12", id: "lic_test_annual" }, owner.pem).token;
  const withKeys = (o = {}) => page({ keys: [owner.hex], now: T0, ...o });
  const K = real.KEYS;

  /* the issuing script and the browser agree (the script's own check, then the browser's) */
  ok(check(ann, owner.hex).ok && !check(ann, other.hex).ok, "scripts/issue-license.mjs: a key checks against its own public key only");
  ok(/^COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/.test(ann), "a key is COG1.<payload>.<86-character signature>");
  ok(ann.length < 400, `a key is short enough to paste from an email (${ann.length} characters)`);

  /* not switched on yet: no public key in the config */
  {
    const p = page({ now: T0 });
    const r = p.L.activateKey(ann);
    ok(!r.ok && r.reason === "not_configured" && /not switched on/.test(r.message) && p.storage.m.size === 0 && !p.L.isLicensed(), "with no public key configured a key is refused with a plain message and nothing is stored");
    ok(p.L.validateAndApplyPromo(TEST_PROMO).ok && p.L.isLicensed(), "the promo still works with no public key");
  }

  /* the verifier agrees with Node on many valid and damaged signatures, and is fast enough */
  {
    const p = withKeys(), ms = [];
    let agree = 0, total = 0, wrongAccepted = 0;
    for (let i = 0; i < 24; i++){
      const t = issue({ facility: "Facility " + i + " " + "x".repeat(i * 3), tier: ["monthly_facility", "annual_facility", "enterprise"][i % 3], until: "2027-0" + (1 + i % 9) + "-1" + (i % 9) }, owner.pem).token;
      const t0 = process.hrtime.bigint();
      const good = p.L.inspectKey(t);
      ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
      total++; if (good.ok === check(t, owner.hex).ok) agree++;
      const parts = t.split(".");
      const sigBytes = Buffer.from(parts[2], "base64url");
      for (const flip of [0, 17, 31, 32, 50, 63]){
        const b = Buffer.from(sigBytes); b[flip] ^= 1 << (i % 8);
        const damaged = `${parts[0]}.${parts[1]}.${b.toString("base64url")}`;
        total++;
        const r = p.L.inspectKey(damaged);
        if (r.ok) wrongAccepted++;
        if (r.ok === check(damaged, owner.hex).ok) agree++;
      }
    }
    ok(agree === total && wrongAccepted === 0, `the browser verifier differs from Node's on ${total - agree} of ${total} signatures (${wrongAccepted} damaged ones accepted)`);
    ms.sort((a, b) => a - b);
    ok(ms[Math.floor(ms.length / 2)] < 400, `a key takes ${ms[Math.floor(ms.length / 2)].toFixed(0)} ms (median) to check`);
    /* signature edge cases: r or s of zero, or not below the group order, are refused */
    const body = ann.split(".")[1];
    for (const [label, bytes] of [["r = 0", Buffer.concat([Buffer.alloc(32), Buffer.alloc(32, 1)])], ["s = 0", Buffer.concat([Buffer.alloc(32, 1), Buffer.alloc(32)])], ["r and s = 2^256-1", Buffer.alloc(64, 255)]])
      ok(!p.L.inspectKey(`COG1.${body}.${bytes.toString("base64url")}`).ok, `a signature with ${label} was accepted`);
    /* a public key that is not on the curve never verifies */
    const offCurve = withKeys({ keys: ["04" + "11".repeat(64)] });
    ok(!offCurve.L.inspectKey(ann).ok && offCurve.L.inspectKey(ann).reason === "signature", "a public key that is not on the curve verified something");
  }

  /* a good key, kept, and what is stored */
  {
    const p = withKeys();
    ok(!p.L.isLicensed(), "a new page with a key configured is not licensed");
    const r = p.L.activateKey(ann);
    ok(r.ok && r.reason === "applied" && r.persisted === true && r.message === `License activated for ${FACILITY}.`, "a good key is accepted: " + r.message);
    const rec = JSON.parse(p.storage.getItem(K.license));
    ok(rec.facilityName === FACILITY && rec.licenseTier === "annual_facility" && rec.expiresAt === "2027-10-31" && rec.isLicensed === true && typeof rec.signature === "string" && rec.signature.length === 86 && rec.token === ann, "the stored record has the facility, tier, date, flag and signature");
    ok(p.L.isLicensed() && p.L.isKeyActive() && !p.L.isPromoActive() && !p.L.isPaidActive(), "a key licenses the page and is neither promo nor the earlier code");
    const st = p.L.status();
    ok(st.licensed && st.keyed && st.type === "key" && st.facilityName === FACILITY && st.licenseTier === "annual_facility" && st.tierLabel === "Annual facility license" && st.expiresAt === "2027-10-31" && !st.inGrace && st.daysLeft === 385, `status describes the license (days left ${st.daysLeft})`);
    ok(withKeys({ storage: p.storage }).L.isLicensed(), "a reloaded page is still licensed by the key");
    /* every tier */
    for (const tier of ["monthly_facility", "annual_facility", "enterprise"]){
      const q = withKeys(), t = issue({ facility: "Tier test", tier, until: "2026-12-01" }, owner.pem).token;
      ok(q.L.activateKey(t).ok && q.L.status().licenseTier === tier, `${tier} is accepted`);
    }
    ok(p.L.revokeKey().licensed === false && p.storage.getItem(K.license) === null, "removing the license clears the key");
  }

  /* damaged, foreign, unfinished and unknown keys unlock nothing and write nothing */
  {
    const parts = ann.split("."), forged = issue({ facility: "Thief", tier: "enterprise", until: "2099-01-01" }, other.pem).token;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const edit = ch => `COG1.${Buffer.from(JSON.stringify({ ...payload, ...ch })).toString("base64url")}.${parts[2]}`;
    const custom = obj => { const b = Buffer.from(JSON.stringify(obj)).toString("base64url"); return `COG1.${b}.${crypto.sign("sha256", Buffer.from("COG1." + b), { key: owner.pem, dsaEncoding: "ieee-p1363" }).toString("base64url")}`; };
    const cases = {
      "a key signed by someone else": [forged, "signature"],
      "an edited date": [edit({ e: "2099-01-01" }), "signature"],
      "an edited tier": [edit({ t: "enterprise" }), "signature"],
      "an edited facility": [edit({ f: "Someone Else" }), "signature"],
      "the signature of another key": [`COG1.${parts[1]}.${issue({ facility: "x", tier: "enterprise", until: "2030-01-01" }, owner.pem).token.split(".")[2]}`, "signature"],
      "a truncated key": [ann.slice(0, -5), "format"],
      "a key with a letter removed from the middle": [ann.slice(0, 60) + ann.slice(61), "signature"],
      "a newer key version": [ann.replace("COG1.", "COG2."), "version"],
      "plain words": ["hello there", "format"],
      "an unknown tier, properly signed": [custom({ v: 1, f: "X", t: "platinum", e: "2030-01-01", n: "n1" }), "format"],
      "a missing facility, properly signed": [custom({ v: 1, f: " ", t: "enterprise", e: "2030-01-01", n: "n2" }), "format"],
      "a bad date, properly signed": [custom({ v: 1, f: "X", t: "enterprise", e: "tomorrow", n: "n3" }), "format"],
      "a payload version 2, properly signed": [custom({ v: 2, f: "X", t: "enterprise", e: "2030-01-01", n: "n4" }), "format"],
      "an empty box": ["   ", "empty"]
    };
    for (const [what, [text, reason]] of Object.entries(cases)){
      const p = withKeys(), r = p.L.activateKey(text);
      ok(!r.ok && r.reason === reason && p.storage.m.size === 0 && !p.L.isLicensed() && r.message.length > 10, `${what}: ${JSON.stringify({ ok: r.ok, reason: r.reason })} (wanted ${reason})`);
    }
    /* a stored record is not trusted: the key inside it is checked again, and the other fields are ignored */
    const p = withKeys(); p.L.activateKey(ann);
    const rec = JSON.parse(p.storage.getItem(K.license));
    const tryStored = obj => { const s2 = makeStorage(); s2.setItem(K.license, typeof obj === "string" ? obj : JSON.stringify(obj)); return withKeys({ storage: s2 }); };
    ok(!tryStored({ facilityName: "Thief", licenseTier: "enterprise", expiresAt: "2099-01-01", isLicensed: true, signature: "x".repeat(86) }).L.isLicensed(), "a stored record with no key unlocked something");
    ok(!tryStored({ ...rec, token: forged }).L.isLicensed(), "a stored record holding a forged key unlocked something");
    ok(!tryStored({ ...rec, token: ann.slice(0, -2) + "AA" }).L.isLicensed(), "a stored record with a damaged key unlocked something");
    for (const junk of ["", "null", "[]", "{", "true", '{"token":5}']) ok(!tryStored(junk).L.isLicensed(), `junk in the license slot (${junk}) unlocked something`);
    const edited = tryStored({ ...rec, facilityName: "Another Place", licenseTier: "enterprise", expiresAt: "2099-12-31" });
    ok(edited.L.isLicensed() && edited.L.status().facilityName === FACILITY && edited.L.status().expiresAt === "2027-10-31" && edited.L.status().licenseTier === "annual_facility", "the decorative fields in the record changed what the page says");
    ok(!withKeys({ keys: [other.hex], storage: p.storage }).L.isLicensed(), "changing the public key did not end an earlier key's license");
    ok(withKeys({ keys: [other.hex, owner.hex], storage: p.storage }).L.isLicensed(), "a second public key (rotation) did not keep the first key's licenses working");
    ok(!withKeys({ revoked: ["lic_test_annual"], storage: p.storage }).L.isLicensed(), "a withdrawn id still licensed the page");
    const rv = withKeys({ revoked: ["lic_test_annual"] }).L.activateKey(ann);
    ok(!rv.ok && rv.reason === "revoked", "a withdrawn key was accepted");
  }

  /* pasting as people paste: wrapped lines, quotes, an email around it */
  {
    const wrapped = ann.replace(/(.{60})/g, "$1\n"), p = withKeys();
    ok(p.L.activateKey(`Hello,\r\nYour key:\r\n"${wrapped}"\r\n\r\nThanks, Cognicopia`).ok, "a key wrapped across lines inside an email was not found");
    ok(p.L.looksLikeKey(wrapped) && !p.L.looksLikeKey("PAID-TEST-CODE") && !p.L.looksLikeKey("") && !p.L.looksLikeKey(null), "looksLikeKey tells keys from codes");
    const a = withKeys(), b = withKeys();
    a.L.activateKey(ann); b.L.activateKey(`<${ann}>.`);
    ok(a.L.status().id === undefined && b.L.isLicensed(), "angle brackets and a full stop around a key are ignored");
  }

  /* dates: paid through, grace, months offline, expiry */
  {
    const p = withKeys({ now: Date.parse("2027-10-31T23:00:00Z") });
    ok(p.L.activateKey(ann).ok && p.L.status().daysLeft === 1 && !p.L.status().inGrace, "on the paid-through date the license is current (the whole day counts)");
    const grace = (days, note) => { const q = withKeys({ storage: p.storage, now: Date.parse("2027-11-01T00:00:00Z") + days * DAYMS }); return { q, st: q.L.status() }; };
    for (const d of [1, 30, 60, 89]){
      const { q, st } = grace(d);
      ok(q.L.isLicensed() && st.inGrace && st.keyed && st.licensed, `${d} days after the date the license still works offline (grace)`);
    }
    for (const d of [91, 120, 400]){
      const { q, st } = grace(d);
      ok(!q.L.isLicensed() && !st.licensed && st.lapsed && st.lapsed.facilityName === FACILITY && st.lapsed.expiresAt === "2027-10-31", `${d} days after the date the license has ended, and the page knows whose it was`);
    }
    /* months offline inside the paid period: nothing needs the network */
    const months = withKeys({ storage: p.storage, now: Date.parse("2027-03-01T00:00:00Z") });
    ok(months.L.isLicensed() && !months.L.status().inGrace, "five months into a year the license works with no network at all");
    const late = withKeys({ now: Date.parse("2028-06-01T00:00:00Z") }).L.activateKey(ann);
    ok(!late.ok && late.reason === "expired" && /ended on/.test(late.message), "a key that has run out is refused when pasted");
    const gr = withKeys({ now: Date.parse("2027-12-01T00:00:00Z") }).L.activateKey(ann);
    ok(gr.ok && /renew soon/.test(gr.message), "a key inside its grace days is accepted with a reminder");
    /* an older key never replaces a newer one */
    const q = withKeys(), newer = issue({ facility: FACILITY, tier: "annual_facility", until: "2028-10-31", id: "lic_newer" }, owner.pem).token, older = issue({ facility: FACILITY, tier: "monthly_facility", until: "2026-12-31", id: "lic_older" }, owner.pem).token;
    q.L.activateKey(newer); const k = q.L.activateKey(older);
    ok(k.ok && k.reason === "kept" && q.L.status().expiresAt === "2028-10-31" && /already has a license/.test(k.message), "an older key replaced a newer one");
    q.L.activateKey(issue({ facility: FACILITY, tier: "annual_facility", until: "2029-10-31", id: "lic_newest" }, owner.pem).token);
    ok(q.L.status().expiresAt === "2029-10-31", "a newer key replaces an older one");
  }

  /* one box: key, earlier access code, promo code */
  {
    const p = withKeys();
    const e = p.L.activate("  "); ok(!e.ok && e.reason === "empty", "an empty box");
    const w = p.L.activate("nonsense"); ok(!w.ok && w.kind === "promo" && w.message === p.L.MESSAGES.invalid, "a wrong code gets the plain refusal");
    const paid = p.L.activate("  " + TEST_PAID + " "); ok(paid.ok && paid.kind === "paid" && p.L.isPaidActive() && p.storage.getItem(K.paid) === TEST_PAID, "the earlier access code is accepted in the same box");
    const promo = p.L.activate("test-promo-code"); ok(promo.ok && promo.kind === "promo" && p.L.isPromoActive(), "a promo code is accepted in the same box");
    const key = p.L.activate("my key: " + ann); ok(key.ok && key.kind === "key" && p.L.isKeyActive(), "a key is accepted in the same box");
    ok(p.L.status().type === "key" && p.L.status().promo && p.L.status().paid, "all three can be active; the key is what the page reports");
    p.L.revokeKey(); ok(p.L.isLicensed(), "removing the key leaves the earlier code and promo alone");
  }

  /* the address */
  {
    const nowAt = { now: T0, keys: [owner.hex] };
    const a = page({ ...nowAt, location: { search: "?x=1&license_key=" + encodeURIComponent(ann) + "&y=2", hash: "#top" } });
    ok(a.L.isLicensed() && a.L.status().facilityName === FACILITY, "?license_key= turned the license on when the page started");
    ok(a.history.calls.length === 1 && a.history.calls[0] === "/index.html?x=1&y=2#top" && !/license_key/.test(a.history.calls[0]), `the key was removed from the address: ${a.history.calls[0]}`);
    const b = page({ ...nowAt, location: { search: "", hash: "#license_key=" + ann } });
    ok(b.L.isLicensed() && b.history.calls[0] === "/index.html", `#license_key= worked and the address was cleaned: ${b.history.calls[0]}`);
    const c = page({ ...nowAt, location: { search: "?license_key=COG1.not.a.real.key" } });
    ok(!c.L.isLicensed() && c.history.calls.length === 1, "a bad ?license_key= unlocked nothing and was still removed from the address");
    const d = page({ ...nowAt, location: { search: "?session_id=cs_live_a1B2c3D4e5F6g7H8" } });
    ok(!d.L.isLicensed() && d.location.replaced.length === 1 && d.location.replaced[0] === "activate.html?session_id=cs_live_a1B2c3D4e5F6g7H8", `?session_id= is passed to activate.html: ${d.location.replaced[0]}`);
    const e = page({ ...nowAt, location: { search: "?session_id=<script>" } });
    ok(e.location.replaced.length === 0 && e.history.calls.length === 1, "a session id of the wrong shape is dropped, not passed on");
    const f = page({ ...nowAt, storage: a.storage, location: { search: "?session_id=cs_live_a1B2c3D4e5F6g7H8" } });
    ok(f.L.isLicensed() && f.location.replaced.length === 0 && f.history.calls.length === 1, "a licensed page does not send a session id anywhere");
    const g = page({ ...nowAt, location: { search: "?session_id=cs_live_a1B2c3D4e5F6g7H8&license_key=" + ann, pathname: "/activate.html" } });
    ok(!g.L.isLicensed() && g.location.replaced.length === 0 && g.history.calls.length === 0, "activate.html reads its own address; the manager leaves it alone");
    const h = page({ ...nowAt, location: { search: "?foo=bar" } });
    ok(!h.L.isLicensed() && h.history.calls.length === 0 && h.location.replaced.length === 0, "an address with neither parameter is left alone");
    const r = a.L.rememberRef("cs_live_a1B2c3D4e5F6g7H8");
    ok(r && a.L.renewalRef() === "cs_live_a1B2c3D4e5F6g7H8" && !a.L.rememberRef("nope") && !a.L.rememberRef(null) && a.L.renewalRef() === "cs_live_a1B2c3D4e5F6g7H8", "the checkout reference is kept only when it has the shape of one");
  }

  /* blocked storage: accepted for the page, and the person is told */
  {
    const p = withKeys({ brokenStorage: true });
    let r, threw = false; try { r = p.L.activateKey(ann); } catch (e){ threw = true; }
    ok(!threw && r.ok && r.persisted === false && /only until this page is closed/.test(r.message) && p.L.isLicensed(), "blocked storage: the key works for the page and the person is told");
    const full = makeStorage(); full.setItem = () => { throw new Error("quota"); };
    const q = withKeys({ storage: full }); let r2; try { r2 = q.L.activateKey(ann); } catch (e){ r2 = { thrown: true }; }
    ok(!r2.thrown && r2.ok && r2.persisted === false && q.L.isLicensed(), "a full store: the key is accepted for the page, never an error");
  }

  /* the pages: the offline cache and the new files */
  {
    const sw = read("sw.js");
    ok(sw.includes('"src/config/license.js"') && sw.includes('"assets/services/licenseManager.js"'), "the offline cache keeps the license files");
    ok(fs.existsSync(path.join(ROOT, "scripts/license-keygen.mjs")) && fs.existsSync(path.join(ROOT, "scripts/issue-license.mjs")), "the key scripts exist");
    const gi = read(".gitignore");
    ok(/^\*\.pem$/m.test(gi) && /^\*-private\.\*$/m.test(gi), ".gitignore refuses private keys");
    const tracked = (() => { try { return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); } catch (e){ return []; } })();
    let leaked = 0;
    for (const f of tracked){
      if (!/\.(js|mjs|ts|tsx|json|md|html|env|txt|yml|yaml|pem)$/i.test(f) || /node_modules|package-lock|\.min\.js|vendor|assets\/vendor/.test(f)) continue;
      let t; try { t = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e){ continue; }
      if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}/.test(t) || /\bsk_live_[A-Za-z0-9]{16,}/.test(t) || /\bwhsec_[A-Za-z0-9]{16,}/.test(t)) { leaked++; fails.push(`a private key or Stripe secret appears in ${f}`); }
    }
    ok(leaked === 0, "no private key or Stripe secret is tracked");
  }
}

/* ---------- 10. the pricing on the pages ---------- */
{
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.name === ".git" || e.name === "node_modules" || e.name === ".next" || e.name === "platform" ? [] : e.isDirectory() ? walk(path.posix.join(d, e.name)) : e.name.endsWith(".html") ? [path.posix.join(d, e.name)] : []);
  const pages = walk("."), idx = read("index.html"), bld = read("builder.html"), pricing = read("pricing.html"), act = read("activate.html"), contact = read("contact.html");
  const CTA = "Get Full Access ($39/mo or $349/yr)";

  /* the old price and the old trial are gone from every page, script, service and document */
  const old = [], LEGACY_PRICE_DOCS = ["scripts/check-license.mjs", "docs/stripe-setup-guide.md", "docs/blueprint-decisions.md", "docs/HANDOFF-next-session.md"];   // these name the earlier price on purpose, as the one being replaced
  const scan = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => {
    if ([".git", "node_modules", ".next", "vendor"].includes(e.name)) return;
    const f = path.posix.join(d, e.name);
    if (e.isDirectory()) return scan(f);
    if (!/\.(html|md|mjs|js|ts|tsx|json)$/.test(e.name) || /package-lock|\.min\./.test(e.name)) return;
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    if (!LEGACY_PRICE_DOCS.includes(f) && /129\.99|12999/.test(t)) old.push(f);
  });
  scan(".");
  ok(old.length === 0, "the old $129.99 price is still in: " + old.join(", "));

  /* every page with a top bar offers both buttons, with the exact words and the right paths */
  let bars = 0;
  for (const f of pages){
    const h = read(f);
    if (!/class="cg-topbar/.test(h)) continue;
    bars++;
    const P = "../".repeat(f.split("/").length - 1);
    ok(h.includes(CTA + " &#x2192;") && h.includes("Request Corporate Invoice / W-9"), `${f}: the top bar does not carry both buttons`);
    ok(new RegExp(`href="${P}pricing\\.html"[^>]*data-upgrade-prompt|data-upgrade-prompt[^>]*href="${P}pricing\\.html"`).test(h), `${f}: the main button does not go to ${P}pricing.html and carry data-upgrade-prompt`);
    ok(h.includes(`href="${f === "index.html" ? "" : P}contact.html?subject=Corporate+Invoice+Request"`), `${f}: the invoice button does not go to contact.html?subject=Corporate+Invoice+Request`);
    ok(!/buy\.stripe\.com\/[A-Za-z0-9]/.test(h), `${f}: a hard-coded Stripe link`);
  }
  ok(bars >= 29, `only ${bars} pages have a top bar`);

  /* the trial and the gates */
  ok(/FREE_RUNS\s*=\s*LICCFG\.FREE_RUNS \|\| 25;/.test(idx) && /FREE_RUNS\s*=\s*LICCFG\.FREE_RUNS \|\| 25;/.test(bld), "index.html and builder.html: the free trial is not 25");
  ok(/PRICE_MONTH = "\$39 a month", PRICE_YEAR = "\$349 a year"/.test(idx) && /PRICE_MONTH = "\$39 a month", PRICE_YEAR = "\$349 a year"/.test(bld), "the page prices differ from $39 a month and $349 a year");
  for (const [f, h] of [["index.html", idx], ["builder.html", bld]]){
    ok(/id:\s*"gateMonthly"/.test(h) && /id:\s*"gateAnnual"/.test(h) && /id:\s*"gateInvoice"/.test(h), `${f}: the upgrade screen does not offer monthly, annual and invoice`);
    ok(/Request Corporate Invoice \/ W-9/.test(h) && /save about 25%/.test(h) && /Best value/.test(h), `${f}: the upgrade screen is missing the invoice button or the savings`);
    ok(/function payLink\(plan\)/.test(h) && /REPLACE_ME\|test_/.test(h), `${f}: a placeholder or test Payment Link could be used`);
    ok(!/PAY_LINK\b/.test(h), `${f}: still uses the single PAY_LINK`);
    ok(!/maxlength="40"/.test(h.slice(h.indexOf('id="gate'), h.indexOf('id="gate') + 2500)), `${f}: the license box still stops at 40 characters`);
  }
  ok(/id="upgradeBanner"/.test(bld) && /left <= 5/.test(bld), "builder.html: no upgrade banner for the last free packets");
  ok(/The free trial<\/strong> is 25 packets/.test(idx) && /\$39 a month or \$349 a year/.test(idx), "index.html: the legal note does not state the plans and the 25-packet trial");

  /* pricing.html and activate.html */
  ok(/\$39/.test(pricing) && /\$349/.test(pricing) && /Save \$119/.test(pricing) && /about 25%/.test(pricing) && /Custom quote/.test(pricing) && /net-30/i.test(pricing) && /W-9/.test(pricing) && /ACH/.test(pricing) && /25 packets/.test(pricing), "pricing.html: plans, saving, enterprise, invoice terms and trial");
  ok(/Best value/.test(pricing) && /Request Corporate Invoice \/ W-9/.test(pricing), "pricing.html: best value and the invoice button");
  ok(!/HIPAA[- ]compliant|ensures? compliance|guarantee/i.test(pricing + act), "pricing.html or activate.html makes a claim the product cannot back");
  ok(/data-pay="monthly"/.test(pricing) && /data-pay="annual"/.test(pricing) && /REPLACE_ME\|test_/.test(pricing), "pricing.html: the buy buttons do not guard against a placeholder link");
  const nets = pages.filter(f => /(?<![.\w])fetch\s*\(|new\s+XMLHttpRequest|navigator\.sendBeacon\s*\(|new\s+WebSocket|new\s+EventSource/.test(read(f).replace(/<script id="pdflib">[\s\S]*?<\/script>/, "")));
  ok(nets.join() === "activate.html", "only activate.html may use the network; found: " + nets.join(", "));
  ok(/credentials:\s*"omit"/.test(act) && /JSON\.stringify\(\{ session_id: ref \}\)/.test(act), "activate.html: the one request must send only the checkout reference and no cookies");
  ok(/rememberRef/.test(act) && /cs_\(\?:live\|test\)_/.test(act), "activate.html: the checkout reference is checked before it is sent");
  ok(/meta name="robots" content="noindex"/.test(act), "activate.html should not be indexed");
  ok(/\?subject=|subject/.test(contact) && /Corporate Invoice|corporate invoice request/.test(contact) && /textContent/.test(contact) && !/innerHTML/.test(contact.slice(contact.indexOf('id="contact-subject-js"'))), "contact.html: ?subject= is not handled safely");
  const sw = read("sw.js");
  ok(sw.includes('"pricing.html"') && sw.includes('"activate.html"') && /\(license_key\|session_id\)/.test(sw), "sw.js: pricing and activation pages cached offline, and a key in an address is never cached");
  const srv = read("server.js");
  ok(/'pricing'/.test(srv) && /'activate'/.test(srv), "server.js: routes for the new pages");
  ok(/pricing\.html/.test(read("scripts/site-nav.mjs")), "the pricing page is in the navigation");
}

console.log(`License check: ${pass} checks passed`);
if (fails.length){
  console.log(`${fails.length} FAILED:`);
  fails.slice(0, 40).forEach(f => console.log("  - " + f));
  process.exit(1);
}
