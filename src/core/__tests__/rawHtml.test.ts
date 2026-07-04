// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseRawHtml } from '../rawHtml';

describe('parseRawHtml', () => {
  it('returns unavailable zeros when html is null', () => {
    expect(parseRawHtml(null, new DOMParser())).toEqual({
      available: false,
      mainTextLength: 0,
      bodyTextLength: 0,
    });
  });

  it('measures <main> and <body> normalized text lengths for full HTML', () => {
    const html =
      '<!doctype html><html><body><nav>Nav</nav><main>Main content</main></body></html>';
    const res = parseRawHtml(html, new DOMParser());
    expect(res.available).toBe(true);
    // main region = <main> only
    expect(res.mainTextLength).toBe('Main content'.length); // 12
    // body = nav + main text, concatenated (no inter-element whitespace in the fixture)
    expect(res.bodyTextLength).toBe('NavMain content'.length); // 15
  });

  it('falls back to <body> for mainTextLength when there is no <main>', () => {
    const html = '<!doctype html><html><body><div>Only body text</div></body></html>';
    const res = parseRawHtml(html, new DOMParser());
    expect(res.available).toBe(true);
    expect(res.mainTextLength).toBe('Only body text'.length); // 14
    expect(res.bodyTextLength).toBe('Only body text'.length); // 14
  });
});
