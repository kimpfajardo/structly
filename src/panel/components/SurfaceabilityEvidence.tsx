import { analyzeSurfaceability } from '../../core/surfaceability';
import type { SurfaceabilityAnalysis, SurfaceabilityStatus } from '../../core/surfaceability';
import type { PageSnapshot } from '../../core/types';
import styles from './SurfaceabilityEvidence.module.css';

export type SurfaceabilityEvidenceProps =
  | { analysis: SurfaceabilityAnalysis; snapshot?: never }
  | { snapshot: PageSnapshot; analysis?: never };

const STATUS_LABELS: Record<SurfaceabilityStatus, string> = {
  delivered: 'delivered',
  partial: 'partly delivered',
  missing: 'delivery gap',
  unknown: 'not verified',
};

function statusClass(status: SurfaceabilityStatus): string | undefined {
  if (status === 'delivered') return styles.statusDelivered;
  if (status === 'unknown') return styles.statusUnknown;
  return styles.statusAttention;
}

function textCounts(main: number, body: number): string {
  return `Main: ${main} chars · page: ${body} chars`;
}

/** Presentational delivery evidence. Pass a prepared analysis, or a snapshot for local analysis. */
export function SurfaceabilityEvidence(props: SurfaceabilityEvidenceProps) {
  const analysis = props.analysis ?? analyzeSurfaceability(props.snapshot!);
  const { metrics } = analysis;

  return (
    <section className={styles.section} aria-labelledby="surfaceability-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Surfaceability evidence</p>
          <h2 id="surfaceability-title" className={styles.title}>
            What machines receive
          </h2>
        </div>
        <span className={statusClass(analysis.status)}>{STATUS_LABELS[analysis.status]}</span>
      </header>

      <p className={styles.summary}>{analysis.summary}</p>

      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Rendered page</dt>
          <dd>{textCounts(metrics.renderedMainTextLength, metrics.renderedBodyTextLength)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Initial HTML</dt>
          <dd>
            {metrics.rawAvailable
              ? textCounts(metrics.rawMainTextLength ?? 0, metrics.rawBodyTextLength ?? 0)
              : 'Unavailable in this audit'}
          </dd>
        </div>
      </dl>

      <div className={styles.detail}>
        <span>Scope</span>
        <strong>{analysis.scopeLabel}</strong>
      </div>
      <p className={styles.fixDirection}>{analysis.fixDirection}</p>
    </section>
  );
}
