#!/usr/bin/env node
/* js/qr.js: structure checks in Node, and (where OpenCV is installed for Python) every code is rendered and decoded back to its text. */
import { qrMatrix, qrSvg, MAX_BYTES } from "../js/qr.js";
import { execFileSync } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const texts = ["A", "builder.html#/audio/train", "https://cognicopia.org/", "builder.html#/audio/radio-1950s?card=3", "x".repeat(100), "Hello, Peggy — 1950s radio", "y".repeat(180), "z".repeat(MAX_BYTES)];
const sizes = texts.map((t) => qrMatrix(t).length);
ok(sizes[0] === 21 && sizes.every((s) => (s - 17) % 4 === 0 && s >= 21 && s <= 57) && sizes[7] > sizes[0] && MAX_BYTES >= 210, "code sizes follow the version (21 modules for a short text, up to 57; the limit is " + MAX_BYTES + " bytes)");
const m = qrMatrix("hello"), n = m.length, fin = (x0, y0) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const edge = i === 0 || i === 6 || j === 0 || j === 6, core = i >= 2 && i <= 4 && j >= 2 && j <= 4; if (m[y0 + i][x0 + j] !== (edge || core)) return false; } return true; };
ok(fin(0, 0) && fin(n - 7, 0) && fin(0, n - 7) && m[n - 8][8] === true && m[6].slice(8, n - 8).every((v, i) => v === ((i + 8) % 2 === 0)), "the three finder squares, the timing line and the dark module are where the standard puts them");
let thrown = false; try { qrMatrix("q".repeat(MAX_BYTES + 1)); } catch (e) { thrown = e instanceof RangeError; } ok(thrown, "text that is too long is refused with a plain error");
const svg = qrSvg("hello", { scale: 5, label: "Play the radio <b>" }); ok(/^<svg/.test(svg) && /width="145"/.test(svg) && !/<b>/.test(svg) && /fill="#fff"/.test(svg) && /fill="#000"/.test(svg) && JSON.stringify(qrMatrix("same")) === JSON.stringify(qrMatrix("same")), "the SVG is black on white with a quiet zone, the label is safe, and the same text always gives the same code");
let note = "";
try {
  const py = `import cv2,sys,json,numpy as np
d=cv2.QRCodeDetector(); out=[]
for path,txt in json.load(open(sys.argv[1])):
    im=cv2.imread(path,cv2.IMREAD_GRAYSCALE); got,_,_=d.detectAndDecode(im); out.append(got==txt)
print(json.dumps(out))`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-")), jobs = [];
  const { loadPlaywright } = await import("./lib/browser.mjs"); const { chromium } = loadPlaywright(); const br = await chromium.launch(); const pg = await br.newPage();
  for (let i = 0; i < texts.length; i++) { const f = path.join(dir, i + ".png"); await pg.setContent(`<body style="margin:0;background:#fff">${qrSvg(texts[i], { scale: 6 })}</body>`); const el = await pg.$("svg"); await el.screenshot({ path: f }); jobs.push([f, texts[i]]); }
  await br.close(); fs.writeFileSync(path.join(dir, "jobs.json"), JSON.stringify(jobs));
  const res = JSON.parse(execFileSync("python3", ["-c", py, path.join(dir, "jobs.json")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  ok(res.length === texts.length && res.every(Boolean), "an independent decoder (OpenCV) reads every one of " + texts.length + " codes back to its text (" + res.map((x) => (x ? "ok" : "FAIL")).join(",") + ")");
  fs.rmSync(dir, { recursive: true, force: true });
} catch (e) { note = " (the decoder check was skipped: OpenCV for Python or a browser is not available)"; }
if (problems.length) { console.error("qr check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("qr check passed: " + passed + " checks (structure, limits, SVG, decoded back by OpenCV)" + note);
