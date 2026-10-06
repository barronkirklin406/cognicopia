import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataError } from "@/lib/data/errors";

/**
 * The HTTP edge: who may call, how input is checked, what comes back. The
 * database and the data functions are replaced, so these tests are about the
 * routes alone. Row level security is proven in tests/db.
 */

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));

const createFacility = vi.fn();
const getMembership = vi.fn();
vi.mock("@/lib/data/facilities", () => ({
  createFacility: (...args: unknown[]) => createFacility(...args),
  getMembership: (...args: unknown[]) => getMembership(...args),
}));

const getCalendar = vi.fn();
const saveCalendar = vi.fn();
vi.mock("@/lib/data/calendars", () => ({
  getCalendar: (...args: unknown[]) => getCalendar(...args),
  saveCalendar: (...args: unknown[]) => saveCalendar(...args),
}));

const listContent = vi.fn();
vi.mock("@/lib/data/content", () => ({ listContent: (...args: unknown[]) => listContent(...args) }));

const { POST: postFacility } = await import("@/app/api/facilities/route");
const { GET: getCalendarRoute, PUT: putCalendar } = await import("@/app/api/calendars/route");
const { GET: getContent } = await import("@/app/api/content/route");

const json = (method: string, url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (url: string) => new Request(`http://localhost${url}`);
const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
const signedOut = () => getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
const body = async (response: Response) => (await response.json()) as Record<string, any>;

const CONTENT_ID = "5eed0000-0000-4000-8000-000000000001";
const calendarData = () => ({
  schema_version: 1,
  month: "2026-10",
  groups: [{ id: "g1", name: "Garden Room", acuity: 2, size: 8 }],
  slots: [{ id: "s1", date: "2026-10-05", time: "10:00", group_id: "g1", content_item_id: CONTENT_ID, locked: false, note: "" }],
});

beforeEach(() => {
  vi.resetAllMocks();
  signedIn();
});

describe("every route needs a signed-in user", () => {
  it.each([
    ["POST /api/facilities", () => postFacility(json("POST", "/api/facilities", { facility_name: "Maple" }))],
    ["GET /api/calendars", () => getCalendarRoute(get("/api/calendars?month=2026-10"))],
    ["PUT /api/calendars", () => putCalendar(json("PUT", "/api/calendars", { month: "2026-10", data: calendarData() }))],
    ["GET /api/content", () => getContent(get("/api/content"))],
  ])("%s answers 401 with no session, and touches no data", async (_name, call) => {
    signedOut();
    const response = await call();
    expect(response.status).toBe(401);
    expect((await body(response)).error.code).toBe("unauthenticated");
    for (const fn of [createFacility, getMembership, getCalendar, saveCalendar, listContent]) expect(fn).not.toHaveBeenCalled();
  });
});

describe("POST /api/facilities", () => {
  it("creates the facility and returns its id", async () => {
    createFacility.mockResolvedValue("f-1");
    const response = await postFacility(json("POST", "/api/facilities", { facility_name: "  Maple Court  " }));
    expect(response.status).toBe(201);
    expect(await body(response)).toEqual({ facility_id: "f-1" });
    expect(createFacility).toHaveBeenCalledWith(expect.anything(), "Maple Court"); // trimmed
  });

  it.each([{}, { facility_name: "" }, { facility_name: "   " }, { facility_name: 7 }, { facility_name: "x".repeat(121) }, null])(
    "refuses %j with 422",
    async (input) => {
      const response = await postFacility(json("POST", "/api/facilities", input));
      expect(response.status).toBe(422);
      expect(createFacility).not.toHaveBeenCalled();
    },
  );

  it("requires JSON, so a forged form post cannot ride on the user's cookies", async () => {
    const forged = new Request("http://localhost/api/facilities", { method: "POST", headers: { "content-type": "text/plain" }, body: '{"facility_name":"x"}' });
    expect((await postFacility(forged)).status).toBe(415);
    const form = new Request("http://localhost/api/facilities", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "facility_name=x" });
    expect((await postFacility(form)).status).toBe(415);
    expect(createFacility).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const broken = new Request("http://localhost/api/facilities", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
    expect((await postFacility(broken)).status).toBe(400);
  });

  it("passes the database's reasons on: already a member is a 409", async () => {
    createFacility.mockRejectedValue(new DataError(409, "already_member", "This account already belongs to a facility."));
    const response = await postFacility(json("POST", "/api/facilities", { facility_name: "Maple" }));
    expect(response.status).toBe(409);
    expect((await body(response)).error.code).toBe("already_member");
  });

  it("answers a plain 500 for anything unexpected, without its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createFacility.mockRejectedValue(new Error('duplicate key value violates ... Failing row contains (Margaret)'));
    const response = await postFacility(json("POST", "/api/facilities", { facility_name: "Maple" }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await body(response))).not.toMatch(/Margaret|Failing row/);
  });
});

describe("GET /api/calendars", () => {
  it.each(["", "?month=", "?month=2026-13", "?month=26-10", "?month=2026-10-01"])("refuses the query %j with 422", async (query) => {
    const response = await getCalendarRoute(get(`/api/calendars${query}`));
    expect(response.status).toBe(422);
    expect(getCalendar).not.toHaveBeenCalled();
  });

  it("answers 404 when the month has no calendar", async () => {
    getCalendar.mockResolvedValue(null);
    expect((await getCalendarRoute(get("/api/calendars?month=2026-10"))).status).toBe(404);
  });

  it("returns the calendar", async () => {
    getCalendar.mockResolvedValue({ id: "c1", month_year: "2026-10" });
    const response = await getCalendarRoute(get("/api/calendars?month=2026-10"));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ calendar: { id: "c1", month_year: "2026-10" } });
    expect(getCalendar).toHaveBeenCalledWith(expect.anything(), "2026-10");
  });
});

describe("PUT /api/calendars", () => {
  it("saves the calendar into the caller's own facility, as found from their membership", async () => {
    getMembership.mockResolvedValue({ id: "user-1", facility_id: "facility-of-user-1", role: "staff" });
    saveCalendar.mockImplementation(async (_db, input) => ({ id: "c1", ...input }));

    const response = await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", data: calendarData() }));
    expect(response.status).toBe(200);
    expect(getMembership).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(saveCalendar).toHaveBeenCalledWith(expect.anything(), {
      facility_id: "facility-of-user-1",
      month_year: "2026-10",
      generated_data: calendarData(),
    });
  });

  it("ignores a facility the caller names: the facility always comes from their membership", async () => {
    getMembership.mockResolvedValue({ id: "user-1", facility_id: "facility-of-user-1", role: "staff" });
    saveCalendar.mockImplementation(async (_db, input) => ({ id: "c1", ...input }));
    await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", facility_id: "someone-elses", data: { ...calendarData(), facility_id: "someone-elses" } }));
    // The extra field inside the data is refused by the strict schema; the one beside it is dropped.
    expect(saveCalendar).not.toHaveBeenCalled();

    await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", facility_id: "someone-elses", data: calendarData() }));
    expect(saveCalendar.mock.calls[0]?.[1].facility_id).toBe("facility-of-user-1");
  });

  it("refuses resident-looking data with 422 phi_keys, before it reaches the database", async () => {
    const data = { ...calendarData(), groups: [{ id: "g1", name: "Garden Room", acuity: 2, size: 8, residents: ["Margaret"] }] };
    const response = await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", data }));
    expect(response.status).toBe(422);
    const payload = await body(response);
    expect(payload.error.code).toBe("phi_keys");
    expect(payload.error.issues).toEqual([{ path: "residents", message: "Looks like resident or health information." }]);
    expect(JSON.stringify(payload)).not.toMatch(/Margaret/);
    expect(getMembership).not.toHaveBeenCalled();
    expect(saveCalendar).not.toHaveBeenCalled();
  });

  it.each([
    ["no month", { data: calendarData() }],
    ["no data", { month: "2026-10" }],
    ["a bad month", { month: "2026-13", data: calendarData() }],
    ["data for another month", { month: "2026-11", data: calendarData() }],
    ["data that is not a calendar", { month: "2026-10", data: { hello: "world" } }],
  ])("refuses %s with 422", async (_label, input) => {
    const response = await putCalendar(json("PUT", "/api/calendars", input));
    expect(response.status).toBe(422);
    expect(saveCalendar).not.toHaveBeenCalled();
  });

  it("answers 403 for a signed-in user who belongs to no facility", async () => {
    getMembership.mockResolvedValue(null);
    const response = await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", data: calendarData() }));
    expect(response.status).toBe(403);
    expect((await body(response)).error.code).toBe("no_facility");
    expect(saveCalendar).not.toHaveBeenCalled();
  });

  it("passes on the database's refusal, such as the guard or the size limit", async () => {
    getMembership.mockResolvedValue({ id: "user-1", facility_id: "f1", role: "staff" });
    saveCalendar.mockRejectedValue(new DataError(413, "too_large", "This calendar is too large."));
    expect((await putCalendar(json("PUT", "/api/calendars", { month: "2026-10", data: calendarData() }))).status).toBe(413);
  });

  it("requires JSON", async () => {
    const forged = new Request("http://localhost/api/calendars", { method: "PUT", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await putCalendar(forged)).status).toBe(415);
  });
});

describe("GET /api/content", () => {
  it("lists the library, passing the filters through", async () => {
    listContent.mockResolvedValue([{ id: "k1" }]);
    const response = await getContent(get("/api/content?stage=early&category=music"));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ items: [{ id: "k1" }] });
    expect(listContent).toHaveBeenCalledWith(expect.anything(), { stage: "early", category: "music" });
  });

  it("works with no filters", async () => {
    listContent.mockResolvedValue([]);
    expect((await getContent(get("/api/content"))).status).toBe(200);
    expect(listContent).toHaveBeenCalledWith(expect.anything(), {});
  });

  it.each(["?stage=severe", "?stage=", "?category=Not A Slug", "?category=a--b"])("refuses %j with 422", async (query) => {
    expect((await getContent(get(`/api/content${query}`))).status).toBe(422);
    expect(listContent).not.toHaveBeenCalled();
  });
});
