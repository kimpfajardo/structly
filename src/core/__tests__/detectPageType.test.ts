import { describe, expect, it } from 'vitest';
import { detectPageType } from '../detectPageType';
import { makeSnapshot } from '../../__fixtures__/makeSnapshot';
import type { JsonLdBlock, FormControlNode } from '../types';

function jsonLd(types: string[]): JsonLdBlock[] {
  return [{ raw: '', valid: true, parsed: null, types }];
}

function passwordField(): FormControlNode[] {
  return [{ tag: 'input', type: 'password', hasLabel: true, accessibleName: 'Password' }];
}

// A URL with no path signal, so URL-based branches never fire on their own.
const NEUTRAL_URL = 'https://example.com/xyz';

describe('detectPageType', () => {
  it('classifies Product JSON-LD as product', () => {
    expect(detectPageType(makeSnapshot({ url: NEUTRAL_URL, jsonLd: jsonLd(['Product']), formControls: [] }))).toBe(
      'product',
    );
  });

  it('classifies Article-family JSON-LD as article', () => {
    for (const t of ['Article', 'NewsArticle', 'BlogPosting']) {
      expect(
        detectPageType(makeSnapshot({ url: NEUTRAL_URL, jsonLd: jsonLd([t]), formControls: [] })),
      ).toBe('article');
    }
  });

  it('classifies a page with a password field as account', () => {
    expect(
      detectPageType(makeSnapshot({ url: NEUTRAL_URL, jsonLd: [], formControls: passwordField() })),
    ).toBe('account');
  });

  it('classifies docs/blog/product/account/marketing URL conventions', () => {
    const cases: Array<[string, string]> = [
      ['https://example.com/docs/getting-started', 'docs'],
      ['https://example.com/reference/api', 'docs'],
      ['https://example.com/blog/hello-world', 'article'],
      ['https://example.com/news/2026/story', 'article'],
      ['https://example.com/products/widget-123', 'product'],
      ['https://shop.example.com/store', 'product'],
      ['https://example.com/login', 'account'],
      ['https://example.com/account/settings', 'account'],
      ['https://example.com/sign-up', 'account'],
      ['https://example.com/pricing', 'marketing'],
      ['https://example.com/features', 'marketing'],
    ];
    for (const [url, expected] of cases) {
      expect(detectPageType(makeSnapshot({ url, jsonLd: [], formControls: [] }))).toBe(expected);
    }
  });

  it('returns unknown when no signal is present, including a bare host root', () => {
    expect(detectPageType(makeSnapshot({ url: NEUTRAL_URL, jsonLd: [], formControls: [] }))).toBe('unknown');
    expect(detectPageType(makeSnapshot({ url: 'https://example.com/', jsonLd: [], formControls: [] }))).toBe(
      'unknown',
    );
  });

  it('returns unknown for an unparseable URL with no other signal', () => {
    expect(detectPageType(makeSnapshot({ url: 'not-a-url', jsonLd: [], formControls: [] }))).toBe('unknown');
  });

  it('prefers JSON-LD over conflicting URL and form signals', () => {
    // Product schema on a /blog URL with a password field still resolves to product.
    expect(
      detectPageType(
        makeSnapshot({
          url: 'https://example.com/blog/post',
          jsonLd: jsonLd(['Product']),
          formControls: passwordField(),
        }),
      ),
    ).toBe('product');
  });

  it('prefers a password field over a conflicting product URL', () => {
    expect(
      detectPageType(
        makeSnapshot({
          url: 'https://example.com/products/widget',
          jsonLd: [],
          formControls: passwordField(),
        }),
      ),
    ).toBe('account');
  });

  it('ignores an unrecognized JSON-LD @type and falls through to URL', () => {
    expect(
      detectPageType(
        makeSnapshot({ url: 'https://example.com/docs/x', jsonLd: jsonLd(['Organization']), formControls: [] }),
      ),
    ).toBe('docs');
  });
});
