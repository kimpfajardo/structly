import { useState } from 'react';
import type { AuditReport, CategoryId } from '../../core/types';
import { exportJson } from '../../core/export/json';
import { exportMarkdown } from '../../core/export/markdown';
import { IssueItem } from './IssueItem';
import styles from '../panel.module.css';

type StatusFilter = 'all' | 'fail' | 'warn' | 'info';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  fail: 'Failures',
  warn: 'Warnings',
  info: 'Info',
};

// Filename per 07-exports.md: audit-<hostname>-<YYYYMMDD>-<HHmmss>.<ext>, timestamp in UTC.
function buildFilename(report: AuditReport, ext: 'md' | 'json'): string {
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
  return `audit-${hostname}-${stamp}.${ext}`;
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

export function Report({ report }: { report: AuditReport }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');

  const groups = report.categories
    .filter((c) => categoryFilter === 'all' || c.id === categoryFilter)
    .map((c) => ({
      category: c,
      issues: c.issues.filter((i) => statusFilter === 'all' || i.status === statusFilter),
    }))
    .filter((g) => g.issues.length > 0);

  return (
    <div className={styles.report}>
      <p className={styles.scoreLine}>
        <strong className={styles.scoreNumber}>{report.overallScore}</strong> — {report.band}
      </p>

      <ul className={styles.categoryList}>
        {report.categories.map((c) => (
          <li key={c.id}>
            {c.label}: {c.score}/{c.maxScore} ({c.issues.length}{' '}
            {c.issues.length === 1 ? 'issue' : 'issues'})
          </li>
        ))}
      </ul>

      <div className={styles.filters}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.label}>Status</legend>
          {(['all', 'fail', 'warn', 'info'] as StatusFilter[]).map((s) => (
            <label key={s} className={styles.radioLabel}>
              <input
                type="radio"
                name="status-filter"
                value={s}
                checked={statusFilter === s}
                onChange={() => setStatusFilter(s)}
              />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </fieldset>

        <div className={styles.filterGroup}>
          <label className={styles.label} htmlFor="category-filter">
            Category
          </label>
          <select
            id="category-filter"
            className={styles.select}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryId | 'all')}
          >
            <option value="all">All categories</option>
            {report.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className={styles.hint}>No issues match the current filters.</p>
      ) : (
        groups.map((g) => (
          <section key={g.category.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{g.category.label}</h2>
            <ul className={styles.issueList}>
              {g.issues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className={styles.exportButtons}>
        <button
          className={styles.button}
          onClick={() =>
            downloadText(exportMarkdown(report), buildFilename(report, 'md'), 'text/markdown')
          }
        >
          Export Markdown
        </button>
        <button
          className={styles.button}
          onClick={() =>
            downloadText(exportJson(report), buildFilename(report, 'json'), 'application/json')
          }
        >
          Export JSON
        </button>
      </div>
    </div>
  );
}
