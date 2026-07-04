// Zod schema for PageSnapshot — see 02-data-model.md (source of truth). Mirrors the
// PageSnapshot interface in src/core/types.ts field-for-field, including the schemaVersion
// literal 1. The panel validates the finalized snapshot with this before running rules
// (01-architecture.md). Pure: no chrome.* and no DOM-collection code.

import { z } from 'zod';

const HeadingNodeSchema = z.object({
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string(),
});

const LinkNodeSchema = z.object({
  text: z.string(),
  accessibleName: z.string(),
  href: z.string(),
});

const ButtonNodeSchema = z.object({
  text: z.string(),
  accessibleName: z.string(),
  isIconOnly: z.boolean(),
});

const FormControlNodeSchema = z.object({
  tag: z.string(),
  type: z.string().nullable(),
  hasLabel: z.boolean(),
  accessibleName: z.string(),
});

const JsonLdBlockSchema = z.object({
  raw: z.string(),
  valid: z.boolean(),
  types: z.array(z.string()),
  parsed: z.unknown(),
});

const RenderedMetricsSchema = z.object({
  mainTextLength: z.number(),
  bodyTextLength: z.number(),
  hasSkeletonMarkers: z.boolean(),
  frameworkMarkers: z.array(z.string()),
});

const RawHtmlMetricsSchema = z.object({
  available: z.boolean(),
  mainTextLength: z.number(),
  bodyTextLength: z.number(),
});

const PageMetaSchema = z.object({
  title: z.string().nullable(),
  metaDescription: z.string().nullable(),
  canonical: z.string().nullable(),
  canonicalCount: z.number(),
  robots: z.string().nullable(),
  lang: z.string().nullable(),
  viewport: z.string().nullable(),
});

const LandmarksSchema = z.object({
  hasMain: z.boolean(),
  hasNav: z.boolean(),
  hasHeader: z.boolean(),
  hasFooter: z.boolean(),
  mainCount: z.number(),
});

export const PageSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: z.string(),
  url: z.string(),
  pageType: z.enum(['marketing', 'docs', 'product', 'account', 'article', 'unknown']),
  meta: PageMetaSchema,
  headings: z.array(HeadingNodeSchema),
  h1Count: z.number(),
  landmarks: LandmarksSchema,
  links: z.array(LinkNodeSchema),
  buttons: z.array(ButtonNodeSchema),
  primaryCta: z.object({ text: z.string(), accessibleName: z.string() }).nullable(),
  formControls: z.array(FormControlNodeSchema),
  jsonLd: z.array(JsonLdBlockSchema),
  rendered: RenderedMetricsSchema,
  raw: RawHtmlMetricsSchema,
  topContentText: z.string(),
});
