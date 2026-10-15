# The local art agent: coloring pages made on your own computer

The local art agent makes new coloring-page pictures from a few words, **on your own computer**. It turns each picture into a print master and runs the same checks as every other piece of art in the library, so it can join the library after a person approves it. It is a tool for you (the owner) to improve the picture library. It is not part of the website. Staff and families never see it, and nothing about it is published.

## What never happens

- **No description, prompt, picture or resident detail leaves your computer.** The picture programs run on your computer. The Python parts block every internet connection except connections to your computer itself (a "loopback" connection: one program on your computer talking to another). The Node part makes no internet request at all. `npm test` proves all three (`scripts/check-local-art.mjs`).
- **No cloud picture service is used.** Pollinations, Replicate, the online FLUX services and Canva are out, as you decided in October 2026. The Packet Builder's "Describe a page" tab is unchanged: it still picks from the library's own pictures, with no internet needed.
- **One step uses the internet, once, and only if you choose it:** `npm run art:setup` installs the Python packages and downloads one picture model. It sends nothing about Cognicopia, a resident or a picture: it asks for the model's public files and downloads them. After that, every step runs with the internet blocked.

## What it makes

For each picture it makes several tries (candidates). Each one is:

1. made pure black and white with your brightness rule (0.34 R + 0.5 G + 0.16 B under 200 is ink);
2. given a margin, with any frame drawn round the page taken off (a quilt's own edge is kept, because it is part of the design);
3. cropped and centered on a 3:4 page, **1800 x 2400 pixels, 6 x 8 inches at 300 dpi**, with stray dots removed;
4. given lines at least **3 pt** thick (thin lines are thickened);
5. checked with the library's own checks: black and white only, areas big enough to color, the subject filling the page, no large solid black, a faithful trace, the file size, and the dignity words.

The best candidate wins. If none passes, the agent changes the words to fix what failed (for example "fewer details, larger simple shapes") and makes a new round. The winner goes to `assets/coloring/_inbox/` with a note beside it (the "sidecar" file) that records the words, the engine, the seed and the license note. From there it goes through the usual review in `docs/line-art-pipeline.md`. **Nothing reaches the library until a person approves it.**

Every candidate, why one was chosen, and the three tier drawings are on a review page: `assets/coloring/_review/agent/index.html`. Open it in a browser. That folder is never committed.

## The picture engines

| Engine | What it is | When it is used |
|---|---|---|
| `procedural` | The library's own picture, drawn exactly by its code | Quilts, mandalas and patterns (34 designs). They are already exact vector drawings, so they are kept as drawn. |
| `comfyui` | ComfyUI, a free picture program that runs on your computer, reached at `127.0.0.1:8188` | If ComfyUI is running and has a model. An SDXL checkpoint works with no extra setup; for FLUX add `--workflow flux`. |
| `diffusers` | A picture model downloaded once by `npm run art:setup`, run by `scripts/local_art/generate.py` | If no ComfyUI is running |
| `folder` | Pictures you made in any program on your computer, named `<design-id>-anything.png` | `--engine folder --from <folder>` |
| `standin` | Test pictures drawn from the library | For checking the workflow without a model. Its results stay on the review page only. |

With no `--engine`, the agent picks for you. Patterns use `procedural`. Everything else uses `comfyui` if it answers, otherwise `diffusers` if a model is set up. If neither is ready, it says plainly what is missing.

## What your computer needs

- **Node 20 or newer** (you already use it for `npm test`).
- **Python 3.10 or newer**, from python.org.
- **A graphics card helps a great deal.** With one, a picture takes seconds to a minute. Without one (the "cpu" route), a picture can take several minutes and needs plenty of memory. The doctor command says which you have.
- **Disk space:** the default model (Stable Diffusion XL base 1.0) is about 7 GB.

## Your first step

Open a terminal in the `cognicopia` folder and run:

```
npm run art:doctor
```

It checks your computer and lists, line by line, what is ready and what is not. Its last line is the next step to take. Do that step, then run `npm run art:doctor` again. If anything it prints is unclear, paste it into a coding session as it is: nobody can see your screen from there, so this guide names no buttons or menus.

## The commands

```
npm run art:doctor                      what is ready on this computer (add -- --selftest to prove the model route works)
npm run art:setup                       once: the Python environment and one picture model (the one step that downloads)
npm run art:library                     how the 150 designs stand against the print standards, and which to upgrade
npm run art:make -- --only sunflower    make a master for one design, from your description of it
npm run art:make -- --category botanical-garden
npm run art:make -- --all               every design (patterns are kept as drawn)
npm run art:make -- --prompt "a teapot on a lace cloth" --id teapot-lace --category home-everyday
```

The words used for a library design are your own descriptions in `src/data/coloring_owner_prompts.json`, inside the same clinical wrapper as the Packet Builder's "Describe a page" tab: "Minimalist bold-and-easy adult coloring book page of ... thick pure-black vector outlines, clean uncrowded composition, large fillable areas, solid pure white background, zero shading, zero gray tones, high contrast, 3:4 aspect ratio". Words the dignity filter sets aside (for example "cute") are refused before any picture is made.

Options for `art:make`: `--candidates 4` (tries per round), `--rounds 2`, `--fresh` (new seeds, so new pictures), `--steps`, `--cfg`, `--checkpoint <name>`, `--workflow <file>` or `--workflow flux`, `--port`, `--keep-best` (keep the best try even if it did not pass), `--dry-run` (review page only). Your settings are saved in `.cognicopia/art-agent.json` in your home folder, never in the repository.

After a run with masters in the inbox: `npm run coloring:ingest`, then `npm run coloring:review`, then approve or reject each one (`docs/line-art-pipeline.md`), then `npm run coloring` and `npm run build`.

## The library today

`npm run art:library` measured the library on October 15, 2026:

- 150 designs, 450 pages (three tiers each).
- 141 meet every measured print standard. The other 9 have a subject filling less than 45% of the page, because they are tall, narrow or spread-out subjects: apple branch, pumpkin patch, tea for two, baking day, grandfather clock, milk bottles, butter churn, chickadee on a pine, seashells. They are the first ones to remake.
- 34 are exact geometric patterns (quilts, mandalas, tiles), kept as drawn.
- 116 can be upgraded with a picture engine.

The report is `assets/coloring/_review/library/index.html` (not committed).

## ComfyUI and FLUX

If you use ComfyUI, start it as its own instructions say. The agent talks to it only at `127.0.0.1` (your own computer) and refuses any other address. With an SDXL checkpoint in ComfyUI, `npm run art:make -- --only sunflower` uses it automatically.

For FLUX.1 schnell, the repository has a ready workflow file, `scripts/local_art/workflows/flux1-schnell.json`: `npm run art:make -- --only sunflower --workflow flux`. It expects files with the usual FLUX names (`flux1-schnell.safetensors`, `t5xxl_fp8_e4m3fn.safetensors`, `clip_l.safetensors`, `ae.safetensors`). If yours are named differently, copy the file, change the names, and pass your copy with `--workflow <file>`. The node names in that file and in the standard graph were checked against ComfyUI's source code on October 14, 2026, but not against a running ComfyUI.

Any workflow saved from ComfyUI in its API format also works. Write `%PROMPT%`, `%NEGATIVE%`, `%SEED%`, `%WIDTH%`, `%HEIGHT%`, `%STEPS%`, `%CFG%` and `%CHECKPOINT%` where those values go.

## Licenses: read before you sell

Pictures go into packets that facilities pay for, so the model's license matters. Each model folder downloaded by `art:setup` keeps the model's license file. Read it before approving pictures for the library.

- Stable Diffusion XL base 1.0 (the default) uses the CreativeML Open RAIL++-M license.
- FLUX.1 [schnell] uses the Apache 2.0 license. FLUX.1 [dev] has a non-commercial license.

The sidecar beside each master records the engine and a license note, and the ingest copies them into the art record.

## What was tested, and what was not

Tested in the cloud workspace where this was built (no graphics card, and no access to the model download site):

- The whole route with test pictures, a folder of pictures, the exact patterns and no engine at all. This included a failed round followed by a refined round that passed, and the real ingest and review sheet taking the agent's master.
- The ComfyUI route against a stand-in ComfyUI on the same computer. That covered the job it is sent, the progress connection, fetching the finished picture, an error passed on in plain words, and the FLUX workflow filled in.
- The model route with a tiny model made on the spot: Python, torch and diffusers loaded a model from a folder and drew pictures with the internet blocked. The agent rejected those noise pictures as "mostly dark" and refined the words, as designed.
- The internet block: outside addresses, outside names and other kinds of connection are refused, and connections to the computer itself are allowed.

**Not tested here:** a real picture model (SDXL or FLUX), because the model download site is blocked in this workspace and there is no graphics card. How good the pictures are, and how long they take, will only be known on your computer. `npm run art:setup` runs the same tiny-model test after installing the packages and stops before the large download if it fails; `npm run art:doctor -- --selftest` runs it again at any time.

## Plain answers to likely messages

- **"No picture engine is ready on this computer"**: start ComfyUI with a model in it, or run `npm run art:setup` once.
- **"ComfyUI is not answering at 127.0.0.1:8188"**: ComfyUI is not running, or uses another port. Add `--port <number>`.
- **"This model asks you to sign in and accept its terms"**: that model's page needs you to accept its terms first. Choose another model with `npm run art:setup -- --model <name>`.
- **"None of N candidates passed the checks"**: try `--fresh`, more `--candidates`, or simpler words. Open the review page to see why each one failed.

## For whoever maintains it

| File | Role |
|---|---|
| `scripts/local_art_agent.mjs` | The commands: doctor, setup, make, library. Picks an engine, runs the rounds, writes the inbox and review files. Node built-ins only, with no network module. |
| `scripts/lib/local-art.mjs` | The prompt wrapper (the same words as `js/coloringAgent.js`), hints, cleaning (`cleanCandidate`), border and edge rules, line measurement, scoring and the review page. |
| `scripts/local_art/offline_guard.py` | Blocks every connection except connections to the computer itself, and tells the Hugging Face libraries they are offline. Imported first by every Python part. |
| `scripts/local_art/generate.py` | The diffusers route: loads the model from its folder only (`local_files_only`). |
| `scripts/local_art/comfyui.py` | The ComfyUI route: standard library only, this computer only, no proxy. Opens the progress connection before handing over the job. |
| `scripts/local_art/fetch_model.py` | The one download step, used only by `art:setup`. Downloads only the parts the model's `model_index.json` names. |
| `scripts/local_art/selftest.py` | Proves the model route with a tiny model made on the spot. |
| `scripts/local_art/workflows/flux1-schnell.json` | The FLUX.1 schnell graph for ComfyUI. |
| `scripts/check-local-art.mjs` | The check (in `npm test` and `npm run build`). |

The agent reuses the library's own pieces: `scripts/lib/master.mjs` (crop and center), `scripts/lib/raster.mjs`, `scripts/lib/png.mjs`, and the ingest itself (`scripts/ingest_coloring_assets.mjs --dry-run --json`) to score every candidate. A candidate that passes the agent therefore passes the same checks in the real ingest. Model files (`*.safetensors`, `*.ckpt`, `*.gguf`) and Python caches are git-ignored.
