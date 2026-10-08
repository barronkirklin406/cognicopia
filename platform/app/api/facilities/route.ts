import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/access/with-access";
import { createFacility } from "@/lib/data/facilities";
import { FacilityNameSchema } from "@/lib/domain/facility";
import { issuesOf, problem, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.object({ facility_name: FacilityNameSchema });

/**
 * POST /api/facilities  { "facility_name": "Maple Court" }
 * The signed-in user creates their facility and becomes its admin. The facility
 * starts with no subscription: the admin chooses a plan next (/admin/billing).
 */
export const POST = withUser(async ({ request, db }) => {
  const body = Body.safeParse(await readJson(request));
  if (!body.success) return problem(422, "invalid", "Enter the facility's name.", issuesOf(body.error));

  const facilityId = await createFacility(db, body.data.facility_name);
  return NextResponse.json({ facility_id: facilityId }, { status: 201 });
});
