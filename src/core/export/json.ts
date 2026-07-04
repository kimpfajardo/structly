// JSON export — see 07-exports.md. Pure and deterministic. Output is exactly the AuditReport
// object; do not reshape, rename, or omit keys. This is the CI/dashboard-stable format.

import type { AuditReport } from '../types';

export function exportJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
