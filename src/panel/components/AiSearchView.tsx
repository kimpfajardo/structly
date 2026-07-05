import { useMemo } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot } from '../../core/types';
import { buildAiSearchInsights } from '../../core/aiSearch/insights';
import type { PillarStatus } from '../../core/aiSearch/insights';
import { buildCitationPreview } from '../../core/aiSearch/citationPreview';
import type { CitationTier } from '../../core/aiSearch/citationPreview';
import { useCountUp } from '../useCountUp';
import { Chevron } from './Chevron';
import { Reveal } from './Reveal';
import styles from '../panel.module.css';

// AEO/GEO view — everything here is derived locally from the finalized snapshot and the
// fixed 24-rule output. No network calls; the citation preview is a labeled simulation.

const TIER_LABEL: Record<CitationTier, string> = {
  strong: 'likely cited',
  possible: 'possibly cited',
  weak: 'unlikely cited',
  excluded: 'excluded',
};

function tierChipClass(tier: CitationTier): string | undefined {
  if (tier === 'strong') return styles.chipPass;
  if (tier === 'possible') return styles.chipInfo;
  if (tier === 'weak') return styles.chipWarn;
  return styles.chipFail;
}

function pillarChipClass(status: PillarStatus): string | undefined {
  if (status === 'ready') return styles.chipPass;
  if (status === 'attention') return styles.chipWarn;
  return styles.chipFail;
}

function ringClass(likelihood: number, tier: CitationTier): string | undefined {
  if (tier === 'excluded' || likelihood < 55) return styles.ringLow;
  if (likelihood < 80) return styles.ringMid;
  return styles.ringHigh;
}

function signalBarClass(score: number): string | undefined {
  if (score >= 0.85) return styles.signalBarHigh;
  if (score >= 0.5) return styles.signalBarMid;
  return styles.signalBarLow;
}

// Count-up needs a hook, and hooks can't live inside a map callback.
function RingValue({ likelihood }: { likelihood: number }) {
  return <span className={styles.ringValue}>{useCountUp(likelihood)}</span>;
}

// Citation URLs can be arbitrarily long. Keep the origin (left) and the tail of the path
// (the last URL_TAIL_CHARS) visible and let the middle collapse — the head span clips with a
// CSS ellipsis that reads as the delimiter, so the source domain and page slug both stay
// readable at any panel width. Full URL stays on the title for hover/inspection.
const URL_TAIL_CHARS = 12;

function CitationUrl({ url }: { url: string }) {
  const head = url.slice(0, -URL_TAIL_CHARS);
  const tail = url.slice(-URL_TAIL_CHARS);
  return (
    <span className={styles.citationUrl} title={url}>
      <span className={styles.citationUrlHead}>{head}</span>
      <span className={styles.citationUrlTail}>{tail}</span>
    </span>
  );
}

export function AiSearchView({
  snapshot,
  report,
}: {
  snapshot: PageSnapshot;
  report: AuditReport;
}) {
  const issues = useMemo<AuditIssue[]>(
    () => report.categories.flatMap((c) => c.issues),
    [report],
  );
  const insights = useMemo(() => buildAiSearchInsights(snapshot, issues), [snapshot, issues]);
  const preview = useMemo(() => buildCitationPreview(snapshot, issues), [snapshot, issues]);

  return (
    <div className={styles.aiView}>
      {/* Static text: the word-by-word reveal kept the eye chasing motion for ~900ms
          while rings and bars were also animating — one moving system at a time. */}
      <div className={styles.takeaway}>
        <p className={styles.takeawayText}>{insights.keyTakeaway}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIndex}>01</span>
          <span className={styles.sectionName}>How AI assistants may surface this page</span>
        </h2>
        <p className={styles.disclaimer}>{preview.disclaimer}</p>
        <ul className={styles.assistantList}>
          {preview.assistants.map((a, i) => (
            <li
              key={a.profileId}
              className={styles.assistantCard}
              style={{ '--d': `${i * 110}ms` } as React.CSSProperties}
            >
              <div className={styles.assistantHead}>
                <div
                  className={ringClass(a.likelihood, a.tier)}
                  style={{ '--pct': a.likelihood, '--d': `${i * 110}ms` } as React.CSSProperties}
                  role="img"
                  aria-label={`${a.name} citation likelihood ${a.likelihood} out of 100`}
                >
                  <RingValue likelihood={a.likelihood} />
                </div>
                <div className={styles.assistantMeta}>
                  <span className={styles.assistantName}>{a.name}</span>
                  <span className={styles.assistantBlurb}>{a.blurb}</span>
                </div>
                <span className={tierChipClass(a.tier)}>{TIER_LABEL[a.tier]}</span>
              </div>

              <div className={styles.citationCard}>
                <span className={styles.citationLabel}>cited as</span>
                <span className={styles.citationTitle}>{a.displayTitle}</span>
                <CitationUrl url={a.displayUrl} />
                <p className={styles.citationSnippet}>{a.snippet}</p>
              </div>

              {a.blockers.length > 0 && (
                <ul className={styles.blockerList}>
                  {a.blockers.map((b, i) => (
                    <li key={i} className={styles.blockerItem}>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Sections 2–5 are collapsed by default (progressive disclosure): the takeaway
          and assistant previews answer the headline question; the rest is on demand. */}
      <Reveal>
      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>
            <span className={styles.sectionIndex}>02</span>
            <span className={styles.sectionName}>Citation signals</span>
          </h2>
        </summary>
        <div className={styles.sectionBody}>
        <ul className={styles.signalList}>
          {preview.signals.map((s, i) => (
            <li
              key={s.id}
              className={styles.signalRow}
              style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
            >
              <div className={styles.signalTop}>
                <span className={styles.signalLabel}>{s.label}</span>
                <span className={styles.signalScore}>{Math.round(s.score * 100)}/100</span>
              </div>
              <div className={styles.barTrack} aria-hidden="true">
                <div className={signalBarClass(s.score)} style={{ width: `${s.score * 100}%` }} />
              </div>
              <span className={styles.signalDetail}>{s.detail}</span>
            </li>
          ))}
        </ul>
        </div>
      </details>
      </Reveal>

      {preview.fanOutQueries.length > 0 && (
        <Reveal>
        <details className={styles.section}>
          <summary className={styles.sectionSummary}>
            <Chevron />
            <h2 className={styles.sectionTitleCollapsible}>
              <span className={styles.sectionIndex}>03</span>
              <span className={styles.sectionName}>Query fan-out coverage</span>
            </h2>
          </summary>
          <div className={styles.sectionBody}>
          <p className={styles.hint}>
            Google's AI features issue related sub-queries ("query fan-out"). Based on its
            headings, this page can be retrieved for:
          </p>
          <ul className={styles.fanoutList}>
            {preview.fanOutQueries.map((q, i) => (
              <li key={i} className={styles.fanoutChip}>
                {q}
              </li>
            ))}
          </ul>
          </div>
        </details>
        </Reveal>
      )}

      <Reveal>
      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>
            <span className={styles.sectionIndex}>04</span>
            <span className={styles.sectionName}>AEO / GEO readiness</span>
          </h2>
        </summary>
        <div className={styles.sectionBody}>
        <p className={styles.hint}>Per Google Search Central's published guidance.</p>
        <ul className={styles.pillarList}>
          {insights.pillars.map((p) => (
            <li key={p.id} className={styles.issueItem}>
              <details>
                <summary className={styles.issueSummary}>
                  <span className={styles.issueTitle}>{p.title}</span>
                  <span className={pillarChipClass(p.status)}>{p.status}</span>
                </summary>
                <div className={styles.issueDetail}>
                  <p className={styles.pillarGuidance}>{p.guidance}</p>
                  <div>
                    <span className={styles.detailLabel}>On this page:</span>
                    <ul className={styles.evidenceList}>
                      {p.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Recommendations:</span>
                    <ul className={styles.evidenceList}>
                      {p.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <p className={styles.pillarSources}>
                    {p.sources.map((s) => (
                      <a
                        key={s.url}
                        className={styles.sourceLink}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.label}
                      </a>
                    ))}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
        </div>
      </details>
      </Reveal>

      <Reveal>
      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>
            <span className={styles.sectionIndex}>05</span>
            <span className={styles.sectionName}>Per Google, you can skip</span>
          </h2>
        </summary>
        <div className={styles.sectionBody}>
        <ul className={styles.skipList}>
          {insights.skipList.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        </div>
      </details>
      </Reveal>
    </div>
  );
}
