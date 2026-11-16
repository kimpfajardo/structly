import type { AuditReport, PageSnapshot } from '../../core/types';
import { Chevron } from './Chevron';
import panelStyles from '../panel.module.css';
import styles from './recheck-receipt.module.css';

function actionableCount(report: AuditReport): number {
  return report.categories.flatMap((category) => category.issues).filter(
    (issue) => issue.status === 'fail' || issue.status === 'warn',
  ).length;
}

function changeLabel(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function RecheckReceipt({
  before,
  after,
}: {
  before: { report: AuditReport; snapshot: PageSnapshot };
  after: { report: AuditReport; snapshot: PageSnapshot };
}) {
  const scoreChange = after.report.overallScore - before.report.overallScore;
  const issueChange = actionableCount(after.report) - actionableCount(before.report);
  const rawChange = after.snapshot.raw.mainTextLength - before.snapshot.raw.mainTextLength;
  const renderedChange = after.snapshot.rendered.mainTextLength - before.snapshot.rendered.mainTextLength;

  return (
    <details className={panelStyles.section} aria-labelledby="recheck-receipt-title">
      <summary className={panelStyles.sectionSummary}>
        <Chevron />
        <div className={styles.summaryText}>
          <h2 id="recheck-receipt-title" className={panelStyles.sectionTitleCollapsible}>
            Recheck receipt
          </h2>
          <p className={styles.delta}>Score {changeLabel(scoreChange)} · Findings {changeLabel(issueChange)}</p>
        </div>
      </summary>
      <ul className={styles.list}>
        <li>
          <span>Checklist score</span>
          <strong>
            {before.report.overallScore} → {after.report.overallScore} ({changeLabel(scoreChange)})
          </strong>
        </li>
        <li>
          <span>Fixable findings</span>
          <strong>
            {actionableCount(before.report)} → {actionableCount(after.report)} ({changeLabel(issueChange)})
          </strong>
        </li>
        <li>
          <span>Initial HTML text</span>
          <strong>{changeLabel(rawChange)} characters</strong>
        </li>
        <li>
          <span>Rendered main text</span>
          <strong>{changeLabel(renderedChange)} characters</strong>
        </li>
      </ul>
    </details>
  );
}
