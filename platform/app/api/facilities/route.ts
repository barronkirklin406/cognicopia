import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createFacility } from "@/lib/data/facilities";
import { FacilityNameSchema } from "@/lib/domain/facility";
import { handleError, issuesOf, problem, readJson } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({ facility_name: FacilityNameSchema });

/**
 * POST /api/facilities  { "facility_name": "Maple Court" }
 * The signed-in user creates their facility and becomes its admin.
 */
export async function POST(request: Request) {
  try {
    const db = await createClient();
    await requireUser(db);

    const body = Body.safeParse(await readJson(request));
    if (!body.success) return problem(422, "invalid", "Enter the facility's name.", issuesOf(body.error));

    const facilityId = await createFacility(db, body.data.facility_name);
    return NextResponse.json({ facility_id: facilityId }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
