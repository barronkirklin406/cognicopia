import { readFileSync } from "node:fs";
import path from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

/**
 * The portal's own stylesheet (app/globals.css) and Tailwind's utilities share one page. A class
 * name that both define is a trap: Tailwind's version wins (utilities sit above the portal's rules),
 * and a page that used the old name changes without anyone touching it. That happened once:
 * Tailwind's "container" replaced the 960 px page width, and its "grid" met the old tile grid's
 * columns. The old names were renamed (page-width, tiles); this keeps it from happening again.
 */
const css = readFileSync(path.join(import.meta.dirname, "../../app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const ours = [...new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]!))];

// The portal's visually-hidden class does what Tailwind's does, on purpose.
const SAME_ON_PURPOSE = new Set(["sr-only"]);

describe("class names the portal's stylesheet defines", () => {
  it("finds the portal's own classes", () => {
    expect(ours).toEqual(expect.arrayContaining(["page-width", "tiles", "card", "btn", "stack", "badge", "alert"]));
    expect(ours.length).toBeGreaterThan(25);
  });

  it("are not also Tailwind utilities, so a utility never overrides an old rule of the same name", async () => {
    const compiler = await compile("@tailwind utilities;", {
      loadStylesheet: async () => {
        throw new Error("no imports are needed");
      },
    });
    const built = compiler.build(ours);
    const defined = new Set([...built.matchAll(/^\.([\w\\:-]+)\s*\{/gm)].map((m) => m[1]!));
    const clashes = ours.filter((name) => defined.has(name) && !SAME_ON_PURPOSE.has(name));
    expect(clashes).toEqual([]);
  });

  it("would notice a clash: Tailwind does define container and grid", async () => {
    const compiler = await compile("@tailwind utilities;", { loadStylesheet: async () => { throw new Error("none"); } });
    const built = compiler.build(["container", "grid"]);
    expect(built).toMatch(/\.container\s*\{/);
    expect(built).toMatch(/\.grid\s*\{/);
  });
});
