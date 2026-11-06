/* Monthly bundle compilation without memory spikes.

   A facility-wide bundle can run to hundreds of pages. Instead of holding every page and picture at once, the work is cut into chunks:
   each chunk is processed, its results are handed on, its references are dropped, and the browser gets a turn before the next chunk
   starts. The chunk size follows what the computer has (device memory, JS heap limit). Heavy DOM-free work, such as shrinking photos,
   can go to a Web Worker pool (js/bundle-worker.js), a few tasks at a time. Nothing is sent anywhere. */

export const VERSION = "1.0.0";
/* pages: how many pages are expected. Returns a chunk size between 5 and 50. */
export function chooseChunkSize(o = {}) {
  const mem = Number(o.deviceMemoryGB) || (typeof navigator !== "undefined" && navigator.deviceMemory) || 4, heap = Number(o.jsHeapLimitMB) || 0;
  let size = mem <= 1 ? 5 : mem <= 2 ? 10 : mem <= 4 ? 20 : mem <= 8 ? 30 : 40; if (heap && heap < 1024) size = Math.min(size, 10); if (o.pages && o.pages < size) size = Math.max(5, Math.ceil(o.pages));
  return Math.max(5, Math.min(50, size));
}
const nextTurn = () => new Promise((r) => (typeof requestAnimationFrame === "function" && false ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
/* items: anything. process(item, index) -> result (may be async). release(results) is called after each chunk with that chunk's results,
   which is where they should be written out (to the PDF, to the print stage) so that they need not stay in memory. */
export async function compileInChunks(items, process, o = {}) {
  const list = Array.isArray(items) ? items : [], size = Math.max(1, o.chunkSize || chooseChunkSize({ pages: list.length })), out = { chunks: 0, processed: 0, failed: 0, cancelled: false, maxHeld: 0, results: o.release ? undefined : [] };
  for (let at = 0; at < list.length; at += size) {
    if (typeof o.shouldCancel === "function" && o.shouldCancel()) { out.cancelled = true; break; }
    const chunk = list.slice(at, at + size), res = [];
    const par = Math.max(1, Math.min(8, o.concurrency || 1));      // a few at a time, in order, so a worker pool can be kept busy without holding the whole chunk's work in flight
    for (let i = 0; i < chunk.length; i += par) {
      const got = await Promise.all(chunk.slice(i, i + par).map((it, j) => Promise.resolve().then(() => process(it, at + i + j)).then((v) => ({ v }), () => ({ e: 1 }))));
      for (const g of got) { if (g.e) { res.push({ error: true }); out.failed++; } else { res.push(g.v); out.processed++; } }
    }
    out.maxHeld = Math.max(out.maxHeld, res.length); out.chunks++;
    if (o.release) await o.release(res, out.chunks - 1); else out.results.push(...res);
    if (typeof o.onProgress === "function") { try { o.onProgress({ done: Math.min(list.length, at + chunk.length), total: list.length, chunk: out.chunks }); } catch (e) { /* a broken callback never stops the compile */ } }
    await (o.yieldFn || nextTurn)();
  }
  return out;
}

/* ---------- a small worker pool ---------- */
export class WorkerPool {
  /* make: () => Worker (so tests can pass a stand-in). size: how many run at once. */
  constructor(make, size = 2) { this.make = make; this.size = Math.max(1, Math.min(8, size)); this.workers = []; this.queue = []; this.seq = 0; this.inFlight = 0; this.peak = 0; this.closed = false; }
  _spawn() { const w = this.make(); w.__busy = false; w.onmessage = (ev) => { const j = w.__job; w.__job = null; w.__busy = false; this.inFlight--; if (j) (ev.data && ev.data.ok ? j.res(ev.data) : j.rej(new Error((ev.data && ev.data.error) || "task failed"))); this._pump(); }; w.onerror = (e) => { const j = w.__job; w.__job = null; w.__busy = false; this.inFlight--; if (j) j.rej(new Error("worker error")); this._pump(); }; this.workers.push(w); return w; }
  _pump() { while (this.queue.length) { let w = this.workers.find((x) => !x.__busy) || (this.workers.length < this.size ? this._spawn() : null); if (!w) return; const j = this.queue.shift(); w.__busy = true; w.__job = j; this.inFlight++; this.peak = Math.max(this.peak, this.inFlight); try { w.postMessage(Object.assign({ id: ++this.seq }, j.task)); } catch (e) { w.__busy = false; w.__job = null; this.inFlight--; j.rej(e); } } }
  run(task) { if (this.closed) return Promise.reject(new Error("the pool is closed")); return new Promise((res, rej) => { this.queue.push({ task, res, rej }); this._pump(); }); }
  terminate() { this.closed = true; this.workers.forEach((w) => { try { w.terminate(); } catch (e) { /* gone */ } }); this.workers = []; this.queue.splice(0).forEach((j) => j.rej(new Error("the pool is closed"))); }
}
/* Photos (PNG or JPEG bytes) shrunk through the pool, in chunks, a few at a time. Returns [{ bytes, width, height, mime } | { error: true }] in order. */
export async function downscaleAll(pool, photos, o = {}) {
  const res = [];
  await compileInChunks(photos, (p) => pool.run({ type: "downscale", bytes: p.bytes, mime: p.mime, maxPx: o.maxPx || 1200, quality: o.quality }).then((r) => ({ bytes: r.bytes, width: r.width, height: r.height, mime: r.mime })), { chunkSize: o.chunkSize || 20, concurrency: o.concurrency || pool.size, release: (r) => { res.push(...r); }, onProgress: o.onProgress, shouldCancel: o.shouldCancel });
  return res;
}
