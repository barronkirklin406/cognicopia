import type { Metadata } from "next";
import { PageHeader } from "@/components/planner/PageHeader";
import { ReminiscenceBrowser } from "@/components/planner/ReminiscenceBrowser";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { listContent } from "@/lib/data/content";
import { parsePromptParams, toPrompt } from "@/lib/domain/reminiscence";

export const metadata: Metadata = { title: "Reminiscence prompts" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * Reminiscence prompts: conversation starters for one-to-one visits and group circles. They are
 * library items, so they are a premium tool like the rest of the library: the page asks first, and
 * the database refuses the read for a lapsed facility as well.
 */
export default async function ReminiscencePage({ searchParams }: { searchParams: SearchParams }) {
  const access = await requirePremium("/reminiscence");
  const session = { user: access.user, membership: access.membership };

  if (access.blocked) {
    return (
      <Shell session={session} current="/reminiscence">
        <div className="stack">
          <h1>Reminiscence prompts</h1>
          <RenewalPrompt status={access.membership.facility.subscription_status} isAdmin={access.membership.role === "admin"} />
        </div>
      </Shell>
    );
  }

  const params = await searchParams;
  const initial = parsePromptParams({ decade: first(params.decade), sense: first(params.sense), stage: first(params.stage), q: first(params.q) });
  const items = await listContent(access.db, { category: "reminiscence", limit: 1000 });
  const prompts = items.map(toPrompt).filter((prompt): prompt is NonNullable<typeof prompt> => prompt !== null);

  return (
    <Shell session={session} current="/reminiscence">
      <div className="grid gap-6">
        <PageHeader title="Reminiscence prompts">Conversation starters for a one-to-one visit or a group circle, by decade and by the sense that brings the time back.</PageHeader>
        {prompts.length === 0 ? <p className="m-0 text-lg">There are no prompts to show yet.</p> : <ReminiscenceBrowser prompts={prompts} initial={initial} />}
      </div>
    </Shell>
  );
}
