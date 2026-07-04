// JSON-LD collector — see 03-collectors.md § jsonLd.

import type { JsonLdBlock } from '../../core/types';

export function collectJsonLd(): JsonLdBlock[] {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((el) => {
    const raw = el.textContent ?? '';
    try {
      const parsed: unknown = JSON.parse(raw);
      return { raw, valid: true, parsed, types: extractTypes(parsed) };
    } catch {
      return { raw, valid: false, parsed: null, types: [] };
    }
  });
}

// Collect @type values at the top level and within an @graph array (if present). @type may be
// a string or an array of strings. Flatten to a unique string array. Top level + @graph only;
// nested non-graph objects are ignored.
export function extractTypes(value: unknown): string[] {
  const types: string[] = [];

  const addTypeOf = (node: unknown): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const t = (node as Record<string, unknown>)['@type'];
    if (typeof t === 'string') {
      types.push(t);
    } else if (Array.isArray(t)) {
      for (const item of t) if (typeof item === 'string') types.push(item);
    }
  };

  addTypeOf(value);

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const graph = (value as Record<string, unknown>)['@graph'];
    if (Array.isArray(graph)) for (const node of graph) addTypeOf(node);
  }

  return Array.from(new Set(types));
}
