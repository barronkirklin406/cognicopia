/* Security and Accessibility screen (#/safety) and the daily backup reminder.

   Five sections: Display (color-blind palettes, OpenDyslexic), the rapid tier worksheet (six micro-tiers), the access log, backups (a daily
   reminder, differential backups and merging one in) and the optional device lock for the license. Like the other Studio and facility screens it
   mounts into the builder's view and is torn down at the next address change. Nothing here is sent anywhere.

   The builder hands in (deps): esc, toast, todayISO, store (its encrypted storage), residents(), activeId(), nameOf(p), existingProfiles(),
   saveProfile(id, p), flush(), facility(), print(pages, title), secure (CogniSecureStore) and dailyOps (CogniDailyOps). */
import * as K from "./access-kit.js";
import * as BD from "./backup-diff.js";

let deps = null, mounted = null;
const H = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const say = (m) => { try { deps.toast(m); } catch (e) { /* no toast */ } };
const plain = () => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } };
const logEv = (ev, o) => { try { if (window.CogniAccessLog) window.CogniAccessLog.append(ev, o); } catch (e) { /* the screen works without the log */ } };
export function init(d) { deps = d; }
export function teardown() { if (mounted) { try { mounted.ac.abort(); mounted.view.innerHTML = ""; } catch (e) { /* the page is gone */ } mounted = null; } }
export function current() { return mounted ? mounted.name : null; }
const on = (m, el, ev, fn) => el.addEventListener(ev, fn, { signal: m.ac.signal });
const dl = (name, text, type) => { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };

export function render(view, d) {
  if (d) deps = d; if (!deps) { view.innerHTML = '<p class="hint">The security and accessibility tools are still loading.</p>'; return; }
  teardown(); const ac = new AbortController(); mounted = { name: "safety", view, ac, state: { tab: "display", msg: "" } };
  const S = mounted.state, tabs = [["display", "Display"], ["tier", "Rapid tier worksheet"], ["log", "Access log"], ["backup", "Backups"], ["device", "Device lock"]];
  view.innerHTML = `<div class="st-tool ft-tool" data-ft="safety"><p class="eyebrow">Facility tool</p><h1 class="view-title" tabindex="-1">Security &amp; Accessibility</h1><p class="lede">Make pages easier to see and read, check who opened what on this computer, keep backups, and tie a license to one computer if you want to. All of it stays on this computer.</p><div class="st-stage" role="tablist" aria-label="Sections" id="saTabs"></div><div id="saBody"></div></div>`;
  const tabsEl = view.querySelector("#saTabs"), body = view.querySelector("#saBody");
  const draw = async () => {
    tabsEl.innerHTML = tabs.map(([k, l]) => `<button class="btn${S.tab === k ? " btn-primary" : ""}" type="button" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${H(l)}</button>`).join("");
    body.innerHTML = await ({ display, tier, log, backup, device })[S.tab]();
  };
  S.redraw = draw; on(mounted, tabsEl, "click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { S.tab = b.dataset.tab; S.msg = ""; draw(); } });
  on(mounted, body, "click", (e) => handle(e, mounted, draw)); on(mounted, body, "change", (e) => change(e, mounted, draw)); draw();
}

/* ---- sections ---- */
const swatches = (p) => `<div class="sa-swatches" aria-label="The four deck colors in this palette">${K.CATEGORIES.map((c) => `<span class="sa-swatch" style="background:${H(K.paletteOf(p).cats[c])}">${{ hometown: "● Hometown", career: "■ Career", music: "◒ Music", family: "◆ Family" }[c]}</span>`).join("")}</div>`;
const display = () => { const p = K.readPrefs(plain());
  return `<h2 class="st-h2">Color palette</h2><p class="hint">Each palette was checked by simulating that kind of color vision: the four deck colors stay apart and black text on each stays at 7:1 or better. Shapes and marks are always shown as well, so color is never the only signal.</p><fieldset class="field"><legend>Palette</legend><div class="st-stage">${Object.entries(K.PALETTES).map(([k, v]) => `<label class="st-opt"><input type="radio" name="palette" value="${k}"${p.palette === k ? " checked" : ""}> <span>${H(v.label)}</span></label>`).join("")}</div></fieldset>${swatches(p.palette)}
    <h2 class="st-h2">Font</h2><fieldset class="field"><legend>Typeface for the screen</legend><div class="st-stage">${Object.entries(K.FONTS).map(([k, v]) => `<label class="st-opt"><input type="radio" name="font" value="${k}"${p.font === k ? " checked" : ""}> <span>${H(v.label)}</span></label>`).join("")}</div></fieldset>
    <label class="st-opt"><input type="checkbox" id="saPrintFont"${p.printFont ? " checked" : ""}${p.font === "opendyslexic" ? "" : " disabled"}> <span>Use it on printed pages too<small>OpenDyslexic is wider than the default, so a printed page may fill sooner. Check a page before printing a batch.</small></span></label>
    <p class="sa-sample" style="font-size:1.25rem;margin-top:14px">A sample line: The quick brown fox jumps over the lazy dog, 0123456789.</p><p class="hint" id="saMsg" role="status">${H(mounted.state.msg || "")}</p>`; };
const tier = () => { const S = mounted.state, a = S.answers || (S.answers = {}), r = K.suggestMicro(a), list = deps.residents(), res = S.res || (deps.activeId && deps.activeId()) || ""; S.res = list.some((p) => p.id === res) ? res : "";
  return `<h2 class="st-h2">Rapid tier worksheet</h2><p class="hint">Eight things staff may already have seen in the resident's ordinary days. Nothing is tried or tested. It is a guide, not an assessment, and the person who knows the resident best chooses the tier.</p>
    <div class="field"><label for="saRes">Resident</label><select id="saRes"><option value="">${list.length ? "Choose a resident" : "No saved residents yet"}</option>${list.map((p) => `<option value="${H(p.id)}"${p.id === S.res ? " selected" : ""}>${H(deps.nameOf(p))}</option>`).join("")}</select></div>
    <div class="st-scroll"><table class="st-matrix"><thead><tr><th scope="col">What you may have seen</th><th scope="col">Not seen</th><th scope="col">Sometimes</th><th scope="col">Usually</th></tr></thead><tbody>${K.OBSERVATIONS.map((o) => `<tr><th scope="row">${H(o.text)}</th>${[0, 1, 2].map((v) => `<td><label class="st-opt"><input type="radio" name="obs-${o.id}" value="${v}" data-obs="${o.id}"${a[o.id] === v ? " checked" : ""} aria-label="${["Not seen", "Sometimes", "Usually"][v]}: ${H(o.text)}"></label></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="st-banner" role="status"><b>${H(K.MICRO_TIERS[r.micro].label)}</b> (${r.score} of ${K.SCORE_MAX}${r.complete ? "" : ", " + r.answered + " of " + K.OBSERVATIONS.length + " lines answered"})<p>${H(K.MICRO_TIERS[r.micro].summary)} Print size ${K.MICRO_TIERS[r.micro].fontScale}&times;, lines ${K.MICRO_TIERS[r.micro].lineThicknessPt} pt, about ${Math.round(K.MICRO_TIERS[r.micro].itemShare * 100)}% of a full page's items.</p></div>
    <label class="st-opt"><span>Or choose by hand</span><select id="saMicro" aria-label="Choose a micro-tier by hand">${K.MICRO_ORDER.map((m) => `<option value="${m}"${m === (S.manual || r.micro) ? " selected" : ""}>${H(K.MICRO_TIERS[m].label)}</option>`).join("")}</select></label>
    <p class="msg-bad" id="saErr" role="alert"></p><p class="hint" id="saMsg" role="status">${H(S.msg || "")}</p>
    <div class="actions"><button class="btn btn-primary" type="button" id="saApply">Apply to this resident's profile</button><button class="btn" type="button" id="saPrintBlank">Print the blank one-page worksheet</button></div>`; };
const log = () => { const L = window.CogniAccessLog; if (!L) return `<p class="msg-bad">The access log did not load.</p>`; const v = L.verify(), es = L.entries().slice(-60).reverse(), sm = L.summary();
  return `<h2 class="st-h2">Access log</h2><p class="hint">A record on this computer of what kind of thing was done and when. It holds no names, no health details and nothing anyone typed: residents appear as a short code, and a print as a page count. Each entry is chained to the one before it, so an edited, removed or reordered entry shows up below. That catches mistakes and casual edits; it cannot stop someone who can run code in this browser from rewriting the whole log.</p>
    <p class="st-banner" role="status"><b>${v.ok ? "The log checks out" : "The log does not check out"}.</b> ${v.count} entr${v.count === 1 ? "y" : "ies"}${v.ok ? "" : "; the first problem is at entry " + v.brokenAt}.</p>
    <ul class="ft-report">${Object.entries(sm).map(([k, n]) => `<li>${H(L.EVENTS[k] || k)}: ${n}</li>`).join("")}</ul>
    <div class="actions"><button class="btn" type="button" id="saVerify">Check it again</button><button class="btn" type="button" id="saCsv">Download as a spreadsheet (CSV)</button><button class="btn" type="button" id="saReset">Start a new log</button></div><p class="hint" id="saMsg" role="status">${H(mounted.state.msg || "")}</p>
    <div class="st-scroll"><table class="st-matrix sa-log"><thead><tr><th scope="col">No.</th><th scope="col">When</th><th scope="col">What</th><th scope="col">Initials</th><th scope="col">Reference</th><th scope="col">Note</th></tr></thead><tbody>${es.map((e) => `<tr><td>${e.n}</td><td>${H(e.at.replace("T", " ").slice(0, 19))}</td><td>${H(L.EVENTS[e.ev] || e.ev)}</td><td>${H(e.who)}</td><td>${H(e.ref)}</td><td>${H(e.note)}</td></tr>`).join("")}</tbody></table></div>`; };
const backup = () => { const st = BD.readState(deps.store), idx = BD.refresh(deps.store), n = BD.changedCount(idx, st.lastBackupAt || null), S = mounted.state;
  return `<h2 class="st-h2">Backups</h2><p class="hint">A backup is a locked file that only the passphrase you choose can open (at least 10 characters). A <b>differential</b> backup holds only what changed since the last one. Keep the passphrase somewhere safe: it cannot be recovered.</p>
    <p class="st-banner" role="status"><b>${n}</b> record${n === 1 ? " has" : "s have"} changed ${st.lastBackupAt ? "since the last backup on " + H(st.lastBackupAt.slice(0, 10)) : "(no backup has been made yet)"}.</p>
    <div class="field"><label for="saPass">Passphrase for the backup file</label><input id="saPass" type="password" autocomplete="new-password" minlength="10"></div>
    <div class="actions"><button class="btn btn-primary" type="button" id="saBack" data-kind="${st.lastBackupAt ? "differential" : "full"}">${st.lastBackupAt ? "Back up what changed" : "Make the first backup"}</button><button class="btn" type="button" id="saBackFull" data-kind="full">Make a full backup</button></div>
    <h2 class="st-h2">Merge a backup into this computer</h2><p class="hint">Adds what is new, keeps what is the same, and joins a record that changed on both computers without losing either side's entries. A record removed on the other computer is removed here only if it has not changed here since.</p>
    <div class="field"><label for="saFile">Backup file</label><input id="saFile" type="file" accept=".cognicopia,.json"></div><div class="field"><label for="saPass2">Its passphrase</label><input id="saPass2" type="password" autocomplete="off"></div>
    <div class="actions"><button class="btn" type="button" id="saMerge">Merge it</button></div>
    <p class="msg-bad" id="saErr" role="alert"></p><div id="saOut" role="status">${S.out || ""}</div>
    <h2 class="st-h2">Daily reminder</h2><label class="st-opt"><input type="checkbox" id="saRemind"${st.enabled ? " checked" : ""}> <span>Remind me once a day, when something has changed and no backup has been made that day</span></label>`; };
const device = async () => { let info = { ok: false }; try { const mod = await import("./license-persistence.js"); info = await mod.default.deviceLock(); } catch (e) { /* the license module is not loaded */ }
  return `<h2 class="st-h2">Device lock</h2><p class="hint">Off by default. When it is on, a saved license key copied from another computer's browser is not restored here. It is a soft lock, not a security boundary: it compares a short tag made from coarse traits of this computer (platform, touch, processors, language), and anyone holding the key text can still paste it. The tag is checked here and never sent anywhere. A browser update or a new tablet can change it; "Use this key on this computer" moves the key across.</p>
    ${info.ok ? `<label class="st-opt"><input type="checkbox" id="saLock"${info.on ? " checked" : ""}> <span>Tie the saved license to this computer</span></label><p class="st-banner" role="status">This computer's tag: <b>${H(info.tag)}</b>. ${info.matches === null ? "No license key is kept here yet." : info.matches ? "It matches the saved key." : "It does not match the saved key (the key was saved on another computer, or this one changed)."}</p>
    <div class="actions"><button class="btn" type="button" id="saRebind">Use this key on this computer</button></div><p class="hint" id="saMsg" role="status">${H(mounted.state.msg || "")}</p>` : `<p class="msg-bad">The license tools did not load, so the device lock is not available on this page.</p>`}`; };

/* ---- actions ---- */
function change(e, m, draw) {
  const t = e.target, S = m.state;
  if (t.name === "palette" || t.name === "font" || t.id === "saPrintFont") {
    const cur = K.readPrefs(plain()), next = Object.assign({}, cur, t.name === "palette" ? { palette: t.value } : t.name === "font" ? { font: t.value } : { printFont: t.checked });
    if (t.name === "font" && t.value !== "opendyslexic") next.printFont = false; const saved = K.savePrefs(plain(), next); K.apply(document, saved || next); S.msg = saved ? "Saved. It applies to every page on this computer." : "Could not save the choice (storage is blocked). It applies until the page is closed."; draw();
  } else if (t.dataset && t.dataset.obs) { S.answers[t.dataset.obs] = Number(t.value); S.manual = ""; draw(); }
  else if (t.id === "saRes") { S.res = t.value; draw(); }
  else if (t.id === "saMicro") { S.manual = t.value; }
  else if (t.id === "saRemind") { const st = BD.readState(deps.store); BD.saveState(deps.store, Object.assign({}, st, { enabled: t.checked })); }
  else if (t.id === "saLock") { import("./license-persistence.js").then((mod) => mod.default.setDeviceLock(t.checked)).then((r) => { logEv("device-lock", { note: r.on ? "turned on" : "turned off" }); S.msg = r.on ? "The device lock is on." : "The device lock is off."; draw(); }); }
}
async function handle(e, m, draw) {
  const b = e.target.closest("button"); if (!b) return; const S = m.state, err = m.view.querySelector("#saErr"); if (err) err.textContent = "";
  try {
    if (b.id === "saApply") {
      const p = deps.residents().find((x) => x.id === S.res); if (!p) { err.textContent = "Choose a resident first."; return; }
      const micro = S.manual || K.suggestMicro(S.answers || {}).micro; deps.saveProfile(p.id, K.applyMicroToProfile(p, micro)); await Promise.resolve(deps.flush && deps.flush());
      S.msg = deps.nameOf(p) + " is now " + K.MICRO_TIERS[micro].label + ". Their pages use it from the next print."; S.manual = ""; draw();
    } else if (b.id === "saPrintBlank") deps.print([{ html: K.worksheetPage({ facility: deps.facility ? deps.facility() : "" }) }], "Rapid tier worksheet");
    else if (b.id === "saVerify") { const v = window.CogniAccessLog.verify(); S.msg = v.ok ? "The log checks out (" + v.count + " entries)." : "Problem found at entry " + v.brokenAt + "."; draw(); }
    else if (b.id === "saCsv") { dl("Cognicopia access log " + deps.todayISO() + ".csv", window.CogniAccessLog.csv(), "text/csv"); logEv("export", { note: "access log" }); }
    else if (b.id === "saReset") { if (window.confirm("Start a new log? The old entries are removed from this computer. Download them first if you need them.")) { window.CogniAccessLog.reset(); S.msg = "A new log was started."; draw(); } }
    else if (b.id === "saBack" || b.id === "saBackFull") {
      const SS = deps.secure, pass = m.view.querySelector("#saPass").value, problem = SS.passphraseProblem(pass); if (problem) { err.textContent = problem; return; }
      const st = BD.readState(deps.store), since = b.dataset.kind === "full" ? null : st.lastBackupAt || null, now = new Date(), file = BD.makeBackup(deps.store, since, now), env = await SS.sealFile(file, pass, "diffbackup");
      dl("Cognicopia " + file.kind + " backup " + deps.todayISO() + ".cognicopia", JSON.stringify(env), "application/json"); BD.saveState(deps.store, BD.markBackedUp(st, now)); logEv("backup", { note: file.kind + ", " + file.records.length + " records" });
      S.msg = "The " + file.kind + " backup was made: " + file.records.length + " record" + (file.records.length === 1 ? "" : "s") + (file.removed.length ? " and " + file.removed.length + " removal" + (file.removed.length === 1 ? "" : "s") : "") + "."; draw();
    } else if (b.id === "saMerge") {
      const f = m.view.querySelector("#saFile").files[0], pass = m.view.querySelector("#saPass2").value; if (!f) { err.textContent = "Choose the backup file first."; return; }
      let env; try { env = JSON.parse(await f.text()); } catch (x) { err.textContent = "That file could not be read as a Cognicopia backup."; return; }
      let obj; try { obj = await deps.secure.openFile(env, pass); } catch (x) { logEv("unlock-failed", { note: "backup file" }); err.textContent = "The passphrase did not open that file, or it is not a backup."; return; }
      const D = deps.dailyOps, r = BD.applyBackup(deps.store, obj, new Date(), D ? { dailyops: (l, i) => JSON.stringify(D.mergeBoards(D.normalizeBoard(l), D.normalizeBoard(i)).board) } : {}); await Promise.resolve(deps.flush && deps.flush());
      logEv("restore", { note: r.added + " added, " + (r.merged + r.tookNewer) + " updated" });
      S.out = `<p class="msg-ok"><b>${r.added}</b> added, <b>${r.merged}</b> joined, <b>${r.tookNewer}</b> replaced by a newer copy, <b>${r.keptLocal}</b> kept as they were here, <b>${r.removed}</b> removed, <b>${r.unchanged}</b> already the same${r.failed ? ", " + r.failed + " could not be saved" : ""}.</p>${r.conflicts.length ? `<ul class="ft-report">${r.conflicts.slice(0, 40).map((c) => `<li>${H(c.what)}: ${H(c.how)}</li>`).join("")}</ul>` : ""}`; draw();
    } else if (b.id === "saRebind") { const mod = await import("./license-persistence.js"), r = await mod.default.rebindDevice(); logEv("device-lock", { note: r.ok ? "key moved to this computer" : "move refused" }); S.msg = r.message || ""; draw(); }
  } catch (x) { if (err) err.textContent = x && x.message ? x.message : "That did not work."; }
}

/* ---- the daily reminder: a small strip at the foot of the window, built with textContent only ---- */
export function promptIfDue(d, now = new Date()) {
  if (d) deps = d; if (!deps || typeof document === "undefined" || document.getElementById("cgBackupBar")) return null;
  let r; try { const st = BD.readState(deps.store), idx = BD.refresh(deps.store, now); r = BD.shouldPrompt(st, idx, now); if (!r.show) return r; BD.saveState(deps.store, BD.markPrompted(st, now)); } catch (e) { return null; }
  const bar = document.createElement("div"); bar.id = "cgBackupBar"; bar.setAttribute("role", "status"); bar.className = "sa-bar";
  const txt = document.createElement("span"); txt.textContent = r.changed + (r.changed === 1 ? " record has" : " records have") + " changed and no backup has been made today."; bar.appendChild(txt);
  const mk = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = label; b.addEventListener("click", () => { fn(); bar.remove(); }); bar.appendChild(b); };
  mk("Back up now", () => { location.hash = "#/safety"; setTimeout(() => { const t = document.querySelector('[data-tab="backup"]'); if (t) t.click(); }, 400); });
  mk("Remind me tomorrow", () => {}); mk("Pause for a week", () => { try { BD.saveState(deps.store, BD.snooze(BD.readState(deps.store), new Date(), 24 * 7)); } catch (e) { /* ignore */ } });
  document.body.appendChild(bar); logEv("backup-prompt", { note: r.changed + " changed" }); return r;
}
if (typeof window !== "undefined") { window.CogniSafety = { init, render, teardown, current, promptIfDue }; window.dispatchEvent(new Event("cogni-safety-ready")); }
