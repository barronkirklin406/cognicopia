#!/usr/bin/env node
/* =====================================================================
   Reference audit: a read-only static scan of every .html, .js and .css file.

   It finds the kind of breakage that shows up as a dead button or a blank
   page, and writes a markdown report. It never changes a file.

     errors    a local script, stylesheet, image or page that does not exist
               (the 404 a visitor would get); an id used twice in one page; a
               closing tag that does not match what is open; an empty link
               (href="#", href="", javascript:); a listener attached straight
               to an element whose id exists nowhere in the repository
     warnings  an id that code looks up but no page or script ever creates; an
               in-page link (#name) with nothing to land on; a leftover
               console.log, debugger statement or TODO/FIXME
     notes     CSS classes that no page or script mentions

   What it cannot know. This is a text scan, not a browser. An id built from
   pieces at run time, or a class chosen by a calculation, can look dead when
   it is not, which is why those are warnings and notes, not errors. A clean
   report does not prove every button works: run the page checks in
   scripts/check-*-ui.mjs for that. Generated and bundled files (see
   GENERATED) are read for the ids they define but never reported on, because
   the fix belongs in their source.

   Use:
     node scripts/audit-references.mjs                  report to docs/audit-report.md
     node scripts/audit-references.mjs --out -          report to the screen
     node scripts/audit-references.mjs --json           the same findings as JSON
     node scripts/audit-references.mjs --root some/dir  scan another folder
     node scripts/audit-references.mjs --selftest       prove the scan finds planted faults
   Exit code 1 when there is at least one error.
   ===================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const HERE = path.dirname(fileURLToPath(import.meta.url));

/* Files that are produced by a tool or copied from elsewhere: read for the ids they create, never reported on. */
const GENERATED = [/(^|\/)assets\/services\//, /(^|\/)assets\/(svgs|pcg|coloring|cognicopia-coloring|brand)\//, /\.bundle\.js$/, /\.min\.js$/, /(^|\/)js\/coloring-data\.js$/, /jspdf/i, /(^|\/)node_modules\//, /(^|\/)platform\//, /(^|\/)license-service\//, /(^|\/)outreach\/data\//];
const SKIP_DIRS = new Set([".git", "node_modules", ".claude"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "command", "keygen", "basefont", "frame"]);
const OPTIONAL_END = new Set(["p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody", "tfoot", "option", "optgroup", "colgroup", "caption", "rt", "rp"]);

function audit(root) {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(html|js|mjs|css)$/i.test(e.name)) files.push(full);
    }
  })(root);

  const rel = (f) => path.relative(root, f).split(path.sep).join("/");
  const findings = { errors: [], warnings: [], notes: [] };
  const add = (level, category, file, line, message) => findings[level].push({ category, file, line, message });
  const lineOf = (text, idx) => { let n = 1; for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) n++; return n; };
  const blank = (s) => s.replace(/[^\n]/g, " ");

  const defined = new Set();      // every id the repository creates, in markup or in code
  const cssClasses = [];          // { cls, file, line }
  const jsUnits = [];             // { file, text, line0, report }
  const htmlUnits = [];

  const read = new Map();
  for (const f of files) { try { read.set(f, fs.readFileSync(f, "utf8")); } catch (e) { add("errors", "unreadable file", rel(f), 1, String(e.message)); } }

  const idDefsOf = (text) => {
    for (const m of text.matchAll(/\bid\s*=\s*\\?["']([A-Za-z_][\w:.-]*)\\?["']/g)) defined.add(m[1]);
    for (const m of text.matchAll(/\.id\s*=\s*["']([A-Za-z_][\w:.-]*)["']/g)) defined.add(m[1]);
    for (const m of text.matchAll(/setAttribute\(\s*["']id["']\s*,\s*["']([A-Za-z_][\w:.-]*)["']/g)) defined.add(m[1]);
    for (const m of text.matchAll(/\bid\s*:\s*["']([A-Za-z_][\w:.-]*)["']/g)) defined.add(m[1]);
  };

  /* ---- pass 1: split each page into markup, scripts and styles; collect definitions ---- */
  for (const [f, text] of read) {
    const r = rel(f), gen = GENERATED.some((g) => g.test(r)), ext = path.extname(f).toLowerCase();
    idDefsOf(text);
    if (ext === ".js" || ext === ".mjs") { jsUnits.push({ file: r, text, line0: 1, report: !gen && !r.startsWith("scripts/") }); continue; }
    if (ext === ".css") { if (!gen) collectCss(text, r, 1); continue; }
    /* html */
    let masked = text, scripts = [], styles = [];
    masked = masked.replace(/<!--[\s\S]*?-->/g, blank);
    masked = masked.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body, off) => {
      const start = off + m.indexOf(">") + 1;
      if (!/\bsrc\s*=/.test(attrs) && !/type\s*=\s*["'](?:application\/(?:ld\+)?json|text\/template|importmap)/i.test(attrs)) scripts.push({ body, start });
      return m.slice(0, m.indexOf(">") + 1) + blank(body) + "</script>";
    });
    masked = masked.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, body, off) => { styles.push({ body, start: off + m.indexOf(">") + 1 }); return m.slice(0, m.indexOf(">") + 1) + blank(body) + "</style>"; });
    for (const s of scripts) jsUnits.push({ file: r, text: s.body, line0: lineOf(text, s.start), report: !gen });
    for (const s of styles) if (!gen) collectCss(s.body, r, lineOf(text, s.start));
    htmlUnits.push({ file: r, path: f, text, masked, gen });
  }
  function collectCss(css, file, line0) {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, (m) => blank(m)).replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => blank(m));
    const heads = body.replace(/\{[^{}]*\}/g, "{}").replace(/\{[^{}]*\}/g, "{}");
    for (const m of heads.matchAll(/(^|[^\w-])\.([A-Za-z_][\w-]*)/g)) cssClasses.push({ cls: m[2], file, line: line0 + (heads.slice(0, m.index).match(/\n/g) || []).length });
  }

  /* ---- pass 2: markup checks ---- */
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const attr = (attrs, name) => { const m = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(attrs); return m ? (m[1] ?? m[2] ?? m[3]) : null; };
  for (const u of htmlUnits) {
    const { file, masked, text, gen } = u, dir = path.dirname(u.path), seen = new Map(), stack = [], anchorsWanted = [];
    const here = new Set(); for (const m of masked.matchAll(/\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) here.add(m[1] ?? m[2]);
    tagRe.lastIndex = 0; let m;
    while ((m = tagRe.exec(masked))) {
      const closing = m[1] === "/", name = m[2].toLowerCase(), attrs = m[3], line = lineOf(text, m.index), selfClose = /\/\s*$/.test(attrs);
      if (!gen) {
        if (!closing) {
          const id = attr(attrs, "id");
          if (id && !/[\${]/.test(id)) { if (seen.has(id)) add("errors", "duplicate id", file, line, `id="${id}" is used again (first on line ${seen.get(id)})`); else seen.set(id, line); }
          if (name === "a" || name === "area") {
            const href = attr(attrs, "href");
            if (href !== null && (href.trim() === "" || href.trim() === "#" || /^javascript:\s*(void\(0\))?;?\s*$/i.test(href.trim()))) add("errors", "empty link", file, line, `<${name} href="${href}"> goes nowhere: use a <button type="button"> for an action, or a real address`);
            else if (href && href[0] === "#" && href.length > 1 && !/[\${]/.test(href) && !here.has(decodeURIComponent(href.slice(1)))) anchorsWanted.push({ line, frag: href.slice(1) });
          }
        }
        /* local files */
        const tagTargets = { script: "src", link: "href", img: "src", source: "src", video: "src", audio: "src", iframe: "src", a: "href", embed: "src" };
        if (!closing && tagTargets[name]) checkLocal(file, line, name, attr(attrs, tagTargets[name]), dir);
        if (!closing && name === "img") { const ss = attr(attrs, "srcset"); if (ss) ss.split(",").forEach((p) => checkLocal(file, line, "img srcset", p.trim().split(/\s+/)[0], dir)); }
      }
      /* balance */
      if (VOID.has(name) || selfClose) continue;
      if (!closing) { stack.push({ name, line }); continue; }
      let i = stack.length - 1; while (i >= 0 && stack[i].name !== name && OPTIONAL_END.has(stack[i].name)) i--;
      if (i >= 0 && stack[i].name === name) { stack.length = i; continue; }
      let deeper = stack.length - 1; while (deeper >= 0 && stack[deeper].name !== name) deeper--;
      if (deeper >= 0) {      /* the tag is open further out: say what was left open inside it, and carry on from there */
        const left = stack.slice(deeper + 1).filter((x) => !OPTIONAL_END.has(x.name));
        if (!gen) add("errors", "mismatched tag", file, line, `</${name}> closes the <${name}> from line ${stack[deeper].line}, but ${left.map((x) => `<${x.name}> (line ${x.line})`).join(", ")} is still open inside it`);
        stack.length = deeper; continue;
      }
      if (!gen) add("errors", "mismatched tag", file, line, `</${name}> has no matching <${name}>`);
    }
    if (!gen) {
      for (const s of stack) if (!OPTIONAL_END.has(s.name) && !["html", "body", "head"].includes(s.name)) add("errors", "unclosed tag", file, s.line, `<${s.name}> is never closed`);
      for (const a of anchorsWanted) if (!defined.has(a.frag)) add("warnings", "in-page link", file, a.line, `href="#${a.frag}" has nothing to land on (no id or name "${a.frag}" in this page or any script)`);
    }
  }
  function checkLocal(file, line, what, url, dir) {
    if (!url) return; url = url.trim();
    if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\$\{|\{\{)/i.test(url) || /[\${]/.test(url)) return;
    const clean = decodeURIComponent(url.split(/[?#]/)[0]); if (!clean) return;
    let target = clean.startsWith("/") ? path.join(root, clean) : path.resolve(dir, clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) add("errors", "missing file", file, line, `<${what}> points at "${url}", which does not exist`);
  }

  /* ---- pass 3: code checks ---- */
  const refRe = [
    [/getElementById\(\s*(["'`])([^"'`$\\\s]+)\1\s*\)/g, 2],
    [/querySelector(?:All)?\(\s*(["'`])#([A-Za-z_][\w:-]*)(?=[\s.\[:>+~,"'`)])/g, 2],
    [/(?<![\w$.])\$\(\s*(["'])#([A-Za-z_][\w:-]*)\1\s*\)/g, 2]
  ];
  const reported = new Set();
  for (const u of jsUnits) {
    if (!u.report) continue;
    const code = u.text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:\\"'`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
    const L = (i) => u.line0 + (code.slice(0, i).match(/\n/g) || []).length;
    for (const [re, g] of refRe) for (const m of code.matchAll(re)) {
      const id = m[g]; if (defined.has(id)) continue;
      const tail = code.slice(m.index + m[0].length, m.index + m[0].length + 40);
      const direct = /^\s*(?:\?\.|\.)\s*(?:addEventListener|onclick|click)\b/.test(tail);
      const key = u.file + ":" + id + ":" + direct; if (reported.has(key)) continue; reported.add(key);
      if (direct) add("errors", "listener on a missing element", u.file, L(m.index), `a listener is attached directly to "#${id}", which no page or script creates`);
      else add("warnings", "dead id reference", u.file, L(m.index), `code looks up "#${id}", which no page or script creates`);
    }
    /* const x = <lookup>; x.addEventListener(...) */
    for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:document\.)?(?:getElementById\(\s*["']([\w:-]+)["']\s*\)|querySelector\(\s*["']#([\w:-]+)["']\s*\)|\$\(\s*["']#([\w:-]+)["']\s*\))\s*;/g)) {
      const v = m[1], id = m[2] || m[3] || m[4]; if (defined.has(id)) continue;
      const vr = v.replace(/\$/g, "\\$");
      if (!new RegExp("(?<![\\w$.])" + vr + "\\.addEventListener\\b").test(code)) continue;
      /* a null test anywhere in the same code (if (x), x &&, x ?., if (!x)) means the page copes with the element being absent */
      const guarded = new RegExp("if\\s*\\(\\s*!?\\s*" + vr + "\\b|(?<![\\w$.])" + vr + "\\s*(?:&&|\\?\\.)|&&\\s*" + vr + "\\b|!\\s*" + vr + "\\b").test(code);
      const key = u.file + ":" + id + ":var"; if (reported.has(key)) continue; reported.add(key);
      if (guarded) add("warnings", "dead id reference", u.file, L(m.index), `code looks up "#${id}", which no page or script creates; it checks for null before attaching a listener, so nothing breaks, but that handler never runs`);
      else add("errors", "listener on a missing element", u.file, L(m.index), `"${v}" is looked up as "#${id}", which no page or script creates, and a listener is then attached to it without a null check`);
    }
    if (!u.file.startsWith("scripts/")) {
      for (const m of code.matchAll(/(?<![\w$.])console\.log\s*\(/g)) add("warnings", "debug leftover", u.file, L(m.index), "console.log( … ) left in the code");
      for (const m of code.matchAll(/(?<![\w$.])debugger\s*;/g)) add("warnings", "debug leftover", u.file, L(m.index), "debugger statement left in the code");
      for (const m of u.text.matchAll(/(?:\/\/|\/\*)\s*(TODO|FIXME|XXX)\b[^\n]*/g)) add("warnings", "unfinished note", u.file, u.line0 + (u.text.slice(0, m.index).match(/\n/g) || []).length, m[0].slice(0, 90));
    }
  }

  /* ---- pass 4: unreferenced classes (a note, never an error). A class counts as used when any page or script
     outside a stylesheet mentions it; the stylesheet's own selector does not count. ---- */
  const nonCss = new Set();
  for (const [f, text] of read) {
    const ext = path.extname(f).toLowerCase(); if (ext === ".css") continue;
    const t = ext === ".html" ? text.replace(/<style\b[\s\S]*?<\/style>/gi, " ") : text;
    for (const m of t.matchAll(/[A-Za-z_][\w-]*/g)) nonCss.add(m[0]);
  }
  const doneCls2 = new Set();
  for (const c of cssClasses) { if (doneCls2.has(c.cls)) continue; if (!nonCss.has(c.cls)) { doneCls2.add(c.cls); add("notes", "unreferenced class", c.file, c.line, `.${c.cls} is styled but no page or script mentions it`); } }

  return { findings, scanned: { html: files.filter((f) => /\.html$/i.test(f)).length, js: files.filter((f) => /\.m?js$/i.test(f)).length, css: files.filter((f) => /\.css$/i.test(f)).length }, ids: defined.size };
}

function report(result, root) {
  const { findings: F, scanned } = result, count = (a) => a.length;
  const status = F.errors.length ? "RED: errors need fixing" : F.warnings.length ? "AMBER: no errors, warnings to review" : "GREEN: nothing found";
  const out = [`# Reference audit report`, ``, `Scanned ${scanned.html} HTML, ${scanned.js} JavaScript and ${scanned.css} CSS files under \`${path.basename(root) || "."}\`. This scan is read-only: it changed no file.`, ``, `**Health: ${status}**`, ``,
    `| | Count |`, `|---|---|`, `| Errors | ${count(F.errors)} |`, `| Warnings | ${count(F.warnings)} |`, `| Notes | ${count(F.notes)} |`, ``];
  for (const [level, title, blurb] of [["errors", "Errors", "Each of these breaks something a visitor can reach."], ["warnings", "Warnings", "Review each one: some are real, some are ids or notes built at run time that a text scan cannot see."], ["notes", "Notes", "Information only. A class used by a calculation can look unused here."]]) {
    out.push(`## ${title} (${F[level].length})`, ``, blurb, ``);
    if (!F[level].length) { out.push("None.", ""); continue; }
    const byCat = {}; for (const f of F[level]) (byCat[f.category] = byCat[f.category] || []).push(f);
    for (const [cat, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
      out.push(`### ${cat} (${list.length})`, ``);
      for (const f of list.slice(0, 40)) out.push(`- \`${f.file}:${f.line}\` ${f.message}`);
      if (list.length > 40) out.push(`- …and ${list.length - 40} more (run with --json for all of them)`);
      out.push("");
    }
  }
  out.push(`## What this scan cannot prove`, ``, `It reads text; it does not run the pages. A clean report does not show that every button works. Run \`scripts/check-*-ui.mjs\` and \`scripts/audit-ux.mjs\` for behaviour.`, ``);
  return out.join("\n");
}

/* ---- self test: plant known faults in a temporary folder and prove each is found ---- */
function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-audit-"));
  const w = (n, t) => { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), t); };
  w("good.html", `<!doctype html><html><head><title>t</title><link rel="stylesheet" href="s.css"></head><body><main id="m"><button id="ok">x</button><a href="#m">top</a><p>one<p>two</main><script>document.getElementById("ok").addEventListener("click", function(){});</script></body></html>`);
  w("s.css", `.used{color:#000}.orphan{color:#111}`);
  w("bad.html", `<!doctype html><html><head><title>t</title><script src="gone.js"></script></head><body class="used">
<div id="dup"><span id="dup">a</span></div>
<a href="#">dead</a><a href="#nowhere">anchor</a>
<div><b>x</div></b>
<img src="missing.png" alt="">
<script>
  document.getElementById("ghost").addEventListener("click", function(){});
  var el = document.querySelector("#phantom"); el.addEventListener("click", function(){});
  var seen = document.getElementById("neverMade");
  var careful = document.getElementById("absentGuarded"); if (careful) { careful.addEventListener("click", function(){}); }
  console.log("debug"); debugger;
  // TODO remove
</script></body></html>`);
  const r = audit(dir); fs.rmSync(dir, { recursive: true, force: true });
  const has = (level, cat, file, needle) => r.findings[level].some((f) => f.category === cat && f.file === file && (!needle || f.message.includes(needle)));
  const expect = [
    ["errors", "missing file", "bad.html", "gone.js"], ["errors", "missing file", "bad.html", "missing.png"], ["errors", "duplicate id", "bad.html", "dup"], ["errors", "empty link", "bad.html", 'href="#"'],
    ["errors", "mismatched tag", "bad.html", "<b> (line"], ["errors", "mismatched tag", "bad.html", "</b> has no matching"], ["errors", "listener on a missing element", "bad.html", "ghost"], ["errors", "listener on a missing element", "bad.html", "phantom"],
    ["warnings", "dead id reference", "bad.html", "neverMade"], ["warnings", "dead id reference", "bad.html", "absentGuarded"], ["warnings", "in-page link", "bad.html", "nowhere"], ["warnings", "debug leftover", "bad.html", "console.log"], ["warnings", "debug leftover", "bad.html", "debugger"], ["warnings", "unfinished note", "bad.html", "TODO"],
    ["notes", "unreferenced class", "s.css", "orphan"]
  ];
  const guardedAsError = r.findings.errors.some((f) => f.message.includes("absentGuarded"));
  const missed = expect.filter((e) => !has(...e)), falsePos = r.findings.errors.concat(r.findings.warnings).filter((f) => f.file === "good.html");
  const noteUsed = r.findings.notes.some((f) => f.message.includes(".used "));
  if (missed.length || falsePos.length || noteUsed || guardedAsError) { if (guardedAsError) console.error("  a null-guarded listener was reported as an error"); console.error("self test FAILED"); missed.forEach((m) => console.error("  not found: " + m.join(" | "))); falsePos.forEach((f) => console.error("  false alarm on a clean page: " + f.category + " " + f.message)); if (noteUsed) console.error("  a used class was reported as unused"); process.exit(1); }
  console.log(`self test passed: ${expect.length} planted faults found, no false alarms on the clean page`);
}

if (flag("--selftest")) selftest();
else {
  const root = path.resolve(opt("--root", path.join(HERE, "..")));
  const result = audit(root);
  if (flag("--json")) console.log(JSON.stringify(result, null, 1));
  else {
    const md = report(result, root), out = opt("--out", path.join(root, "docs", "audit-report.md"));
    if (out === "-") console.log(md); else { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, md); console.log(`audit report written to ${path.relative(process.cwd(), out)}: ${result.findings.errors.length} errors, ${result.findings.warnings.length} warnings, ${result.findings.notes.length} notes`); }
  }
  process.exit(result.findings.errors.length ? 1 : 0);
}
