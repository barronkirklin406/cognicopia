import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { SignInForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";
import { pageError, pageNotice } from "@/lib/auth/messages";
import { first, type SearchParams } from "@/lib/auth/params";
import { safeNext } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Sign in" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = pageError(first(params.error));
  const notice = pageNotice(first(params.notice));
  const next = safeNext(first(params.next), "");
  const withNext = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Shell>
      <div className="narrow stack">
        <h1>Sign in</h1>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        <SignInForm next={next || undefined} />
        <p>
          New here? <Link href={`/signup${withNext}`}>Create an account</Link>. To join a facility that has invited you, open the link they sent you.
        </p>
      </div>
    </Shell>
  );
}
