// Pure text normalization for src/core (rawHtml + rules). Mirrors the collector helper in
// src/content/collectors/shared.ts; kept here so src/core has no dependency on the content/
// DOM layer. Identical logic so text measurements stay deterministic across both sides.
export function normalizeText(input: string | null | undefined): string {
  if (input == null) return '';
  return input.replace(/\s+/g, ' ').trim();
}
