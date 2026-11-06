/**
 * The password length limits, on their own so a form can show them without pulling the schemas (and zod)
 * into the browser. The rules themselves are in lib/domain/auth.ts and run on the server.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 72;
