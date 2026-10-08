import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";
import { first, type SearchParams } from "@/lib/auth/params";
import { safeNext } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext(first((await searchParams).next), "");
  const withNext = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Shell>
      <div className="narrow stack">
        <h1>Create your account</h1>
        <p>
          Everyone has their own sign-in. After you confirm your email address you can set up your facility, or join one you have been invited to.
        </p>
        <SignUpForm next={next || undefined} />
        <p>
          Already have an account? <Link href={`/login${withNext}`}>Sign in</Link>.
        </p>
      </div>
    </Shell>
  );
}
