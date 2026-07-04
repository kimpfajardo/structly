// Test helper: deep-merge overrides onto a valid baseline PageSnapshot (08-testing-acceptance.md).
// Plain objects are merged recursively; arrays and primitives are replaced wholesale.

import type { PageSnapshot } from '../core/types';
import baseline from './snapshots/baseline.json';

type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function makeSnapshot(overrides: DeepPartial<PageSnapshot> = {}): PageSnapshot {
  const clone = structuredClone(baseline) as unknown as PageSnapshot;
  return deepMerge(clone, overrides) as PageSnapshot;
}
