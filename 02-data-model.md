# 02 — Data Model

All types live in `src/core/types.ts`. Zod schemas live in `src/core/schemas/snapshot.ts` and
`src/core/schemas/messages.ts`. Types must be derived from or kept in exact sync with the Zod
schemas. Do not add, rename, or make optional any field not marked optional here.

## Enums

```ts
export type Severity = 'low' | 'medium' | 'high';
export type Status = 'pass' | 'warn' | 'fail' | 'info';
export type PageType = 'marketing' | 'docs' | 'product' | 'account' | 'article' | 'unknown';
export type CategoryId =
  | 'metadata'
  | 'content'
  | 'structured-data'
  | 'rendering-risk'
  | 'cta'
  | 'accessibility';
```

## Snapshot node types

```ts
export interface HeadingNode {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface LinkNode {
  text: string;
  accessibleName: string;
  href: string;
}

export interface ButtonNode {
  text: string;
  accessibleName: string;
  isIconOnly: boolean;
}

export interface FormControlNode {
  tag: string;          // 'input' | 'select' | 'textarea'
  type: string | null;  // input type attr, else null
  hasLabel: boolean;
  accessibleName: string;
}

export interface JsonLdBlock {
  raw: string;
  valid: boolean;       // JSON.parse succeeded
  types: string[];      // extracted @type values (see 03)
  parsed: unknown | null;
}

export interface RenderedMetrics {
  mainTextLength: number;      // normalized text length of main region (live DOM)
  bodyTextLength: number;      // normalized text length of <body> (live DOM)
  hasSkeletonMarkers: boolean;
  frameworkMarkers: string[];  // e.g. ['next','react']
}

export interface RawHtmlMetrics {
  available: boolean;          // false if raw fetch failed
  mainTextLength: number;      // 0 if unavailable
  bodyTextLength: number;      // 0 if unavailable
}

export interface PageMeta {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  canonicalCount: number;
  robots: string | null;       // content of meta[name=robots], lowercased, else null
  lang: string | null;         // html[lang], else null
  viewport: string | null;     // meta[name=viewport] content, else null
}

export interface Landmarks {
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  mainCount: number;
}
```

## PageSnapshot

```ts
export interface PageSnapshot {
  schemaVersion: 1;
  capturedAt: string;          // ISO 8601
  url: string;
  pageType: PageType;          // 'unknown' from content script; finalized by panel
  meta: PageMeta;
  headings: HeadingNode[];
  h1Count: number;
  landmarks: Landmarks;
  links: LinkNode[];
  buttons: ButtonNode[];
  primaryCta: { text: string; accessibleName: string } | null;
  formControls: FormControlNode[];
  jsonLd: JsonLdBlock[];
  rendered: RenderedMetrics;
  raw: RawHtmlMetrics;         // defaulted by content script; finalized by panel
  topContentText: string;      // first 800 normalized chars of main region
}
```

## Audit result types

```ts
export interface AuditIssue {
  id: string;                  // rule ID, e.g. 'meta.missing-canonical'
  category: CategoryId;
  severity: Severity;
  status: Status;
  title: string;
  whyItMatters: string;
  evidence: string[];
  recommendedFix: string;
  selectors: string[];         // may be empty
  scoreImpact: number;         // computed penalty for this issue (see 05)
}

export interface AuditCategoryScore {
  id: CategoryId;
  label: string;               // human label (see 05 for exact strings)
  score: number;               // 0..maxScore
  maxScore: number;            // category weight
  issues: AuditIssue[];
}

export interface AuditReport {
  pageUrl: string;
  pageTitle: string;           // snapshot.meta.title ?? ''
  pageType: PageType;
  auditedAt: string;           // ISO 8601
  overallScore: number;        // 0..100
  band: string;                // see 05
  categories: AuditCategoryScore[];
}
```

## Rule signature

```ts
export type Rule = (snapshot: PageSnapshot) => AuditIssue | null;
```

A rule returns `null` when it does not fire (the page passes that check). When it fires it
returns exactly one `AuditIssue`; multiple offending elements are summarized in `evidence`.
`scoreImpact` is set by the scoring layer (`05`), not by the rule; rules may set it to `0` and
scoring overwrites it.

## Zod (must exist and be used)

`src/core/schemas/snapshot.ts` exports `PageSnapshotSchema` matching `PageSnapshot` exactly
(including the `schemaVersion` literal `1`). The panel validates the finalized snapshot with it
before running rules (`01`).

`src/core/schemas/messages.ts` exports schemas for `AuditRequest`, `CollectRequest`,
`AuditResult`, `AuditError`, and a discriminated union `PanelInboundMessage` =
`AuditResult | AuditError`. The panel validates inbound service-worker messages; the service
worker validates inbound panel messages. Reject and surface anything that fails validation.
