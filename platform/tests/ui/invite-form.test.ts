import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** The invitation form: the email box appears only when the server can send, and is labelled and on by default. */

vi.mock("@/app/admin/actions", () => ({
  inviteAction: async () => ({}),
  cancelInviteAction: async () => ({}),
  changeRoleAction: async () => ({}),
  removeMemberAction: async () => ({}),
  renameFacilityAction: async () => ({}),
}));

const { InviteForm } = await import("@/components/team-forms");

describe("InviteForm", () => {
  it("offers to email the invitation when the server can, with the box ticked and explained", () => {
    const markup = renderToStaticMarkup(h(InviteForm, { canEmail: true }));
    expect(markup).toContain('name="send_email"');
    expect(markup).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect(markup).toContain("Email the invitation to this address");
    expect(markup).toContain('aria-describedby="invite-send-email-hint"');
    expect(markup).toContain('id="invite-send-email-hint"');
    expect(markup).toContain("Create the invitation");
    expect(markup).not.toContain("Create invitation link");
  });

  it("is the link-only form it always was when the server cannot send email", () => {
    for (const markup of [renderToStaticMarkup(h(InviteForm, { canEmail: false })), renderToStaticMarkup(h(InviteForm))]) {
      expect(markup).not.toContain("send_email");
      expect(markup).not.toContain("Email the invitation");
      expect(markup).toContain("Create invitation link");
    }
  });
});
