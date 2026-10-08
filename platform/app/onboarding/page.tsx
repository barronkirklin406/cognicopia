import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth-forms";
import { Shell } from "@/components/Shell";
import { requireSignedIn } from "@/lib/access/guards";

export const metadata: Metadata = { title: "Set up your facility" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/** For someone signed in who belongs to no facility yet. Anyone who does is sent to their dashboard. */
export default async function OnboardingPage() {
  const { ctx } = await requireSignedIn("/onboarding");
  if (ctx.membership) redirect("/dashboard");

  return (
    <Shell session={ctx}>
      <div className="narrow stack">
        <h1>Set up your facility</h1>
        <p>
          You will be the facility's first admin: you can invite your team, choose a plan and manage billing. Please do not enter anything about a resident anywhere in Cognicopia.
        </p>
        <OnboardingForm />
        <p className="small muted">Were you invited to an existing facility? Open the invitation link you were sent instead.</p>
      </div>
    </Shell>
  );
}
