import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";
import { getAccess } from "@/lib/access/guards";

export const metadata: Metadata = { title: "Choose a new password" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * Reached from the link in the reset email. That link signs the person in (see
 * app/auth/callback/route.ts), so this page is for someone who is signed in. If
 * the link was old, or used already, there is no session, and it says so.
 */
export default async function ResetPasswordPage() {
  const { ctx } = await getAccess();
  return (
    <Shell session={ctx ?? undefined}>
      <div className="narrow stack">
        <h1>Choose a new password</h1>
        {ctx ? (
          <ResetPasswordForm />
        ) : (
          <>
            <Alert tone="warn">That link has expired or was already used.</Alert>
            <p>
              <Link className="btn" href="/forgot-password">
                Email me a new link
              </Link>
            </p>
          </>
        )}
      </div>
    </Shell>
  );
}
