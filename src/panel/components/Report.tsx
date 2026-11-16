import { useEffect, useState } from 'react';
import type { AuditReport, CategoryId, PageSnapshot, PageType } from '../../core/types';
import { exportJson } from '../../core/export/json';
import { exportMarkdown } from '../../core/export/markdown';
import { exportPageEvidenceMarkdown } from '../../core/export/pageEvidenceMarkdown';
import { actionableIssues, buildFixPrompt } from '../../core/export/prompt';
import { CTA_EXPECTED_TYPES, SCHEMA_EXPECTED_TYPES, SUMMARY_EXPECTED_TYPES } from '../../core/rules/constants';
import { IssueItem } from './IssueItem';
import { Chevron } from './Chevron';
import { RecheckReceipt } from './RecheckReceipt';
import { SurfaceabilityEvidence } from './SurfaceabilityEvidence';
import { Select } from './Select';
import styles from '../panel.module.css';

type StatusFilter = 'all' | 'fail' | 'warn' | 'info';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  fail: 'Failures',
  warn: 'Warnings',
  info: 'Info',
};

// Filename per 07-exports.md: audit-<hostname>-<YYYYMMDD>-<HHmmss>.<ext>, timestamp in UTC.
function buildFilename(
  report: AuditReport,
  ext: 'md' | 'json',
  prefix = 'audit',
): string {
  let hostname = 'page';
  try {
    hostname = new URL(report.pageUrl).hostname || 'page';
  } catch {
    hostname = 'page';
  }
  const d = new Date(report.auditedAt);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `${prefix}-${hostname}-${stamp}.${ext}`;
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type CopyTarget = 'prompt' | 'md' | 'json' | 'evidence';

const PURPOSE_LABELS: Record<PageType, string> = {
  marketing: 'marketing',
  product: 'product',
  article: 'article',
  docs: 'documentation',
  account: 'account',
  unknown: 'unconfirmed',
};

function purposeSummary(pageType: PageType): string {
  if (pageType === 'unknown') {
    return 'Page type: Not identified. Shared page checks applied.';
  }
  const checks = [
    SUMMARY_EXPECTED_TYPES.includes(pageType) && 'top summary',
    CTA_EXPECTED_TYPES.includes(pageType) && 'named primary action',
    SCHEMA_EXPECTED_TYPES.includes(pageType) && 'structured-data expectation',
  ].filter(Boolean);
  return `Assessed as ${PURPOSE_LABELS[pageType]}. This applies checks for ${checks.join(', ') || 'the shared page basics'}; findings only change when a relevant condition is missing.`;
}

export function Report({
  report,
  snapshot,
  recheck,
}: {
  report: AuditReport;
  snapshot: PageSnapshot;
  recheck: { before: { report: AuditReport; snapshot: PageSnapshot }; after: { report: AuditReport; snapshot: PageSnapshot } } | null;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [copyError, setCopyError] = useState<CopyTarget | null>(null);
  const [focusedIssue, setFocusedIssue] = useState<string | null>(null);
  const actionable = actionableIssues(report);
  const priorities = actionable.slice(0, 3);

  useEffect(() => {
    if (!focusedIssue) return;
    const details = document.getElementById(`issue-${focusedIssue}`) as HTMLDetailsElement | null;
    if (details) {
      details.open = true;
      details.querySelector('summary')?.focus();
      details.scrollIntoView?.({ block: 'nearest' });
    }
    setFocusedIssue(null);
  }, [focusedIssue]);

  function showIssue(id: string): void {
    setStatusFilter('all');
    setCategoryFilter('all');
    setFocusedIssue(id);
  }

  async function handleCopy(target: CopyTarget, text: string): Promise<void> {
    setCopyError(null);
    setCopied(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied((current) => current === target ? null : current), 1500);
    } catch {
      setCopyError(target);
    }
  }

  const groups = report.categories
    .filter((c) => categoryFilter === 'all' || c.id === categoryFilter)
    .map((c) => ({
      category: c,
      issues: c.issues.filter((i) => statusFilter === 'all' || i.status === statusFilter),
    }))
    .filter((g) => g.issues.length > 0);

  return (
    <div className={styles.report}>
      <section className={styles.fixFirst} aria-labelledby="fix-first-title">
        <h2 id="fix-first-title" className={styles.sectionTitle}>
          {actionable.length > 0 ? 'Fix first' : 'No fixes needed'}
        </h2>
        <p className={styles.hint}>
          {actionable.length} {actionable.length === 1 ? 'finding needs' : 'findings need'} attention
        </p>
        {priorities.length > 0 && (
          <ol className={styles.fixFirstList}>
            {priorities.map((issue) => (
              <li key={issue.id}>
                <button className={styles.priorityButton} onClick={() => showIssue(issue.id)}>
                  <span>{issue.title}</span>
                  <span className={issue.status === 'fail' ? styles.chipFail : styles.chipWarn}>
                    {issue.status}
                  </span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ol>
        )}
        <button
          className={styles.buttonHero}
          disabled={actionable.length === 0}
          title={actionable.length > 0 ? 'Copy a prompt covering every failing and warning finding' : 'No failing or warning findings to build a prompt from'}
          onClick={() => void handleCopy('prompt', buildFixPrompt(report))}
        >
          {copied === 'prompt' ? 'Copied' : 'Copy AI fix prompt'}
        </button>
        {copyError === 'prompt' && <p className={styles.copyError} role="alert">Copy failed. Check clipboard access and try again, or use Export report to download.</p>}
        <p className={styles.hint}>Local page checks. Rankings, citations, and completed actions are not verified.</p>
      </section>

      {recheck && <RecheckReceipt before={recheck.before} after={recheck.after} />}

      <div className={styles.filters}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.label}>Status</legend>
          <div className={styles.segmented}>
            {(['all', 'fail', 'warn', 'info'] as StatusFilter[]).map((s) => (
              <label key={s} className={styles.segment}>
                <input
                  className={styles.segmentInput}
                  type="radio"
                  name="status-filter"
                  value={s}
                  checked={statusFilter === s}
                  onChange={() => setStatusFilter(s)}
                />
                {STATUS_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <Select
          id="category-filter"
          label="Category"
          value={categoryFilter}
          options={[
            { value: 'all', label: 'All categories' },
            ...report.categories.map((category) => ({ value: category.id, label: category.label })),
          ]}
          onChange={setCategoryFilter}
        />
      </div>

      {groups.length === 0 ? (
        <p className={styles.hint}>No issues match the current filters.</p>
      ) : groups.map((g) => (
        <section key={g.category.id} className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionName}>{g.category.label}</span>
            <span className={styles.sectionCount}>
              {g.issues.length} {g.issues.length === 1 ? 'issue' : 'issues'}
            </span>
          </h2>
          <ul className={styles.issueList}>
            {g.issues.map((issue) => (
              <IssueItem key={issue.id} issue={issue} page={{ url: report.pageUrl, pageType: report.pageType }} />
            ))}
          </ul>
        </section>
      ))}

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>Page evidence</h2>
        </summary>
        <div className={styles.sectionBody}>
          <p className={styles.purposeAssessment}>{purposeSummary(report.pageType)}</p>
          <SurfaceabilityEvidence snapshot={snapshot} />
          <h3 className={styles.subheading}>Category scores</h3>
          <dl className={styles.categoryList}>
            {report.categories.map((category) => (
              <div key={category.id} className={styles.categoryRow}>
                <dt>{category.label}</dt>
                <dd>{category.score}/{category.maxScore}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>Export report</h2>
        </summary>
        <div className={styles.exportButtons}>
          <div className={styles.exportGroup}>
            <span className={styles.exportLabel}>Copy</span>
            <button className={copied === 'md' ? styles.textButtonCopied : styles.textButton} onClick={() => void handleCopy('md', exportMarkdown(report))}>
              {copied === 'md' ? 'Copied' : 'Markdown'}
            </button>
            <button className={copied === 'json' ? styles.textButtonCopied : styles.textButton} onClick={() => void handleCopy('json', exportJson(report))}>
              {copied === 'json' ? 'Copied' : 'JSON'}
            </button>
            <button className={copied === 'evidence' ? styles.textButtonCopied : styles.textButton} title="Copy the limited page evidence captured by this audit" onClick={() => void handleCopy('evidence', exportPageEvidenceMarkdown(snapshot))}>
              {copied === 'evidence' ? 'Copied' : 'Page evidence'}
            </button>
          </div>
          <div className={styles.exportGroup}>
            <span className={styles.exportLabel}>Download</span>
            <button className={styles.textButton} onClick={() => downloadText(exportMarkdown(report), buildFilename(report, 'md'), 'text/markdown')}>Markdown</button>
            <button className={styles.textButton} onClick={() => downloadText(exportJson(report), buildFilename(report, 'json'), 'application/json')}>JSON</button>
            <button className={styles.textButton} title="Download the limited page evidence captured by this audit" onClick={() => downloadText(exportPageEvidenceMarkdown(snapshot), buildFilename(report, 'md', 'page-evidence'), 'text/markdown')}>Page evidence</button>
          </div>
          {copyError && copyError !== 'prompt' && <p className={styles.copyError} role="alert">Copy failed. Check clipboard access and try again, or use Export report to download.</p>}
        </div>
      </details>
      <p className={styles.srOnly} role="status">{copied ? 'Copied to clipboard.' : ''}</p>
    </div>
  );
}
