import { describe, expect, it } from 'vitest';
import { extractTypes } from '../jsonld';

describe('extractTypes', () => {
  it('extracts unique types from a top-level JSON-LD array', () => {
    expect(
      extractTypes([
        { '@type': 'Product' },
        { '@type': ['Article', 'Product', null] },
        { nested: { '@type': 'FAQPage' } },
        null,
      ]),
    ).toEqual(['Product', 'Article']);
  });
});
