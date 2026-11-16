/* =====================================================================
   Baseline settings for the end-to-end checks in e2e/.

   A plain module, not a @playwright/test config: this repository does not
   install the Playwright test runner (docs/dev-setup.md), it loads Playwright
   itself through scripts/lib/browser.mjs and runs files with Node's own test
   runner (node --test). Everything a check may want to change is here.
   ===================================================================== */
export default {
  /* Chromium only: it is the browser the cloud sandbox ships. No options are needed there;
     on your own computer run "npx playwright install chromium" once (see docs/dev-setup.md). */
  launch: { headless: true },

  /* The two sizes CLAUDE.md requires every visible change to be looked at in. */
  viewports: {
    laptop: { width: 1366, height: 768 },
    phone: { width: 390, height: 844 }
  },

  /* Per-step limits, in milliseconds. */
  timeouts: { settle: 1200, action: 5000 },

  /* Written before any page script runs, so a first-visit window never covers the page under test. */
  storage: { cognicopia_eula_accepted: "true" },
  nightShiftKey: "cognicopia_night_shift",

  /* The service worker (sw.js) is blocked: it is a separate piece of the offline story with its own checks, and a
     worker serving old files would hide a change under test. Set to "allow" to test it on purpose. */
  serviceWorkers: "block",

  /* Pages the baseline smoke check loads. */
  pages: [
    "index.html", "builder.html", "profile.html", "pricing.html", "contact.html",
    "activate.html", "tablet.html", "terms.html", "resources/index.html"
  ],

  /* Where screenshots and traces of a failure are written (git-ignored). */
  artifacts: "e2e/.artifacts"
};
