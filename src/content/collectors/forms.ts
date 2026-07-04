// form controls collector — see 03-collectors.md § formControls.

import { accessibleName, associatedLabelText, isVisible } from './shared';
import type { FormControlNode } from '../../core/types';

export function collectFormControls(): FormControlNode[] {
  return Array.from(
    document.querySelectorAll('input:not([type="hidden"]), select, textarea'),
  )
    .filter(isVisible)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      hasLabel: associatedLabelText(el) !== '',
      accessibleName: accessibleName(el),
    }));
}
