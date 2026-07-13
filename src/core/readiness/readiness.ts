// Local readiness assessment. It only reports signals present in PageSnapshot; it does not
// generate answers, predict citations, or claim observed search performance.

import { normalizeText } from '../text';
import type { PageSnapshot, PageType } from '../types';
import { VAGUE_TEXT } from '../rules/constants';

export type ConfirmedPagePurpose = Exclude<PageType, 'unknown'>;
export type ReadinessState = 'supported' | 'blocked' | 'unverifiable-locally' | 'needs-observed-data';
export type QuestionCoverageState = 'structurally-covered' | 'mentioned' | 'not-found';
export type ActionPathState = 'named-primary-cta' | 'generic-primary-cta' | 'form-fields-only' | 'missing';

export interface QuestionCoverage {
  question: string;
  state: QuestionCoverageState;
  matchedTerms: string[];
  matchedIn: Array<'heading' | 'leading-content' | 'metadata'>;
}

export interface QuestionCoverageSummary {
  items: QuestionCoverage[];
  structurallyCovered: number;
  mentioned: number;
  notFound: number;
}

export interface ActionPathAssessment {
  state: ActionPathState;
  name: string | null;
  labeledFormControls: number;
  unlabeledFormControls: number;
  detail: string;
}

export interface ReadinessCondition {
  id: 'purpose' | 'initial-content' | 'question-coverage' | 'action-path' | 'observed-performance';
  state: ReadinessState;
  label: string;
  detail: string;
}

export interface ReadinessInput {
  snapshot: PageSnapshot;
  purpose: PageType;
  questions?: string[];
}

export interface ReadinessAssessment {
  purpose: PageType;
  questionCoverage: QuestionCoverageSummary;
  actionPath: ActionPathAssessment | null;
  conditions: ReadinessCondition[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how',
  'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'to', 'what', 'when', 'where', 'which',
  'who', 'why', 'with', 'you', 'your',
]);

const ACTION_PURPOSES: ConfirmedPagePurpose[] = ['marketing', 'product', 'account'];

function terms(text: string | null | undefined): Set<string> {
  return new Set(
    (normalizeText(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [])
      .filter((term) => !STOP_WORDS.has(term)),
  );
}

function matchedTerms(question: Set<string>, source: Set<string>): string[] {
  return [...question].filter((term) => source.has(term));
}

function questionCoverage(snapshot: PageSnapshot, questions: string[]): QuestionCoverageSummary {
  const headingTerms = terms(snapshot.headings.map((heading) => heading.text).join(' '));
  const leadingContentTerms = terms(snapshot.topContentText);
  const metadataTerms = terms(`${snapshot.meta.title ?? ''} ${snapshot.meta.metaDescription ?? ''}`);
  const items = questions
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 3)
    .map((question) => {
      const requested = terms(question);
      const inHeading = matchedTerms(requested, headingTerms);
      const inLeadingContent = matchedTerms(requested, leadingContentTerms);
      const inMetadata = matchedTerms(requested, metadataTerms);
      const matched = new Set([...inHeading, ...inLeadingContent, ...inMetadata]);
      const sharedHeadingAndContent = inHeading.some((term) => inLeadingContent.includes(term));
      const matchedIn: QuestionCoverage['matchedIn'] = [];
      if (inHeading.length > 0) matchedIn.push('heading');
      if (inLeadingContent.length > 0) matchedIn.push('leading-content');
      if (inMetadata.length > 0) matchedIn.push('metadata');
      const state: QuestionCoverageState =
        sharedHeadingAndContent
          ? 'structurally-covered'
          : matched.size > 0
            ? 'mentioned'
            : 'not-found';

      return {
        question,
        state,
        matchedTerms: [...matched],
        matchedIn,
      };
    });

  return {
    items,
    structurallyCovered: items.filter((item) => item.state === 'structurally-covered').length,
    mentioned: items.filter((item) => item.state === 'mentioned').length,
    notFound: items.filter((item) => item.state === 'not-found').length,
  };
}

function assessActionPath(snapshot: PageSnapshot): ActionPathAssessment {
  const primaryName = normalizeText(snapshot.primaryCta?.accessibleName || snapshot.primaryCta?.text);
  const labeledFormControls = snapshot.formControls.filter(
    (control) => control.hasLabel || normalizeText(control.accessibleName) !== '',
  ).length;
  const unlabeledFormControls = snapshot.formControls.length - labeledFormControls;

  if (primaryName) {
    if (VAGUE_TEXT.includes(primaryName.toLowerCase())) {
      return {
        state: 'generic-primary-cta',
        name: primaryName,
        labeledFormControls,
        unlabeledFormControls,
        detail: `Primary CTA is named "${primaryName}", but the label does not state the outcome.`,
      };
    }
    return {
      state: 'named-primary-cta',
      name: primaryName,
      labeledFormControls,
      unlabeledFormControls,
      detail: `Primary CTA is named "${primaryName}". Its destination and completion are outside this snapshot.`,
    };
  }

  if (snapshot.formControls.length > 0) {
    return {
      state: 'form-fields-only',
      name: null,
      labeledFormControls,
      unlabeledFormControls,
      detail:
        unlabeledFormControls > 0
          ? `${unlabeledFormControls} form control(s) lack a usable label.`
          : 'Form fields are labeled, but this snapshot does not expose the submit action or destination.',
    };
  }

  return {
    state: 'missing',
    name: null,
    labeledFormControls,
    unlabeledFormControls,
    detail: 'No primary CTA or form fields were detected in the snapshot.',
  };
}

function initialContentCondition(snapshot: PageSnapshot): ReadinessCondition {
  if (!snapshot.raw.available) {
    return {
      id: 'initial-content',
      state: 'unverifiable-locally',
      label: 'Initial content delivery',
      detail: 'Raw HTML was unavailable, so initial content delivery could not be checked.',
    };
  }
  if (snapshot.raw.bodyTextLength < 100 || (snapshot.raw.mainTextLength < 200 && snapshot.rendered.mainTextLength > 600)) {
    return {
      id: 'initial-content',
      state: 'blocked',
      label: 'Initial content delivery',
      detail: `Raw HTML exposes ${snapshot.raw.mainTextLength} main-text characters; the rendered page exposes ${snapshot.rendered.mainTextLength}.`,
    };
  }
  return {
    id: 'initial-content',
    state: 'supported',
    label: 'Initial content delivery',
    detail: `Raw HTML exposes ${snapshot.raw.mainTextLength} main-text characters.`,
  };
}

function actionPathCondition(
  purpose: ConfirmedPagePurpose,
  actionPath: ActionPathAssessment,
): ReadinessCondition {
  if (actionPath.state === 'named-primary-cta') {
    return { id: 'action-path', state: 'supported', label: 'Action path', detail: actionPath.detail };
  }
  if (!ACTION_PURPOSES.includes(purpose) && actionPath.state === 'missing') {
    return {
      id: 'action-path',
      state: 'supported',
      label: 'Action path',
      detail: `A primary action is optional for a ${purpose} page.`,
    };
  }
  return {
    id: 'action-path',
    state: actionPath.state === 'form-fields-only' && actionPath.unlabeledFormControls === 0
      ? 'unverifiable-locally'
      : 'blocked',
    label: 'Action path',
    detail: actionPath.detail,
  };
}

export function buildReadinessAssessment({ snapshot, purpose, questions = [] }: ReadinessInput): ReadinessAssessment {
  const coverage = questionCoverage(snapshot, questions);
  const knownPurpose = purpose === 'unknown' ? null : purpose;
  const actionPath = knownPurpose ? assessActionPath(snapshot) : null;
  const questionState: ReadinessState =
    coverage.items.length === 0
      ? 'unverifiable-locally'
      : coverage.structurallyCovered === coverage.items.length
        ? 'supported'
        : 'blocked';

  const conditions: ReadinessCondition[] = [
    initialContentCondition(snapshot),
    {
      id: 'question-coverage',
      state: questionState,
      label: 'Question coverage',
      detail:
        coverage.items.length === 0
          ? 'No questions were supplied for a structural coverage check.'
          : `${coverage.structurallyCovered}/${coverage.items.length} question(s) match both a heading and the captured leading content. This does not verify answer quality or correctness.`,
    },
  ];

  if (knownPurpose && actionPath) {
    conditions.unshift({
      id: 'purpose',
      state: 'supported',
      label: 'Identified page type',
      detail: `This page is being assessed as ${knownPurpose}.`,
    });
    conditions.push(actionPathCondition(knownPurpose, actionPath));
  }

  conditions.push({
    id: 'observed-performance',
    state: 'needs-observed-data',
    label: 'Observed discovery and conversion',
    detail: 'Local page signals cannot verify ranking, citations, traffic, or completed actions.',
  });

  return { purpose, questionCoverage: coverage, actionPath, conditions };
}
