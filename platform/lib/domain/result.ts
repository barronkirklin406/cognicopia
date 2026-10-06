/** The outcome of validating untrusted input: the clean value, or why not. */

export interface Issue {
  /** Where in the input, as a dotted path ("slots.3.date"); empty for the whole input. */
  path: string;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** "phi_keys": a field that looks like resident or health data. "invalid": anything else. */
      code: "phi_keys" | "invalid";
      message: string;
      issues: Issue[];
    };

export const invalid = (message: string, issues: Issue[] = []): ParseResult<never> => ({
  ok: false,
  code: "invalid",
  message,
  issues,
});
