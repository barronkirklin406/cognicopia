import { z } from "zod";

/**
 * Imported first by every module that builds a schema. In the browser, zod 4 would otherwise test whether
 * the page may build code from text (`new Function`) to speed up parsing; under this site's
 * Content-Security-Policy (no 'unsafe-eval') that test is refused, and the browser reports each refusal as a
 * policy violation even though zod copes. Parsing without it is slightly slower and the browser only checks a
 * form's shape, so nothing is lost. On the server the speed-up stays.
 */
if (typeof window !== "undefined") z.config({ jitless: true });
