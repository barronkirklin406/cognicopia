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
const VERSION = "cognicopia-v48";
const CORE = [
  "./", "index.html", "404.html", "builder.html", "profile.html", "tablet.html", "pricing.html", "activate.html", "manifest.webmanifest",
  // the shared design system and its two typefaces (Atkinson Hyperlegible for the interface, Fraunces for headings)
  "css/styles.css", "fonts/AtkinsonHyperlegible-Regular.woff2", "fonts/AtkinsonHyperlegible-Bold.woff2", "fonts/Fraunces-latin.woff2",
  "assets/cognicopia-logo.jpg", "assets/icon-192.png", "assets/favicon-16.png", "assets/favicon-32.png", "assets/apple-touch-icon.png", "favicon.ico", "assets/icon-512.png", "assets/icon-maskable-512.png",
  "assets/cognicopia-coloring/cognicopia-coloring.js", "js/coloringAgent.js", "assets/services/vectorEngine.js", "assets/services/secureStore.js", "assets/services/reminiscenceEngine.js", "assets/services/slpClinicalService.js", "assets/services/heirloomService.js", "assets/services/facilityPlanner.js", "assets/services/academy.js", "assets/services/dailyOps.js", "assets/services/nightShift.js",
  "assets/vendor/jspdf.umd.min.js", "assets/vendor/jspdf-atkinson.js",
  // the hybrid coloring engine: its subjects travel in the bundle, so coloring pages draw offline
  "assets/coloring/subjects.bundle.js", "assets/coloring/manifest.json", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/ClinicalMatrix.js", "src/engine/ClinicalActivities.js", "src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js", "src/engine/ProceduralPacketEngine.js",
  // the procedural engine behind Today's Packet: its content travels in one bundle, so the daily packet is made offline
  // licensing: the license key, the promo code and the license badge work offline. A key is checked on the computer, so once it is
  // entered the tools stay unlocked with no connection, for as long as its paid-through date plus the grace days (src/config/license.js).
  "src/config/license.js", "assets/services/licenseManager.js", "js/careTier.js", "js/voiceKit.js", "js/legal.js", "js/sessionTimeout.js", "terms.html", "js/invoiceMaker.js", "js/staffGuide.js", "resources/staff-guide/index.html", "assets/services/trialLedger.js", "js/trialBadge.js", "assets/services/censusImport.js", "assets/services/privacyExport.js", "assets/services/residentTracker.js", "assets/services/staffCompanion.js", "assets/services/localDb.js", "assets/services/contentCatalog.js", "assets/services/contentMatcher.js", "data/content-catalog.json",
  "assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js",
  // Tablet Activities (tablet.html): the touch puzzle makers and the screen
  "js/tabletSound.js", "js/tabletArt.js", "js/tabletBanks.js", "js/tabletEras.js", "js/tabletEngine.js", "js/tabletKit.js", "js/tabletWords.js", "js/tabletCreate.js", "js/tabletThink.js", "js/tablet.js",
  // its pictures (finished illustrations, one transparent PNG each)
  "assets/tablet/apple.png", "assets/tablet/banana.png", "assets/tablet/barn.png", "assets/tablet/bee.png", "assets/tablet/bells.png", "assets/tablet/bird.png", "assets/tablet/boat.png", "assets/tablet/bone.png", "assets/tablet/button.png", "assets/tablet/candle.png", "assets/tablet/car.png", "assets/tablet/cat.png", "assets/tablet/chair.png", "assets/tablet/chimes.png", "assets/tablet/clock.png", "assets/tablet/cow.png", "assets/tablet/cup.png", "assets/tablet/daisy.png", "assets/tablet/dog.png", "assets/tablet/duck.png", "assets/tablet/fish.png", "assets/tablet/flower.png", "assets/tablet/fork.png", "assets/tablet/grapes.png", "assets/tablet/guitar.png", "assets/tablet/hat.png", "assets/tablet/hen.png", "assets/tablet/horse.png", "assets/tablet/house.png", "assets/tablet/kettle.png", "assets/tablet/key.png", "assets/tablet/leaf.png", "assets/tablet/m-bubbles.png", "assets/tablet/m-color.png", "assets/tablet/m-crossword.png", "assets/tablet/m-match.png", "assets/tablet/m-odd.png", "assets/tablet/m-order.png", "assets/tablet/m-paint.png", "assets/tablet/m-saying.png", "assets/tablet/m-sort.png", "assets/tablet/m-sounds.png", "assets/tablet/m-spell.png", "assets/tablet/m-trace.png", "assets/tablet/m-wordsearch.png", "assets/tablet/mitten.png", "assets/tablet/orange.png", "assets/tablet/phone.png", "assets/tablet/pig.png", "assets/tablet/rabbit.png", "assets/tablet/rose.png", "assets/tablet/scarf.png", "assets/tablet/sheep.png", "assets/tablet/shoe.png", "assets/tablet/sock.png", "assets/tablet/spoon.png", "assets/tablet/station.png", "assets/tablet/storm.png", "assets/tablet/teapot.png", "assets/tablet/train.png", "assets/tablet/tree.png", "assets/tablet/tulip.png", "assets/tablet/waves.png"
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
  // An address that carries a license key or a checkout reference is never copied into the cache.
  const carriesKey = /[?&#](license_key|session_id)=/.test(req.url);
  event.waitUntil(network.then(res => {
    if (!carriesKey && res.ok && res.status === 200 && res.type === "basic") return cache.put(req, res.clone());
  }).catch(() => {}));
  // A page already copied does not wait on a stalled connection.
  const wait = saved && req.mode === "navigate"
    ? Promise.race([network, new Promise(resolve => setTimeout(() => resolve(null), PAGE_WAIT_MS))])
    : network;
  try {
    const res = await wait;
    // A page the site no longer has (a 404) is not shown over a copy that was saved when it did.
    if (res && !(req.mode === "navigate" && res.status === 404 && saved)) {
      // A tablet address the site cannot answer opens the tablet mode in the packet tool, never an error page.
      if (req.mode === "navigate" && res.status === 404 && /tablet/i.test(new URL(req.url).pathname) && await cache.match("index.html"))
        return Response.redirect(new URL("index.html#tablet-fallback", self.location.href).href, 302);
      return res;
    }
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
