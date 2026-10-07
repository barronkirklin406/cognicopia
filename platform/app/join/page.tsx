import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { AcceptInviteForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";
import { getAccess } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { previewInvite } from "@/lib/data/invites";
import { InviteTokenSchema } from "@/lib/domain/invite";
import { signOutAction } from "@/app/actions";

export const metadata: Metadata = { title: "Join a facility" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * The page an invitation link opens. The secret is in the address, so this page
 * (like every page here) is sent with Referrer-Policy: no-referrer, and the secret
 * is never shown, logged or kept: it goes straight to the one call that uses it.
 *
 * Not signed in: sign in or create an account, and come back here.
 * Signed in without a facility: see what the link is for, then accept it.
 * Anything else: an honest explanation.
 */
export default async function JoinPage({ searchParams }: { searchParams: SearchParams }) {
  const parsed = InviteTokenSchema.safeParse(first((await searchParams).token));
  const { db, ctx } = await getAccess();
  const session = ctx ?? undefined;

  if (!parsed.success) {
    return (
      <Shell session={session}>
        <div className="narrow stack">
          <h1>This invitation link is not valid</h1>
          <p>It may have been cut short when it was copied. Ask a facility admin to send it again.</p>
          <p>
            <Link href={ctx ? "/dashboard" : "/login"}>{ctx ? "Go to your home page" : "Go to sign in"}</Link>
          </p>
        </div>
      </Shell>
    );
  }
  const token = parsed.data;

  if (!ctx) {
    const next = encodeURIComponent(`/join?token=${token}`);
    return (
      <Shell>
        <div className="narrow stack">
          <h1>You have been invited to join a facility</h1>
          <p>Sign in, or create your own account, and you will come straight back here to accept.</p>
          <div className="row">
            <Link className="btn" href={`/login?next=${next}`}>
              Sign in
            </Link>
            <Link className="btn secondary" href={`/signup?next=${next}`}>
              Create an account
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (ctx.membership) {
    return (
      <Shell session={ctx} current="/join">
        <div className="narrow stack">
          <h1>You already belong to a facility</h1>
          <p>
            This account is part of <strong>{ctx.membership.facility.facility_name}</strong>, and an account can belong to only one facility. To use this invitation, sign out and sign in with a different account.
          </p>
          <form action={signOutAction}>
            <button type="submit" className="btn secondary">
              Sign out
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  const preview = await previewInvite(db, token);
  if (!preview) {
    return (
      <Shell session={ctx}>
        <div className="narrow stack">
          <h1>This invitation is no longer valid</h1>
          <p>It has been used, cancelled or has expired. Ask a facility admin for a new one.</p>
          <p>
            <Link href="/onboarding">Set up your own facility instead</Link>
          </p>
        </div>
      </Shell>
    );
  }

  const roleLabel = preview.role === "admin" ? "an admin" : "staff";
  return (
    <Shell session={ctx}>
      <div className="narrow stack">
        <h1>Join {preview.facility_name}</h1>
        <p>
          You have been invited to join <strong>{preview.facility_name}</strong> as {roleLabel}.
        </p>
        {preview.email_locked && !preview.email_matches ? (
          <>
            <Alert tone="warn" title="This invitation is for a different email address">
              <p>You are signed in as {ctx.user.email}. Sign out, then sign in with the address the invitation was sent to.</p>
            </Alert>
            <form action={signOutAction}>
              <button type="submit" className="btn secondary">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <AcceptInviteForm token={token} facilityName={preview.facility_name} roleLabel={roleLabel} />
        )}
      </div>
    </Shell>
  );
}
