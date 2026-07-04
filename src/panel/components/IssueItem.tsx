import { useState } from 'react';
import type { AuditIssue } from '../../core/types';
import styles from '../panel.module.css';

// Plain-text block copied by the "Copy" button — all fields, labeled (06-ui-panel.md).
function issueToText(issue: AuditIssue): string {
  const parts = [
    `Title: ${issue.title}`,
    `Severity: ${issue.severity}`,
    `Status: ${issue.status}`,
    `Why it matters: ${issue.whyItMatters}`,
    'Evidence:',
    ...issue.evidence.map((e) => `- ${e}`),
    `Recommended fix: ${issue.recommendedFix}`,
  ];
  if (issue.selectors.length > 0) parts.push(`Selectors: ${issue.selectors.join(', ')}`);
  return parts.join('\n');
}

export function IssueItem({ issue }: { issue: AuditIssue }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(): void {
    navigator.clipboard
      .writeText(issueToText(issue))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard may be unavailable; fail quietly.
      });
  }

  return (
    <li className={styles.issueItem}>
      <details>
        <summary className={styles.issueSummary}>
          <span className={styles.issueTitle}>{issue.title}</span>{' '}
          <span className={styles.issueMeta}>
            severity: {issue.severity}, status: {issue.status}
          </span>
        </summary>
        <div className={styles.issueDetail}>
          <p>
            <span className={styles.detailLabel}>Severity:</span> {issue.severity}
          </p>
          <p>
            <span className={styles.detailLabel}>Status:</span> {issue.status}
          </p>
          <p>
            <span className={styles.detailLabel}>Why it matters:</span> {issue.whyItMatters}
          </p>
          <div>
            <span className={styles.detailLabel}>Evidence:</span>
            <ul className={styles.evidenceList}>
              {issue.evidence.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          </div>
          <p>
            <span className={styles.detailLabel}>Recommended fix:</span> {issue.recommendedFix}
          </p>
          {issue.selectors.length > 0 && (
            <p>
              <span className={styles.detailLabel}>Selectors:</span> {issue.selectors.join(', ')}
            </p>
          )}
          <button className={styles.copyButton} onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </details>
    </li>
  );
}
