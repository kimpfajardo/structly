// Core data model — see 02-data-model.md (source of truth). Do not add, rename, or
// make optional any field not marked optional there. Free of chrome.* and DOM code.

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
  tag: string; // 'input' | 'select' | 'textarea'
  type: string | null; // input type attr, else null
  hasLabel: boolean;
  accessibleName: string;
}

export interface JsonLdBlock {
  raw: string;
  valid: boolean; // JSON.parse succeeded
  types: string[]; // extracted @type values (see 03)
  parsed: unknown | null;
}

export interface RenderedMetrics {
  mainTextLength: number; // normalized text length of main region (live DOM)
  bodyTextLength: number; // normalized text length of <body> (live DOM)
  hasSkeletonMarkers: boolean;
  frameworkMarkers: string[]; // e.g. ['next','react']
}

export interface RawHtmlMetrics {
  available: boolean; // false if raw fetch failed
  mainTextLength: number; // 0 if unavailable
  bodyTextLength: number; // 0 if unavailable
}

export interface PageMeta {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  canonicalCount: number;
  robots: string | null; // content of meta[name=robots], lowercased, else null
  lang: string | null; // html[lang], else null
  viewport: string | null; // meta[name=viewport] content, else null
}

export interface Landmarks {
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  mainCount: number;
}

export interface PageSnapshot {
  schemaVersion: 1;
  capturedAt: string; // ISO 8601
  url: string;
  pageType: PageType; // 'unknown' from content script; finalized by panel
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
  raw: RawHtmlMetrics; // defaulted by content script; finalized by panel
  topContentText: string; // first 800 normalized chars of main region
}

export interface AuditIssue {
  id: string; // rule ID, e.g. 'meta.missing-canonical'
  category: CategoryId;
  severity: Severity;
  status: Status;
  title: string;
  whyItMatters: string;
  evidence: string[];
  recommendedFix: string;
  selectors: string[]; // may be empty
  scoreImpact: number; // computed penalty for this issue (see 05)
}

export interface AuditCategoryScore {
  id: CategoryId;
  label: string; // human label (see 05 for exact strings)
  score: number; // 0..maxScore
  maxScore: number; // category weight
  issues: AuditIssue[];
}

export interface AuditReport {
  pageUrl: string;
  pageTitle: string; // snapshot.meta.title ?? ''
  pageType: PageType;
  auditedAt: string; // ISO 8601
  overallScore: number; // 0..100
  band: string; // see 05
  categories: AuditCategoryScore[];
}

export type Rule = (snapshot: PageSnapshot) => AuditIssue | null;
