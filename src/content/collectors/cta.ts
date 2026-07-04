// primary CTA collector — see 03-collectors.md § primaryCta.

import { normalizeText, isVisible, getMainRegion, accessibleName } from './shared';
import type { PageSnapshot } from '../../core/types';

export function collectPrimaryCta(): PageSnapshot['primaryCta'] {
  const candidates = Array.from(getMainRegion().querySelectorAll('button, a[role="button"]'));
  for (const el of candidates) {
    if (el.closest('nav, header, footer')) continue;
    if (!isVisible(el)) continue;
    return { text: normalizeText(el.textContent), accessibleName: accessibleName(el) };
  }
  return null;
}
