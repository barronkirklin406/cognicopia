// Next.js swaps the real "server-only" package for an empty module when it builds server code, and the
// real one throws if it is ever loaded elsewhere. Tests run on the server, so they get the empty one.
export {};
