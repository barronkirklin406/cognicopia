#!/usr/bin/env node
/* =====================================================================
   The license desk (license-desk.html), in a real browser.

   The page is where the owner makes the license-signing key and, later,
   license keys by hand, with nothing to install. It has to be right in
   three ways, and this proves each:

     - what it makes is what the rest of the system uses: the secret file
       is a standard PKCS#8 key that scripts/issue-license.mjs reads, the
       "safe line" is the public half in the format src/config/license.js
       holds, and a license key made in the page verifies with the Node
       checker (the same check the browser's license manager makes)
     - what Node makes works in the page: a key made by
       scripts/issue-license.mjs is accepted by the page's checker when the
       site trusts that pair, and refused, with the plain message, when it
       does not
     - nothing can leave the browser: the page makes no network request,
       its content security policy forbids connections, forms and frames,
       a fetch from the page fails, the secret key is never written into
       the page's text, and nothing is stored in the browser

   Also: every control is at least 52 px and there is no sideways scroll on
   a phone. Needs Playwright; where it is missing this exits 2 and
   npm run build skips it. Run: node scripts/check-license-desk-ui.mjs
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";
import { issue, check } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], foreign = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

const pointOfPem = pem => {
  const jwk = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ format: "jwk" });
  const h = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  return "04" + h(jwk.x) + h(jwk.y);
};
const open = async (w = 1366, h = 900, config) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  if (config) await ctx.route("**/src/config/license.js", route => route.fulfill({ contentType: "text/javascript", body: config }));
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u); });
  await p.goto(base + "license-desk.html"); await p.waitForSelector("#makePair");
  return p;
};
const text = (p, sel) => p.$eval(sel, e => (e.value !== undefined && e.tagName !== "DIV" ? e.value : e.textContent).replace(/\s+/g, " ").trim());

try {
  /* ---------- 1. the page makes a pair that Node accepts ---------- */
  let p = await open();
  const dl = p.waitForEvent("download", { timeout: 15000 });
  await p.click("#makePair");
  const file = await dl;
  ok(file.suggestedFilename() === "cognicopia-license-private.pem", "the secret file is saved as cognicopia-license-private.pem: " + file.suggestedFilename());
  const pem = fs.readFileSync(await file.path(), "utf8");
  ok(/^-----BEGIN PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+-----END PRIVATE KEY-----\n$/.test(pem), "the secret file is a PEM private key");
  let nodePoint = null; try { nodePoint = pointOfPem(pem); } catch (e) { /* reported below */ }
  ok(!!nodePoint, "Node reads the page's secret file as a P-256 key");
  const line = await text(p, "#pubLine");
  ok(/^PUBLIC_KEYS: Object\.freeze\(\["04[0-9a-f]{128}"\]\),$/.test(line), "the safe line is in the format src/config/license.js holds: " + line.slice(0, 40) + "…");
  ok(nodePoint && line.includes('"' + nodePoint + '"'), "the safe line is the public half of the secret file");
  const secretBody = pem.split("\n")[1];                      // the first line of the key's own text; the page's script mentions the header words, so the key itself is what is looked for
  ok(secretBody.length >= 60 && !(await p.content()).includes(secretBody) && !(await p.$eval("body", b => b.innerText)).includes(secretBody), "the secret key is never written into the page");
  ok(/does not trust this key yet/.test(await text(p, "#trustMsg")), "the page says the site does not trust a new key yet");
  const again = p.waitForEvent("download", { timeout: 15000 });
  await p.click("#saveAgain");
  ok(fs.readFileSync(await (await again).path(), "utf8") === pem, "Save again gives the same secret file");

  /* ---------- 2. a license key made in the page verifies with Node ---------- */
  const tmpKey = "/tmp/cognicopia-desk-test-" + process.pid + ".pem"; fs.writeFileSync(tmpKey, pem);
  await p.setInputFiles("#pemFile", tmpKey);
  await p.waitForFunction(() => /Got it/.test(document.getElementById("pemMsg").textContent), null, { timeout: 8000 });
  await p.click("#makeKey");
  ok(/Choose the date|Type the facility/.test(await text(p, "#keyMsg")), "a key is not made without a facility name: " + await text(p, "#keyMsg"));
  await p.fill("#fac", "Maple Court (example)"); await p.selectOption("#plan", "annual_facility"); await p.fill("#until", "2027-10-31");
  await p.click("#makeKey"); await p.waitForSelector("#keyOut:not([hidden])");
  const token = await text(p, "#keyText");
  const verdict = check(token, nodePoint);
  ok(verdict.ok, "a license key made in the page verifies with the Node checker: " + (verdict.reason || "ok"));
  ok(verdict.ok && verdict.payload.f === "Maple Court (example)" && verdict.payload.t === "annual_facility" && verdict.payload.e === "2027-10-31" && /^lic_[0-9a-f]{16}$/.test(verdict.payload.n) && verdict.payload.v === 1, "the key says what was typed: " + JSON.stringify(verdict.payload || {}));
  ok((await text(p, "#linkText")) === "https://cognicopia.org/activate.html#license_key=" + token, "the one-click link carries the key after a #");
  ok((await text(p, "#mailText")).includes(token) && /Maple Court \(example\)/.test(await text(p, "#mailText")), "the email has the key and the facility's name");
  ok(/does NOT accept this key yet/.test(await text(p, "#siteSays")), "the page warns that this site does not trust the new key yet");
  await p.fill("#fac", "Café Résidence 山"); await p.click("#makeKey");
  const tokenU = await text(p, "#keyText"), vu = check(tokenU, nodePoint);
  ok(vu.ok && vu.payload.f === "Café Résidence 山", "a name with accents and non-Latin letters is kept exactly");
  ok(await p.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0), "nothing is stored in the browser");
  ok(await p.evaluate(() => fetch("https://example.com/x").then(() => false, () => true)), "a fetch from the page is refused by its content security policy");
  const csp = await p.$eval('meta[http-equiv="Content-Security-Policy"]', e => e.content);
  ok(/connect-src 'none'/.test(csp) && /form-action 'none'/.test(csp) && /frame-src 'none'/.test(csp), "the content security policy forbids connections, forms and frames");
  await p.close();

  /* ---------- 3. a key made by Node is accepted by the page when the site trusts that pair, and refused when not ---------- */
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pairPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }), pairPoint = pointOfPem(pairPem);
  const realConfig = fs.readFileSync(ROOT + "/src/config/license.js", "utf8");
  const trustedConfig = realConfig.replace(/PUBLIC_KEYS:\s*Object\.freeze\(\[[^\]]*\]\)/, 'PUBLIC_KEYS: Object.freeze(["' + pairPoint + '"])');
  ok(trustedConfig !== realConfig, "the test could point the config at its own public key");
  const nodeKey = issue({ facility: "Node Made Manor", tier: "monthly_facility", until: "2030-01-31" }, pairPem).token;
  p = await open(1366, 900, trustedConfig);
  await p.fill("#checkText", nodeKey); await p.click("#checkKey");
  ok(/accepts it\. Node Made Manor, .*Monthly.*paid through 2030-01-31/i.test(await text(p, "#checkOut")), "the checker accepts a Node-made key the site trusts: " + await text(p, "#checkOut"));
  await p.fill("#checkText", nodeKey.slice(0, -4) + "AAAA"); await p.click("#checkKey");
  ok(/could not be verified/.test(await text(p, "#checkOut")), "a key with a changed signature is refused: " + await text(p, "#checkOut"));
  await p.fill("#checkText", "hello"); await p.click("#checkKey");
  ok(/does not look like a license key/.test(await text(p, "#checkOut")), "something that is not a key gets the plain message");
  /* the same trusted page: a file chosen in step 2 matches the site, and the page says so */
  const f2 = "/tmp/cognicopia-desk-test2-" + process.pid + ".pem"; fs.writeFileSync(f2, pairPem);
  await p.setInputFiles("#pemFile", f2);
  await p.waitForFunction(() => /Got it/.test(document.getElementById("pemMsg").textContent), null, { timeout: 8000 });
  ok(/the key this website trusts/.test(await text(p, "#pemMsg")), "a Node-made secret file is read, and the page says this site trusts it");
  await p.fill("#fac", "Trusted House"); await p.fill("#until", "2028-02-29"); await p.click("#makeKey"); await p.waitForSelector("#keyOut:not([hidden])");
  ok(/This website accepts this key/.test(await text(p, "#siteSays")), "a key made here with a trusted file is accepted by the page's own check: " + await text(p, "#siteSays"));
  ok(check(await text(p, "#keyText"), pairPoint).ok, "and by the Node checker");
  await p.close();
  fs.unlinkSync(tmpKey); fs.unlinkSync(f2);

  /* ---------- 4. a wrong file, size and phone ---------- */
  p = await open(390, 844);
  const junk = "/tmp/cognicopia-desk-junk-" + process.pid + ".pem"; fs.writeFileSync(junk, "not a key");
  await p.setInputFiles("#pemFile", junk);
  await p.waitForFunction(() => document.getElementById("pemMsg").textContent.length > 0, null, { timeout: 5000 });
  ok(/not a secret key file/.test(await text(p, "#pemMsg")), "a file that is not a key is refused plainly");
  fs.unlinkSync(junk);
  ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, "no sideways scroll on a phone");
  const small = await p.evaluate(() => [...document.querySelectorAll("button, input:not([type=file]), select, textarea")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 51.5; }).map(e => e.id + " " + Math.round(e.getBoundingClientRect().height)));
  ok(small.length === 0, "every control is at least 52 px: " + small.join(", "));
  await p.close();
} finally {
  await browser.close(); srv.close();
}

if (foreign.length) problems.push("the page made a network request: " + [...new Set(foreign)].slice(0, 3).join(" "));
if (errors.length) problems.push("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
if (problems.length) { console.log(`license desk check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`license desk check passed: ${passed} checks in a real browser (the key pair it makes is the one Node and the license manager use, a key it makes verifies, a Node-made key is accepted or refused as it should be, and nothing can leave the page)`);
