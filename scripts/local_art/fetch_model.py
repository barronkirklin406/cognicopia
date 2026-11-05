#!/usr/bin/env python3
"""
Cognicopia local art agent: download a picture model ONCE, to a folder on this computer.

This is the only step of the local art agent that uses the internet, and it
sends nothing about Cognicopia or anyone in it: it asks the model's public page
for its file list and downloads those files. Every later step reads the
folder with the network refused (offline_guard.py).

  fetch_model.py --repo stabilityai/stable-diffusion-xl-base-1.0 --dest ~/.cognicopia/models/sdxl-base

It downloads only what diffusers needs to run the model: the settings files,
the word files, the license and model card, and one copy of each set of
weights (the smaller fp16 copy when every part has one, else the full one;
safetensors over older formats). It skips the single-file checkpoints and
other formats a repository may also carry, which can double the size.
Writes cognicopia-model.json in the folder: the repository, revision, files,
weight variant, license files and the date.
Needs huggingface_hub (installed by npm run art:setup).
"""
import argparse
import datetime
import json
import os
import sys

WEIGHT_EXT = (".safetensors", ".bin", ".ckpt", ".pt", ".pth", ".onnx", ".onnx_data", ".msgpack", ".h5", ".pb", ".gguf")
KEEP_EXT = (".json", ".txt", ".model", ".md", ".yaml", ".yml")


def components_of(index):
    """The parts a model_index.json names (unet, vae, text_encoder...): the only folders the model reads."""
    return {k for k, v in (index or {}).items() if not k.startswith("_") and isinstance(v, list) and len(v) == 2 and v[0]}


def choose(files, components=None):
    """The files to download: (list, variant, notes). With components, folders the model does not use are left out."""
    files = sorted(files)
    if "model_index.json" not in files:
        raise SystemExit("This model is not in the diffusers format (no model_index.json), so the agent cannot run it. Choose another model.")
    notes, chosen = [], []
    parts = {}
    for f in files:
        if "/" not in f:
            if f.lower().endswith(KEEP_EXT) or f.upper().startswith("LICENSE"):
                chosen.append(f)                         # model_index.json, the license and the model card
            continue                                     # a single-file checkpoint at the top: not needed
        part = f.split("/")[0]
        if components is not None and part not in components:
            continue                                     # an extra folder (another format, a spare copy): not needed
        parts.setdefault(part, []).append(f)
    weighted = {}
    for part, fs in parts.items():
        for f in fs:
            low = f.lower()
            if low.endswith(KEEP_EXT) and ".safetensors.index" not in low and ".bin.index" not in low:
                chosen.append(f)
        safet = [f for f in fs if f.lower().endswith(".safetensors") or ".safetensors.index" in f.lower()]
        bins = [f for f in fs if f.lower().endswith(".bin") or ".bin.index" in f.lower()]
        if safet:
            weighted[part] = ("safetensors", safet)
        elif bins:
            weighted[part] = ("bin", bins)
            notes.append("%s has only the older .bin weights" % part)
    fp16_everywhere = all(any(".fp16." in f for f in fs) for _, fs in weighted.values()) and weighted
    variant = "fp16" if fp16_everywhere else None
    for part, (kind, fs) in weighted.items():
        keep = [f for f in fs if (".fp16." in f) == bool(variant)]
        chosen.extend(keep)
    return sorted(set(chosen)), variant, notes


def main():
    ap = argparse.ArgumentParser(description="Download a picture model once, for the local art agent.")
    ap.add_argument("--repo", required=True, help="the model's name, e.g. stabilityai/stable-diffusion-xl-base-1.0")
    ap.add_argument("--dest", required=True, help="the folder to keep it in (outside the repository)")
    ap.add_argument("--revision", default=None)
    ap.add_argument("--list", action="store_true", help="say what would be downloaded, download nothing")
    a = ap.parse_args()
    try:
        from huggingface_hub import HfApi, hf_hub_download
    except ImportError:
        print("huggingface_hub is not installed. Run: npm run art:setup", file=sys.stderr)
        return 2
    dest = os.path.abspath(os.path.expanduser(a.dest))
    api = HfApi()
    try:
        files = api.list_repo_files(a.repo, revision=a.revision)
    except Exception as e:                               # gated, missing or no connection: said plainly
        msg = str(e).split("\n")[0]
        if "401" in msg or "403" in msg or "gated" in msg.lower():
            print("This model asks you to sign in and accept its terms on its page before it can be downloaded. Choose another model, or accept its terms first.", file=sys.stderr)
        else:
            print("Could not read the model's file list: %s" % msg, file=sys.stderr)
        return 1
    components = None
    if "model_index.json" in files:
        try:
            with open(hf_hub_download(a.repo, "model_index.json", revision=a.revision), encoding="utf-8") as fh:
                components = components_of(json.load(fh))
        except Exception:                                # without it every folder is considered, which only costs space
            components = None
    chosen, variant, notes = choose(files, components)
    print("Model %s: %d files%s" % (a.repo, len(chosen), " (fp16 weights)" if variant else ""))
    for n in notes:
        print("  note: " + n)
    if a.list:
        for f in chosen:
            print("  " + f)
        return 0
    os.makedirs(dest, exist_ok=True)
    for i, f in enumerate(chosen, 1):
        print("  [%d/%d] %s" % (i, len(chosen), f), flush=True)
        hf_hub_download(a.repo, f, revision=a.revision, local_dir=dest)
    licenses = [f for f in chosen if "/" not in f and (f.upper().startswith("LICENSE") or f.lower() == "readme.md")]
    with open(os.path.join(dest, "cognicopia-model.json"), "w", encoding="utf-8") as fh:
        json.dump({"repo": a.repo, "revision": a.revision, "variant": variant, "files": chosen, "license_files": licenses,
                   "downloaded": datetime.date.today().isoformat(),
                   "note": "Read the license file before using pictures from this model commercially."}, fh, indent=1)
    print("Done. The model is in %s. From now on the agent reads it with the network refused." % dest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
