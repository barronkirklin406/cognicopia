/* =====================================================================
   The residents folder: saved residents kept as locked files in a folder
   on the facility's own computer (or a shared folder on its own network).

   The person chooses a folder once (the browser asks them to pick it and
   to allow Cognicopia to save there) and a passphrase for the files. From
   then on, whenever a page that loads this script opens or a resident is
   saved, sync() does two things:
     read    every file in the folder that changed since it was last read is
             opened with the passphrase; where its copy of a resident is
             newer than this computer's, it takes its place
     write   every resident that changed on this computer is written to the
             folder as its own locked file
   So several computers pointed at the same folder, with the same passphrase,
   share the same residents, and the newer copy of each one wins. No
   Cognicopia server is involved: the files go only where the folder is.

   The files: one resident to a file, "resident-<code>.cognicopia", where
   the code comes from the resident's record number, never their name. Each
   is the station handoff's locked file (exportRoster in
   src/services/secureStore.ts: AES-GCM, a key made from the passphrase with
   PBKDF2), so it opens on the roster screen's handoff too. A short note,
   "About these files.txt", says what they are. Photos stay on this
   computer and are not put in the folder.

   Kept on this computer: the folder's handle (the browser's own permission
   to the folder, in this site's IndexedDB) and, sealed in the encrypted
   store under "cognicopia_folder", the passphrase and which file holds
   which resident. Clearing the store clears those too.

   Deleting a resident here deletes their file. A computer that still has
   them writes it back, until they are deleted there too: a file is never
   taken as a reason to delete a resident.

   Needs a browser that lets a page use a folder (Chrome or Edge on a
   computer). Elsewhere supported() is false and the handoff file is the
   way. Works offline; makes no network request.
   ===================================================================== */
(function (root) {
  "use strict";
  var SS = function () { return root.CogniSecureStore || null; };
  var PREFIX = "cognicopia_resident_", SETTINGS = "cognicopia_folder", FILE_RE = /^resident-[0-9a-f]{12}\.cognicopia$/, NOTE = "About these files.txt";
  var DB = "cognicopia-folder", STORE = "handles", KEY = "residents";
  var listeners = [], running = null, again = false, timer = null, last = { state: "off" };

  /* ---------- the folder's handle, kept by the browser ---------- */
  function idb(mode, fn) {
    return new Promise(function (res, rej) {
      if (!root.indexedDB) { rej(new Error("no indexedDB")); return; }
      var open = root.indexedDB.open(DB, 1);
      open.onupgradeneeded = function () { open.result.createObjectStore(STORE); };
      open.onerror = function () { rej(open.error); };
      open.onsuccess = function () {
        var db = open.result, tx = db.transaction(STORE, mode), st = tx.objectStore(STORE), out;
        try { out = fn(st); } catch (e) { rej(e); return; }
        tx.oncomplete = function () { db.close(); res(out && "result" in out ? out.result : undefined); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
    });
  }
  var saveHandle = function (h) { return idb("readwrite", function (st) { return st.put(h, KEY); }); };
  var loadHandle = function () { return idb("readonly", function (st) { return st.get(KEY); }).catch(function () { return null; }); };
  var dropHandle = function () { return idb("readwrite", function (st) { return st.delete(KEY); }).catch(function () { return null; }); };

  /* ---------- the sealed settings: the passphrase and the index ---------- */
  function storage() { var s = SS(); return s && s.storage ? s.storage : null; }
  function open() { var s = SS(); try { return !!s && s.status().state === "open"; } catch (e) { return false; } }
  function settings() { var st = storage(); try { var v = st && JSON.parse(st.getItem(SETTINGS) || "null"); return v && typeof v === "object" && typeof v.pass === "string" ? v : null; } catch (e) { return null; } }
  function keep(v) { storage().setItem(SETTINGS, JSON.stringify(v)); return SS().flush ? SS().flush() : null; }

  /* ---------- small helpers ---------- */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function sha(text) { return root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex); }
  /* a resident's file name: a code made from their record number (the folder must not hold a name) */
  function fileFor(id) { return sha("cognicopia-folder|" + id).then(function (h) { return "resident-" + h.slice(0, 12) + ".cognicopia"; }); }
  function residents() {
    var st = storage(), out = [];
    for (var i = 0; i < st.length; i++) { var k = st.key(i); if (!k || k.indexOf(PREFIX) !== 0) continue; var v = st.getItem(k), p = null; try { p = JSON.parse(v); } catch (e) { /* not a profile */ }
      if (p && SS().isProfile(p) && k === PREFIX + p.id) out.push({ id: p.id, text: v, profile: p }); }
    return out;
  }
  function files(dir) {
    var out = [];
    if (!dir.entries) return Promise.resolve(out);
    var it = dir.entries();
    function step() { return it.next().then(function (r) { if (r.done) return out; var name = r.value[0], h = r.value[1]; if (h.kind === "file" && FILE_RE.test(name)) out.push({ name: name, handle: h }); return step(); }); }
    return step();
  }
  function write(dir, name, text) {
    return dir.getFileHandle(name, { create: true }).then(function (fh) {
      return fh.createWritable().then(function (w) { return w.write(text).then(function () { return w.close(); }); }).then(function () { return fh.getFile(); }).then(function (f) { return f.lastModified; });
    });
  }
  function permission(dir, ask) {
    if (!dir || typeof dir.queryPermission !== "function") return Promise.resolve(dir ? "granted" : "none");
    return dir.queryPermission({ mode: "readwrite" }).then(function (st) { return st === "granted" || !ask ? st : dir.requestPermission({ mode: "readwrite" }); });
  }
  function say(state) { last = state; listeners.slice().forEach(function (fn) { try { fn(state); } catch (e) { /* a listener's fault is its own */ } }); return state; }

  /* ---------- the note in the folder ---------- */
  var NOTE_TEXT = [
    "These files are residents saved by Cognicopia (cognicopia.org).",
    "",
    "Each file is one resident, locked with the passphrase chosen in Cognicopia. Without it the files cannot be read.",
    "The file names are codes, not names. Please do not rename, edit or open them in another program.",
    "",
    "To use them on another computer, open Cognicopia's Packet Builder there, go to the Resident roster,",
    "choose this same folder under \"Keep residents in a folder on this computer\" and type the same passphrase.",
    ""
  ].join("\r\n");

  /* ---------- one sync: read what changed in the folder, then write what changed here ---------- */
  function syncOnce(dir, cfg) {
    var R = SS(), st = storage(), idx = cfg.index || { ids: {}, files: {} }, out = { read: 0, added: 0, updated: 0, kept: 0, wrote: 0, removed: 0, failed: [] };
    idx.ids = idx.ids || {}; idx.files = idx.files || {};
    return files(dir).then(function (list) {
      var names = {}; list.forEach(function (f) { names[f.name] = f; });
      /* read */
      return list.reduce(function (chain, f) {
        return chain.then(function () { return f.handle.getFile(); }).then(function (file) {
          var known = idx.files[f.name];
          if (known && known.mtime === file.lastModified) return null;
          return file.text().then(function (text) { return R.readRoster(text, cfg.pass); }).then(function (r) {
            out.read++;
            var p = r.profiles[0]; if (!p) return null;
            var raw = null; try { raw = JSON.parse(st.getItem(PREFIX + p.id) || "null"); } catch (e) { raw = null; }
            var m = R.mergeRoster(raw && R.isProfile(raw) ? [raw] : [], [p], "newer"), text = JSON.stringify(p);
            if (m.write.length) { st.setItem(PREFIX + p.id, text); if (m.added) out.added++; else out.updated++; } else out.kept++;
            return sha(text).then(function (h) { idx.files[f.name] = { mtime: file.lastModified, id: p.id }; idx.ids[p.id] = { file: f.name, hash: h }; });
          }, function () { out.failed.push(f.name); });
        });
      }, Promise.resolve()).then(function () { return names; });
    }).then(function (names) {
      /* write */
      var here = residents(), ids = {};
      return here.reduce(function (chain, r) {
        return chain.then(function () { ids[r.id] = 1; return Promise.all([sha(r.text), fileFor(r.id)]); }).then(function (x) {
          var h = x[0], name = x[1], e = idx.ids[r.id];
          if (e && e.hash === h && e.file === name && names[name]) return null;
          return R.exportRoster([r.profile], cfg.pass, "", "").then(function (env) { return write(dir, name, JSON.stringify(env)); }).then(function (mtime) {
            out.wrote++; idx.ids[r.id] = { file: name, hash: h }; idx.files[name] = { mtime: mtime, id: r.id }; names[name] = true;
          });
        });
      }, Promise.resolve()).then(function () {
        /* a resident this computer had and no longer has was deleted here: their file goes too */
        return Object.keys(idx.ids).reduce(function (chain, id) {
          return chain.then(function () {
            if (ids[id]) return null;
            var name = idx.ids[id].file; delete idx.ids[id]; delete idx.files[name];
            if (!names[name] || !dir.removeEntry) return null;
            return dir.removeEntry(name).then(function () { out.removed++; }, function () { /* already gone */ });
          });
        }, Promise.resolve());
      });
    }).then(function () {
      cfg.index = idx; cfg.last = new Date().toISOString(); cfg.count = residents().length;
      return keep(cfg);
    }).then(function () { return out; });
  }

  /* ---------- the public side ---------- */
  function supported() { return typeof root.showDirectoryPicker === "function"; }
  /* where things stand: off, needs the passphrase, needs permission again (after the browser restarts), or connected */
  function status() {
    if (!supported()) return Promise.resolve({ state: "unsupported" });
    return loadHandle().then(function (dir) {
      var cfg = open() ? settings() : null;
      if (!dir) return { state: "off" };
      if (!open()) return { state: "locked", name: dir.name };
      if (!cfg) return { state: "off", name: dir.name };
      return permission(dir, false).then(function (p) {
        return { state: p === "granted" ? "connected" : "permission", name: dir.name, last: cfg.last || "", count: cfg.count || 0, result: last.result || null };
      });
    });
  }
  /* sync now; resolves with what it did (or null when the folder is not in use) */
  function sync() {
    if (running) { again = true; return running; }
    running = Promise.all([loadHandle(), Promise.resolve(open() ? settings() : null)]).then(function (x) {
      var dir = x[0], cfg = x[1];
      if (!dir || !cfg || !open()) return null;
      return permission(dir, false).then(function (p) {
        if (p !== "granted") { say({ state: "permission", name: dir.name }); return null; }
        return syncOnce(dir, cfg).then(function (r) {
          say({ state: "connected", name: dir.name, last: cfg.last, count: cfg.count, result: r });
          if (r.added || r.updated) try { document.dispatchEvent(new CustomEvent("cg-residents-changed", { detail: { from: "folder", added: r.added, updated: r.updated } })); } catch (e) { /* no page */ }
          return r;
        });
      });
    }).then(function (r) { running = null; if (again) { again = false; return sync(); } return r; }, function (e) { running = null; say({ state: "error", message: String(e && e.message || e) }); throw e; });
    return running;
  }
  /* sync a moment after a save, once however many saves come together */
  function soon() { clearTimeout(timer); timer = setTimeout(function () { sync().catch(function () { /* shown by status */ }); }, 600); }

  /* start using a folder: the handle is one the browser gave (showDirectoryPicker), the passphrase is checked first,
     and when the folder already holds residents the passphrase must open them */
  function connectHandle(dir, pass) {
    var R = SS();
    if (!R || !open()) return Promise.reject(new Error("Saved residents are locked. Unlock them first."));
    var problem = R.passphraseProblem(pass); if (problem) return Promise.reject(new Error(problem));
    return permission(dir, true).then(function (p) {
      if (p !== "granted") throw new Error("The browser did not allow Cognicopia to save in that folder.");
      return files(dir);
    }).then(function (list) {
      if (!list.length) return null;
      return list[0].handle.getFile().then(function (f) { return f.text(); }).then(function (t) { return R.readRoster(t, pass); }).catch(function (e) {
        throw new Error(/passphrase/.test(String(e && e.message)) ? "That passphrase does not open the residents already in this folder. Type the passphrase they were saved with." : "A file in this folder could not be read as a Cognicopia resident.");
      });
    }).then(function () {
      return dir.getFileHandle(NOTE, { create: false }).then(function () { return null; }, function () { return write(dir, NOTE, NOTE_TEXT); });
    }).then(function () { return saveHandle(dir); }).then(function () {
      var cfg = settings(); return keep({ pass: pass, index: cfg && cfg.pass === pass ? cfg.index : { ids: {}, files: {} }, last: "", count: 0 });
    }).then(sync);
  }
  /* the button: the browser asks the person to choose a folder */
  function choose(pass) {
    var R = SS(), problem = R ? R.passphraseProblem(pass) : "This browser cannot lock files.";
    if (problem) return Promise.reject(new Error(problem));
    if (!supported()) return Promise.reject(new Error("This browser cannot keep residents in a folder. Use Chrome or Edge on a computer, or the handoff file."));
    return root.showDirectoryPicker({ id: "cognicopia-residents", mode: "readwrite" }).then(function (dir) { return connectHandle(dir, pass); });
  }
  /* after the browser restarts it asks again before a page may use the folder: this asks (it needs a click) */
  function reconnect() {
    return loadHandle().then(function (dir) {
      if (!dir) throw new Error("No folder is chosen.");
      return permission(dir, true).then(function (p) { if (p !== "granted") throw new Error("The browser did not allow Cognicopia to use the folder."); return sync(); });
    });
  }
  /* stop: this computer forgets the folder and the passphrase; the files in the folder stay as they are */
  function forget() {
    var st = storage();
    try { if (st) st.removeItem(SETTINGS); } catch (e) { /* locked */ }
    return Promise.resolve(SS() && SS().flush ? SS().flush() : null).then(dropHandle).then(function () { return say({ state: "off" }); });
  }
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  /* on every page that loads this script: once the sealed store is open, sync if the folder is in use and allowed */
  function start() {
    var s = SS(); if (!s || !supported()) return;
    (s.ready ? s.ready() : Promise.resolve()).then(function () { if (open()) return sync(); }).catch(function () { /* shown by status */ });
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start(); }

  root.CogniResidentFolder = Object.freeze({ supported: supported, status: status, sync: sync, soon: soon, choose: choose, connectHandle: connectHandle, reconnect: reconnect, forget: forget, onChange: onChange, fileFor: fileFor, NOTE: NOTE });
})(typeof globalThis !== "undefined" ? globalThis : this);
