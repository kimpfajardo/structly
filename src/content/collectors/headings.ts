// headings collector — see 03-collectors.md § headings.

import { normalizeText, isVisible } from './shared';
import type { HeadingNode } from '../../core/types';

export function collectHeadings(): HeadingNode[] {
  return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .filter(isVisible)
    .map((el) => ({
      level: Number(el.tagName.charAt(1)) as HeadingNode['level'],
      text: normalizeText(el.textContent),
    }));
}
