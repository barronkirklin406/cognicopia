#!/usr/bin/env python3
"""
Cognicopia local art agent: prove the picture-model route works on this computer,
before (or without) downloading a real model.

Builds a tiny picture model with random weights in a temporary folder (a few
megabytes, made here, nothing downloaded), saves it the way a downloaded
model is saved, and runs generate.py on it exactly as the agent does: the
offline guard on, the model read from the folder, two pictures at 3:4. The
pictures are noise (the model has learned nothing); what is proved is that
Python, torch, diffusers and transformers are installed and work together,
and that generate.py loads a model and writes PNG files with the network
refused.

  selftest.py [--keep DIR]      prints a JSON line: { ok, images, seconds, device, ... }
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from offline_guard import install_guard  # noqa: E402

install_guard()


def tiny_pipeline(folder):
    import torch
    from diffusers import AutoencoderKL, DDIMScheduler, StableDiffusionPipeline, UNet2DConditionModel
    from transformers import CLIPTextConfig, CLIPTextModel, CLIPTokenizer
    torch.manual_seed(0)
    unet = UNet2DConditionModel(block_out_channels=(8, 16), layers_per_block=1, sample_size=16, in_channels=4, out_channels=4,
                                down_block_types=("DownBlock2D", "CrossAttnDownBlock2D"), up_block_types=("CrossAttnUpBlock2D", "UpBlock2D"),
                                cross_attention_dim=16, norm_num_groups=4, attention_head_dim=2)
    vae = AutoencoderKL(block_out_channels=[8, 16], in_channels=3, out_channels=3, down_block_types=["DownEncoderBlock2D", "DownEncoderBlock2D"],
                        up_block_types=["UpDecoderBlock2D", "UpDecoderBlock2D"], latent_channels=4, norm_num_groups=4)
    text = CLIPTextModel(CLIPTextConfig(bos_token_id=0, eos_token_id=1, pad_token_id=1, hidden_size=16, intermediate_size=32, num_attention_heads=2,
                                        num_hidden_layers=2, vocab_size=64, max_position_embeddings=77))
    tok_dir = os.path.join(folder, "_tok")
    os.makedirs(tok_dir, exist_ok=True)
    vocab = {"<|startoftext|>": 0, "<|endoftext|>": 1}
    for c in "abcdefghijklmnopqrstuvwxyz":
        vocab[c] = len(vocab)
        vocab[c + "</w>"] = len(vocab)
    with open(os.path.join(tok_dir, "vocab.json"), "w", encoding="utf-8") as f:
        json.dump(vocab, f)
    with open(os.path.join(tok_dir, "merges.txt"), "w", encoding="utf-8") as f:
        f.write("#version: 0.2\n")
    tok = CLIPTokenizer(os.path.join(tok_dir, "vocab.json"), os.path.join(tok_dir, "merges.txt"), model_max_length=77)
    sched = DDIMScheduler(beta_start=0.00085, beta_end=0.012, beta_schedule="scaled_linear", clip_sample=False, set_alpha_to_one=False, steps_offset=1)
    pipe = StableDiffusionPipeline(vae=vae, text_encoder=text, tokenizer=tok, unet=unet, scheduler=sched, safety_checker=None,
                                   feature_extractor=None, requires_safety_checker=False)
    model_dir = os.path.join(folder, "model")
    pipe.save_pretrained(model_dir)
    return model_dir


def main():
    ap = argparse.ArgumentParser(description="Prove the picture-model route works on this computer.")
    ap.add_argument("--keep", help="keep the tiny model and its pictures in this folder")
    a = ap.parse_args()
    t0 = time.time()
    work = os.path.abspath(a.keep) if a.keep else tempfile.mkdtemp(prefix="cognicopia-selftest-")
    os.makedirs(work, exist_ok=True)
    out = {"ok": False}
    try:
        model_dir = tiny_pipeline(work)
        req = {"model_dir": model_dir, "variant": None, "prompt": "a teapot", "negative": "color", "seeds": [1, 2],
               "width": 48, "height": 64, "steps": 2, "guidance": 5.0, "device": "cpu", "out_dir": os.path.join(work, "out")}
        with open(os.path.join(work, "request.json"), "w", encoding="utf-8") as f:
            json.dump(req, f)
        p = subprocess.run([sys.executable, os.path.join(HERE, "generate.py"), "--request", os.path.join(work, "request.json")], capture_output=True, text=True, timeout=600)
        with open(os.path.join(req["out_dir"], "result.json"), encoding="utf-8") as f:
            res = json.load(f)
        files = [os.path.join(req["out_dir"], im["file"]) for im in res.get("images", [])]
        out.update(ok=bool(res.get("ok")) and len(files) == 2 and all(os.path.getsize(x) > 0 for x in files), images=len(files), device=res.get("device"),
                   pipeline=res.get("pipeline"), error=res.get("error"), stderr_tail=(p.stderr or "")[-300:] if not res.get("ok") else "", folder=work if a.keep else None)
    except Exception as e:
        out["error"] = "%s: %s" % (type(e).__name__, str(e).split("\n")[0][:300])
    out["seconds"] = round(time.time() - t0, 1)
    print(json.dumps(out))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
