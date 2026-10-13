/* Netlify Function: GET /api/licenses/health (see ../src/handlers.mjs). */
import { handleHealth } from "../src/handlers.mjs";
export default async () => handleHealth(process.env);
export const config = { path: "/api/licenses/health" };
