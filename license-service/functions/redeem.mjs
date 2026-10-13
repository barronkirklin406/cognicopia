/* Netlify Function: POST /api/licenses/redeem (see ../src/handlers.mjs). */
import { handleRedeem } from "../src/handlers.mjs";
export default async (request) => handleRedeem(request, process.env);
export const config = { path: "/api/licenses/redeem" };
