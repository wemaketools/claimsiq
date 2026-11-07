import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Digest',
  title: 'Digest',
  subtitle:
    'The claims position at the as-of date on one printable page, from the same figures as the other screens.',
  print: 'Print or save as PDF',
  sheet: {
    title: 'Claims digest',
    dataSet: 'Data set',
    asOf: 'As of',
    filters: 'Filters',
    noFilters: 'None, all claims',
    note: 'Figures come from the same rules as the Overview, Exceptions, Suppliers and Action Queue screens. A flag is a review indicator, not a finding.',
  },
  empty: {
    title: 'No claims to summarize',
    description:
      'There are no claims at this as-of date. Choose a later date, or another data set.',
    filteredDescription: 'No claim matches the filters. Clear a filter to widen the view.',
  },
  headline: {
    title: 'Headline figures',
  },
  shown: 'Showing {shown} of {total}.',
  exceptions: {
    title: 'Top exceptions',
    subtitle: 'Open claims the rules flagged, highest severity first.',
    link: 'All exceptions',
    caption: 'Top exceptions',
    none: 'No open claim is flagged for review',
    noneDescription: 'Nothing is past a stage target, delayed with a supplier or materially moved.',
    column: {
      claim: 'Claim',
      severity: 'Severity',
      reasons: 'Why it needs review',
      owner: 'Owner',
      daysLate: 'Days late',
      stage: 'Stage',
      incurred: 'Incurred',
    },
  },
  reserve: {
    title: 'Material reserve movements',
    subtitle: 'Reserve changes on open claims that met the material test, newest first.',
    link: 'All claims',
    caption: 'Material reserve movements',
    none: 'No open claim has a material reserve movement',
    summary: 'Open claims with a material reserve movement: {claims}.',
    up: 'Up {amount}',
    down: 'Down {amount}',
    percent: '{percent}% of the earlier amount',
    column: {
      claim: 'Claim',
      date: 'Date',
      before: 'Before',
      after: 'After',
      change: 'Change',
      basis: 'Material because',
    },
  },
  suppliers: {
    title: 'Supplier delays',
    subtitle:
      'Suppliers with an open request past the {target}-day target, or with a request that has no request time. Alphabetical, not ranked.',
    link: 'Suppliers',
    caption: 'Supplier delays',
    none: 'No supplier request is past its target',
    noneDescription: 'Every open request with a request time is within the target.',
    claims_one: '{count} claim has a request past the target; {unverified} with no request time.',
    claims_other:
      '{count} claims have a request past the target; {unverified} with no request time.',
    baseline_one:
      'All suppliers’ open waits together: {count} request, median {median} and 90th percentile {p90} (business days) against the {target}-day target.',
    baseline_other:
      'All suppliers’ open waits together: {count} requests, median {median} and 90th percentile {p90} (business days) against the {target}-day target.',
    baselineNotEnough_one:
      'All suppliers’ open waits together: {count} request, not enough for percentiles (needed: {minimum}).',
    baselineNotEnough_other:
      'All suppliers’ open waits together: {count} requests, not enough for percentiles (needed: {minimum}).',
    column: {
      supplier: 'Supplier',
      open: 'Open requests',
      pastTarget: 'Past target',
      longest: 'Longest wait',
      median: 'Median wait',
      p90: '90th percentile',
    },
    noRequestTime: '{count} with no request time',
    notEnough: 'Not enough data: {count} of {minimum} needed',
  },
  actions: {
    title: 'Open actions',
    subtitle: 'Tasks not done, overdue first, then by priority and due date.',
    link: 'Action Queue',
    caption: 'Open actions',
    none: 'No open actions',
    noneDescription: 'Every task is done, or none has been created.',
    summary_one: '{count} open action, {overdue} overdue.',
    summary_other: '{count} open actions, {overdue} overdue.',
    filtered: 'Only tasks on the claims in view are counted.',
    column: {
      task: 'Task',
      claim: 'Claim',
      owner: 'Owner',
      due: 'Due',
      priority: 'Priority',
      status: 'Status',
    },
  },
} satisfies Catalog;

export default en;
