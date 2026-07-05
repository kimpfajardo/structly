// AI fix-prompt export — developer CTA layered on top of 07's exports (Kim-authorized,
// 2026-07). Pure and deterministic: builds an LLM-ready prompt (Claude Code, Cursor,
// ChatGPT, ...) from audit results. No chrome.* or DOM code.

import type { AuditIssue, AuditReport, PageType } from '../types';
import { CATEGORY_LABELS } from '../scoring/weights';

type ActionableStatus = 'fail' | 'warn';

const STATUS_RANK: Record<ActionableStatus, number> = { fail: 0, warn: 1 };
const SEVERITY_RANK: Record<AuditIssue['severity'], number> = { high: 0, medium: 1, low: 2 };

export interface PromptPageContext {
  url: string;
  pageType: PageType;
}

type ActionableIssue = AuditIssue & { status: ActionableStatus };

// Fail/warn issues in fix order: failures first, then warnings; high severity first within
// each; original report order (category order) as the stable tie-break.
export function actionableIssues(report: AuditReport): AuditIssue[] {
  const collected = report.categories
    .flatMap((c) => c.issues)
    .filter((i): i is ActionableIssue => i.status === 'fail' || i.status === 'warn')
    .map((issue, index) => ({ issue, index }));

  collected.sort((a, b) => {
    const byStatus = STATUS_RANK[a.issue.status] - STATUS_RANK[b.issue.status];
    if (byStatus !== 0) return byStatus;
    const bySeverity = SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.index - b.index;
  });

  return collected.map((c) => c.issue);
}

function issueBlock(issue: AuditIssue, heading: string): string[] {
  const lines = [
    heading,
    `- Rule: ${issue.id}`,
    `- Status: ${issue.status} (${issue.severity} severity)`,
    `- Category: ${CATEGORY_LABELS[issue.category]}`,
    `- Why it matters: ${issue.whyItMatters}`,
    '- Evidence:',
    ...issue.evidence.map((e) => `  - ${e}`),
    `- Recommended fix: ${issue.recommendedFix}`,
  ];
  if (issue.selectors.length > 0) {
    lines.push(`- Selectors: ${issue.selectors.join(', ')}`);
  }
  return lines;
}

// Full-report prompt covering every fail/warn finding.
export function buildFixPrompt(report: AuditReport): string {
  const issues = actionableIssues(report);
  const failCount = issues.filter((i) => i.status === 'fail').length;
  const warnCount = issues.length - failCount;
  const title = report.pageTitle === '' ? 'Untitled page' : report.pageTitle;

  const lines: string[] = [
    'You are helping me fix issues found by an automated page-readiness audit of a live web page.',
    '',
    `Page: ${report.pageUrl}`,
    `Title: ${title}`,
    `Page type: ${report.pageType}`,
    `Overall score: ${report.overallScore}/100 (${report.band})`,
    `Actionable findings: ${failCount} ${failCount === 1 ? 'failure' : 'failures'}, ${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`,
    '',
  ];

  if (issues.length === 0) {
    lines.push('No failing or warning findings — nothing to fix.');
    return lines.join('\n').trimEnd();
  }

  lines.push(
    'The evidence below was collected from the rendered page, not from source code. Ask me for the relevant source files before making changes.',
    '',
  );

  issues.forEach((issue, idx) => {
    lines.push(...issueBlock(issue, `## ${idx + 1}. ${issue.title}`), '');
  });

  lines.push(
    'Instructions:',
    '1. Work through the findings in order; failures first.',
    '2. Make the smallest change that resolves each finding — preserve existing content, design, and behavior.',
    '3. If a finding does not apply to my stack or looks like a false positive, say so and skip it instead of forcing a change.',
    '4. When you are done, list what changed per finding so I can re-run the audit.',
  );

  return lines.join('\n').trimEnd();
}

// Single-issue prompt for a targeted fix.
export function buildIssueFixPrompt(issue: AuditIssue, page: PromptPageContext): string {
  const lines: string[] = [
    'You are helping me fix one issue found by an automated page-readiness audit of a live web page.',
    '',
    `Page: ${page.url}`,
    `Page type: ${page.pageType}`,
    '',
    ...issueBlock(issue, `## ${issue.title}`),
    '',
    'Instructions:',
    '1. The evidence was collected from the rendered page, not from source code — ask me for the relevant source files before making changes.',
    '2. Make the smallest change that resolves this finding — preserve existing content, design, and behavior.',
    '3. When you are done, summarize what changed so I can re-run the audit.',
  ];

  return lines.join('\n').trimEnd();
}
