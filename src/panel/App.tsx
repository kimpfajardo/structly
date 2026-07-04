import { useEffect, useState } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot, PageType } from '../core/types';
import { PanelInboundMessageSchema } from '../core/schemas/messages';
import { PageSnapshotSchema } from '../core/schemas/snapshot';
import { parseRawHtml } from '../core/rawHtml';
import { ALL_RULES } from '../core/rules';
import { scoreAudit } from '../core/scoring/score';
import { Report } from './components/Report';
import styles from './panel.module.css';

// The panel is the only stateful client (01-architecture.md). On AUDIT_RESULT it finalizes the
// snapshot (raw metrics + page type), validates it, runs the rules, and scores the report.

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; report: AuditReport }
  | { kind: 'error'; message: string };

const PAGE_TYPES: PageType[] = ['marketing', 'docs', 'product', 'account', 'article', 'unknown'];

export default function App() {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [pageType, setPageType] = useState<PageType>('unknown');
  const [pageInfo, setPageInfo] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab) setPageInfo({ title: tab.title ?? '', url: tab.url ?? '' });
      })
      .catch(() => {
        // Header page info is best-effort in idle; ignore failures.
      });
  }, []);

  // Runs on the AUDIT_RESULT / AUDIT_ERROR reply from the service worker. selectedType is the
  // page-type value captured when the audit was requested (01: read at finalization time).
  function finalize(response: unknown, selectedType: PageType): void {
    const parsed = PanelInboundMessageSchema.safeParse(response);
    if (!parsed.success) {
      setView({ kind: 'error', message: 'Received an invalid message from the extension.' });
      return;
    }
    if (parsed.data.type === 'AUDIT_ERROR') {
      setView({ kind: 'error', message: parsed.data.message });
      return;
    }

    const finalized: PageSnapshot = {
      ...(parsed.data.snapshot as PageSnapshot),
      raw: parseRawHtml(parsed.data.rawHtmlString, new DOMParser()),
      pageType: selectedType,
    };
    if (!PageSnapshotSchema.safeParse(finalized).success) {
      setView({ kind: 'error', message: 'The finalized page snapshot failed validation.' });
      return;
    }

    const issues = ALL_RULES.map((rule) => rule(finalized)).filter(
      (issue): issue is AuditIssue => issue !== null,
    );
    const report = scoreAudit(finalized, issues);
    setView({ kind: 'result', report });
    setPageInfo({ title: report.pageTitle, url: report.pageUrl });
  }

  async function handleAudit(): Promise<void> {
    const selectedType = pageType;
    setView({ kind: 'loading' });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setView({ kind: 'error', message: 'No active tab found.' });
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'AUDIT_REQUEST', tabId: tab.id, url: tab.url },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          setView({
            kind: 'error',
            message: chrome.runtime.lastError.message ?? 'Could not reach the extension worker.',
          });
          return;
        }
        finalize(response, selectedType);
      },
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Page Readiness Auditor</h1>
        {pageInfo && (
          <p className={styles.pageMeta}>
            <span className={styles.pageTitle}>{pageInfo.title || 'Untitled page'}</span>
            <span className={styles.pageUrl}>{pageInfo.url}</span>
          </p>
        )}
        <div className={styles.controls}>
          <label className={styles.label} htmlFor="page-type">
            Page type
          </label>
          <select
            id="page-type"
            className={styles.select}
            value={pageType}
            onChange={(e) => setPageType(e.target.value as PageType)}
          >
            {PAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            className={styles.button}
            onClick={handleAudit}
            disabled={view.kind === 'loading'}
          >
            {view.kind === 'loading' ? 'Auditing…' : 'Audit Page'}
          </button>
        </div>
      </header>

      <div className={styles.statusRegion} role="status" aria-live="polite">
        {view.kind === 'idle' && (
          <p className={styles.hint}>Choose a page type and click Audit Page to run a check.</p>
        )}
        {view.kind === 'loading' && <p>Auditing…</p>}
        {view.kind === 'error' && <p className={styles.error}>{view.message}</p>}
      </div>

      {view.kind === 'result' && <Report report={view.report} />}
    </div>
  );
}
