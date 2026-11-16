import { useEffect, useRef, useState } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot } from '../core/types';
import { PanelInboundMessageSchema } from '../core/schemas/messages';
import { PageSnapshotSchema } from '../core/schemas/snapshot';
import { parseRawHtml } from '../core/rawHtml';
import { detectPageType } from '../core/detectPageType';
import { ALL_RULES } from '../core/rules';
import { scoreAudit } from '../core/scoring/score';
import { actionableIssues } from '../core/export/prompt';
import { Report } from './components/Report';
import { AiSearchView } from './components/AiSearchView';
import { Credits } from './components/Credits';
import logoBlack from '../../public/icons/structly-guiding-light-icon-black.svg';
import logoWhite from '../../public/icons/structly-guiding-light-icon-white.svg';
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
// snapshot (raw metrics + an initial page-purpose guess), validates it, runs the rules, and
// scores the report. The snapshot stays beside the report for local readiness checks.

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; report: AuditReport; snapshot: PageSnapshot }
  | { kind: 'error'; message: string };

type ResultTab = 'audit' | 'ai';
type Theme = 'light' | 'dark';
type AuditResult = Extract<View, { kind: 'result' }>;

function bandClass(score: number): string | undefined {
  if (score >= 90) return styles.bandStrong;
  if (score >= 75) return styles.bandGood;
  if (score >= 50) return styles.bandModerate;
  return styles.bandMajor;
}

function buildResult(snapshot: PageSnapshot): AuditResult {
  const issues = ALL_RULES.map((rule) => rule(snapshot)).filter(
    (issue): issue is AuditIssue => issue !== null,
  );
  return { kind: 'result', report: scoreAudit(snapshot, issues), snapshot };
}

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
  const [theme, setTheme] = useState<Theme>(() =>
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [pageInfo, setPageInfo] = useState<{ title: string; url: string } | null>(null);
  const [tab, setTab] = useState<ResultTab>('audit');
  const [questions, setQuestions] = useState<string[]>([]);
  const [recheck, setRecheck] = useState<{
    before: AuditResult;
    after: AuditResult;
  } | null>(null);
  // Monotonic audit run id. Bumped on every audit and on reset so replies from a
  // superseded or cancelled run are ignored instead of overwriting current state.
  const runId = useRef(0);
  const latestResult = useRef<AuditResult | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

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
  function publishResult(next: AuditResult): void {
    const previous = latestResult.current;
    if (previous?.report.pageUrl === next.report.pageUrl) {
      setRecheck({ before: previous, after: next });
    } else {
      setRecheck(null);
      setQuestions([]);
    }
    latestResult.current = next;
    setView(next);
    setTab('audit');
    setPageInfo({ title: next.report.pageTitle, url: next.report.pageUrl });
  }

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
    const finalized: PageSnapshot = {
      ...collected,
      pageType: detectPageType(collected),
    };
    if (!PageSnapshotSchema.safeParse(finalized).success) {
      setView({ kind: 'error', message: 'The finalized page snapshot failed validation.' });
      return;
    }

    publishResult(buildResult(finalized));
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
    latestResult.current = null;
    setRecheck(null);
    setQuestions([]);
    setView({ kind: 'idle' });
    setTab('audit');
    void readActiveTab().then((info) => {
      if (info) setPageInfo(info);
    });
  }

  // Stale result: the active tab no longer matches the audited URL.
  const auditedUrl = view.kind === 'result' ? view.report.pageUrl : null;
  const actionableCount = view.kind === 'result' ? actionableIssues(view.report).length : 0;
  const staleUrl =
    auditedUrl !== null && pageInfo !== null && pageInfo.url !== auditedUrl
      ? pageInfo.url
      : null;

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'audit' ? 'ai' : 'audit';
    setTab(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(next === 'audit' ? '#audit-tab' : '#readiness-tab')
      ?.focus();
  }

  return (
    <div className={styles.container} data-theme={theme} data-view={view.kind}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <h1 className={styles.title}>
            <img
              className={styles.wordmark}
              src={theme === 'dark' ? logoWhite : logoBlack}
              alt=""
              aria-hidden="true"
            />
            <span className={styles.brandName}>Structly</span>
          </h1>
          <button
            className={styles.themeToggle}
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Dark mode"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              {theme === 'dark' ? <><circle cx="10" cy="10" r="3.5" /><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4m0-12.8L15 5M5 15l-1.4 1.4" /></> : <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />}
            </svg>
          </button>
        </div>
        {pageInfo && (
          <p className={styles.pageMeta}>
            <span className={styles.pageTitle} title={pageInfo.title}>{pageInfo.title || 'Untitled page'}</span>
            <span className={styles.pageUrl} title={pageInfo.url}>{pageInfo.url}</span>
          </p>
        )}
        {view.kind === 'idle' && (
          <div className={styles.idleIntro}>
            <h2>See your page<br />more clearly.</h2>
            <p>Inspect its structure.<br />Find what needs attention.</p>
          </div>
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
            {view.kind === 'loading' ? 'Auditing…' : view.kind === 'result' && staleUrl === null ? 'Recheck page' : 'Audit page'}
            {view.kind === 'idle' && <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>}
          </button>
          {view.kind !== 'idle' && (
            <button className={styles.buttonSecondary} onClick={handleReset}>
              Reset
            </button>
          )}
        </div>
      </header>

      {view.kind === 'idle' && (
        <>
          <div className={styles.idleVisual} aria-hidden="true">
            <div className={styles.photoCaption}><span>Initial HTML</span><span>Rendered page</span></div>
          </div>
          <section className={styles.idleContext}>
            <h2>One page.<br />A closer look.</h2>
            <p>Metadata, content, structured data, accessibility, rendering, and actions.</p>
            <div className={styles.localScope}><span>Local page checks</span><span>{ALL_RULES.length} rules</span></div>
            <p className={styles.hint}>Rankings, citations, and completed actions are not verified.</p>
          </section>
        </>
      )}
      <div className={styles.statusRegion} role="status" aria-live="polite">
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
          <section className={styles.resultSummary} aria-label="Audit summary">
            <div className={styles.verdict}>
              <h2 className={styles.verdictTitle}>
                {actionableCount > 0 ? <>{actionableCount} {actionableCount === 1 ? 'thing' : 'things'}<br />to fix.</> : <>No fixes<br />needed.</>}
              </h2>
              <p className={styles.hint}>{actionableCount > 0 ? 'Start with the findings below.' : 'No failing or warning findings in this audit.'}</p>
            </div>
            <div className={styles.score}>
              <span>Checklist score</span>
              <strong>{view.report.overallScore}<small>/100</small></strong>
              <span className={bandClass(view.report.overallScore)}>{view.report.band}</span>
            </div>
          </section>
          <div className={styles.tabs} role="tablist" aria-label="Result views">
            <button
              id="audit-tab"
              className={tab === 'audit' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'audit'}
              aria-controls="audit-panel"
              tabIndex={tab === 'audit' ? 0 : -1}
              onClick={() => setTab('audit')}
              onKeyDown={handleTabKeyDown}
            >
              Audit report
            </button>
            <button
              id="readiness-tab"
              className={tab === 'ai' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'ai'}
              aria-controls="readiness-panel"
              tabIndex={tab === 'ai' ? 0 : -1}
              onClick={() => setTab('ai')}
              onKeyDown={handleTabKeyDown}
            >
              AI readiness
            </button>
          </div>
          {tab === 'audit' ? (
            <div id="audit-panel" role="tabpanel" aria-labelledby="audit-tab">
              <Report report={view.report} snapshot={view.snapshot} recheck={recheck} />
            </div>
          ) : (
            <div id="readiness-panel" role="tabpanel" aria-labelledby="readiness-tab">
              <AiSearchView
                snapshot={view.snapshot}
                report={view.report}
                questions={questions}
                onQuestionsChange={setQuestions}
              />
            </div>
          )}
        </>
      )}

      <Credits />
    </div>
  );
}
