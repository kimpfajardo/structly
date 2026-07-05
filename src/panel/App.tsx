import { useEffect, useRef, useState } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot } from '../core/types';
import { PanelInboundMessageSchema } from '../core/schemas/messages';
import { PageSnapshotSchema } from '../core/schemas/snapshot';
import { parseRawHtml } from '../core/rawHtml';
import { detectPageType } from '../core/detectPageType';
import { ALL_RULES } from '../core/rules';
import { scoreAudit } from '../core/scoring/score';
import { Report } from './components/Report';
import { AiSearchView } from './components/AiSearchView';
import { Credits } from './components/Credits';
import logoMark from './assets/logo-mark.png';
import styles from './panel.module.css';

// Long URLs get middle-truncated for display in flowing text (the stale banner), keeping the
// origin and the tail of the path with an ellipsis as the delimiter. The full URL stays
// available via the element's title on hover.
const INLINE_URL_MAX = 32;

function truncateMiddle(value: string, max = INLINE_URL_MAX): string {
  if (value.length <= max) return value;
  const keep = max - 1; // reserve one slot for the ellipsis
  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);
  return `${value.slice(0, front)}…${value.slice(value.length - back)}`;
}

// The panel is the only stateful client (01-architecture.md). On AUDIT_RESULT it finalizes the
// snapshot (raw metrics + auto-detected page type), validates it, runs the rules, and scores the
// report. Page type is classified from the snapshot (detectPageType); there is no manual control.
// The snapshot is kept alongside the report so the AI Search tab can derive its insights
// locally without re-running the audit.

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; report: AuditReport; snapshot: PageSnapshot }
  | { kind: 'error'; message: string };

type ResultTab = 'audit' | 'ai';

async function readActiveTab(): Promise<{ title: string; url: string } | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? { title: tab.title ?? '', url: tab.url ?? '' } : null;
  } catch {
    // Header page info is best-effort; ignore failures.
    return null;
  }
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [pageInfo, setPageInfo] = useState<{ title: string; url: string } | null>(null);
  const [tab, setTab] = useState<ResultTab>('audit');
  // Monotonic audit run id. Bumped on every audit and on reset so replies from a
  // superseded or cancelled run are ignored instead of overwriting current state.
  const runId = useRef(0);

  // Regather context: the side panel outlives tab switches and in-tab navigations, so
  // keep the header's page info in sync with the active tab instead of reading it once.
  useEffect(() => {
    function refresh(): void {
      void readActiveTab().then((info) => {
        if (info) setPageInfo(info);
      });
    }
    refresh();

    const onActivated = (): void => refresh();
    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      updatedTab: chrome.tabs.Tab,
    ): void => {
      if (updatedTab.active && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) {
        refresh();
      }
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // Runs on the AUDIT_RESULT / AUDIT_ERROR reply from the service worker.
  function finalize(response: unknown): void {
    const parsed = PanelInboundMessageSchema.safeParse(response);
    if (!parsed.success) {
      setView({ kind: 'error', message: 'Received an invalid message from the extension.' });
      return;
    }
    if (parsed.data.type === 'AUDIT_ERROR') {
      setView({ kind: 'error', message: parsed.data.message });
      return;
    }

    const collected: PageSnapshot = {
      ...(parsed.data.snapshot as PageSnapshot),
      raw: parseRawHtml(parsed.data.rawHtmlString, new DOMParser()),
      pageType: 'unknown',
    };
    // Page type is always classified from the snapshot (JSON-LD, URL, forms) — no manual pick.
    const finalized: PageSnapshot = { ...collected, pageType: detectPageType(collected) };
    if (!PageSnapshotSchema.safeParse(finalized).success) {
      setView({ kind: 'error', message: 'The finalized page snapshot failed validation.' });
      return;
    }

    const issues = ALL_RULES.map((rule) => rule(finalized)).filter(
      (issue): issue is AuditIssue => issue !== null,
    );
    const report = scoreAudit(finalized, issues);
    setView({ kind: 'result', report, snapshot: finalized });
    setTab('audit');
    setPageInfo({ title: report.pageTitle, url: report.pageUrl });
  }

  async function handleAudit(): Promise<void> {
    const id = ++runId.current;
    setView({ kind: 'loading' });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      if (id === runId.current) setView({ kind: 'error', message: 'No active tab found.' });
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'AUDIT_REQUEST', tabId: tab.id, url: tab.url },
      (response: unknown) => {
        if (id !== runId.current) return; // superseded by a newer audit or a reset
        if (chrome.runtime.lastError) {
          setView({
            kind: 'error',
            message: chrome.runtime.lastError.message ?? 'Could not reach the extension worker.',
          });
          return;
        }
        finalize(response);
      },
    );
  }

  function handleReset(): void {
    runId.current++; // drop any in-flight audit reply
    setView({ kind: 'idle' });
    setTab('audit');
    void readActiveTab().then((info) => {
      if (info) setPageInfo(info);
    });
  }

  // Stale result: the active tab no longer matches the audited URL.
  const auditedUrl = view.kind === 'result' ? view.report.pageUrl : null;
  const staleUrl =
    auditedUrl !== null && pageInfo !== null && pageInfo.url !== auditedUrl
      ? pageInfo.url
      : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {/* 32px source rendered at 18px so it stays crisp on 2x displays */}
          <img className={styles.logoMark} src={logoMark} alt="" />
          <span>
            structly<span className={styles.titleDot} aria-hidden="true">.</span>
          </span>
        </h1>
        {pageInfo && (
          <p className={styles.pageMeta}>
            <span className={styles.pageTitle}>{pageInfo.title || 'Untitled page'}</span>
            <span className={styles.pageUrl}>{pageInfo.url}</span>
          </p>
        )}
        <div className={styles.controls}>
          {/* Once a result exists the user's job is reading, not re-running — the header
              CTA demotes to secondary so the report (or the stale banner) owns the accent. */}
          <button
            className={view.kind === 'result' ? styles.buttonSecondary : styles.button}
            onClick={handleAudit}
            disabled={view.kind === 'loading'}
          >
            {view.kind === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
            {view.kind === 'loading' ? 'Auditing…' : 'Audit Page'}
          </button>
          {view.kind !== 'idle' && (
            <button className={styles.buttonSecondary} onClick={handleReset}>
              Reset
            </button>
          )}
        </div>
      </header>

      <div className={styles.statusRegion} role="status" aria-live="polite">
        {view.kind === 'idle' && (
          <p className={styles.idleHero}>Click Audit Page to run a check.</p>
        )}
        {/* The button already carries the spinner; a second one here split focus. */}
        {view.kind === 'loading' && <p className={styles.statusLoading}>Auditing…</p>}
        {view.kind === 'error' && <p className={styles.error}>{view.message}</p>}
      </div>

      {staleUrl !== null && (
        <div className={styles.staleBanner} role="status">
          <p className={styles.staleText}>
            The page changed — this result is for{' '}
            <span className={styles.staleOldUrl} title={auditedUrl ?? ''}>
              {truncateMiddle(auditedUrl ?? '')}
            </span>
            , but you are now on{' '}
            <span className={styles.staleNewUrl} title={staleUrl}>
              {truncateMiddle(staleUrl)}
            </span>
            .
          </p>
          {/* Single CTA — the header already offers Reset; duplicating it made 4 buttons
              for 2 actions. This is also the only accent-colored element while visible. */}
          <div className={styles.staleActions}>
            <button className={styles.button} onClick={handleAudit}>
              Audit this page
            </button>
          </div>
        </div>
      )}

      {view.kind === 'result' && (
        <>
          <div className={styles.tabs} role="tablist" aria-label="Result views">
            <button
              className={tab === 'audit' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'audit'}
              onClick={() => setTab('audit')}
            >
              Audit report
            </button>
            <button
              className={tab === 'ai' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'ai'}
              onClick={() => setTab('ai')}
            >
              AI Search
              <span className={styles.tabBadge}>AEO/GEO</span>
            </button>
          </div>
          {tab === 'audit' ? (
            <Report report={view.report} />
          ) : (
            <AiSearchView snapshot={view.snapshot} report={view.report} />
          )}
        </>
      )}

      <Credits />
    </div>
  );
}
