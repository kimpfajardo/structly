// Raw-HTML metrics — see 03-collectors.md § raw. Panel-side, but pure and Node-testable:
// the DOMParser is injected so this runs under jsdom in tests and with a real DOMParser in
// the panel. No chrome.* and no reliance on a browser global.

import type { RawHtmlMetrics } from './types';
import { normalizeText } from './text';

export function parseRawHtml(html: string | null, parser: DOMParser): RawHtmlMetrics {
  if (html === null) return { available: false, mainTextLength: 0, bodyTextLength: 0 };
  const doc = parser.parseFromString(html, 'text/html');
  const main = doc.querySelector('main') ?? doc.querySelector('[role="main"]') ?? doc.body;
  return {
    available: true,
    mainTextLength: normalizeText(main?.textContent).length,
    bodyTextLength: normalizeText(doc.body?.textContent).length,
  };
}
