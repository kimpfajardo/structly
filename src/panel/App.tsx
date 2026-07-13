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
    <div className={styles.container} data-theme={theme}>
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
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className={styles.themeToggleThumb} />
          </button>
        </div>
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
