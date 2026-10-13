/* Cloudflare Workers entry (the same service, if it is hosted there instead of on Netlify). */
import { route } from "./src/handlers.mjs";
export default { fetch: (request, env) => route(request, env) };
