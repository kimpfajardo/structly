import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { AuditIssue, AuditReport, PageSnapshot } from '../../core/types';
import { buildAiSearchInsights } from '../../core/aiSearch/insights';
import type { PillarStatus } from '../../core/aiSearch/insights';
import { buildReadinessAssessment } from '../../core/readiness/readiness';
import type { ReadinessState } from '../../core/readiness/readiness';
import { Chevron } from './Chevron';
import { transitionContent } from '../transition';
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
  onQuestionsChange: Dispatch<SetStateAction<string[]>>;
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
    void transitionContent(() => {
      onQuestionsChange((current) => current.length >= 3 || current.includes(question) ? current : [...current, question]);
      setDraftQuestion((current) => current.trim() === question ? '' : current);
    });
  }

  return (
    <div className={styles.aiView}>
      <section className={styles.readinessIsland}>
        <h2 className={styles.reportHeading}>Readiness conditions</h2>
        <p className={styles.hint}>
          {purpose !== 'unknown'
            ? `Local checks for a ${purpose} page.`
            : 'Local checks for this page.'}
        </p>
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
                {condition.id === 'action-path' && assessment.actionPath && (
                  <p>{assessment.actionPath.labeledFormControls} labeled form control(s), {assessment.actionPath.unlabeledFormControls} unlabeled.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.questionIsland}>
        <h2 className={styles.reportHeading}>Question coverage</h2>
        <p className={styles.hint}>
          Add up to three questions to check meaningful terms. Answer quality is not assessed.
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
            <span className={styles.controlLabel}>Add</span>
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
                    onClick={() => void transitionContent(() => onQuestionsChange((current) => current.filter((question) => question !== item.question)))}
                  >
                    <span className={styles.controlLabel}>Remove</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.reportAppendix}>
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
      <p className={styles.reportScope}>Rankings, citations, traffic, and completed actions are not verified.</p>
    </div>
  );
}
