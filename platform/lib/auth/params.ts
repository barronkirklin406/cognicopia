/** A query-string value as Next.js hands it over (a string, a list of them when repeated, or nothing): the first string, or undefined. */
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
