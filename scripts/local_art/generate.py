#!/usr/bin/env python3
"""
Cognicopia local art agent: the picture model, run on this computer only.

scripts/local_art_agent.mjs calls this with a request file. The website never
runs it, and nothing here is published.

The offline guard comes first. Before any other library is imported, every
network connection is refused except one to this computer itself (127.0.0.1,
::1, or a local socket), and the Hugging Face libraries are told they are
offline. The model is read from a folder on this computer (local_files_only).
A prompt, a description or a picture never leaves the computer: there is
nowhere for it to go.

  generate.py --request req.json    make the pictures the request asks for: PNG files and result.json in its out_dir
  generate.py --check [--model-dir D]   what this computer has (Python, packages, device, the model folder), as JSON
  generate.py --guard-selftest      prove the guard refuses an outside address and allows this computer (standard library only)

A request:
  { "model_dir": "/home/me/.cognicopia/models/sdxl", "variant": "fp16" or null,
    "prompt": "...", "negative": "...", "seeds": [11, 12, 13, 14],
    "width": 864, "height": 1152, "steps": 30, "guidance": 7.0,
    "device": "auto" (or "cpu", "cuda", "mps"), "out_dir": "/tmp/..." }
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from offline_guard import install_guard, selftest as guard_selftest  # noqa: E402  (the guard goes in before anything else)

install_guard()


# ---------------------------------------------------------------- what this computer has
def package_versions():
    from importlib import metadata
    out = {}
    for name in ("torch", "diffusers", "transformers", "accelerate", "safetensors", "huggingface_hub"):
        try:
            out[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            out[name] = None
    return out


def model_info(model_dir):
    if not model_dir:
        return {"dir": None, "ready": False}
    info = {"dir": model_dir, "ready": os.path.isfile(os.path.join(model_dir, "model_index.json"))}
    meta = os.path.join(model_dir, "cognicopia-model.json")
    if os.path.isfile(meta):
        with open(meta, encoding="utf-8") as f:
            info["download"] = json.load(f)
    return info


def pick_device(want="auto"):
    import torch
    if want and want != "auto":
        return want
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def check(model_dir):
    out = {"python": sys.version.split()[0], "platform": sys.platform, "packages": package_versions(), "model": model_info(model_dir), "guard": True}
    if out["packages"]["torch"]:
        try:
            import torch
            dev = pick_device()
            out["device"] = dev
            if dev == "cuda":
                p = torch.cuda.get_device_properties(0)
                out["device_name"], out["device_memory_gb"] = p.name, round(p.total_memory / 2 ** 30, 1)
        except Exception as e:                           # a broken install says so instead of stopping
            out["device_error"] = str(e)
    return out


# ---------------------------------------------------------------- making pictures
def generate(req):
    out_dir = req["out_dir"]
    os.makedirs(out_dir, exist_ok=True)
    result = {"ok": False, "images": [], "notes": []}
    try:
        import torch
        from diffusers import AutoPipelineForText2Image
        model_dir = req["model_dir"]
        if not os.path.isfile(os.path.join(model_dir, "model_index.json")):
            raise RuntimeError("no picture model in %s (run: npm run art:setup)" % model_dir)
        device = pick_device(req.get("device", "auto"))
        dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
        kwargs = {"local_files_only": True, "torch_dtype": dtype}
        if req.get("variant"):
            kwargs["variant"] = req["variant"]
        t0 = time.time()
        pipe = AutoPipelineForText2Image.from_pretrained(model_dir, **kwargs)
        pipe = pipe.to(device)
        if device == "cpu" and hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing()
        pipe.set_progress_bar_config(disable=True)
        result.update(device=device, dtype=str(dtype).replace("torch.", ""), load_seconds=round(time.time() - t0, 1), pipeline=type(pipe).__name__)
        tok = getattr(pipe, "tokenizer", None)
        if tok is not None:
            n = len(tok(req["prompt"]).input_ids)
            if n > tok.model_max_length:
                result["notes"].append("The words were longer than the model reads (%d of %d tokens); the end was left out." % (n, tok.model_max_length))
        for seed in req["seeds"]:
            t1 = time.time()
            gen = torch.Generator(device="cpu").manual_seed(int(seed))
            image = pipe(prompt=req["prompt"], negative_prompt=req.get("negative") or None, width=int(req["width"]), height=int(req["height"]),
                         num_inference_steps=int(req.get("steps", 30)), guidance_scale=float(req.get("guidance", 7.0)), generator=gen).images[0]
            name = "seed-%d.png" % int(seed)
            image.save(os.path.join(out_dir, name))
            result["images"].append({"seed": int(seed), "file": name, "seconds": round(time.time() - t1, 1)})
        result["ok"] = True
    except Exception as e:
        result["error"] = str(e).split("\n")[0][:400]
        result["error_type"] = type(e).__name__
    with open(os.path.join(out_dir, "result.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    return result


def main():
    ap = argparse.ArgumentParser(description="Cognicopia local art agent: the picture model, on this computer only.")
    ap.add_argument("--request")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--model-dir")
    ap.add_argument("--guard-selftest", action="store_true")
    a = ap.parse_args()
    if a.guard_selftest:
        r = guard_selftest()
        print(json.dumps(r))
        return 0 if r["ok"] else 1
    if a.check:
        print(json.dumps(check(a.model_dir)))
        return 0
    if a.request:
        with open(a.request, encoding="utf-8") as f:
            req = json.load(f)
        r = generate(req)
        print(json.dumps({"ok": r["ok"], "images": len(r["images"]), "error": r.get("error")}))
        return 0 if r["ok"] else 1
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
