/* Netlify Function: POST /api/licenses/webhook (see ../src/handlers.mjs). */
import { handleWebhook } from "../src/handlers.mjs";
export default async (request) => handleWebhook(request, process.env);
export const config = { path: "/api/licenses/webhook" };
