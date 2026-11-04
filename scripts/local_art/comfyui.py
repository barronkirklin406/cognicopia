#!/usr/bin/env python3
"""
Cognicopia local art agent: pictures from ComfyUI running on this computer.

ComfyUI is a free picture-making program that runs on your own computer and
answers on a local address (http://127.0.0.1:8188 by default). This harness
hands it a job, watches its progress messages, then fetches the finished
picture's bytes and writes them to disk. It talks to this computer only: any
host but 127.0.0.1, ::1 or localhost is refused before a connection is
opened, and the offline guard refuses every other address anyway.
Standard library only (no packages to install).

  comfyui.py --request req.json            make the pictures (PNG files and result.json in its out_dir)
  comfyui.py --check [--port 8188]         is ComfyUI answering, and which models does it have (JSON)

A request:
  { "host": "127.0.0.1", "port": 8188, "checkpoint": "sd_xl_base_1.0.safetensors" (or "" for the first one),
    "workflow": "path/to/workflow_api.json" (optional; see below), "prompt": "...", "negative": "...",
    "seeds": [11, 12], "width": 864, "height": 1152, "steps": 30, "cfg": 7.0,
    "sampler": "euler", "scheduler": "normal", "timeout_s": 900, "out_dir": "/tmp/..." }

Without a workflow file the standard text-to-picture graph is used (checkpoint,
two text encoders, an empty 3:4 canvas, a sampler, the decoder, save). A
workflow saved from ComfyUI in its API format works too: write %PROMPT%,
%NEGATIVE%, %SEED%, %WIDTH%, %HEIGHT%, %STEPS%, %CFG% and %CHECKPOINT% where
those values go (a FLUX graph, say), and they are filled in for each picture.
"""
import argparse
import base64
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from offline_guard import install_guard, is_local  # noqa: E402

install_guard()


class ComfyError(Exception):
    pass


class ProgressClosed(OSError):
    """The progress connection ended early: the job may still finish, so ComfyUI is asked instead."""


# ---------------------------------------------------------------- talking to ComfyUI on this computer
def base_url(req):
    host = str(req.get("host") or "127.0.0.1")
    if not is_local(host):
        raise ComfyError("ComfyUI must run on this computer: %s is not this computer's address (use 127.0.0.1)." % host)
    return host, int(req.get("port") or 8188)


def http(req, method, path, body=None, timeout=30, raw=False):
    host, port = base_url(req)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request("http://%s:%d%s" % (host, port, path), data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))          # never through a proxy: straight to this computer
    try:
        with opener.open(r, timeout=timeout) as resp:
            payload = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        raise ComfyError("ComfyUI refused the job (%d): %s" % (e.code, detail))
    except (urllib.error.URLError, OSError) as e:
        raise ComfyError("ComfyUI is not answering at %s:%d. Start ComfyUI first. (%s)" % (host, port, getattr(e, "reason", e)))
    return payload if raw else json.loads(payload.decode("utf-8") or "null")


# ---------------------------------------------------------------- a small WebSocket client, to watch progress
class Socket:
    def __init__(self, host, port, path, timeout):
        import socket as _s
        self.sock = _s.create_connection((host, port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                           "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, host, port, key)).encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ComfyError("ComfyUI closed the progress connection")
            head += chunk
        status, self.buf = head.split(b"\r\n\r\n", 1)
        if b" 101 " not in status.split(b"\r\n")[0]:
            raise ComfyError("ComfyUI did not open a progress connection")

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ProgressClosed("ComfyUI closed the progress connection")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _send(self, opcode, payload=b""):
        mask = os.urandom(4)
        head = bytes([0x80 | opcode])
        n = len(payload)
        head += bytes([0x80 | n]) if n < 126 else (bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def message(self):
        """The next whole message: (text or None, binary or None)."""
        parts, kind = [], None
        while True:
            b1, b2 = self._read(2)
            fin, opcode, masked, n = b1 & 0x80, b1 & 0x0F, b2 & 0x80, b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if masked else None
            data = self._read(n)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if opcode == 8:
                raise ProgressClosed("ComfyUI closed the progress connection")
            if opcode == 9:
                self._send(10, data)
                continue
            if opcode == 10:
                continue
            if opcode in (1, 2):
                kind = opcode
            parts.append(data)
            if fin:
                body = b"".join(parts)
                return (body.decode("utf-8", "replace"), None) if kind == 1 else (None, body)

    def close(self):
        try:
            self._send(8)
            self.sock.close()
        except OSError:
            pass


# ---------------------------------------------------------------- the job
def default_graph(r, seed, checkpoint):
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": int(r["width"]), "height": int(r["height"]), "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": r["prompt"], "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": r.get("negative") or "", "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {"seed": int(seed), "steps": int(r.get("steps", 30)), "cfg": float(r.get("cfg", 7.0)),
                                                    "sampler_name": r.get("sampler") or "euler", "scheduler": r.get("scheduler") or "normal", "denoise": 1.0,
                                                    "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "cognicopia", "images": ["8", 0]}},
    }


def graph_from_file(path, r, seed, checkpoint):
    text = open(path, encoding="utf-8").read()
    for token, value in (("%PROMPT%", r["prompt"]), ("%NEGATIVE%", r.get("negative") or ""), ("%CHECKPOINT%", checkpoint)):
        text = text.replace(token, json.dumps(value)[1:-1])
    for token, value in (("%SEED%", int(seed)), ("%WIDTH%", int(r["width"])), ("%HEIGHT%", int(r["height"])), ("%STEPS%", int(r.get("steps", 30))), ("%CFG%", float(r.get("cfg", 7.0)))):
        text = text.replace('"' + token + '"', json.dumps(value)).replace(token, json.dumps(value))
    return json.loads(text)


def checkpoints(r):
    info = http(r, "GET", "/object_info/CheckpointLoaderSimple")
    try:
        return list(info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0])
    except (KeyError, TypeError, IndexError):
        return []


def open_progress(r, client_id):
    """The progress connection, opened before the job is handed over so no message is missed (None if ComfyUI has none)."""
    host, port = base_url(r)
    try:
        return Socket(host, port, "/ws?clientId=" + client_id, timeout=30)
    except (OSError, ComfyError):
        return None


def wait_for(r, prompt_id, ws, timeout):
    """Watch the progress messages until the job is done; without them, ask every second."""
    end = time.time() + timeout
    if ws is not None:
        try:
            while time.time() < end:
                text, _ = ws.message()
                if not text:
                    continue                              # a preview picture
                msg = json.loads(text)
                data = msg.get("data") or {}
                if data.get("prompt_id") not in (None, prompt_id):
                    continue
                if msg.get("type") == "execution_error":
                    raise ComfyError("ComfyUI stopped with an error: %s" % (data.get("exception_message") or "unknown"))
                if msg.get("type") == "execution_success" or (msg.get("type") == "executing" and data.get("node") is None and data.get("prompt_id") == prompt_id):
                    break
        except OSError:
            pass                                          # the progress connection dropped or went quiet: ask instead
    while time.time() < end:
        hist = http(r, "GET", "/history/" + prompt_id)
        if hist and prompt_id in hist:
            return hist[prompt_id]
        time.sleep(1)
    raise ComfyError("ComfyUI did not finish within %d seconds" % timeout)


def images_of(entry):
    status = entry.get("status") or {}
    if status.get("status_str") == "error":
        raise ComfyError("ComfyUI stopped with an error")
    for node in (entry.get("outputs") or {}).values():
        for im in node.get("images") or []:
            if im.get("type", "output") == "output":
                yield im


def generate(r):
    out_dir = r["out_dir"]
    os.makedirs(out_dir, exist_ok=True)
    result = {"ok": False, "images": [], "notes": [], "engine": "comfyui"}
    try:
        base_url(r)
        names = checkpoints(r)
        ckpt = r.get("checkpoint") or (names[0] if names else "")
        if not r.get("workflow"):
            if not names:
                raise ComfyError("ComfyUI has no model in its checkpoints folder. Add one in ComfyUI first.")
            if ckpt not in names:
                raise ComfyError("ComfyUI has no model named %s. It has: %s" % (ckpt, ", ".join(names)))
        result["checkpoint"] = ckpt
        for seed in r["seeds"]:
            t0 = time.time()
            client_id = uuid.uuid4().hex
            graph = graph_from_file(r["workflow"], r, seed, ckpt) if r.get("workflow") else default_graph(r, seed, ckpt)
            ws = open_progress(r, client_id)
            try:
                queued = http(r, "POST", "/prompt", {"prompt": graph, "client_id": client_id})
                prompt_id = (queued or {}).get("prompt_id")
                if not prompt_id:
                    raise ComfyError("ComfyUI did not accept the job: %s" % json.dumps(queued)[:300])
                entry = wait_for(r, prompt_id, ws, int(r.get("timeout_s", 900)))
            finally:
                if ws is not None:
                    ws.close()
            got = list(images_of(entry))
            if not got:
                raise ComfyError("ComfyUI finished but saved no picture")
            im = got[0]
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im.get("type", "output")})
            data = http(r, "GET", "/view?" + q, raw=True, timeout=60)
            name = "seed-%d.png" % int(seed)
            with open(os.path.join(out_dir, name), "wb") as f:
                f.write(data)
            result["images"].append({"seed": int(seed), "file": name, "seconds": round(time.time() - t0, 1)})
        result["ok"] = True
    except ComfyError as e:
        result["error"] = str(e)
    except Exception as e:                               # anything unexpected, said plainly
        result["error"] = "%s: %s" % (type(e).__name__, str(e).split("\n")[0][:300])
    with open(os.path.join(out_dir, "result.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    return result


def check(r):
    out = {"engine": "comfyui", "host": r.get("host") or "127.0.0.1", "port": int(r.get("port") or 8188), "reachable": False}
    try:
        stats = http(r, "GET", "/system_stats", timeout=5)
        out["reachable"] = True
        out["version"] = ((stats or {}).get("system") or {}).get("comfyui_version")
        out["checkpoints"] = checkpoints(r)
    except ComfyError as e:
        out["error"] = str(e)
    return out


def main():
    ap = argparse.ArgumentParser(description="Cognicopia local art agent: pictures from ComfyUI on this computer.")
    ap.add_argument("--request")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8188)
    a = ap.parse_args()
    if a.check:
        print(json.dumps(check({"host": a.host, "port": a.port})))
        return 0
    if a.request:
        with open(a.request, encoding="utf-8") as f:
            r = json.load(f)
        res = generate(r)
        print(json.dumps({"ok": res["ok"], "images": len(res["images"]), "error": res.get("error")}))
        return 0 if res["ok"] else 1
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
