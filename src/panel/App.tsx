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
import { DiscoveryCards } from './components/DiscoveryCards';
import { transitionContent } from './transition';
import logoBlack from '../../public/icons/structly-guiding-light-icon-black.svg';
import logoWhite from '../../public/icons/structly-guiding-light-icon-white.svg';
import loadingVideoUrl from './assets/refracted-glass.mp4';
import loadingPoster from './assets/refracted-glass.webp';
import styles from './panel.module.css';

// Long URLs get middle-truncated for display in flowing text (the stale banner), keeping the
// origin and the tail of the path with an ellipsis as the delimiter. The full URL stays
// available via the element's title on hover.
const INLINE_URL_MAX = 32;
const MIN_LOADING_MS = 2000;

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
  const [motionPaused, setMotionPaused] = useState(false);
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
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualVideo = useRef<HTMLVideoElement>(null);
  const tabIntent = useRef<ResultTab>('audit');

  function cancelCompletion(): void {
    if (completionTimer.current !== null) clearTimeout(completionTimer.current);
    completionTimer.current = null;
  }

  useEffect(() => () => {
    runId.current++;
    cancelCompletion();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    if (view.kind !== 'loading' && view.kind !== 'result') return;
    const video = visualVideo.current;
    if (!video) return;
    video.playbackRate = view.kind === 'result' ? 0.5 : 1;
    const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    let inView = true;
    let active = true;
    const updateMotion = (): void => {
      if (!active) return;
      const paused = document.hidden || reducedMotion?.matches === true || !inView;
      setMotionPaused(paused);
      if (paused) video.pause();
      else void video.play().catch(() => {});
    };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      if (!entry) return;
      inView = entry.isIntersecting;
      updateMotion();
    }) : null;
    updateMotion();
    observer?.observe(video);
    document.addEventListener('visibilitychange', updateMotion);
    reducedMotion?.addEventListener('change', updateMotion);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', updateMotion);
      reducedMotion?.removeEventListener('change', updateMotion);
      observer?.disconnect();
      video.pause();
    };
  }, [view.kind]);

  // Regather context: the side panel outlives tab switches and in-tab navigations, so
  // keep the header's page info in sync with the active tab instead of reading it once.
  useEffect(() => {
    let active = true;
    function refresh(): void {
      void readActiveTab().then((info) => {
        if (info && active) void transitionContent(() => {
          if (active) setPageInfo(info);
        });
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
      active = false;
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
    tabIntent.current = 'audit';
    setTab('audit');
    setPageInfo({ title: next.report.pageTitle, url: next.report.pageUrl });
  }

  function finalize(response: unknown): AuditResult | Extract<View, { kind: 'error' }> {
    const parsed = PanelInboundMessageSchema.safeParse(response);
    if (!parsed.success) {
      return { kind: 'error', message: 'Received an invalid message from the extension.' };
    }
    if (parsed.data.type === 'AUDIT_ERROR') {
      return { kind: 'error', message: parsed.data.message };
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
      return { kind: 'error', message: 'The finalized page snapshot failed validation.' };
    }

    return buildResult(finalized);
  }

  async function handleAudit(): Promise<void> {
    const id = ++runId.current;
    cancelCompletion();
    await transitionContent(() => {
      if (id === runId.current) setView({ kind: 'loading' });
    }, { waitForAnimation: true });
    if (id !== runId.current) return;
    // The two-second hold starts after the loading screen has finished entering.
    const loadingStarted = Date.now();

    function complete(next: AuditResult | Extract<View, { kind: 'error' }>): void {
      if (id !== runId.current) return;
      const publish = (): void => {
        completionTimer.current = null;
        void transitionContent(() => {
          if (id !== runId.current) return;
          if (next.kind === 'result') publishResult(next);
          else setView(next);
        });
      };
      const remaining = MIN_LOADING_MS - (Date.now() - loadingStarted);
      if (remaining > 0) completionTimer.current = setTimeout(publish, remaining);
      else publish();
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (id !== runId.current) return;
      if (!activeTab?.id || !activeTab.url) {
        complete({ kind: 'error', message: 'No active tab found.' });
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'AUDIT_REQUEST', tabId: activeTab.id, url: activeTab.url },
        (response: unknown) => {
          if (id !== runId.current) return; // superseded by a newer audit or a reset
          const error = chrome.runtime.lastError;
          complete(error
            ? { kind: 'error', message: error.message ?? 'Could not reach the extension worker.' }
            : finalize(response));
        },
      );
    } catch {
      complete({ kind: 'error', message: 'Could not read the active tab. Try auditing again.' });
    }
  }

  function handleReset(): void {
    const id = ++runId.current; // drop any in-flight audit reply
    cancelCompletion();
    latestResult.current = null;
    tabIntent.current = 'audit';
    void transitionContent(() => {
      if (id !== runId.current) return;
      setRecheck(null);
      setQuestions([]);
      setView({ kind: 'idle' });
      setTab('audit');
    });
    void readActiveTab().then((info) => {
      if (info && id === runId.current) void transitionContent(() => {
        if (id === runId.current) setPageInfo(info);
      });
    });
  }

  function handleDisclosure(event: React.MouseEvent<HTMLDivElement>): void {
    if (!(event.target instanceof Element)) return;
    const summary = event.target.closest('summary');
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || event.target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();
    void transitionContent(() => {
      if (details.isConnected) details.open = !details.open;
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
    const next = event.currentTarget.id === 'audit-tab' ? 'ai' : 'audit';
    changeTab(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(next === 'audit' ? '#audit-tab' : '#readiness-tab')
      ?.focus();
  }

  function changeTab(next: ResultTab): void {
    if (next === tabIntent.current) return;
    tabIntent.current = next;
    const id = runId.current;
    void transitionContent(() => {
      if (id === runId.current) setTab(next);
    }, { tabDirection: next === 'ai' ? 'forward' : 'backward' });
  }

  return (
    <div className={styles.container} data-theme={theme} data-view={view.kind} data-motion={motionPaused ? 'paused' : 'running'} onClickCapture={handleDisclosure}>
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
            onClick={() => void transitionContent(() => setTheme((current) => current === 'dark' ? 'light' : 'dark'))}
          >
            <svg className={styles.themeIcon} data-visible={theme === 'dark'} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="10" cy="10" r="3.5" /><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4m0-12.8L15 5M5 15l-1.4 1.4" />
            </svg>
            <svg className={styles.themeIcon} data-visible={theme === 'light'} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
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
        {view.kind !== 'idle' && <div className={styles.controls}>
          {/* Once a result exists the user's job is reading, not re-running — the header
              CTA demotes to secondary so the report (or the stale banner) owns the accent. */}
          <button
            className={view.kind === 'result' ? styles.buttonSecondary : styles.button}
            onClick={handleAudit}
            disabled={view.kind === 'loading'}
          >
            <span className={styles.actionLabel} key={view.kind}>
              {view.kind === 'loading' ? 'Auditing…' : view.kind === 'result' && staleUrl === null ? 'Recheck page' : 'Audit Page'}
            </span>
          </button>
          <button className={styles.buttonSecondary} onClick={handleReset}>
            <span className={styles.controlLabel}>Reset</span>
          </button>
        </div>}
      </header>

      {view.kind === 'idle' && (
        <>
          <div className={styles.idleVisual}>
            <button className={styles.idleAudit} onClick={handleAudit}>
              <span className={styles.actionLabel}>Audit Page</span>
            </button>
          </div>
          <section className={styles.idleContext}>
            <h2>Find out how AI-ready this page is</h2>
            <p>Check how your content is delivered and structured, then get a prioritized list of issues with specific fixes.</p>
          </section>
          <DiscoveryCards />
        </>
      )}
      <div className={styles.statusRegion} role="status" aria-live="polite">
        {view.kind === 'loading' && (
          <div className={styles.loadingScene}>
            <div className={styles.loadingVisual} aria-hidden="true">
              <video
                ref={visualVideo}
                className={styles.loadingVideo}
                src={loadingVideoUrl}
                poster={loadingPoster}
                muted
                loop
                playsInline
                preload="auto"
                tabIndex={-1}
              />
            </div>
            <div className={styles.loadingCopy}>
              <h2 className={styles.loadingTitle}>
                <span className={styles.textLine}><span className={styles.textLineInner}>Reading your </span></span>
                <span className={styles.textLine}><span className={styles.textLineInner}>page.</span></span>
              </h2>
              <p className={styles.loadingNote}>Checking its structure and initial HTML.</p>
            </div>
          </div>
        )}
        {view.kind === 'error' && <p className={styles.error}>{view.message}</p>}
        {view.kind === 'result' && <p className={styles.srOnly}>Audit complete. {actionableCount} findings need attention.</p>}
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
              <span className={styles.controlLabel}>Audit this page</span>
            </button>
          </div>
        </div>
      )}

      {view.kind === 'result' && (
        <div className={styles.resultShell}>
          <section className={styles.resultSummary} aria-label="Audit summary">
            <div className={styles.resultHero}>
              <div className={styles.resultVisual} aria-hidden="true">
                <video
                  ref={visualVideo}
                  className={styles.loadingVideo}
                  src={loadingVideoUrl}
                  poster={loadingPoster}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  tabIndex={-1}
                />
              </div>
              <div className={styles.score}>
                <span>Checklist score</span>
                <strong>{view.report.overallScore}<small>/100</small></strong>
                <span className={bandClass(view.report.overallScore)}>{view.report.band}</span>
              </div>
            </div>
            <h2 className={styles.verdictTitle}>
              {actionableCount > 0 ? `${actionableCount} ${actionableCount === 1 ? 'thing' : 'things'} to fix.` : 'No fixes needed.'}
            </h2>
          </section>
          <div className={styles.tabs} data-active={tab} role="tablist" aria-label="Result views">
            <button
              id="audit-tab"
              className={tab === 'audit' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'audit'}
              aria-controls="audit-panel"
              tabIndex={tab === 'audit' ? 0 : -1}
              onClick={() => changeTab('audit')}
              onKeyDown={handleTabKeyDown}
            >
              <span className={styles.controlLabel}>Audit report</span>
            </button>
            <button
              id="readiness-tab"
              className={tab === 'ai' ? styles.tabActive : styles.tab}
              role="tab"
              aria-selected={tab === 'ai'}
              aria-controls="readiness-panel"
              tabIndex={tab === 'ai' ? 0 : -1}
              onClick={() => changeTab('ai')}
              onKeyDown={handleTabKeyDown}
            >
              <span className={styles.controlLabel}>AI readiness</span>
            </button>
          </div>
          {tab === 'audit' ? (
            <div key={tab} id="audit-panel" className={styles.resultPanel} role="tabpanel" aria-labelledby="audit-tab">
              <Report report={view.report} snapshot={view.snapshot} recheck={recheck} />
            </div>
          ) : (
            <div key={tab} id="readiness-panel" className={styles.resultPanel} role="tabpanel" aria-labelledby="readiness-tab">
              <AiSearchView
                snapshot={view.snapshot}
                report={view.report}
                questions={questions}
                onQuestionsChange={setQuestions}
              />
            </div>
          )}
        </div>
      )}

      <Credits />
    </div>
  );
}
