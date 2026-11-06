import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Exceptions & SLA',
  title: 'Exceptions & SLA',
  subtitle:
    'Open claims that need a person to look: stage targets missed, supplier delays, material reserve changes and evidence that is missing. A flag is a review cue, not a finding.',
  caption: 'Exceptions',
  summary_one: '{count} claim needs review: {high} High, {medium} Medium, {low} Low.',
  summary_other: '{count} claims need review: {high} High, {medium} Medium, {low} Low.',
  summaryOther: 'Flagged without a severity: {count}.',
  filter: {
    severity: 'Severity',
    allSeverities: 'All severities',
    reason: 'Reason',
    allReasons: 'All reasons',
  },
  column: {
    claim: 'Claim',
    severity: 'Severity',
    reasons: 'Why it needs review',
    owner: 'Owner',
    daysLate: 'Days late',
    stage: 'Stage',
    incurred: 'Incurred',
    tasks: 'Tasks',
    actions: 'Actions',
  },
  csv: {
    claim: 'Claim ID',
    incurred: 'Incurred (BWP)',
    openTasks: 'Open tasks',
  },
  tasksHint: 'Open tasks on the claim.',
  daysLateHint: 'Business days past the stage target or the supplier target, whichever is later.',
  tasksUnknown: 'Tasks could not be read',
  empty: {
    title: 'No exceptions to review',
    description:
      'No open claim has a missed target, a supplier delay, a material reserve change or missing evidence as of this date.',
    noMatchTitle: 'No exceptions match',
    noMatchDescription: 'Nothing flagged matches these filters. Clear a filter to see the rest.',
  },
} satisfies Catalog;

export default en;
