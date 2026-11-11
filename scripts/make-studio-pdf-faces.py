#!/usr/bin/env python3
"""Write assets/vendor/jspdf-studio-faces.js: the three extra faces the Activity Page Studio's pages use, as TrueType data
the PDF maker can embed (it cannot read the .woff2 files the screen uses).

  grid    Atkinson Hyperlegible Mono Bold   the letter grid of a word search
  flow    Pinyon Script                     a resident's name in flowing script
  formal  Marck Script                      a resident's name in formal script

All three are under the SIL Open Font License (fonts/OFL-*.txt). Run it again only when a file in /fonts changes:
    pip install fonttools brotli
    python3 scripts/make-studio-pdf-faces.py
"""
import base64, io, os
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FACES = [("grid", "AtkinsonHyperlegibleMono-Bold", "AtkinsonHyperlegibleMono", "bold"),
         ("flow", "PinyonScript-Regular", "PinyonScript", "normal"),
         ("formal", "MarckScript-Regular", "MarckScript", "normal")]
parts = []
for key, name, family, style in FACES:
    font = TTFont(os.path.join(ROOT, "fonts", name + ".woff2"))
    font.flavor = None                                   # plain TrueType, uncompressed
    buf = io.BytesIO(); font.save(buf)
    parts.append('    %s: { file: "%s.ttf", family: "%s", style: "%s", data: "%s" }' % (key, name, family, style, base64.b64encode(buf.getvalue()).decode("ascii")))
out = """/* The Activity Page Studio's three extra faces for the PDF maker (SIL Open Font License 1.1: fonts/OFL-AtkinsonHyperlegibleMono.txt,
   fonts/OFL-PinyonScript.txt, fonts/OFL-MarckScript.txt). Made by scripts/make-studio-pdf-faces.py from the files in /fonts; do not edit by hand.
   Loaded only when a PDF holds a page that uses one of them (js/utils/studio-pdf.js). */
(function (root) {
  "use strict";
  root.CognicopiaPdfFaces = Object.freeze({
%s
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
""" % ",\n".join(parts)
with open(os.path.join(ROOT, "assets", "vendor", "jspdf-studio-faces.js"), "w", encoding="utf-8") as f:
    f.write(out)
print("wrote assets/vendor/jspdf-studio-faces.js (%d KB)" % (len(out) // 1024))
