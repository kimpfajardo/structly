// Markdown export — see 07-exports.md. Pure and deterministic. Produces exactly the specified
// structure. Plain Markdown only (no color/emoji).

import type { AuditReport } from '../types';

export function exportMarkdown(report: AuditReport): string {
  const title = report.pageTitle === '' ? 'Untitled page' : report.pageTitle;
  const lines: string[] = [];

  lines.push(`# Audit Report: ${title}`);
  lines.push('');
  lines.push(`- URL: ${report.pageUrl}`);
  lines.push(`- Page type: ${report.pageType}`);
  lines.push(`- Audited at: ${report.auditedAt}`);
  lines.push(`- Overall score: ${report.overallScore} (${report.band})`);
  lines.push('');

  lines.push('## Scores');
  lines.push('');
  lines.push('| Category | Score |');
  lines.push('|---|---|');
  for (const c of report.categories) {
    lines.push(`| ${c.label} | ${c.score}/${c.maxScore} |`);
  }
  lines.push('');

  lines.push('## Issues');
  lines.push('');

  const withIssues = report.categories.filter((c) => c.issues.length > 0);
  if (withIssues.length === 0) {
    lines.push('No issues detected.');
  } else {
    for (const c of withIssues) {
      lines.push(`### ${c.label}`);
      lines.push('');
      for (const issue of c.issues) {
        lines.push(`#### ${issue.title}`);
        lines.push(`- Severity: ${issue.severity}`);
        lines.push(`- Status: ${issue.status}`);
        lines.push(`- Why it matters: ${issue.whyItMatters}`);
        lines.push('- Evidence:');
        for (const e of issue.evidence) {
          lines.push(`  - ${e}`);
        }
        lines.push(`- Recommended fix: ${issue.recommendedFix}`);
        if (issue.selectors.length > 0) {
          lines.push(`- Selectors: ${issue.selectors.join(', ')}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n').trimEnd();
}
