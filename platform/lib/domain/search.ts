/**
 * Turn what someone typed into search into the words to look for: lower case, letters
 * and digits only, the first few. "Radio  shows!" gives ["radio", "shows"]. Nothing the
 * person types is ever put into a database query or a pattern.
 */
export function searchWords(query: string | undefined | null): string[] {
  if (!query) return [];
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
    .slice(0, 8);
}
