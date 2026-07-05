import { useState } from 'react';
import type { AuditReport, CategoryId } from '../../core/types';
import { exportJson } from '../../core/export/json';
import { exportMarkdown } from '../../core/export/markdown';
import { actionableIssues, buildFixPrompt } from '../../core/export/prompt';
import { IssueItem } from './IssueItem';
import { Reveal } from './Reveal';
import { useCountUp } from '../useCountUp';
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

// Visual supplements only — band/severity/status are always rendered as text per 06.
function bandClass(score: number): string | undefined {
  if (score >= 90) return styles.bandStrong;
  if (score >= 75) return styles.bandGood;
  if (score >= 50) return styles.bandModerate;
  return styles.bandMajor;
}

function barClass(score: number, maxScore: number): string | undefined {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.85) return styles.barHigh;
  if (ratio >= 0.5) return styles.barMid;
  return styles.barLow;
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

type CopyTarget = 'prompt' | 'md' | 'json';

export function Report({ report }: { report: AuditReport }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const animatedScore = useCountUp(report.overallScore);

  const hasActionable = actionableIssues(report).length > 0;

  function handleCopy(target: CopyTarget, text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(target);
        setTimeout(() => setCopied((current) => (current === target ? null : current)), 1500);
      })
      .catch(() => {
        // Clipboard may be unavailable; fail quietly (same policy as IssueItem).
      });
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
      <header className={styles.scoreHero}>
        <p className={styles.scoreKicker}>Overall score</p>
        <p className={styles.scoreLine}>
          <strong className={styles.scoreNumber}>{animatedScore}</strong>
          <span className={styles.scoreDenominator}>/100</span>
          <span className={bandClass(report.overallScore)}>{report.band}</span>
        </p>
      </header>

      <ul className={styles.categoryList}>
        {report.categories.map((c, i) => (
          <li
            key={c.id}
            className={styles.categoryRow}
            style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
          >
            <div className={styles.categoryTop}>
              <span className={styles.categoryLabel}>{c.label}</span>
              {/* One data point per row edge — issue counts live in the section headers
                  below, where they help navigation instead of crowding the verdict. */}
              <span className={styles.categoryScore}>
                {c.score}/{c.maxScore}
              </span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <div
                className={barClass(c.score, c.maxScore)}
                style={{ width: `${c.maxScore > 0 ? (c.score / c.maxScore) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

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
        groups.map((g, idx) => (
          <Reveal key={g.category.id}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIndex}>{String(idx + 1).padStart(2, '0')}</span>
                <span className={styles.sectionName}>{g.category.label}</span>
                <span className={styles.sectionCount}>
                  {g.issues.length} {g.issues.length === 1 ? 'issue' : 'issues'}
                </span>
              </h2>
              <ul className={styles.issueList}>
                {g.issues.map((issue) => (
                  <IssueItem
                    key={issue.id}
                    issue={issue}
                    page={{ url: report.pageUrl, pageType: report.pageType }}
                  />
                ))}
              </ul>
            </section>
          </Reveal>
        ))
      )}

      <Reveal>
      <div className={styles.exportButtons}>
        <button
          className={styles.buttonHero}
          disabled={!hasActionable}
          title={
            hasActionable
              ? 'Copy an LLM-ready prompt covering every failing and warning finding'
              : 'No failing or warning findings to build a prompt from'
          }
          onClick={() => handleCopy('prompt', buildFixPrompt(report))}
        >
          {copied === 'prompt' ? 'Copied ✓' : 'Copy AI Fix Prompt'}
        </button>
        {/* Same five functions, one visual decision: the primary action keeps button
            weight; copy/download variants are quiet text links grouped by verb. */}
        <div className={styles.exportGroup}>
          <span className={styles.exportLabel}>Copy</span>
          <button
            className={copied === 'md' ? styles.textButtonCopied : styles.textButton}
            onClick={() => handleCopy('md', exportMarkdown(report))}
          >
            {copied === 'md' ? 'Copied ✓' : 'Markdown'}
          </button>
          <button
            className={copied === 'json' ? styles.textButtonCopied : styles.textButton}
            onClick={() => handleCopy('json', exportJson(report))}
          >
            {copied === 'json' ? 'Copied ✓' : 'JSON'}
          </button>
        </div>
        <div className={styles.exportGroup}>
          <span className={styles.exportLabel}>Download</span>
          <button
            className={styles.textButton}
            onClick={() =>
              downloadText(exportMarkdown(report), buildFilename(report, 'md'), 'text/markdown')
            }
          >
            Markdown
          </button>
          <button
            className={styles.textButton}
            onClick={() =>
              downloadText(exportJson(report), buildFilename(report, 'json'), 'application/json')
            }
          >
            JSON
          </button>
        </div>
      </div>
      </Reveal>
    </div>
  );
}
