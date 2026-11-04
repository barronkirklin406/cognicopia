/* A worker for the heavy, DOM-free part of a big compile: shrinking photos (PNG or JPEG bytes) to the size a printed page needs, without touching
   the page. It handles one message at a time, answers with the bytes (transferred, not copied), and closes every bitmap it makes, so a
   facility-wide compile never piles full-size photos up in the page's memory. A browser worker cannot decode SVG, so vector art stays on the
   main thread. Messages: { id, type: "echo" } and { id, type: "downscale", bytes, mime, maxPx, quality }. */
self.onmessage = async (ev) => {
  const m = ev.data || {}, id = m.id;
  try {
    if (m.type === "echo") { self.postMessage({ id, ok: true, value: m.value }); return; }
    if (m.type !== "downscale") throw new Error("unknown task");
    const bmp = await createImageBitmap(new Blob([m.bytes], { type: m.mime || "image/png" })), k = Math.min(1, Math.max(16, Math.min(4000, Math.round(m.maxPx) || 1200)) / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = new OffscreenCanvas(w, h), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h); bmp.close();
    const jpeg = m.mime === "image/jpeg", out = await (await c.convertToBlob({ type: jpeg ? "image/jpeg" : "image/png", quality: Math.max(0.3, Math.min(0.95, Number(m.quality) || 0.85)) })).arrayBuffer();
    self.postMessage({ id, ok: true, width: w, height: h, mime: jpeg ? "image/jpeg" : "image/png", bytes: out }, [out]);
  } catch (e) { self.postMessage({ id, ok: false, error: String(e && e.message || e).slice(0, 120) }); }
};
