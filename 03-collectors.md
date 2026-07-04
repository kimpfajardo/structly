# 03 — Collectors

Collectors run in the content script and produce the rendered portion of `PageSnapshot`. Every
algorithm below is deterministic. Implement them exactly. Shared helpers live in
`src/content/collectors/`.

## Shared helpers

### `normalizeText(input: string | null | undefined): string`
Return `''` for null/undefined. Otherwise collapse all runs of whitespace (`\s+`) to a single
space and trim. Used for every text measurement so lengths are stable.

### `isVisible(el: Element): boolean`
```
const s = getComputedStyle(el);
if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
const r = el.getBoundingClientRect();
if (r.width === 0 && r.height === 0) return false;
return true;
```

### `getMainRegion(): Element`
`document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body`

### `accessibleName(el: Element): string`
Simplified, deterministic. Return the first non-empty result in this order:
1. `el.getAttribute('aria-label')` → `normalizeText`.
2. `aria-labelledby`: split on whitespace, for each id resolve `document.getElementById(id)`,
   concatenate their `textContent` with a space, `normalizeText`.
3. If `el` is a form control (`input`/`select`/`textarea`): its associated label text —
   `document.querySelector('label[for="' + el.id + '"]')` (when `el.id` is present) or the
   closest ancestor `label`. `normalizeText` of that label's `textContent`.
4. If `el` is or contains a single `img`: that img's `alt` attribute → `normalizeText`.
5. `normalizeText(el.textContent)`.
6. `el.getAttribute('title')` → `normalizeText`.
7. `''`.

This intentionally does not implement the full ARIA accname algorithm. Do not extend it.

## Field collectors

### `meta` (PageMeta)
- `title`: `normalizeText(document.title)`; if empty → `null`.
- `metaDescription`: `meta[name="description"]` content, `normalizeText`; empty → `null`.
- `canonical`: first `link[rel="canonical"]` `href` (absolute, via `.href`); none → `null`.
- `canonicalCount`: count of `link[rel="canonical"]`.
- `robots`: `meta[name="robots"]` content, lowercased + trimmed; none → `null`.
- `lang`: `document.documentElement.getAttribute('lang')`, trimmed; empty → `null`.
- `viewport`: `meta[name="viewport"]` content, trimmed; none → `null`.

### `headings` (HeadingNode[]) and `h1Count`
- Select `h1,h2,h3,h4,h5,h6`, keep only `isVisible`, in document order.
- Each → `{ level: <n from tagName>, text: normalizeText(el.textContent) }`.
- `h1Count` = number of collected headings with `level === 1`.

### `landmarks` (Landmarks)
- `hasMain`: `!!document.querySelector('main, [role="main"]')`.
- `mainCount`: count of `main, [role="main"]`.
- `hasNav`: `!!document.querySelector('nav, [role="navigation"]')`.
- `hasHeader`: `!!document.querySelector('header, [role="banner"]')`.
- `hasFooter`: `!!document.querySelector('footer, [role="contentinfo"]')`.

### `links` (LinkNode[])
- Select `a[href]`, keep only `isVisible`.
- Each → `{ text: normalizeText(el.textContent), accessibleName: accessibleName(el), href: el.href }`.

### `buttons` (ButtonNode[])
- Select `button, [role="button"], input[type="button"], input[type="submit"]`, keep `isVisible`.
- `text = normalizeText(el.textContent)` (for `input`, use `el.value` when textContent is empty).
- `isIconOnly = text === ''`.
- `accessibleName = accessibleName(el)`.

### `formControls` (FormControlNode[])
- Select `input:not([type="hidden"]), select, textarea`, keep `isVisible`.
- `tag = el.tagName.toLowerCase()`.
- `type = el.getAttribute('type')` (null for select/textarea).
- `hasLabel`: true if step 3 of `accessibleName` (associated `<label>`) yields non-empty text.
- `accessibleName = accessibleName(el)`.

### `primaryCta`
- Candidates: within `getMainRegion()`, select `button, a[role="button"]`.
- Exclude any candidate where `el.closest('nav, header, footer')` is non-null.
- Keep only `isVisible`. Take the **first** in document order.
- If found → `{ text: normalizeText(el.textContent), accessibleName: accessibleName(el) }`,
  else `null`. Plain `<a>` without `role="button"` is intentionally excluded to avoid nav links.

### `jsonLd` (JsonLdBlock[])
- Select `script[type="application/ld+json"]`.
- For each: `raw = el.textContent ?? ''`.
- Try `JSON.parse(raw)`:
  - Success → `valid = true`, `parsed = value`, `types = extractTypes(value)`.
  - Failure → `valid = false`, `parsed = null`, `types = []`.
- `extractTypes(value)`: collect all `@type` values found at the top level and within an
  `@graph` array (if present). `@type` may be a string or array of strings. Flatten to a
  unique string array. Ignore nested non-graph objects (top level + `@graph` only).

### `rendered` (RenderedMetrics)
- `mainTextLength = normalizeText(getMainRegion().textContent).length`.
- `bodyTextLength = normalizeText(document.body.textContent).length`.
- `hasSkeletonMarkers`: iterate descendants of `getMainRegion()`; true if any element has
  `getAttribute('aria-busy') === 'true'` OR its `className` (string form) matches
  `/(skeleton|placeholder|shimmer|loading)/i`. Stop at first match.
- `frameworkMarkers`: build from these DOM checks, include the marker string when its selector
  matches (unique, in this order):
  - `#__next` → `'next'`
  - `#__nuxt, [data-nuxt]` → `'nuxt'`
  - `astro-island` → `'astro'`
  - `[data-reactroot], #root, #app` → `'react'`

### `topContentText`
`normalizeText(getMainRegion().textContent).slice(0, 800)`.

### `raw` (RawHtmlMetrics) — panel-side
Not collected in the content script. Defaulted to `{ available: false, mainTextLength: 0, bodyTextLength: 0 }`
by the content script, then finalized by the panel via:

`parseRawHtml(html: string | null, parser: DOMParser): RawHtmlMetrics` in `src/core/rawHtml.ts`:
```
if (html === null) return { available: false, mainTextLength: 0, bodyTextLength: 0 };
const doc = parser.parseFromString(html, 'text/html');
const main = doc.querySelector('main') ?? doc.querySelector('[role="main"]') ?? doc.body;
return {
  available: true,
  mainTextLength: normalizeText(main?.textContent).length,
  bodyTextLength: normalizeText(doc.body?.textContent).length,
};
```
`parseRawHtml` takes the parser as a parameter so it is testable in Node (jsdom) and reused in
the panel with `new DOMParser()`.

## Assembly
The content script assembles all fields into a `PageSnapshot` with:
- `schemaVersion: 1`
- `capturedAt: new Date().toISOString()`
- `url: location.href`
- `pageType: 'unknown'`
- `raw: { available: false, mainTextLength: 0, bodyTextLength: 0 }`
and returns it via `sendResponse`.
