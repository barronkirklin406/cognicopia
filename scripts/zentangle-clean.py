#!/usr/bin/env python3
"""Second pass over the Zentangle Gallery's books: take out the front-matter pages scripts/zentangle-pages.py cannot tell from a coloring design.

    python3 scripts/zentangle-clean.py            (every book in assets/zentangle/)
    python3 scripts/zentangle-clean.py dogs lions (only these)
    python3 scripts/zentangle-clean.py --drop reptiles:1 --drop dinosaurs:1,51   (also these pages, by their place in the book now, after looking at them)

A page is removed when it is
  - the "Color Test Page" (a grid of empty ovals), anywhere in the book, found by comparing it with scripts/zentangle-test-page.png; or
  - one of the last 2 pages and made of separate lines of text on white (the "If you enjoyed this book" page); or
  - one of the first 12 pages and its drawing fills less than half of the page (the crown brand page, "This Book Belongs To", the "Zen" and "Zen Tangle
    Coloring" title pages): the book's own coloring designs fill the page, and the few that do not (a single tree, a lion) are never among the first 12.
The pages after it are renumbered (01, 02, ...) and prints one JSON line per book. Nothing here replaces looking at the pages: scripts/check-zentangle-ui.mjs
and a contact sheet of every book's first and last pages are how the owner's exclusions were verified. Offline; reads and writes files only.
"""
import os, sys, json
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..", "assets", "zentangle")
REF = list(Image.open(os.path.join(here, "zentangle-test-page.png")).convert("L").resize((32, 42), Image.BOX).getdata())
FRONT = 12

def text_page(im):
    """lines of text: six or more bands of ink separated by white rows, and little ink in all"""
    g = im.resize((120, 156), Image.BOX); px = g.load(); W, H = g.size
    rows = [sum(1 for x in range(W) if px[x, y] < 150) for y in range(H)]
    bands, inb, gap = 0, False, 0
    for r in rows:
        if r > 0:
            if not inb: bands += 1; inb = True
            gap = 0
        else:
            gap += 1
            if gap >= 2: inb = False
    return bands >= 6 and sum(rows) / (W * H) < 0.07

def judge(path, idx, n):
    im = Image.open(path).convert("L")
    v = list(im.resize((32, 42), Image.BOX).getdata())
    if sum(abs(a - b) for a, b in zip(v, REF)) / len(v) < 14: return "color test page"
    if idx > n - 2 and text_page(im): return "last page of text (the review request)"
    if idx <= FRONT:
        w, h = im.size; bb = im.point(lambda p: 255 if p < 150 else 0).getbbox()
        if not bb or ((bb[2] - bb[0]) * (bb[3] - bb[1])) / (w * h) < 0.5: return "front matter (brand, title or belongs-to page)"
    return None

drops = {}
args = sys.argv[1:]; rest = []
while args:
    a = args.pop(0)
    if a == "--drop":
        slug, _, nums = args.pop(0).partition(":"); drops.setdefault(slug, set()).update(int(x) for x in nums.split(","))
    else: rest.append(a)
books = rest or sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))
for slug in books:
    d = os.path.join(root, slug)
    files = sorted(f for f in os.listdir(d) if f.endswith(".webp"))
    keep, gone = [], []
    for i, f in enumerate(files, 1):
        why = judge(os.path.join(d, "t", f), i, len(files)) or ("looked at and taken out by hand" if i in drops.get(slug, ()) else None)
        (gone.append([i, why]) if why else keep.append(f))
    if gone:
        for i, _ in gone:
            f = files[i - 1]; os.remove(os.path.join(d, f)); os.remove(os.path.join(d, "t", f))
        for k, f in enumerate(keep, 1):
            n = "%02d.webp" % k
            if f != n:
                os.rename(os.path.join(d, f), os.path.join(d, "x-" + n)); os.rename(os.path.join(d, "t", f), os.path.join(d, "t", "x-" + n))
        for sub in (d, os.path.join(d, "t")):
            for f in os.listdir(sub):
                if f.startswith("x-"): os.rename(os.path.join(sub, f), os.path.join(sub, f[2:]))
    print(json.dumps({"slug": slug, "kept": len(keep), "removed": gone}))
