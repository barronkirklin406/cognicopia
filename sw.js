/* =====================================================================
   COGNICOPIA OFFLINE SUPPORT (service worker)
   Everything Cognicopia does happens in the browser. This worker only
   keeps copies of the site's own files so the tools open without an
   internet connection. It never contacts another site, never sends
   anything anywhere, and never stores what anyone types: resident details
   live in the pages' own encrypted browser storage, not here.

   Fresh first: when the network answers, the page comes from the site
   and the copy is refreshed. When it does not (offline, or a stalled
   connection for 4 seconds on a page already copied), the saved copy is
   used. Change VERSION only to clear old copies; updates to the pages
   themselves arrive on their own.
   ===================================================================== */
const VERSION = "cognicopia-v8";
const CORE = [
  "./", "index.html", "builder.html", "profile.html", "manifest.webmanifest",
  "assets/cognicopia-logo.jpg", "assets/icon-192.png", "assets/icon-512.png", "assets/icon-maskable-512.png",
  "assets/cognicore/cognicore.js", "assets/services/vectorEngine.js", "assets/services/secureStore.js", "assets/services/reminiscenceEngine.js", "assets/services/slpClinicalService.js", "assets/services/heirloomService.js", "assets/services/facilityPlanner.js", "assets/services/academy.js",
  "assets/vendor/jspdf.umd.min.js", "assets/vendor/jspdf-atkinson.js"
];
const PAGE_WAIT_MS = 4000;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.indexOf("cognicopia-") === 0 && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // other sites are not ours to touch
  if (req.headers.has("range")) return;                    // partial media requests go straight through
  event.respondWith(freshFirst(event, req));
});

async function freshFirst(event, req){
  const cache = await caches.open(VERSION);
  const saved = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req);
  // Refresh the copy whenever the site answers, even after the saved copy was shown.
  // Registered while the request is still open, so the browser keeps the worker alive for it.
  event.waitUntil(network.then(res => {
    if (res.ok && res.status === 200 && res.type === "basic") return cache.put(req, res.clone());
  }).catch(() => {}));
  // A page already copied does not wait on a stalled connection.
  const wait = saved && req.mode === "navigate"
    ? Promise.race([network, new Promise(resolve => setTimeout(() => resolve(null), PAGE_WAIT_MS))])
    : network;
  try {
    const res = await wait;
    if (res) return res;
  } catch (e) {}
  if (saved) return saved;
  // Offline and never copied: open the packet tool rather than an error page,
  // at its own address, so its links and images work from any folder (the
  // reference pages live under resources/).
  if (req.mode === "navigate" && await cache.match("index.html")){
    const home = new URL("index.html", self.location.href).href;
    return req.url.split(/[?#]/)[0] === home ? cache.match("index.html") : Response.redirect(home, 302);
  }
  return Response.error();
}
