import { describe, expect, it } from "vitest";
import { buildCsp, makeNonce } from "@/lib/security/csp";

/** The Content-Security-Policy: what it allows, what it never allows, and that its nonce is fresh and well formed. */

const directive = (policy: string, name: string) => policy.split("; ").find((d) => d === name || d.startsWith(`${name} `));

describe("makeNonce", () => {
  it("is base64 of 16 random bytes, and different every time", () => {
    const nonces = new Set(Array.from({ length: 200 }, makeNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(atob(nonce)).toHaveLength(16);
    }
  });
});

describe("buildCsp", () => {
  const nonce = "AAAAAAAAAAAAAAAAAAAAAA==";
  const production = buildCsp(nonce);

  it("lets scripts run only if they have this request's nonce, and the scripts they load", () => {
    expect(directive(production, "script-src")).toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
  });

  it("never allows inline or eval'd script in production, anywhere in the policy", () => {
    expect(production).not.toContain("unsafe-eval");
    expect(directive(production, "script-src")).not.toContain("unsafe-inline");
    expect(directive(production, "default-src")).toBe("default-src 'self'");
    expect(production).not.toMatch(/https?:|\*/); // no outside host, no wildcard
  });

  it("allows eval only in development, where React needs it for error stacks", () => {
    const dev = buildCsp(nonce, { development: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "script-src")).not.toContain("unsafe-inline");
  });

  it("styles come from this site and from Next's own inline styles (by nonce); attributes may be inline", () => {
    expect(directive(production, "style-src")).toBe(`style-src 'self' 'nonce-${nonce}'`);
    expect(directive(production, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    expect(directive(buildCsp(nonce, { development: true }), "style-src")).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("keeps everything else to this site: no frames, plugins, outside forms, base changes or connections", () => {
    expect(directive(production, "object-src")).toBe("object-src 'none'");
    expect(directive(production, "base-uri")).toBe("base-uri 'self'");
    expect(directive(production, "form-action")).toBe("form-action 'self'");
    expect(directive(production, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(production, "connect-src")).toBe("connect-src 'self'");
    expect(directive(production, "font-src")).toBe("font-src 'self'");
    expect(directive(production, "img-src")).toBe("img-src 'self' blob: data:");
  });

  it("opens connections for hot reload only in development", () => {
    expect(directive(buildCsp(nonce, { development: true }), "connect-src")).toBe("connect-src 'self' ws: wss:");
  });

  it("is one line of plain directives, with no line break a header could not carry", () => {
    expect(production).not.toMatch(/[\r\n]/);
    expect(production.endsWith(";")).toBe(false);
  });

  it.each(["", "a b", "x'; script-src *", "AAAA\nBBBB", "a;b", "<script>"])("refuses a nonce that is not base64: %j", (bad) => {
    expect(() => buildCsp(bad)).toThrow("base64");
  });
});
