// links collector — see 03-collectors.md § links.

import { normalizeText, isVisible, accessibleName } from './shared';
import type { LinkNode } from '../../core/types';

export function collectLinks(): LinkNode[] {
  return Array.from(document.querySelectorAll('a[href]'))
    .filter(isVisible)
    .map((el) => ({
      text: normalizeText(el.textContent),
      accessibleName: accessibleName(el),
      href: (el as HTMLAnchorElement).href,
    }));
}
