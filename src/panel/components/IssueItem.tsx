import { useEffect, useRef, useState } from 'react';
import type { AuditIssue } from '../../core/types';
import { buildIssueFixPrompt, type PromptPageContext } from '../../core/export/prompt';
import { Chevron } from './Chevron';
import { transitionContent } from '../transition';
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

// Chips supplement color with text; severity/status remain readable as text per 06.
const SEVERITY_CHIP: Record<AuditIssue['severity'], string | undefined> = {
  high: styles.chipHigh,
  medium: styles.chipMedium,
  low: styles.chipLow,
};

const STATUS_CHIP: Record<AuditIssue['status'], string | undefined> = {
  fail: styles.chipFail,
  warn: styles.chipWarn,
  info: styles.chipInfo,
  pass: styles.chipPass,
};

export function IssueItem({ issue, page }: { issue: AuditIssue; page: PromptPageContext }) {
  const [copied, setCopied] = useState<'text' | 'prompt' | null>(null);
  const [copyError, setCopyError] = useState(false);
  const copyRun = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    copyRun.current++;
    clearTimeout(copyTimer.current);
  }, []);

  async function handleCopy(target: 'text' | 'prompt', text: string): Promise<void> {
    const id = ++copyRun.current;
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      if (id !== copyRun.current) return;
      await transitionContent(() => {
        if (id !== copyRun.current) return;
        setCopyError(false);
        setCopied(target);
        copyTimer.current = setTimeout(() => void transitionContent(() => {
          if (id === copyRun.current) setCopied(null);
        }), 1500);
      });
    } catch {
      if (id !== copyRun.current) return;
      await transitionContent(() => {
        if (id !== copyRun.current) return;
        setCopied(null);
        setCopyError(true);
      });
    }
  }

  return (
    <li className={styles.issueItem}>
      <details id={`issue-${issue.id}`}>
        <summary className={styles.issueSummary}>
          <Chevron />
          <span className={styles.issueTitle}>{issue.title}</span>
          <span className={styles.chips}>
            <span className={SEVERITY_CHIP[issue.severity]}>
              <span className={styles.srOnly}>severity: </span>
              {issue.severity}
            </span>
            <span className={STATUS_CHIP[issue.status]}>
              <span className={styles.srOnly}>status: </span>
              {issue.status}
            </span>
          </span>
        </summary>
        <div className={styles.issueDetail}>
          {/* Severity/status stay visible in the summary chips above (and in the copied
              text block) — repeating them here doubled the scan cost for no new info. */}
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
          <div className={styles.issueActions}>
            <button
              className={copied === 'text' ? styles.copied : styles.copyButton}
              onClick={() => void handleCopy('text', issueToText(issue))}
            >
              <span className={styles.controlLabel}>{copied === 'text' ? 'Copied' : 'Copy'}</span>
            </button>
            {issue.status !== 'info' && (
              <button
                className={copied === 'prompt' ? styles.copied : styles.copyButton}
                title="Copy an LLM-ready prompt to fix this finding"
                onClick={() => void handleCopy('prompt', buildIssueFixPrompt(issue, page))}
              >
                <span className={styles.controlLabel}>{copied === 'prompt' ? 'Copied' : 'Copy fix prompt'}</span>
              </button>
            )}
          </div>
          <p className={styles.srOnly} role="status">{copied ? 'Copied to clipboard.' : ''}</p>
          {copyError && <p className={styles.copyError} role="alert">Copy failed. Check clipboard access and try again.</p>}
        </div>
      </details>
    </li>
  );
}
