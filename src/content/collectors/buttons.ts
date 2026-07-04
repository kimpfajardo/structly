// buttons collector — see 03-collectors.md § buttons.

import { normalizeText, isVisible, accessibleName } from './shared';
import type { ButtonNode } from '../../core/types';

export function collectButtons(): ButtonNode[] {
  return Array.from(
    document.querySelectorAll(
      'button, [role="button"], input[type="button"], input[type="submit"]',
    ),
  )
    .filter(isVisible)
    .map((el) => {
      let text = normalizeText(el.textContent);
      if (text === '' && el.tagName.toLowerCase() === 'input') {
        text = normalizeText((el as HTMLInputElement).value);
      }
      return {
        text,
        accessibleName: accessibleName(el),
        isIconOnly: text === '',
      };
    });
}
