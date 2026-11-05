#!/usr/bin/env node
/**
 * The browser check for the platform: builds nothing, starts the built app (`npm run build` first), and
 * drives it in a real Chromium with no database and no Stripe, so it runs anywhere, in CI included.
 *
 * What it proves, for every page a signed-out visitor can reach, at desktop, phone and 320 px widths:
 *   - the security headers are on, and the Content-Security-Policy has a nonce that every script carries;
 *   - no policy violation, console error or page error happens while the page loads and its forms come alive;
 *   - one h1, one main landmark, every field has a name, every control is at least 44 px, nothing scrolls sideways;
 *   - scripts injected into the page (inline, and from elsewhere) do not run, while the page's own do;
 *   - pages that need a sign-in send a visitor to sign in and remember where they were going;
 *   - signing in against a database that cannot be reached says something kind and nothing technical,
 *     and the form stays usable.
 * Signed-in screens (billing, the planner) need a database and Stripe; their rules are covered by the unit
 * and database tests, and by the throwaway end-to-end runs described in docs/saas-platform-architecture.md.
 *
 * Usage:  npm run build && npm run e2e       (set E2E_PORT to change the port; PLAYWRIGHT_MODULES to point at a
 *         folder that holds the `playwright` package when it is not installed here; CHROMIUM_PATH for a browser)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

function loadPlaywright() {
  const places = [process.env.PLAYWRIGHT_MODULES, root, "/opt/node22/lib/node_modules/"].filter(Boolean);
  for (const place of places) {
    try {
      return createRequire(path.join(path.resolve(place), "noop.js"))("playwright");
    } catch {
      // try the next place
    }
  }
  console.error("Playwright is not installed. Run:  npm install --no-save playwright && npx playwright install chromium");
  process.exit(2);
}
const { chromium } = loadPlaywright();

const failures = [];
let checks = 0;
const check = (ok, what) => {
  checks += 1;
  if (!ok) failures.push(what);
};

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startApp(port) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    // Nothing listens here: a database that cannot be reached is part of what is checked.
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    APP_URL: `http://127.0.0.1:${port}`,
  };
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The app stopped at start-up (did you run npm run build?):\n${log}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`);
      if (response.status === 200) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`The app did not start in 60 seconds:\n${log}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return { child, log: () => log };
}

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "phone", width: 390, height: 844 },
  { name: "narrow", width: 320, height: 640 },
];
const TOKEN = "ab".repeat(32);
const PAGES = [
  { path: "/login", status: 200, forms: true },
  { path: "/signup", status: 200, forms: true },
  { path: "/forgot-password", status: 200, forms: true },
  { path: "/join", status: 200, forms: false },
  { path: `/join?token=${TOKEN}`, status: 200, forms: false },
  { path: "/no-such-page", status: 404, forms: false },
];

async function main() {
  const port = Number(process.env.E2E_PORT) || (await freePort());
  const base = `http://127.0.0.1:${port}`;
  const app = await startApp(port);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    // -- every page, every width -------------------------------------------------------------------------
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      for (const spec of PAGES) {
        const label = `${spec.path.replace(TOKEN, "…")} at ${viewport.name}`;
        const page = await context.newPage();
        const problems = [];
        await page.addInitScript(() => {
          window.__violations = [];
          document.addEventListener("securitypolicyviolation", (e) => window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`));
        });
        // The browser logs the page's own 404 as a failed load; that is the answer being checked, not a fault.
        page.on("console", (m) => m.type() === "error" && !(spec.status === 404 && m.location().url === base + spec.path) && problems.push(`console: ${m.text().slice(0, 160)}`));
        page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
        const response = await page.goto(base + spec.path, { waitUntil: "networkidle" });

        check(response.status() === spec.status, `${label}: status ${response.status()}, expected ${spec.status}`);
        const headers = response.headers();
        const csp = headers["content-security-policy"] ?? "";
        check(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/.test(csp), `${label}: no script policy with a nonce`);
        check(!csp.includes("unsafe-eval") && !/script-src[^;]*unsafe-inline/.test(csp), `${label}: the policy allows eval or inline script`);
        check(headers["x-frame-options"] === "DENY", `${label}: X-Frame-Options is not DENY`);
        check(headers["referrer-policy"] === "no-referrer", `${label}: Referrer-Policy is not no-referrer`);
        check(headers["x-content-type-options"] === "nosniff", `${label}: no nosniff`);
        check(!("x-powered-by" in headers), `${label}: X-Powered-By is sent`);

        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
        const scripts = await page.$$eval("script", (els) => els.map((e) => e.nonce || e.getAttribute("nonce") || ""));
        check(scripts.length > 0 && scripts.every((n) => n === nonce), `${label}: a script lacks this request's nonce`);

        check(((await page.evaluate(() => window.__violations)).length === 0), `${label}: policy violations: ${JSON.stringify(await page.evaluate(() => window.__violations))}`);
        check(problems.length === 0, `${label}: ${problems.join(" | ")}`);

        if (spec.forms) {
          const hydrated = await page.evaluate(() => [...document.querySelectorAll("input")].some((el) => Object.keys(el).some((k) => k.startsWith("__react"))));
          check(hydrated, `${label}: the form did not come alive (its scripts did not run)`);
        }

        const facts = await page.evaluate(() => {
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          const nameOf = (el) => {
            if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
            if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return "label";
            if (el.closest("label")) return "label";
            return "";
          };
          const small = [];
          for (const el of document.querySelectorAll("button, input:not([type=hidden]):not([type=checkbox]), select, textarea, a.btn")) {
            if (!visible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.height < 44 - 0.5 || (el.tagName !== "INPUT" && r.width < 44 - 0.5)) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
          return {
            h1: document.querySelectorAll("h1").length,
            main: document.querySelectorAll("main, [role=main]").length,
            unnamed: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter((el) => visible(el) && !nameOf(el)).length,
            small,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            lang: document.documentElement.lang,
          };
        });
        check(facts.h1 === 1, `${label}: ${facts.h1} h1 elements`);
        check(facts.main === 1, `${label}: ${facts.main} main landmarks`);
        check(facts.unnamed === 0, `${label}: ${facts.unnamed} fields without a name`);
        check(facts.small.length === 0, `${label}: controls under 44 px: ${facts.small.join(", ")}`);
        check(facts.overflow <= 0, `${label}: scrolls sideways by ${facts.overflow}px`);
        check(facts.lang === "en", `${label}: no page language`);
        await page.close();
      }
      await context.close();
    }

    // -- a script that is not the app's own does not run ----------------------------------------------------
    {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        window.__v = [];
        document.addEventListener("securitypolicyviolation", (e) => window.__v.push(e.violatedDirective));
      });
      // The real page and headers, plus what a hole in the page would add.
      await page.route(`${base}/login`, async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace("</body>", `<script>window.__inline=1</script><script src="${base}/evil.js"></script></body>`);
        await route.fulfill({ response, body });
      });
      await page.route(`${base}/evil.js`, (route) => route.fulfill({ contentType: "text/javascript", body: "window.__external=1" }));
      await page.goto(`${base}/login`, { waitUntil: "networkidle" });
      check(!(await page.evaluate(() => window.__inline)), "an injected inline script ran");
      check(!(await page.evaluate(() => window.__external)), "an injected outside script ran");
      check((await page.evaluate(() => window.__v)).length >= 2, "the browser did not report the injected scripts");
      check(await page.evaluate(() => [...document.querySelectorAll("input")].some((el) => Object.keys(el).some((k) => k.startsWith("__react")))), "the page's own scripts stopped running");
      await page.close();
    }

    // -- the nonce is new every time ----------------------------------------------------------------------------
    {
      const nonces = new Set();
      for (let i = 0; i < 5; i++) nonces.add(/'nonce-([^']+)'/.exec((await fetch(`${base}/login`)).headers.get("content-security-policy") ?? "")?.[1]);
      check(nonces.size === 5 && !nonces.has(undefined), "the nonce repeats between requests");
    }

    // -- pages that need a sign-in ---------------------------------------------------------------------------------
    for (const target of ["/dashboard", "/library", "/calendar", "/calendar/generate", "/reminiscence", "/admin", "/admin/billing", "/admin/team", "/admin/settings", "/onboarding"]) {
      const response = await fetch(base + target, { redirect: "manual" });
      const location = response.headers.get("location") ?? "";
      const expected = target === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(target)}`;
      check(response.status === 307 && new URL(location, base).pathname + new URL(location, base).search === expected, `${target}: sends a visitor to ${location || "nowhere"}, expected ${expected}`);
    }
    const api = await fetch(`${base}/api/content`);
    check(api.status === 401, `/api/content without a sign-in answered ${api.status}, expected 401`);
    check(((await api.json()).error?.code ?? "") !== "", "/api/content gave no error code");

    // -- signing in when the database cannot be reached --------------------------------------------------------------
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${base}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', "e2e@example.com");
      await page.fill('input[name="password"]', "not-a-real-password");
      await page.click('button[type="submit"]');
      const alert = page.locator('.alert.bad[role="alert"]'); // not Next.js's own, empty, route announcer
      await alert.waitFor({ timeout: 20_000 });
      const said = (await alert.innerText()).trim();
      check(said.length > 0, "signing in with no database said nothing");
      check(!/fetch|ECONN|supabase|127\.0\.0\.1|localhost|stack|undefined|\bnull\b|\[object/i.test(said), `signing in with no database said something technical: ${said}`);
      check(await page.locator('button[type="submit"]').isEnabled(), "the sign-in button stayed disabled after a failure");
      check((await page.inputValue('input[name="email"]')) === "e2e@example.com", "the email was not kept after a failure");
      check((await page.inputValue('input[name="password"]')) === "", "the password was put back into the form");
      await page.close();
    }

    check(!/Error:|TypeError|ReferenceError|at .*\(.*node_modules/.test(app.log()), `the server logged an unexpected error:\n${app.log().slice(-600)}`);
  } finally {
    await browser.close();
    app.child.kill();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${checks} browser checks failed:\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`All ${checks} browser checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
