// Shared collector helpers — see 03-collectors.md. Content-side (uses the live DOM).
// Every function here is deterministic so text measurements are stable across runs.

export function normalizeText(input: string | null | undefined): string {
  if (input == null) return '';
  return input.replace(/\s+/g, ' ').trim();
}

export function isVisible(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return true;
}

export function getMainRegion(): Element {
  return (
    document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body
  );
}

// Step 3 of the accessible-name order, exposed separately because forms.ts reuses it for
// `hasLabel`: the associated <label> text for a form control.
export function associatedLabelText(el: Element): string {
  const id = el.id; // IDL attribute; '' when absent
  if (id) {
    let forLabel: Element | null = null;
    try {
      forLabel = document.querySelector(`label[for="${id}"]`);
    } catch {
      // Pathological id containing selector-special characters would throw; fall through to
      // the ancestor <label>. This keeps collection from crashing without changing matches
      // for normal ids.
      forLabel = null;
    }
    if (forLabel) {
      const t = normalizeText(forLabel.textContent);
      if (t) return t;
    }
  }
  const ancestor = el.closest('label');
  if (ancestor) return normalizeText(ancestor.textContent);
  return '';
}

function singleImgAlt(el: Element): string {
  let img: HTMLImageElement | null = null;
  if (el.tagName.toLowerCase() === 'img') {
    img = el as HTMLImageElement;
  } else {
    const imgs = el.querySelectorAll('img');
    if (imgs.length === 1) img = imgs[0] as HTMLImageElement;
  }
  if (!img) return '';
  return normalizeText(img.getAttribute('alt'));
}

// Simplified, deterministic accessible name (03-collectors.md). Intentionally NOT the full
// ARIA accname algorithm — do not extend it. Returns the first non-empty result in order.
export function accessibleName(el: Element): string {
  // 1. aria-label
  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  // 2. aria-labelledby
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const text = labelledby
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    const normalized = normalizeText(text);
    if (normalized) return normalized;
  }

  // 3. associated <label> text (form controls only)
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const labelText = associatedLabelText(el);
    if (labelText) return labelText;
  }

  // 4. single <img> alt
  const imgAlt = singleImgAlt(el);
  if (imgAlt) return imgAlt;

  // 5. textContent
  const text = normalizeText(el.textContent);
  if (text) return text;

  // 6. title
  const title = normalizeText(el.getAttribute('title'));
  if (title) return title;

  // 7. empty
  return '';
}
