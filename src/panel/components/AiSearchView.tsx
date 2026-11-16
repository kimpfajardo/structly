import { useMemo, useState } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot } from '../../core/types';
import { buildAiSearchInsights } from '../../core/aiSearch/insights';
import type { PillarStatus } from '../../core/aiSearch/insights';
import { buildReadinessAssessment } from '../../core/readiness/readiness';
import type { ReadinessState } from '../../core/readiness/readiness';
import { Chevron } from './Chevron';
import styles from '../panel.module.css';

function pillarChipClass(status: PillarStatus): string | undefined {
  if (status === 'ready') return styles.chipPass;
  if (status === 'attention') return styles.chipWarn;
  return styles.chipFail;
}

function readinessClass(state: ReadinessState): string | undefined {
  if (state === 'supported') return styles.chipPass;
  if (state === 'blocked') return styles.chipFail;
  return styles.chipInfo;
}

function readinessLabel(state: ReadinessState): string {
  if (state === 'supported') return 'supported';
  if (state === 'blocked') return 'blocked';
  if (state === 'unverifiable-locally') return 'not verifiable locally';
  return 'needs observed data';
}

export function AiSearchView({
  snapshot,
  report,
  questions,
  onQuestionsChange,
}: {
  snapshot: PageSnapshot;
  report: AuditReport;
  questions: string[];
  onQuestionsChange: (questions: string[]) => void;
}) {
  const [draftQuestion, setDraftQuestion] = useState('');
  const issues = useMemo<AuditIssue[]>(
    () => report.categories.flatMap((category) => category.issues),
    [report],
  );
  const insights = useMemo(() => buildAiSearchInsights(snapshot, issues), [snapshot, issues]);
  const purpose = snapshot.pageType;
  const assessment = useMemo(
    () => buildReadinessAssessment({ snapshot, purpose, questions }),
    [snapshot, purpose, questions],
  );

  function addQuestion(): void {
    const question = draftQuestion.trim();
    if (!question || questions.length >= 3 || questions.includes(question)) return;
    onQuestionsChange([...questions, question]);
    setDraftQuestion('');
  }

  return (
    <div className={styles.aiView}>
      <div>
        <h2 className={styles.sectionTitle}>Local readiness</h2>
        <p className={styles.takeawayText}>
          {purpose !== 'unknown'
            ? `This is a local readiness check for a ${purpose} page. It shows what the page structurally delivers; it does not predict rankings, citations, traffic, or completed actions.`
            : 'This local readiness check shows what the page structurally delivers without assuming a page type. It does not predict rankings, citations, traffic, or completed actions.'}
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionName}>Readiness conditions</span>
        </h2>
        <ul className={styles.readinessConditions}>
          {assessment.conditions.map((condition) => (
            <li key={condition.id} className={styles.readinessCondition}>
              <details>
                <summary className={styles.readinessConditionTop}>
                  <Chevron />
                  <span className={styles.issueTitle}>{condition.label}</span>
                  <span className={readinessClass(condition.state)}>{readinessLabel(condition.state)}</span>
                </summary>
                <p>{condition.detail}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionName}>Question coverage</span>
        </h2>
        <p className={styles.hint}>
          Add up to three questions this page must make easy to answer. Structly checks where their meaningful terms appear; it does not judge answer quality.
        </p>
        <div className={styles.questionEntry}>
          <label className={styles.srOnly} htmlFor="readiness-question">
            A question this page should answer
          </label>
          <input
            id="readiness-question"
            className={styles.questionInput}
            value={draftQuestion}
            onChange={(event) => setDraftQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addQuestion();
              }
            }}
            placeholder="What should this page answer?"
            disabled={questions.length >= 3}
          />
          <button className={styles.copyButton} onClick={addQuestion} disabled={questions.length >= 3 || !draftQuestion.trim()}>
            Add
          </button>
        </div>
        {assessment.questionCoverage.items.length === 0 ? (
          <p className={styles.hint}>No questions added yet.</p>
        ) : (
          <ul className={styles.questionList}>
            {assessment.questionCoverage.items.map((item) => (
              <li key={item.question} className={styles.questionItem}>
                <div>
                  <span>{item.question}</span>
                  <small>
                    {item.matchedIn.length > 0
                      ? `Found in ${item.matchedIn.join(' and ')}`
                      : 'No meaningful terms found in the captured page evidence'}
                  </small>
                </div>
                <div className={styles.questionActions}>
                  <span className={readinessClass(item.state === 'structurally-covered' ? 'supported' : item.state === 'mentioned' ? 'unverifiable-locally' : 'blocked')}>
                    {item.state.replace('-', ' ')}
                  </span>
                  <button
                    className={styles.textButton}
                    onClick={() => onQuestionsChange(questions.filter((question) => question !== item.question))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {assessment.actionPath && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Action path</h2>
          <p className={styles.actionPathDetail}>{assessment.actionPath.detail}</p>
          <p className={styles.hint}>
            {assessment.actionPath.labeledFormControls} labeled form control(s), {assessment.actionPath.unlabeledFormControls} unlabeled.
          </p>
        </section>
      )}

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>
            <span className={styles.sectionName}>Google guidance</span>
          </h2>
        </summary>
        <div className={styles.sectionBody}>
          <ul className={styles.pillarList}>
            {insights.pillars.map((pillar) => (
              <li key={pillar.id} className={styles.issueItem}>
                <details>
                  <summary className={styles.issueSummary}>
                    <Chevron />
                    <span className={styles.issueTitle}>{pillar.title}</span>
                    <span className={pillarChipClass(pillar.status)}>{pillar.status}</span>
                  </summary>
                  <div className={styles.issueDetail}>
                    <p className={styles.pillarGuidance}>{pillar.guidance}</p>
                    <div>
                      <span className={styles.detailLabel}>On this page:</span>
                      <ul className={styles.evidenceList}>
                        {pillar.findings.map((finding, index) => <li key={index}>{finding}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span className={styles.detailLabel}>Recommendations:</span>
                      <ul className={styles.evidenceList}>
                        {pillar.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}
                      </ul>
                    </div>
                    <p className={styles.pillarSources}>
                      {pillar.sources.map((source) => (
                        <a key={source.url} className={styles.sourceLink} href={source.url} target="_blank" rel="noreferrer">
                          {source.label}
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

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <Chevron />
          <h2 className={styles.sectionTitleCollapsible}>
            <span className={styles.sectionName}>What Google says you can skip</span>
          </h2>
        </summary>
        <div className={styles.sectionBody}>
          <ul className={styles.skipList}>
            {insights.skipList.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      </details>
    </div>
  );
}
