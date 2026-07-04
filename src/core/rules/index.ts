// Flat rule registry — see 04-rules.md § Registry order. Order is fixed:
// metadata (8), content (4), structured-data (3), rendering-risk (3), cta (2),
// accessibility (4) = 24. Running the audit = calling every rule and keeping non-null results.

import type { Rule } from '../types';
import {
  metaMissingTitle,
  metaTitleLength,
  metaMissingDescription,
  metaMissingCanonical,
  metaMultipleCanonical,
  metaMissingLang,
  metaRobotsNoindex,
  metaMissingViewport,
} from './metadata';
import {
  contentMissingH1,
  contentMultipleH1,
  contentHeadingSkip,
  contentMissingSummary,
} from './content';
import { schemaNoJsonld, schemaInvalidJsonld, schemaUnrecognizedType } from './structuredData';
import {
  renderingLowInitialText,
  renderingSkeletonInMain,
  renderingAppShellEmptyRaw,
} from './rendering';
import { ctaMissingPrimary, ctaGenericPrimary } from './cta';
import {
  a11yMissingMain,
  a11yUnlabeledControls,
  a11yIconButtonNoName,
  a11yVagueLinkText,
} from './accessibility';

export const ALL_RULES: Rule[] = [
  metaMissingTitle,
  metaTitleLength,
  metaMissingDescription,
  metaMissingCanonical,
  metaMultipleCanonical,
  metaMissingLang,
  metaRobotsNoindex,
  metaMissingViewport,
  contentMissingH1,
  contentMultipleH1,
  contentHeadingSkip,
  contentMissingSummary,
  schemaNoJsonld,
  schemaInvalidJsonld,
  schemaUnrecognizedType,
  renderingLowInitialText,
  renderingSkeletonInMain,
  renderingAppShellEmptyRaw,
  ctaMissingPrimary,
  ctaGenericPrimary,
  a11yMissingMain,
  a11yUnlabeledControls,
  a11yIconButtonNoName,
  a11yVagueLinkText,
];
