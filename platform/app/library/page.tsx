import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/planner/LibraryBrowser";
import { PageHeader } from "@/components/planner/PageHeader";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { listContent } from "@/lib/data/content";
import { parseFilterParams } from "@/lib/domain/content-filter";

export const metadata: Metadata = { title: "Activity library" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

/**
 * The shared activity library: a premium tool. The page asks first, and reads
 * nothing until it knows the facility's subscription grants access; the database
 * refuses the read for a lapsed facility as well, so this is never the only guard.
 * The whole library is sent to the browser (a few hundred items at most), which sorts it
 * instantly by stage, kind of activity, theme and search; the address says how it was sorted.
 */
export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await requirePremium("/library");
  const session = { user: access.user, membership: access.membership };

  if (access.blocked) {
    return (
      <Shell session={session} current="/library">
        <div className="stack">
          <h1>Activity library</h1>
          <RenewalPrompt status={access.membership.facility.subscription_status} isAdmin={access.membership.role === "admin"} />
        </div>
      </Shell>
    );
  }

  const params = await searchParams;
  const initial = parseFilterParams({ stage: first(params.stage), format: first(params.format), theme: first(params.theme), q: first(params.q) });
  const items = await listContent(access.db, { limit: 1000 });

  return (
    <Shell session={session} current="/library">
      <div className="grid gap-6">
        <PageHeader title="Activity library">Sort by the stage of the people in the room, the kind of activity or a theme, and open any activity to see how to run it for that stage.</PageHeader>
        {items.length === 0 ? <p className="m-0 text-lg">There are no activities to show yet.</p> : <LibraryBrowser items={items} initial={initial} />}
      </div>
    </Shell>
  );
}
