import { NextResponse } from "next/server";
import { z } from "zod";
import { withAccess } from "@/lib/access/with-access";
import { listContent } from "@/lib/data/content";
import { DEMENTIA_STAGES } from "@/lib/db/models";
import { CATEGORY_SLUG } from "@/lib/domain/content";
import { issuesOf, problem } from "@/lib/http";

export const dynamic = "force-dynamic";

const Query = z.object({
  stage: z.enum(DEMENTIA_STAGES).optional(),
  category: z.string().regex(CATEGORY_SLUG).max(64).optional(),
});

/**
 * GET /api/content?stage=early&category=music
 * The shared activity library: premium. A facility whose subscription does not
 * grant access gets 402; the database holds the same line (migration 4). A stage
 * includes the items that suit any stage.
 */
export const GET = withAccess({ premium: true }, async ({ request, db }) => {
  const params = new URL(request.url).searchParams;
  const query = Query.safeParse({
    stage: params.get("stage") ?? undefined,
    category: params.get("category") ?? undefined,
  });
  if (!query.success) return problem(422, "invalid", "Check the stage and category.", issuesOf(query.error));

  const items = await listContent(db, query.data);
  return NextResponse.json({ items });
});
