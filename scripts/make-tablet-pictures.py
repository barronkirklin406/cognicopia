#!/usr/bin/env python3
"""Cut a sheet of separate pictures on a white background into the tablet activities' pictures.

A sheet is one image from Canva with a grid of objects, each alone on plain white. This finds each
object, lifts the white background away (only the white connected to the picture's edge, so white
inside an object stays), trims it, centers it on a square and writes assets/tablet/<name>.png
(400 px, 200 colors, transparent around the object).

  python3 scripts/make-tablet-pictures.py SHEET.png ROWS name name name ...   (names left to right, top to bottom)
  options: --out DIR (default assets/tablet)   --size 400   --gap 36 (how far apart objects must be)

Needs: pip install pillow numpy scipy. Not part of npm test; the check only looks at the finished files.
"""
import os, sys
try:
    import numpy as np
    from PIL import Image, ImageFilter
    from scipy import ndimage as ndi
except ImportError as e:
    print("make-tablet-pictures: needs pillow, numpy and scipy (pip install pillow numpy scipy):", e)
    sys.exit(0)


def main():
    a = sys.argv[1:]
    opts = {"--out": "assets/tablet", "--size": "400", "--gap": "36"}
    for flag in list(opts):
        if flag in a:
            i = a.index(flag); opts[flag] = a[i + 1]; del a[i:i + 2]
    if len(a) < 3:
        print(__doc__); sys.exit(1)
    sheet, rows, names = a[0], int(a[1]), a[2:]
    out_dir, size, gap = opts["--out"], int(opts["--size"]), int(opts["--gap"])
    os.makedirs(out_dir, exist_ok=True)

    im = Image.open(sheet).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    ink = arr.min(axis=2) < 236                                   # anything that is not near-white
    n_want = len(names)
    # Objects on a sheet can sit close together: take the widest merge distance that still keeps them apart.
    for g in sorted({gap, 28, 22, 18, 14, 10, 8}, reverse=True):
        if g > gap: continue
        lab, n = ndi.label(ndi.binary_dilation(ink, structure=np.ones((3, 3)), iterations=g))
        if n >= n_want: break
    areas = ndi.sum(ink, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(-areas)[:n_want]]
    # a small piece left over (a detached leaf, a drop of rain) belongs to the nearest object
    boxes = dict(zip(range(1, n + 1), ndi.find_objects(lab)))
    mid = lambda k: ((boxes[k][0].start + boxes[k][0].stop) / 2, (boxes[k][1].start + boxes[k][1].stop) / 2)
    for k in range(1, n + 1):
        if k in keep or boxes.get(k) is None or not ink[lab == k].any(): continue
        near = min(keep, key=lambda q: (mid(q)[0] - mid(k)[0]) ** 2 + (mid(q)[1] - mid(k)[1]) ** 2)
        if ((mid(near)[0] - mid(k)[0]) ** 2 + (mid(near)[1] - mid(k)[1]) ** 2) ** 0.5 < 0.22 * min(im.size):
            lab[lab == k] = near
    comps = []
    for k in keep:
        ys, xs = np.where(lab == k)
        comps.append(dict(k=k, cy=ys.mean(), cx=xs.mean(), box=(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    comps.sort(key=lambda c: c["cy"])
    per = len(comps) // rows
    ordered = []
    for r in range(rows):
        row = comps[r * per:(r + 1) * per] if r < rows - 1 else comps[r * per:]
        ordered += sorted(row, key=lambda c: c["cx"])

    for c, name in zip(ordered, names):
        x0, y0, x1, y1 = c["box"]
        x0, y0, x1, y1 = max(0, x0 - 6), max(0, y0 - 6), min(im.width, x1 + 6), min(im.height, y1 + 6)
        sub = arr[y0:y1, x0:x1].copy()
        sub[~(lab[y0:y1, x0:x1] == c["k"])] = 255                  # blank out a neighbour that overlaps this box
        light = sub.min(axis=2) >= 236
        l2, _ = ndi.label(light)
        edge = set(np.unique(np.concatenate([l2[0], l2[-1], l2[:, 0], l2[:, -1]]))) - {0}
        bg = ndi.binary_dilation(np.isin(l2, list(edge)), iterations=1)   # eat the pale fringe
        alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        pic = Image.fromarray(sub.astype(np.uint8)); pic.putalpha(alpha)
        pic = pic.crop(alpha.point(lambda v: 255 if v > 40 else 0).getbbox())
        side = max(pic.size); mg = int(side * 0.06)
        sq = Image.new("RGBA", (side + 2 * mg, side + 2 * mg), (255, 255, 255, 0))
        sq.paste(pic, ((sq.width - pic.width) // 2, (sq.height - pic.height) // 2), pic)
        sq = sq.resize((size, size), Image.LANCZOS)
        sq.quantize(colors=200, method=Image.FASTOCTREE, dither=Image.NONE).save(os.path.join(out_dir, name + ".png"), optimize=True)
        print("wrote", os.path.join(out_dir, name + ".png"))


main()
