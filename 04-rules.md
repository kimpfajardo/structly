# 04 — Rules

24 rules across 6 categories. Each rule is a pure function `(snapshot) => AuditIssue | null`.
Group rules by category into `src/core/rules/<category>.ts` and export a flat registry
`ALL_RULES: Rule[]` from `src/core/rules/index.ts` in the order listed here.

**Every field below is literal.** `id`, `category`, `severity`, `status`, `title`,
`whyItMatters`, `recommendedFix`, and `selectors` must be produced exactly as written. Evidence
strings follow the given templates; substitute the bracketed values from the snapshot.

`scoreImpact` is set to `0` by rules and overwritten by scoring (`05`).

## Shared constants (put in `src/core/rules/constants.ts`)

```ts
// Case-insensitive exact-match list for vague CTA / link text.
// Compare against normalizeText(...).toLowerCase().
export const VAGUE_TEXT = [
  'learn more',
  'click here',
  'read more',
  'more',
  'here',
  'submit',
  'continue',
];

// JSON-LD @type values recognized as "known".
export const KNOWN_SCHEMA_TYPES = [
  'Product', 'Article', 'NewsArticle', 'BlogPosting', 'FAQPage', 'QAPage',
  'BreadcrumbList', 'Organization', 'WebSite', 'WebPage', 'HowTo', 'Recipe',
  'Event', 'Review', 'VideoObject', 'Person',
];

// Page types for which a primary CTA is expected.
export const CTA_EXPECTED_TYPES = ['marketing', 'product', 'account'];

// Page types for which a top-of-page summary is expected.
export const SUMMARY_EXPECTED_TYPES = ['marketing', 'product', 'docs', 'article'];

// Page types for which structured data absence is upgraded from info to warn.
export const SCHEMA_EXPECTED_TYPES = ['product', 'article'];
```

---

## Category: metadata (`metadata`)

### `meta.missing-title`
- Trigger: `meta.title === null`.
- severity `high`, status `fail`.
- title: `"Missing document title"`.
- whyItMatters: `"The title is the primary label for the page in search results, browser tabs, and agent context."`
- evidence: `["No <title> element or the title is empty."]`
- recommendedFix: `"Add a descriptive <title> that states the page's purpose."`
- selectors: `["head > title"]`

### `meta.title-length`
- Trigger: `meta.title !== null` AND (`meta.title.length < 10` OR `meta.title.length > 70`).
- severity `low`, status `warn`.
- title: `"Title length outside recommended range"`.
- whyItMatters: `"Very short titles under-describe the page; very long titles get truncated in results."`
- evidence: `["Title length is [meta.title.length] characters (recommended 10-70)."]`
- recommendedFix: `"Rewrite the title to be between 10 and 70 characters."`
- selectors: `["head > title"]`

### `meta.missing-description`
- Trigger: `meta.metaDescription === null`.
- severity `medium`, status `warn`.
- title: `"Missing meta description"`.
- whyItMatters: `"The meta description often becomes the results snippet and helps systems summarize the page."`
- evidence: `["No <meta name=\"description\"> with content was found."]`
- recommendedFix: `"Add a concise meta description summarizing the page."`
- selectors: `["meta[name=\"description\"]"]`

### `meta.missing-canonical`
- Trigger: `meta.canonicalCount === 0`.
- severity `medium`, status `warn`.
- title: `"Missing canonical link"`.
- whyItMatters: `"A canonical link tells systems which URL is the preferred version of the page."`
- evidence: `["No <link rel=\"canonical\"> found."]`
- recommendedFix: `"Add a canonical URL for the preferred version of this page."`
- selectors: `["link[rel=\"canonical\"]"]`

### `meta.multiple-canonical`
- Trigger: `meta.canonicalCount > 1`.
- severity `high`, status `fail`.
- title: `"Multiple canonical links"`.
- whyItMatters: `"Conflicting canonical links are ambiguous and may be ignored, harming indexing."`
- evidence: `["[meta.canonicalCount] canonical links found; there should be exactly one."]`
- recommendedFix: `"Keep a single canonical link and remove the others."`
- selectors: `["link[rel=\"canonical\"]"]`

### `meta.missing-lang`
- Trigger: `meta.lang === null`.
- severity `medium`, status `fail`.
- title: `"Missing html lang attribute"`.
- whyItMatters: `"The lang attribute helps assistive tech and systems interpret the page's language."`
- evidence: `["<html> has no lang attribute."]`
- recommendedFix: `"Add a lang attribute to the <html> element, e.g. lang=\"en\"."`
- selectors: `["html"]`

### `meta.robots-noindex`
- Trigger: `meta.robots !== null` AND `meta.robots.includes('noindex')`.
- severity `high`, status `warn`.
- title: `"Page is set to noindex"`.
- whyItMatters: `"noindex removes the page from search indexes. This may be intentional; confirm it is."`
- evidence: `["meta robots content is \"[meta.robots]\"."]`
- recommendedFix: `"If this page should be discoverable, remove noindex from the robots directive."`
- selectors: `["meta[name=\"robots\"]"]`

### `meta.missing-viewport`
- Trigger: `meta.viewport === null`.
- severity `low`, status `warn`.
- title: `"Missing viewport meta tag"`.
- whyItMatters: `"The viewport tag is required for correct mobile rendering, which affects usability signals."`
- evidence: `["No <meta name=\"viewport\"> found."]`
- recommendedFix: `"Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">."`
- selectors: `["meta[name=\"viewport\"]"]`

---

## Category: content (`content`)

### `content.missing-h1`
- Trigger: `h1Count === 0`.
- severity `high`, status `fail`.
- title: `"No H1 heading"`.
- whyItMatters: `"The H1 states the page's main topic for users and systems."`
- evidence: `["No visible <h1> element found."]`
- recommendedFix: `"Add a single, descriptive H1 as the page's main heading."`
- selectors: `["h1"]`

### `content.multiple-h1`
- Trigger: `h1Count > 1`.
- severity `medium`, status `warn`.
- title: `"Multiple H1 headings"`.
- whyItMatters: `"Multiple H1s dilute the page's primary topic signal."`
- evidence: `["[h1Count] visible <h1> elements found; keep one primary heading."]`
- recommendedFix: `"Keep one H1 and demote the others to H2 or lower."`
- selectors: `["h1"]`

### `content.heading-skip`
- Trigger: scanning `headings` in order, any consecutive pair where `next.level - prev.level > 1`
  (e.g., H1 then H3). Fires once if at least one skip exists.
- severity `medium`, status `warn`.
- title: `"Heading levels skip a level"`.
- whyItMatters: `"Skipped heading levels break the document outline that agents and screen readers rely on."`
- evidence: one entry per skip: `"H[prev.level] is followed by H[next.level] (\"[next.text truncated to 60 chars]\")."`
- recommendedFix: `"Use sequential heading levels without skipping (e.g., H2 before H3)."`
- selectors: `["h1","h2","h3","h4","h5","h6"]`

### `content.missing-summary`
- Trigger: `SUMMARY_EXPECTED_TYPES.includes(pageType)` AND `topContentText.trim().length < 120`.
- severity `medium`, status `warn`.
- title: `"No summary near the top of the main content"`.
- whyItMatters: `"A concise summary near the top helps users and retrieval systems grasp the page quickly."`
- evidence: `["Only [topContentText.trim().length] characters of text found in the top of the main content region."]`
- recommendedFix: `"Add a direct summary paragraph under the main heading."`
- selectors: `["main h1","main p"]`

---

## Category: structured-data (`structured-data`)

### `schema.no-jsonld`
- Trigger: `jsonLd.length === 0`.
- severity `low`.
- status: `'warn'` if `SCHEMA_EXPECTED_TYPES.includes(pageType)`, else `'info'`.
- title: `"No JSON-LD structured data"`.
- whyItMatters: `"Structured data is not required, but it improves machine understanding and search eligibility."`
- evidence: `["No <script type=\"application/ld+json\"> blocks found."]`
- recommendedFix: `"Add JSON-LD for the page's primary entity where a supported type applies."`
- selectors: `["script[type=\"application/ld+json\"]"]`

### `schema.invalid-jsonld`
- Trigger: `jsonLd.some(b => b.valid === false)`.
- severity `high`, status `fail`.
- title: `"Invalid JSON-LD"`.
- whyItMatters: `"Malformed JSON-LD cannot be parsed and is ignored by consuming systems."`
- evidence: one entry per invalid block: `"Block [index] failed to parse as JSON."`
- recommendedFix: `"Fix the JSON syntax so each JSON-LD block parses."`
- selectors: `["script[type=\"application/ld+json\"]"]`

### `schema.unrecognized-type`
- Trigger: there exists at least one valid block whose `types` is empty, OR whose types contain
  no value present in `KNOWN_SCHEMA_TYPES`. (Only consider `valid === true` blocks.)
- severity `low`, status `info`.
- title: `"Unrecognized or missing schema @type"`.
- whyItMatters: `"A recognized @type helps systems classify the entity the page describes."`
- evidence: one entry per offending block: `"Block [index] declares types [types joined by ', ' or '(none)']."`
- recommendedFix: `"Declare a supported schema.org @type appropriate to the page."`
- selectors: `["script[type=\"application/ld+json\"]"]`

---

## Category: rendering-risk (`rendering-risk`)

### `rendering.low-initial-text`
- Trigger:
  - If `raw.available === false`: fire with status `info` (cannot verify).
  - If `raw.available === true`: fire only when `raw.mainTextLength < 200` AND `rendered.mainTextLength > 600`.
- severity `high`.
- status: `'info'` when `raw.available === false`; otherwise `'fail'`.
- title: `"Primary content appears to depend on client-side rendering"`.
- whyItMatters: `"When primary text is missing from the server HTML, systems that do not execute JavaScript may not see it."`
- evidence:
  - available: `["Server HTML main text: [raw.mainTextLength] chars; rendered main text: [rendered.mainTextLength] chars."]`
  - unavailable: `["Server HTML could not be fetched, so client-render dependence could not be verified."]`
- recommendedFix: `"Render the main summary and core content on the server where possible."`
- selectors: `["main"]`
- Note: when `raw.available === true` and the numeric condition is NOT met, return `null`.

### `rendering.skeleton-in-main`
- Trigger: `rendered.hasSkeletonMarkers === true`.
- severity `medium`, status `warn`.
- title: `"Skeleton or placeholder present in main content"`.
- whyItMatters: `"Persistent skeletons at load time suggest primary content arrives late or failed to load."`
- evidence: `["Skeleton/placeholder markers detected inside the main content region."]`
- recommendedFix: `"Ensure primary content is present without waiting on client-side data fetches."`
- selectors: `["main [aria-busy=\"true\"]","main [class*=\"skeleton\"]"]`

### `rendering.app-shell-empty-raw`
- Trigger: `raw.available === true` AND `raw.bodyTextLength < 100`.
  - If `raw.available === false`: return `null` (covered by `rendering.low-initial-text` info).
- severity `high`, status `fail`.
- title: `"Server HTML is nearly empty (app-shell pattern)"`.
- whyItMatters: `"An empty server response means all content depends on client execution, a risk for indexing and retrieval."`
- evidence: `["Server HTML body text is only [raw.bodyTextLength] characters."]`
- recommendedFix: `"Server-render meaningful content instead of shipping an empty shell."`
- selectors: `["body"]`

---

## Category: cta (`cta`)

### `cta.missing-primary`
- Trigger: `CTA_EXPECTED_TYPES.includes(pageType)` AND `primaryCta === null`.
- severity `medium`, status `warn`.
- title: `"No primary call to action detected"`.
- whyItMatters: `"Pages meant to drive action should present a clear next step for users and agents."`
- evidence: `["No primary button or role=button action found in the main content region."]`
- recommendedFix: `"Add a clear primary action button in the main content."`
- selectors: `["main button","main [role=\"button\"]"]`

### `cta.generic-primary`
- Trigger: `primaryCta !== null` AND
  `VAGUE_TEXT.includes(normalizeText(primaryCta.accessibleName).toLowerCase())`.
- severity `low`, status `warn`.
- title: `"Primary CTA uses vague label"`.
- whyItMatters: `"Vague labels like \"Learn more\" reduce clarity for users and agents about what will happen."`
- evidence: `["Primary CTA label is \"[primaryCta.accessibleName]\"."]`
- recommendedFix: `"Use an outcome-specific label such as \"Compare plans\" or \"Start free trial\"."`
- selectors: `["main button","main [role=\"button\"]"]`

---

## Category: accessibility (`accessibility`)

### `a11y.missing-main`
- Trigger: `landmarks.hasMain === false`.
- severity `medium`, status `warn`.
- title: `"No main landmark"`.
- whyItMatters: `"A main landmark lets agents and assistive tech locate the primary content."`
- evidence: `["No <main> or role=\"main\" element found."]`
- recommendedFix: `"Wrap the primary content in a <main> element."`
- selectors: `["main"]`

### `a11y.unlabeled-controls`
- Trigger: `formControls.some(c => c.hasLabel === false && c.accessibleName === '')`.
- severity `high`, status `fail`.
- title: `"Form controls without accessible labels"`.
- whyItMatters: `"Unlabeled controls cannot be reliably identified by agents or screen readers."`
- evidence: one entry per offending control (cap at 10, then add a summary line if more):
  `"<[tag][type ? ' type=\"'+type+'\"' : '']> has no associated label or accessible name."`
- recommendedFix: `"Associate a <label> with each control or add an accessible name."`
- selectors: `["input","select","textarea"]`

### `a11y.icon-button-no-name`
- Trigger: `buttons.some(b => b.isIconOnly === true && b.accessibleName === '')`.
- severity `high`, status `fail`.
- title: `"Icon-only buttons without accessible names"`.
- whyItMatters: `"Icon-only buttons with no name are unusable for agents and screen readers."`
- evidence: `["[count] icon-only button(s) have no accessible name."]`
- recommendedFix: `"Add an aria-label or visually hidden text naming each icon button's action."`
- selectors: `["button"]`

### `a11y.vague-link-text`
- Trigger: count of `links` where
  `VAGUE_TEXT.includes(normalizeText(link.accessibleName).toLowerCase())` is `>= 2`.
- severity `low`, status `warn`.
- title: `"Repeated vague link text"`.
- whyItMatters: `"Repeated vague link text reduces comprehension of where links lead."`
- evidence: `["[count] links use vague text such as \"learn more\" or \"click here\"."]`
- recommendedFix: `"Use descriptive link text that indicates the destination."`
- selectors: `["a[href]"]`

---

## Registry order

`ALL_RULES` must contain the 24 rules in the exact order presented above (metadata 8, content
4, structured-data 3, rendering-risk 3, cta 2, accessibility 4). Running the audit means calling
every rule with the snapshot and collecting the non-null results.
