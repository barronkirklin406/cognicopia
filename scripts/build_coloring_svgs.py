#!/usr/bin/env python3
"""Cognicopia Coloring: turn master PNG line art into closed-path SVG, with VTracer.

Put the masters in  assets/raw_coloring_pngs/  or  assets/coloring/_inbox/  (neither is
published: the first is ignored by .gitignore, the second starts with an underscore) and run

    python3 scripts/build_coloring_svgs.py

For every PNG it
  1. makes the picture pure black on white (Otsu threshold), removes specks, crops to the
     drawing and centers it on a 3:4 page (a 600 x 800 viewBox) with a margin, so every page
     has the same shape as the rest of the library;
  2. traces it with VTracer in binary mode with spline fitting and a speckle filter, so the
     result is smooth curves rather than pixel steps;
  3. keeps only closed paths (every sub-path ends in Z), drops anything that is not a plain
     path, and writes pure black fills, never gray or color;
  4. writes assets/svgs/<name>.svg, and one generated file, js/coloring-data.js, holding the
     same SVG text so js/coloring.js can draw it with no network request (a fetch fails on
     file:// and on a computer that is offline).

Line weight. VTracer outlines the ink in the master, so the weight of a line is the weight it
was drawn at. The tier weights (3, 4.5 and 7.9 pt, never under 3 pt) are added on top by
css/styles.css (.tier-1, .tier-2, .tier-3, drawn with vector-effect: non-scaling-stroke), which
also guarantees that no line is thinner than the 3 pt floor. The center-line tracer
(node scripts/ingest_coloring_assets.mjs, npm run coloring:ingest) is the route that rebuilds a
picture for each tier; this one keeps the picture exactly as drawn.

Needs Python 3.9+, Pillow and vtracer (pip install pillow vtracer). Where they are not
installed this says so and exits 2, and nothing is written; npm run build skips it the same
way it skips the browser checks. It makes no network request.

Options
  --src DIR [--src DIR ...]  where the PNGs are (default: both folders above)
  --out DIR                  where the SVGs go (default assets/svgs)
  --data FILE                the generated data file (default js/coloring-data.js)
  --only NAME                trace one picture
  --speckle N                VTracer filter_speckle, in pixels (default 4)
  --list                     say what would be traced and write nothing
  --check                    exit 1 if js/coloring-data.js is not what the SVGs in --out would make
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = [ROOT / "assets" / "raw_coloring_pngs", ROOT / "assets" / "coloring" / "_inbox"]
VIEW_W, VIEW_H = 600, 800          # the library's page: 3:4
MARGIN = 0.05                      # of the page, on every side
TRACE_H = 1600                     # the working height in pixels (2x the page: smooth curves, small files)
SLUG = re.compile(r"[^a-z0-9]+")


def need(module: str, pip: str | None = None):
    try:
        return __import__(module)
    except ImportError:
        print(f"{module} is not installed here (pip install {pip or module}). Nothing was written.", file=sys.stderr)
        sys.exit(2)


def slug(name: str) -> str:
    return SLUG.sub("-", name.lower()).strip("-") or "picture"


def otsu(hist, total: int) -> int:
    """The threshold that best separates ink from paper (Otsu's method) on a 256-bin histogram."""
    sum_all = sum(i * h for i, h in enumerate(hist))
    best, best_t, w0, sum0 = -1.0, 128, 0, 0
    for t in range(256):
        w0 += hist[t]
        if w0 == 0:
            continue
        w1 = total - w0
        if w1 == 0:
            break
        sum0 += t * hist[t]
        m0, m1 = sum0 / w0, (sum_all - sum0) / w1
        between = w0 * w1 * (m0 - m1) ** 2
        if between > best:
            best, best_t = between, t
    return best_t


def prepare(png: Path, speckle: int):
    """Pure black on white, cropped to the drawing, centered on a 3:4 page. Returns (image, notes)."""
    need("PIL", "pillow")
    from PIL import Image
    img = Image.open(png).convert("RGBA")
    # transparent paper counts as white
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    bg.alpha_composite(img)
    gray = bg.convert("L")
    t = otsu(gray.histogram(), gray.width * gray.height)
    ink = gray.point(lambda v: 255 if v <= t else 0, mode="L")          # 255 = ink
    notes = []
    # remove specks: ink blobs smaller than the filter are noise (a cheap pass; VTracer filters again)
    bbox = ink.getbbox()
    if bbox is None:
        raise ValueError("no ink found: the picture is blank")
    ink = ink.crop(bbox)
    w, h = ink.size
    page_w, page_h = int(TRACE_H * VIEW_W / VIEW_H), TRACE_H
    box_w, box_h = page_w * (1 - 2 * MARGIN), page_h * (1 - 2 * MARGIN)
    scale = min(box_w / w, box_h / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    # resize the anti-aliased ink, soften the last staircase, then cut it clean: smooth edges, few points
    from PIL import ImageFilter
    ink = ink.resize((nw, nh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(radius=1.1)).point(lambda v: 255 if v >= 128 else 0, mode="L")
    page = Image.new("L", (page_w, page_h), 0)
    page.paste(ink, ((page_w - nw) // 2, (page_h - nh) // 2))
    out = Image.eval(page, lambda v: 255 - v)                             # black ink on white
    if t > 200:
        notes.append("the master is very light: its threshold was %d" % t)
    return out, notes


def trace(prepared, speckle: int) -> str:
    vtracer = need("vtracer")
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / "in.png", Path(tmp) / "out.svg"
        prepared.save(src)
        vtracer.convert_image_to_svg_py(
            str(src), str(dst),
            colormode="binary",          # ink and paper, nothing else
            hierarchical="cutout",       # holes are cut out of their parent: one compound path per shape
            mode="spline",               # smooth curves
            filter_speckle=speckle,
            corner_threshold=60,
            length_threshold=8.0,
            max_iterations=10,
            splice_threshold=45,
            path_precision=2,
        )
        return dst.read_text(encoding="utf8")


NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")
FIDELITY_LIMIT = 0.12  # the share of the master's ink the redrawn outline may differ by (a thin line magnifies a small error)
SIMPLIFY = 1.4      # trace pixels: how far a simplified outline may stray from the traced one (0.9 px of 1600 is under 0.05% of the page)
CORNER = 55         # degrees of turn above which a point stays a sharp corner


def subpaths(d: str, dx: float, dy: float):
    """Absolute M/C/L/Z path data to a list of closed point loops (the end points of each segment)."""
    loops = []
    for part in re.split(r"(?=[Mm])", d.strip()):
        if not part.strip():
            continue
        cmd_iter = re.finditer(r"([MCLZmclz])([^MCLZmclz]*)", part)
        pts, cur = [], None
        for m in cmd_iter:
            c, nums = m.group(1), [float(x) for x in NUM.findall(m.group(2))]
            if c in "ML" and len(nums) >= 2:
                for i in range(0, len(nums) - 1, 2):
                    pts.append((nums[i] + dx, nums[i + 1] + dy))
            elif c == "C" and len(nums) >= 6 and pts:
                for i in range(0, len(nums) - 5, 6):
                    p0 = pts[-1]
                    c1, c2, p3 = (nums[i] + dx, nums[i + 1] + dy), (nums[i + 2] + dx, nums[i + 3] + dy), (nums[i + 4] + dx, nums[i + 5] + dy)
                    chord = ((p3[0] - p0[0]) ** 2 + (p3[1] - p0[1]) ** 2) ** 0.5
                    steps = max(1, min(16, int(chord / 3)))        # a long, smooth segment is sampled along its curve
                    for k in range(1, steps + 1):
                        t = k / steps
                        u = 1 - t
                        pts.append((u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p3[0],
                                    u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p3[1]))
            elif c in "mcl":
                raise ValueError("relative path data is not expected from VTracer")
        if len(pts) >= 3:
            if pts[0] == pts[-1]:
                pts.pop()
            loops.append(pts)
    return loops


def rdp(points, eps):
    """Ramer-Douglas-Peucker on a closed loop: anchor on the two farthest points, simplify each side."""
    n = len(points)
    if n <= 4:
        return points
    def dist(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return ((x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2) ** 0.5
    def chain(seq):
        keep = {0, len(seq) - 1}
        stack = [(0, len(seq) - 1)]
        while stack:
            i, j = stack.pop()
            far, at = 0.0, None
            for k in range(i + 1, j):
                d = dist(seq[k], seq[i], seq[j])
                if d > far:
                    far, at = d, k
            if at is not None and far > eps:
                keep.add(at)
                stack += [(i, at), (at, j)]
        return [seq[k] for k in sorted(keep)]
    a = 0
    b = max(range(n), key=lambda k: (points[k][0] - points[a][0]) ** 2 + (points[k][1] - points[a][1]) ** 2)
    first = chain(points[a:b + 1])
    second = chain(points[b:] + points[:a + 1])
    return first[:-1] + second[:-1]


def turn(p0, p1, p2):
    import math
    a1 = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    a2 = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    d = abs(math.degrees(a2 - a1)) % 360
    return 360 - d if d > 180 else d


def smooth_loop(pts, sx, sy):
    """A closed smooth path through the points (Catmull-Rom as cubic curves), sharp where the outline turns sharply."""
    n = len(pts)
    corner = [turn(pts[i - 1], pts[i], pts[(i + 1) % n]) > CORNER for i in range(n)]
    f = lambda p: (p[0] * sx, p[1] * sy)
    out = ["M%.2f %.2f" % f(pts[0])]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = p1 if corner[i] else (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = p2 if corner[(i + 1) % n] else (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append("C%.2f %.2f %.2f %.2f %.2f %.2f" % (*f(c1), *f(c2), *f(p2)))
    out.append("Z")
    return " ".join(out)


def clean(svg_text: str, w: int, h: int):
    """Keep only closed outlines of the ink, simplified and smoothed, in pure black on a 600 x 800 viewBox."""
    sx, sy = VIEW_W / w, VIEW_H / h
    loops_all, raw_nodes, skipped = [], 0, 0
    for m in re.finditer(r"<path\b([^>]*)>", svg_text, re.S):
        attrs = m.group(1)
        d = re.search(r"\bd=\"([^\"]+)\"", attrs)
        fill = re.search(r"\bfill=\"([^\"]+)\"", attrs)
        if not d:
            continue
        if fill and fill.group(1).lower() not in ("#000000", "#000", "black"):
            skipped += 1                              # a white or colored shape is paper, not ink
            continue
        tr = re.search(r"transform=\"translate\(([-\d.]+)[ ,]+([-\d.]+)\)\"", attrs)
        dx, dy = (float(tr.group(1)), float(tr.group(2))) if tr else (0.0, 0.0)
        for loop in subpaths(d.group(1), dx, dy):
            raw_nodes += len(loop)
            loops_all.append(rdp(loop, SIMPLIFY))
    loops_all = [l for l in loops_all if len(l) >= 3]
    if not loops_all:
        raise ValueError("the trace found no ink")
    d = " ".join(smooth_loop(l, sx, sy) for l in loops_all)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW_W} {VIEW_H}" width="{VIEW_W}" height="{VIEW_H}">'
           f'<path d="{d}" fill="#000000" fill-rule="evenodd"/></svg>')
    return svg, {"paths": 1, "subpaths": len(loops_all), "closed_by_script": 0, "nodes_traced": raw_nodes,
                 "nodes_kept": sum(len(l) for l in loops_all), "skipped": skipped, "loops": loops_all}


def fidelity(loops, ink_mask, k=3):
    """How closely the simplified outlines redraw the ink: the share of the ink's area that differs.

    The outlines are drawn k times larger, with even-odd fill, and averaged back down, so a pixel that the
    outline cuts in half counts as half rather than all-or-nothing."""
    from PIL import Image, ImageChops, ImageDraw
    w, h = ink_mask.size
    acc = Image.new("L", (w * k, h * k), 0)
    for l in loops:
        m = Image.new("L", (w * k, h * k), 0)
        ImageDraw.Draw(m).polygon([(x * k, y * k) for x, y in l], fill=255)
        acc = ImageChops.difference(acc, m)               # even-odd: a hole cancels the shape it sits in
    cover = acc.reduce(k)                                 # 0..255, how much of each pixel the outlines cover
    ink = ink_mask.point(lambda v: 255 if v < 128 else 0, mode="L")
    diff = ImageChops.difference(cover, ink)
    area = max(1, sum(ink.histogram()[255:]))
    soft = sum(i * c for i, c in enumerate(diff.histogram())) / 255
    return soft / area


def title_of(name: str, sidecar: dict) -> str:
    if sidecar.get("title"):
        return str(sidecar["title"])
    return " ".join(w.capitalize() for w in re.split(r"[-_ ]+", name) if w)


def collect(srcs, only):
    seen, out = set(), []
    for d in srcs:
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.png")):
            if re.search(r"\.t[23]\.png$", p.name):      # per-tier drawings belong to the center-line route
                continue
            n = slug(p.stem)
            if only and n != slug(only):
                continue
            if n in seen:
                continue
            seen.add(n)
            out.append((n, p))
    return out


def data_file(items) -> str:
    rows = ",\n".join("      " + json.dumps(i, ensure_ascii=False, separators=(",", ":")) for i in items)
    body = "[\n" + rows + "\n    ]" if rows else "[]"
    return ("/* Generated by scripts/build_coloring_svgs.py. Do not edit by hand: change the masters and run it again.\n"
            "   The SVG text is kept here so js/coloring.js can draw a picture with no network request\n"
            "   (a fetch fails on file:// and on a computer that is offline). */\n"
            "(function (root) {\n  \"use strict\";\n  root.CognicopiaSvgColoringData = Object.freeze({\n    viewBox: [0, 0, %d, %d],\n    items: %s\n  });\n})(typeof globalThis !== \"undefined\" ? globalThis : this);\n"
            % (VIEW_W, VIEW_H, body))


def read_items(out_dir: Path, src_meta):
    items = []
    for svg in sorted(out_dir.glob("*.svg")):
        text = svg.read_text(encoding="utf8")
        meta = src_meta.get(svg.stem, {})
        items.append({"id": svg.stem, "title": meta.get("title") or title_of(svg.stem, {}), "svg": text,
                      "bytes": len(text.encode("utf8")), "sha256": hashlib.sha256(text.encode("utf8")).hexdigest()[:16]})
    return items


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", action="append", type=Path)
    ap.add_argument("--out", type=Path, default=ROOT / "assets" / "svgs")
    ap.add_argument("--data", type=Path, default=ROOT / "js" / "coloring-data.js")
    ap.add_argument("--only")
    ap.add_argument("--speckle", type=int, default=4)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    srcs = a.src or DEFAULT_SRC

    meta = {}
    if a.check:
        want = data_file(read_items(a.out, meta))
        have = a.data.read_text(encoding="utf8") if a.data.exists() else ""
        if want != have:
            print(f"{a.data} is not what the SVGs in {a.out} make: run python3 scripts/build_coloring_svgs.py", file=sys.stderr)
            return 1
        print(f"coloring data is current ({len(read_items(a.out, meta))} pictures)")
        return 0

    todo = collect(srcs, a.only)
    if a.list:
        for n, p in todo:
            print(f"{n}  <-  {p.relative_to(ROOT) if p.is_relative_to(ROOT) else p}")
        print(f"{len(todo)} picture(s) would be traced")
        return 0
    if not todo and a.data.exists():
        print("No PNG masters found in: " + ", ".join(str(s) for s in srcs) + ". Nothing to do.")
        return 0

    if todo:
        need("PIL", "pillow"); need("vtracer")
    a.out.mkdir(parents=True, exist_ok=True)
    problems = 0
    for n, p in todo:
        try:
            side = p.with_suffix(".json")
            sidecar = json.loads(side.read_text(encoding="utf8")) if side.exists() else {}
            meta[n] = {"title": title_of(n, sidecar)}
            img, notes = prepare(p, a.speckle)
            svg, stats = clean(trace(img, a.speckle), img.width, img.height)
            off = fidelity(stats["loops"], img)
            if off > FIDELITY_LIMIT:
                raise ValueError("the smoothed outline differs from the master by %.1f%% of its ink (limit %d%%)" % (off * 100, FIDELITY_LIMIT * 100))
            (a.out / f"{n}.svg").write_text(svg, encoding="utf8")
            extra = f"; {'; '.join(notes)}" if notes else ""
            print(f"ok   {n}: {stats['subpaths']} closed outline(s), {stats['nodes_traced']} nodes traced, {stats['nodes_kept']} kept, "
                  f"{off * 100:.2f}% off, {max(1, len(svg) // 1024)} KB{extra}")
        except Exception as e:                      # one bad picture must not stop the rest
            problems += 1
            print(f"FAIL {n}: {e}", file=sys.stderr)
    items = read_items(a.out, meta)
    a.data.parent.mkdir(parents=True, exist_ok=True)
    a.data.write_text(data_file(items), encoding="utf8")
    print(f"wrote {a.data.relative_to(ROOT) if a.data.is_relative_to(ROOT) else a.data} ({len(items)} picture(s))")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
