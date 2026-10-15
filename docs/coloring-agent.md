# The Coloring Agent: describe a page, get a print-ready one

In the Packet Builder, **Cognicopia Coloring** has a fourth tab, **Describe a page**. A person types a few plain words (or presses **Generate random clinical page**) and gets one clean, pure black-and-white coloring page, 3:4, ready to print. They can add it to the packet or save it as a PNG.

The code is `js/coloringAgent.js` (the agent) and the tab in `builder.html` (the screen). `scripts/check-coloringagent.mjs` and `scripts/check-coloringagent-ui.mjs` prove it.

## What it does, in plain words

1. **Wraps the words in the clinical prompt wrapper.** The same words every time, so a page always asks for bold, uncluttered, pure black on pure white:
   - starts: `Minimalist bold-and-easy adult coloring book page of `
   - ends: `, thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio`
   - The person's words are checked first with the library's dignity filter (no childish words, no memory quizzing). The wrapped words are shown under **The words behind this page**, with a Copy button, for anyone who wants to use them in an image maker of their own.
2. **Gets a picture.** The one built-in source is the Cognicopia Coloring library on the computer: 150 pictures, each at three tiers. A description finds its picture by meaning ("a vintage rocking chair on a porch" finds The Rocking Chair). A random page is chosen from the memory-care categories (Vintage Americana, Botanical, Nostalgic Home Objects, Classic Vehicles, Simple Zentangles, Wildlife and Nature, Seasons and Holidays), every category equally likely, never a picture shown in the last twelve, and never one on the resident's list of topics to avoid.
3. **Cleans it on a canvas.** Brightness `0.34 R + 0.5 G + 0.16 B` under 200 becomes pure black (`#000000`); everything else becomes pure white (`#FFFFFF`). Clear pixels count as paper. Nothing gray survives, and the result is read back to prove it.
4. **Lays it on a 3:4 sheet** of 1800 x 2400 px: 6 x 8 in at 300 dpi, which fits inside the 0.5 in margins and the 0.75 in binding gutter of a US Letter page. A picture that is not 3:4 gets white margins, never a crop. The dpi is written into the PNG (a `pHYs` chunk), so it opens at 6 x 8 in.
5. **Checks the result** and refuses one that is nearly blank (under 0.2% ink) or has a large dark area (over 45%). It also measures the thinnest lines and shows a gentle note when they would print under 3 pt.

**Add to packet** queues the library page exactly like any other coloring page (vector, at the tier's own line weight, with the resident's name and the clinical footer). **Download print-ready PNG** counts against the free packets the same way a PDF does.

## When a source is slow or fails

A source is any function that returns a picture (`{ svg }`, `{ blob }`, `{ image }` or `{ url }`). They are tried in order, each with its own time limit (20 seconds). If one is slow, fails, returns something unusable, or comes back too blank or too dark, the next is tried, and the person sees one plain sentence ("The first picture source was not available, so this page came from the library on this computer."). A raw error message is never shown. If every source fails the person sees "The page could not be made just now. Nothing was lost. Please try again."

```js
CognicopiaColoringAgent.generate({ subject: "a rocking chair on a porch", tier: 2, avoid: ["driving"] })
  .then(r => { /* r.blob, r.dataUrl, r.title, r.designId, r.prompt, r.stats, r.notes */ },
        e => { /* e.friendly is a plain sentence, e.code says which */ });
CognicopiaColoringAgent.generate({ random: true, category: "classic-vehicles" });
CognicopiaColoringAgent.clean(anyPictureBlobOrImage);   // the black-and-white filter on its own
CognicopiaColoringAgent.registerProvider("name", fn, true);   // add a source (true: try it first)
```

## Not included: an online picture maker (decided)

The request for this agent also asked for an online source (Pollinations, Flux or Replicate). The owner decided in October 2026 to keep every outside picture service out of the site, to keep the promise that no resident data leaves the device (`CLAUDE.md`: the tools make no network request of their own, and no cloud dependency is added to the static site). A typed description can hold a resident's name, so it never leaves the browser.

New pictures are made instead on the owner's own computer by the **local art agent** (`docs/local-art-agent.md`): it turns a description into a print master with a picture model that runs on that computer, checks it with the library's own checks, and hands it to the usual review in `docs/line-art-pipeline.md`. Approved art reaches this tab through the library, so the tab keeps working offline.

The provider seam (`registerProvider`) stays for tests and for a future local source; it is not a way to add an online one without a new owner decision and new privacy wording.

## The checks

- `node scripts/check-coloringagent.mjs` (also in `npm test`): the wrapper's words, the dignity filter, matching on all 150 pictures and the owner's 150 descriptions, random pages, the exact black-and-white math, the PNG dpi chunk, the chain of sources with a slow source, a failing source and an unusable picture, and that the module touches no network, address or storage.
- `node scripts/check-coloringagent-ui.mjs` (part of `npm run build` where Playwright is installed): in a real browser, a typed description and a random page, no gray pixel in either, 1800 x 2400, the saved PNG and its dpi, Add to packet, the spinner, the plain error sentences, a slow source falling back, 52 px controls, and that nothing is requested from outside the page.

## Limits worth knowing

- The page is always one of the library's pictures at the chosen tier: a description chooses among them, it does not draw something new. "Nothing in the library fits" is said in plain words, with a few words to try.
- The thin-line note is an estimate (a line's tip and corners measure short); it warns and never refuses.
- A picture made elsewhere has whatever line weight it had. The black-and-white filter makes it pure, not thick.
