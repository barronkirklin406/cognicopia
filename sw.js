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
const VERSION = "cognicopia-v44";
const CORE = [
  "./", "index.html", "builder.html", "profile.html", "tablet.html", "pricing.html", "activate.html", "manifest.webmanifest",
  // the shared design system and its two typefaces (Atkinson Hyperlegible for the interface, Fraunces for headings)
  "css/styles.css", "css/pages-utilities.css", "fonts/AtkinsonHyperlegible-Regular.woff2", "fonts/AtkinsonHyperlegible-Bold.woff2", "fonts/Fraunces-latin.woff2",
  "assets/cognicopia-logo.jpg", "assets/icon-192.png", "assets/icon-512.png", "assets/icon-maskable-512.png",
  "assets/cognicopia-coloring/cognicopia-coloring.js", "js/coloringAgent.js", "assets/services/vectorEngine.js", "assets/services/secureStore.js", "assets/services/reminiscenceEngine.js", "assets/services/slpClinicalService.js", "assets/services/heirloomService.js", "assets/services/facilityPlanner.js", "assets/services/academy.js", "assets/services/dailyOps.js", "assets/services/nightShift.js",
  "js/facility-logo.js", "js/shift-calendar.js", "js/shift-calendar-ui.js", "js/quick-lookup.js", "assets/vendor/jspdf.umd.min.js", "assets/vendor/jspdf-atkinson.js",
  // the hybrid coloring engine: its subjects travel in the bundle, so coloring pages draw offline
  "assets/coloring/subjects.bundle.js", "assets/coloring/manifest.json", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "src/engine/ReminiscencePages.js", "src/engine/ClinicalMatrix.js", "src/engine/ClinicalActivities.js", "src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js", "src/engine/ProceduralPacketEngine.js",
  // the procedural engine behind Today's Packet: its content travels in one bundle, so the daily packet is made offline
  // licensing: the license key, the promo code and the license badge work offline. A key is checked on the computer, so once it is
  // entered the tools stay unlocked with no connection, for as long as its paid-through date plus the grace days (src/config/license.js).
  "src/config/license.js", "assets/services/licenseManager.js", "assets/services/trialLedger.js", "assets/services/localDb.js", "assets/services/contentCatalog.js", "assets/services/contentMatcher.js", "data/content-catalog.json",
  "assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js",
  // Tablet Activities (tablet.html): the touch puzzle makers and the screen
  "js/tabletEngine.js", "js/tablet.js",
  // Studio, facility and accessibility screens (ES modules imported by builder.html) and the OpenDyslexic option
  "js/studio-core.js", "js/studio-ui.js", "js/facility-tools-ui.js", "js/safety-ui.js", "js/idle-sanitizer.js", "js/sha256.js", "js/access-kit.js", "js/backup-diff.js", "js/ehr-import.js", "js/slp-goals.js", "js/shift-highlights.js", "js/scenario-trees.js", "js/era-decks.js", "js/deck-formats.js", "js/qr.js", "js/legacy-book.js", "js/tracking-report.js", "js/dictation.js", "js/reminiscence-engine.js", "js/tabletSound.js", "js/sessionTimeout.js", "js/license-persistence.js", "fonts/OpenDyslexic-Regular.woff2", "fonts/OpenDyslexic-Bold.woff2", "assets/services/censusImport.js",
  "js/agent-orchestrator.js", "js/pillar1-production-agents.js", "js/pillar2-functionality-agents.js", "js/pillar3-qa-agents.js", "js/clinical-audit-agent.js", "js/print-preview-modal.js",
  "js/toolkit-ui.js", "js/todays-packet.js", "js/packet-builder.js", "js/clinical-suite.js", "js/pillar4-maintenance-agents.js", "js/pillar5-upgrade-agents.js",
  // pages and scripts added since the first version of this list: the agreement, the invoice maker, the staff guide, the favicon set
  "js/legal.js", "terms.html", "js/invoiceMaker.js", "js/staffGuide.js", "resources/staff-guide/index.html", "assets/favicon-16.png", "assets/favicon-32.png", "assets/apple-touch-icon.png", "favicon.ico", "js/careTier.js", "js/voiceKit.js", "js/auditLogUI.js", "js/familyLifeDigestUI.js", "js/nostalgiaRadioUI.js", "js/pocketLanyardCard.js", "js/trialBadge.js", "js/modalController.js", "assets/services/privacyExport.js", "assets/services/residentTracker.js", "assets/services/staffCompanion.js", "assets/services/researchCenter.js"
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
