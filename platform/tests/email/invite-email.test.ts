import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "@/lib/email/invite-email";

/** The invitation email: what it says, that nothing from outside can break out of it, and that it holds no resident. */

const LINK = `https://app.cognicopia.org/join?token=${"ab".repeat(32)}`;
const base = { facilityName: "Maple Court", role: "staff" as const, link: LINK, email: "new@maple.example" };

describe("buildInviteEmail", () => {
  it("names the facility and the role, gives the link, and says how long it lasts and who it is for", () => {
    const mail = buildInviteEmail(base);
    expect(mail.subject).toBe("You are invited to join Maple Court on Cognicopia");
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Maple Court");
      expect(body).toContain("a member of staff");
      expect(body).toContain(LINK);
      expect(body).toContain("lasts 7 days");
      expect(body).toContain("new@maple.example");
      expect(body).toContain("If you were not expecting this, you can ignore this email.");
    }
  });

  it("says what an admin can do beyond staff", () => {
    const admin = buildInviteEmail({ ...base, role: "admin" });
    expect(admin.text).toContain("an admin");
    expect(admin.text).toContain("manage the team, the settings and billing");
    expect(buildInviteEmail(base).text).not.toContain("manage the team");
  });

  it("puts the secret link in the body once each, and never in the subject", () => {
    const mail = buildInviteEmail(base);
    expect(mail.subject).not.toContain("token");
    expect(mail.text.split(LINK)).toHaveLength(2);
    expect(mail.html.split(LINK)).toHaveLength(4); // the button, and the copy-and-paste line (its address and its shown text)
  });

  it("escapes everything that came from outside in the HTML", () => {
    const mail = buildInviteEmail({ ...base, facilityName: `<script>alert("x")</script> & 'Co'`, email: `a"b@x.example` });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;");
    expect(mail.html).not.toContain(`a"b@x.example`);
  });

  it("cannot be made to add a header through the facility's name", () => {
    const mail = buildInviteEmail({ ...base, facilityName: "Maple\r\nBcc: someone@elsewhere.example\u2028Court" });
    expect(mail.subject).not.toMatch(/[\p{Cc}\p{Zl}\p{Zp}]/u);
    expect(mail.subject.split("\n")).toHaveLength(1);
  });

  it("keeps a very long name to one sensible line", () => {
    expect(buildInviteEmail({ ...base, facilityName: "x".repeat(5000) }).subject.length).toBeLessThan(200);
  });

  it("copes with a facility that has no name", () => {
    expect(buildInviteEmail({ ...base, facilityName: "  \n " }).subject).toBe("You are invited to join a facility on Cognicopia");
  });

  it("asks for nothing about a resident, and says it stores nothing about one", () => {
    const mail = buildInviteEmail(base);
    expect(mail.text).toContain("never asks for, or stores, anything about a resident");
    expect(`${mail.text}${mail.html}`).not.toMatch(/\{\{|\{%/);
  });

  it("is plain enough to read at a glance: large type and a button with a high-contrast label", () => {
    const { html } = buildInviteEmail(base);
    expect(html).toMatch(/font-size:18px/);
    expect(html).toContain("Accept the invitation");
    expect(html).toContain('lang="en"');
  });
});
