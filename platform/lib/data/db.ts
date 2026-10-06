import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * The typed database client the data functions take. Pass the signed-in user's
 * client (lib/supabase/server.ts) so row level security applies. The data
 * functions never pick a client themselves, which keeps them easy to test and
 * keeps "who is asking" a decision made at the edge, in the route.
 */
export type Db = SupabaseClient<Database>;
