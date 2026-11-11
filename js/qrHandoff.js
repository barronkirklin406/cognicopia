/* =====================================================================
   Resident handoff by QR codes: one resident from this screen to an iPad (or any computer with a camera), with no
   internet, no cable and no file.

   The sender packs one resident (their profile; photos stay on this computer), makes it smaller (deflate, where the
   browser has it), locks it with a passphrase (AES-GCM with a key from PBKDF2, SHA-256, the sealed store's rounds) and
   shows it as a loop of numbered QR codes. One code holds about 200 bytes, so a profile takes a handful of codes. The
   receiver's camera reads them in any order, as the loop comes round; when every code has been read it asks for the
   passphrase, opens the resident and adds them as the roster's handoff file does (the newer copy of a resident wins).

   A code says only "CQ1/<loop>/<number>/<count>/<locked bytes>": nothing in it can be read without the passphrase.
   The QR reader is jsQR, saved in the site (assets/vendor/jsqr.js) and loaded only when the camera is opened.
   Nothing is sent anywhere. Checked by scripts/check-qr-handoff-ui.mjs.
   @global CogniQrHandoff
   ===================================================================== */
import { qrSvg, MAX_BYTES } from "./qr.js";

const HEAD = "CQ1", CHUNK = Math.min(176, MAX_BYTES - 24), FRAME_MS = 420;   // under three changes a second: a loop that never flashes
const SELF = import.meta.url, BASE = SELF.replace(/js\/qrHandoff\.js(\?.*)?$/, "");
const SS = () => window.CogniSecureStore || null;
const enc = new TextEncoder(), dec = new TextDecoder();
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- bytes ---------- */
const b64u = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = t => { const s = atob(String(t).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(t).length + 3) % 4)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function through(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
const canDeflate = () => typeof CompressionStream === "function";
const canInflate = () => typeof DecompressionStream === "function";
async function keyFor(pass, salt, rounds) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/* ---------- pack and open ---------- */
/* what travels: the profile, without its photos (the pictures stay sealed on this computer; their names are taken out too) */
function travelling(p) {
  const c = JSON.parse(JSON.stringify(p));
  const t3 = c.tier3_deep || {};
  ["people", "pets", "family"].forEach(k => { if (Array.isArray(t3[k])) t3[k].forEach(x => { if (x && typeof x === "object") delete x.photo; }); });
  return c;
}
/* the codes for one or more residents: { frames, bytes, compressed } */
export async function pack(profiles, pass, from) {
  const S = SS(); if (!S || !crypto.subtle) throw new Error("This browser cannot lock a handoff.");
  const problem = S.passphraseProblem(pass); if (problem) throw new Error(problem);
  const list = (profiles || []).filter(S.isProfile).map(travelling);
  if (!list.length) throw new Error("Choose a resident first.");
  const plain = enc.encode(JSON.stringify(S.rosterFile(list, from || "", "")));
  let body = plain, flag = 0;
  if (canDeflate()) { const z = await through(plain, new CompressionStream("deflate-raw")); if (z.length < plain.length) { body = z; flag = 1; } }
  const rounds = Number(S.PBKDF2_ROUNDS) || 600000, salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(pass, salt, rounds), body));
  const out = new Uint8Array(6 + 16 + 12 + ct.length);
  out[0] = 1; out[1] = flag; new DataView(out.buffer).setUint32(2, rounds); out.set(salt, 6); out.set(iv, 22); out.set(ct, 34);
  const text = b64u(out), n = Math.ceil(text.length / CHUNK), loop = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  const frames = []; for (let i = 0; i < n; i++) frames.push(`${HEAD}/${loop}/${i + 1}/${n}/${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return { frames, bytes: out.length, plainBytes: plain.length, compressed: !!flag, residents: list.length };
}
/* gathers codes as the camera reads them, in any order; a code from another loop starts again */
export class Collector {
  constructor() { this.reset(); }
  reset() { this.loop = ""; this.n = 0; this.parts = []; this.have = 0; }
  add(text) {
    const m = /^CQ1\/([a-z0-9]{4})\/(\d{1,3})\/(\d{1,3})\/([A-Za-z0-9_-]*)$/.exec(String(text || ""));
    if (!m) return { ok: false };
    const loop = m[1], i = +m[2], n = +m[3];
    if (!(n >= 1 && i >= 1 && i <= n)) return { ok: false };
    if (loop !== this.loop || n !== this.n) { this.reset(); this.loop = loop; this.n = n; this.parts = new Array(n).fill(null); }
    const fresh = this.parts[i - 1] === null; if (fresh) { this.parts[i - 1] = m[4]; this.have++; }
    return { ok: true, fresh, number: i, have: this.have, n: this.n, done: this.have === this.n };
  }
  missing() { const out = []; this.parts.forEach((p, i) => { if (p === null) out.push(i + 1); }); return out; }
  text() { return this.have && this.have === this.n ? this.parts.join("") : ""; }
}
/* opens what the codes carried: { profiles, skipped, handoff }. Throws Error("passphrase") or Error("format") or Error("inflate"). */
export async function open(text, pass) {
  const S = SS(); if (!S || !crypto.subtle) throw new Error("This browser cannot open a handoff.");
  let u; try { u = unb64u(text); } catch (e) { throw new Error("format"); }
  if (u.length < 35 || u[0] !== 1) throw new Error("format");
  const flag = u[1], rounds = new DataView(u.buffer, u.byteOffset).getUint32(2);
  if (!(rounds >= 100000 && rounds <= 5000000)) throw new Error("format");
  let body;
  try { body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(22, 34) }, await keyFor(pass, u.slice(6, 22), rounds), u.slice(34))); }
  catch (e) { throw new Error("passphrase"); }
  if (flag === 1) { if (!canInflate()) throw new Error("inflate"); body = await through(body, new DecompressionStream("deflate-raw")); }
  let r; try { r = JSON.parse(dec.decode(body)); } catch (e) { throw new Error("format"); }
  if (!r || r.format !== S.BACKUP_FORMAT || !Array.isArray(r.profiles)) throw new Error("format");
  const profiles = r.profiles.filter(S.isProfile);
  return { profiles, skipped: r.profiles.length - profiles.length, handoff: r.handoff || null };
}

/* ---------- the screens ---------- */
function dialog(id, label) {
  let d = document.getElementById(id);
  if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "wf-dlg qh-dlg"; d.setAttribute("aria-labelledby", id + "H"); document.body.appendChild(d); }
  d.dataset.label = label; return d;
}
const show = d => { try { if (!d.open) d.showModal(); } catch (e) { d.setAttribute("open", ""); } };

/* the sender: the codes in a loop, with Pause and Close */
export async function showCodes(o) {
  const got = await pack(o.profiles, o.pass, o.from);
  const d = dialog("qhSend"), who = o.who || "this resident";
  let at = 0, timer = 0, paused = false;
  d.innerHTML = `<div class="wf-dlg-in"><div class="wf-dlg-head"><h2 id="qhSendH">Codes for ${esc(who)}</h2><button type="button" class="wf-btn wf-alt wf-x" data-qh="close" aria-label="Close">&times;</button></div>
    <p class="wf-dlg-lede">On the iPad or the other computer, open the Packet Builder's <b>Resident roster</b>, open <b>Pass a resident to an iPad with codes on the screen</b> and choose <b>Read codes with the camera</b>. Hold it about a foot from this screen until every code is ticked, then type the passphrase there.</p>
    <div class="qh-code" id="qhCode" aria-live="off"></div>
    <p class="qh-count" id="qhCount" role="status"></p>
    <div class="wf-dlg-btns"><button type="button" class="wf-btn wf-alt" data-qh="pause">Pause</button><button type="button" class="wf-btn" data-qh="close">Done</button></div>
    <p class="wf-dlg-foot">${got.frames.length} codes, locked with the passphrase. Photos stay on this computer. Nothing goes over the internet: the other device's camera reads this screen.</p></div>`;
  const code = d.querySelector("#qhCode"), count = d.querySelector("#qhCount");
  const paint = () => { code.innerHTML = qrSvg(got.frames[at], { scale: 6, label: `Code ${at + 1} of ${got.frames.length}` }); count.textContent = `Code ${at + 1} of ${got.frames.length}${paused ? " (paused)" : ""}`; };
  const tick = () => { at = (at + 1) % got.frames.length; paint(); };
  const run = () => { clearInterval(timer); if (!paused && got.frames.length > 1) timer = setInterval(tick, FRAME_MS); };
  const stop = () => { clearInterval(timer); d.close(); };
  d.onclick = e => { const b = e.target.closest && e.target.closest("[data-qh]"); if (e.target === d) stop(); if (!b) return;
    if (b.dataset.qh === "close") stop();
    if (b.dataset.qh === "pause") { paused = !paused; b.textContent = paused ? "Play" : "Pause"; run(); paint(); } };
  d.onclose = () => { clearInterval(timer); code.innerHTML = ""; if (o.opener && o.opener.isConnected) o.opener.focus(); };
  paint(); show(d); run();
  const first = d.querySelector('[data-qh="pause"]'); if (first) first.focus();
  return { frames: got.frames, dialog: d, step: () => tick() };
}

/* the reader: the camera, the codes ticked off as they are read, then the passphrase */
let jsqrLoading = null;
function loadReader() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrLoading) jsqrLoading = new Promise((res, rej) => { const s = document.createElement("script"); s.src = BASE + "assets/vendor/jsqr.js"; s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error("reader"))); s.onerror = () => rej(new Error("reader")); document.head.appendChild(s); });
  return jsqrLoading;
}
export function readCodes(o) {
  o = o || {};
  const d = dialog("qhRead"), col = new Collector();
  let stream = null, raf = 0, last = 0, done = false;
  d.innerHTML = `<div class="wf-dlg-in"><div class="wf-dlg-head"><h2 id="qhReadH">Read codes with the camera</h2><button type="button" class="wf-btn wf-alt wf-x" data-qh="close" aria-label="Close">&times;</button></div>
    <p class="wf-dlg-lede">Point the camera at the codes on the other screen. They change by themselves; keep it steady until every one is ticked. Nothing is sent anywhere, and the picture is not kept.</p>
    <div class="qh-cam"><video id="qhVideo" playsinline muted autoplay aria-label="What the camera sees"></video></div>
    <p class="qh-count" id="qhStatus" role="status">Starting the camera…</p>
    <ol class="qh-ticks" id="qhTicks" aria-label="Codes read"></ol>
    <form class="qh-pass" id="qhPassForm" hidden>
      <label class="tbp-lab" for="qhPass">The passphrase for these codes</label>
      <input class="qh-input" id="qhPass" type="password" autocomplete="off" minlength="10">
      <div class="wf-dlg-btns"><button type="submit" class="wf-btn">Open and add</button><button type="button" class="wf-btn wf-alt" data-qh="close">Cancel</button></div>
    </form>
    <p class="wf-dlg-foot">Read on this device only. The codes stay locked until the passphrase is typed here.</p></div>`;
  const video = d.querySelector("#qhVideo"), status = d.querySelector("#qhStatus"), ticks = d.querySelector("#qhTicks"), form = d.querySelector("#qhPassForm");
  const canvas = document.createElement("canvas"), ctx2 = canvas.getContext("2d", { willReadFrequently: true });
  const say = t => { status.textContent = t; };
  const paintTicks = () => { ticks.innerHTML = col.n ? col.parts.map((p, i) => `<li class="${p === null ? "" : "is-read"}" aria-label="Code ${i + 1}${p === null ? ", not read yet" : ", read"}">${p === null ? i + 1 : "✓"}</li>`).join("") : ""; };
  const stopCam = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  const finish = () => { done = true; stopCam(); video.hidden = true; say(`All ${col.n} codes read. Type the passphrase to open them.`); form.hidden = false; const pi = d.querySelector("#qhPass"); if (pi) pi.focus(); };
  /* one picture from the camera: a code in it is read and ticked */
  const look = (jsQR, now) => {
    if (done || !stream) return;
    raf = requestAnimationFrame(t => look(jsQR, t));
    if (now - last < 110 || video.readyState < 2 || !video.videoWidth) return;
    last = now;
    const w = Math.min(960, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
    canvas.width = w; canvas.height = h; ctx2.drawImage(video, 0, 0, w, h);
    const hit = jsQR(ctx2.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
    if (!hit) return;
    const r = col.add(hit.data);
    if (!r.ok) { say("That code is not a Cognicopia handoff."); return; }
    if (r.fresh) { paintTicks(); say(`Read ${r.have} of ${r.n} codes.` + (r.done ? "" : " Keep the camera on the screen.")); }
    if (r.done) finish();
  };
  form.onsubmit = e => {
    e.preventDefault();
    const pass = d.querySelector("#qhPass").value, btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; say("Opening…");
    open(col.text(), pass).then(got => Promise.resolve(o.onProfiles ? o.onProfiles(got) : addToStore(got)).then(msg => { say(msg || "Added."); form.hidden = true; d.querySelector("#qhPass").value = ""; }))
      .catch(err => { say({ passphrase: "That passphrase does not open these codes. Check it with the person showing them.", format: "These codes could not be read as a resident. Show them again from the start.", inflate: "This browser is too old to open these codes. Update it, or use the handoff file instead." }[err.message] || err.message); })
      .then(() => { btn.disabled = false; });
  };
  d.onclick = e => { const b = e.target.closest && e.target.closest("[data-qh]"); if (e.target === d || (b && b.dataset.qh === "close")) d.close(); };
  d.onclose = () => { stopCam(); if (o.opener && o.opener.isConnected) o.opener.focus(); };
  show(d);
  const api = { dialog: d, collector: col, add: t => { const r = col.add(t); paintTicks(); if (r.done && !done) finish(); return r; } };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say("This browser cannot use a camera here. Use the handoff file instead."); return api; }
  Promise.all([loadReader(), navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })])
    .then(([jsQR, s]) => { if (!d.open || done) { s.getTracks().forEach(t => t.stop()); return; } stream = s; video.srcObject = s; const pl = video.play(); if (pl && pl.catch) pl.catch(() => {}); say("Looking for codes…"); raf = requestAnimationFrame(t => look(jsQR, t)); })
    .catch(err => { say(err && (err.name === "NotAllowedError" || err.name === "SecurityError") ? "The camera was not allowed. Allow it for this site in the browser's settings, then try again." : err && err.message === "reader" ? "The code reader could not be loaded. Reload the page and try again." : "No camera could be started on this device."); });
  return api;
}
/* the default: add them the way the roster's handoff file does (the newer copy of a resident wins) */
function addToStore(got) {
  const S = SS(), R = window.CogniResident, ls = S && S.storage;
  const have = R ? R.list(ls) : [], m = S.mergeRoster(have, got.profiles, "newer");
  m.write.forEach(p => ls.setItem("cognicopia_resident_" + p.id, JSON.stringify(p)));
  return S.flush().then(() => { document.dispatchEvent(new CustomEvent("cg-residents-changed")); return summary(got, m); });
}
export function summary(got, m) {
  const from = got.handoff && got.handoff.station ? ` from ${got.handoff.station}` : "";
  return `Handoff${from} opened: ${m.added} added, ${m.updated} updated` + (m.kept ? `, ${m.kept} kept as they were (this device's copy was as new or newer)` : "") + (got.skipped ? `; ${got.skipped} damaged entr${got.skipped === 1 ? "y" : "ies"} skipped` : "") + ".";
}

window.CogniQrHandoff = Object.freeze({ pack, open, Collector, showCodes, readCodes, summary, CHUNK, FRAME_MS, canDeflate, canInflate });
document.dispatchEvent(new CustomEvent("cg-qr-handoff-ready"));
