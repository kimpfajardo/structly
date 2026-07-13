// Surfaceability is intentionally a metric comparison, not a text diff. The snapshot only
// retains text lengths, so this module reports what it can prove without inventing content.

import type { PageSnapshot } from '../types';

export type SurfaceabilityStatus = 'delivered' | 'partial' | 'missing' | 'unknown';
export type SurfaceabilityScope = 'main-content' | 'page-body' | 'delivery-check';

export interface SurfaceabilityMetrics {
  renderedMainTextLength: number;
  renderedBodyTextLength: number;
  rawAvailable: boolean;
  rawMainTextLength: number | null;
  rawBodyTextLength: number | null;
}

export interface SurfaceabilityAnalysis {
  status: SurfaceabilityStatus;
  summary: string;
  affectedScope: SurfaceabilityScope;
  scopeLabel: string;
  metrics: SurfaceabilityMetrics;
  fixDirection: string;
}

const MIN_RAW_BODY_TEXT = 100;
const MIN_RENDERED_MAIN_TEXT = 200;
const MIN_MAIN_DELIVERY_RATIO = 0.8;

function metricsFor(snapshot: PageSnapshot): SurfaceabilityMetrics {
  return {
    renderedMainTextLength: snapshot.rendered.mainTextLength,
    renderedBodyTextLength: snapshot.rendered.bodyTextLength,
    rawAvailable: snapshot.raw.available,
    rawMainTextLength: snapshot.raw.available ? snapshot.raw.mainTextLength : null,
    rawBodyTextLength: snapshot.raw.available ? snapshot.raw.bodyTextLength : null,
  };
}

/**
 * Compares the text volumes observed after rendering with the initial HTML captured during the
 * same audit. Counts indicate delivery coverage only; they cannot identify an exact text diff.
 */
export function analyzeSurfaceability(snapshot: PageSnapshot): SurfaceabilityAnalysis {
  const metrics = metricsFor(snapshot);

  if (!snapshot.raw.available) {
    return {
      status: 'unknown',
      summary: 'Initial HTML delivery could not be verified in this audit.',
      affectedScope: 'delivery-check',
      scopeLabel: 'Initial HTML check',
      metrics,
      fixDirection: 'Re-audit when the initial HTML can be fetched.',
    };
  }

  if (
    snapshot.raw.bodyTextLength < MIN_RAW_BODY_TEXT &&
    snapshot.rendered.bodyTextLength > snapshot.raw.bodyTextLength
  ) {
    return {
      status: 'missing',
      summary: 'Most visible page content appears to arrive after the initial HTML.',
      affectedScope: 'page-body',
      scopeLabel: 'Page body',
      metrics,
      fixDirection: 'Server-render meaningful page content instead of an empty app shell.',
    };
  }

  if (
    snapshot.rendered.mainTextLength >= MIN_RENDERED_MAIN_TEXT &&
    snapshot.raw.mainTextLength < snapshot.rendered.mainTextLength * MIN_MAIN_DELIVERY_RATIO
  ) {
    return {
      status: 'partial',
      summary: 'Some main content appears after the initial HTML.',
      affectedScope: 'main-content',
      scopeLabel: 'Main content',
      metrics,
      fixDirection: 'Server-render the main summary and core content.',
    };
  }

  return {
    status: 'delivered',
    summary: 'Initial HTML appears to carry the page’s rendered text.',
    affectedScope: 'main-content',
    scopeLabel: 'Main content',
    metrics,
    fixDirection: 'Keep core content in the initial HTML.',
  };
}
