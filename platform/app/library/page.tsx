import type { Metadata } from "next";
import { Badge } from "@/components/Badge";
import { RenewalPrompt } from "@/components/RenewalPrompt";
import { Shell } from "@/components/Shell";
import { requirePremium } from "@/lib/access/guards";
import { first, type SearchParams } from "@/lib/auth/params";
import { listContent } from "@/lib/data/content";
import { DEMENTIA_STAGES, type ContentItem } from "@/lib/db/models";

export const metadata: Metadata = { title: "Activity library" };

/** Drawn for each request: it depends on who is signed in. */
export const dynamic = "force-dynamic";

const STAGE_LABELS = { early: "Early stage", middle: "Middle stage", late: "Late stage", universal: "Any stage" } as const;
const categoryName = (slug: string) => slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The shared activity library: a premium tool. The page asks first, and reads
 * nothing until it knows the facility's subscription grants access; the database
 * refuses the read for a lapsed facility as well, so this is never the only guard.
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

  const asked = first((await searchParams).stage);
  const stage = DEMENTIA_STAGES.find((candidate) => candidate === asked);
  const items = await listContent(access.db, stage ? { stage } : {});
  const byCategory = new Map<string, ContentItem[]>();
  for (const item of items) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);

  return (
    <Shell session={session} current="/library">
      <div className="stack">
        <h1>Activity library</h1>
        <form method="get" className="row" aria-label="Filter the library">
          <div className="field">
            <label htmlFor="stage">Show activities for</label>
            <select id="stage" name="stage" defaultValue={stage ?? ""}>
              <option value="">Every stage</option>
              <option value="early">Early stage (and any stage)</option>
              <option value="middle">Middle stage (and any stage)</option>
              <option value="late">Late stage (and any stage)</option>
              <option value="universal">Any stage only</option>
            </select>
          </div>
          <button type="submit" className="btn secondary">
            Show
          </button>
        </form>

        {items.length === 0 ? <p>There are no activities to show yet.</p> : null}
        {[...byCategory.entries()].map(([category, group]) => (
          <section key={category} className="stack" aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`}>{categoryName(category)}</h2>
            <div className="grid">
              {group.map((item) => (
                <article key={item.id} className="card stack">
                  <h3>{item.title}</h3>
                  <p>{item.content_payload.summary}</p>
                  <p className="row small">
                    <Badge>{STAGE_LABELS[item.dementia_stage]}</Badge>
                    {item.content_payload.minutes ? <span>{item.content_payload.minutes} minutes</span> : null}
                    {item.content_payload.group_friendly ? <span>Group</span> : null}
                    {item.content_payload.sensory ? <span>Sensory</span> : null}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
