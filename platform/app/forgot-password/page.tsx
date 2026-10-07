import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Forgot your password?" };

export default function ForgotPasswordPage() {
  return (
    <Shell>
      <div className="narrow stack">
        <h1>Forgot your password?</h1>
        <p>Enter the email address you signed up with and we will send you a link to choose a new one.</p>
        <ForgotPasswordForm />
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </Shell>
  );
}
