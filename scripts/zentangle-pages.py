#!/usr/bin/env python3
"""Turn one Zen Tangle coloring book (a PDF exported from Canva) into the Zentangle Gallery's pictures.

    python3 scripts/zentangle-pages.py <book.pdf> <slug> [--review review.png]

Keeps only the coloring designs, exactly as drawn: it leaves out blank pages, the flat dark gray "this book is the property of" cover (a dark black-and-white drawing is kept), the two "Color Test Page"
pages, the "Zen Tangle Coloring" title page, the "if you enjoyed this book" last page and any other page that has color on it. Each kept page is
written as pure black and white (a lossless WebP, 1656 x 2160) with a small gray thumbnail, in assets/zentangle/<slug>/ (full: NN.webp, small: t/NN.webp).
Prints one JSON line: { slug, pages, kept, dropped: [page numbers with the reason] }. Offline: reads one file, writes files, makes no request.
"""
import sys, io, json, os
try:
    import pymupdf as fitz
except Exception:
    import fitz
from PIL import Image

W, TW = 1656, 240
pdf, slug = sys.argv[1], sys.argv[2]
review = sys.argv[sys.argv.index("--review") + 1] if "--review" in sys.argv else None
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "zentangle", slug)
d = fitz.open(pdf)
# the Color Test Page (a grid of empty ovals): compared with a small picture of it kept beside this script
REF = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "zentangle-test-page.png")).convert("L").resize((32, 42), Image.BOX)
REFV = list(REF.getdata())
def is_test_page(g_img):
    v = list(g_img.convert("L").resize((32, 42), Image.BOX).getdata())
    return sum(abs(a - b) for a, b in zip(v, REFV)) / len(v) < 14
kept, dropped = [], []
for i, p in enumerate(d):
    pm = p.get_pixmap(matrix=fitz.Matrix(0.4, 0.4), colorspace=fitz.csRGB)
    im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    px = list(im.getdata()); n = len(px)
    gray = [(r * 299 + g * 587 + b * 114) // 1000 for r, g, b in px]
    ink = sum(1 for v in gray if v < 128) / n; mean = sum(gray) / n
    colored = sum(1 for r, g, b in px if max(r, g, b) - min(r, g, b) > 28) / n
    mid = sum(1 for v in gray if 40 <= v <= 130) / n           # a cover is a flat dark gray; a dark drawing is black and white
    why = None
    if ink < 0.004: why = "blank"
    elif mean < 150 and mid > 0.5: why = "dark cover page"
    elif "color test" in p.get_text().lower() or is_test_page(im): why = "color test page"
    elif colored > 0.02: why = "has color (promo page with book covers)"
    if why: dropped.append([i + 1, why])
    else: kept.append((i + 1, ink))
os.makedirs(os.path.join(root, "t"), exist_ok=True)
for f in os.listdir(root):
    if f.endswith(".webp"): os.remove(os.path.join(root, f))
for f in os.listdir(os.path.join(root, "t")): os.remove(os.path.join(root, "t", f))
sheet = []
for k, (pg, ink) in enumerate(kept, 1):
    p = d[pg - 1]; s = W / p.rect.width
    pm = p.get_pixmap(matrix=fitz.Matrix(s, s), colorspace=fitz.csGRAY)
    im = Image.frombytes("L", (pm.width, pm.height), pm.samples)
    bw = im.point(lambda v: 255 if v > 150 else 0)
    bw.save(os.path.join(root, "%02d.webp" % k), "WEBP", lossless=True, quality=100, method=6)
    th = im.resize((TW, round(TW * im.height / im.width)), Image.LANCZOS)
    th.save(os.path.join(root, "t", "%02d.webp" % k), "WEBP", quality=62, method=6)
    sheet.append((pg, ink, th))
if review:
    low = sorted(sheet, key=lambda x: x[1])[:12]
    cells = [(0, 0, None)] 
    pics = [d[x[0] - 1] for x in []]
    out = Image.new("L", (8 * 126, 6 * 164), 220)
    items = []
    for pg, why in dropped:
        if why != "blank": items.append(pg)
    items += [x[0] for x in low]
    for j, pg in enumerate(items[:48]):
        pm = d[pg - 1].get_pixmap(matrix=fitz.Matrix(0.2, 0.2), colorspace=fitz.csGRAY)
        t = Image.frombytes("L", (pm.width, pm.height), pm.samples).resize((120, 156))
        out.paste(t, (3 + (j % 8) * 126, 4 + (j // 8) * 164))
    out.save(review)
total = sum(os.path.getsize(os.path.join(root, f)) for f in os.listdir(root) if f.endswith(".webp"))
print(json.dumps({"slug": slug, "pages": len(d), "kept": len(kept), "dropped": [x for x in dropped if x[1] != "blank"], "blank": sum(1 for x in dropped if x[1] == "blank"), "kb": total // 1024}))
