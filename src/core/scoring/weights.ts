// Category weights and labels — see 05-scoring.md. Weights sum to 100. Literal; do not edit.

import type { CategoryId } from '../types';

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'metadata': 20,
  'content': 20,
  'structured-data': 15,
  'rendering-risk': 20,
  'cta': 15,
  'accessibility': 10,
};

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  'metadata': 'Metadata and technical basics',
  'content': 'Content structure and answerability',
  'structured-data': 'Structured data',
  'rendering-risk': 'Rendering and hydration risk',
  'cta': 'CTA and action clarity',
  'accessibility': 'Agent and accessibility signals',
};
