import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Overview',
  title: 'Overview',
  subtitle:
    'Where claims stand at the as-of date: what is open, old, high-value or past its stage target.',
  empty: {
    title: 'No claims to summarize',
    description: 'No claims are reported as of this date for the data set.',
    filteredDescription:
      'No claims match these filters as of this date. Clear a filter to see more.',
  },
  kpi: {
    open: { label: 'Open claims', hint: 'Not closed at the as-of date' },
    closed: { label: 'Closed claims', hint: 'Closed at the as-of date' },
    paid: { label: 'Paid to date', hint: 'Posted payments only' },
    reserve: { label: 'Outstanding reserve', hint: 'Latest reserve of each claim' },
    incurred: { label: 'Incurred', hint: 'Paid plus outstanding reserve' },
    sla: { label: 'SLA breaches', hint: 'Open claims past their stage target' },
    highValue: { label: 'High-value claims', hint: 'Open claims at or above the high-value level' },
    newClaims: { label: 'New claims', hint: 'Reported in the period' },
    paidInPeriod: {
      label: 'Paid in period',
      hint_one: 'Posted payments on {count} claim',
      hint_other: 'Posted payments on {count} claims',
    },
    turnaround: {
      label: 'Average closed turnaround',
      value: '{days} days',
      hint: 'Claims averaged: {averaged}. Left out for missing dates: {left}',
      undated: '{count} closed with no closing date',
    },
    highPriority: { label: 'High-priority exceptions', hint: 'Open claims with High severity' },
  },
  group: {
    asOf: 'As of {date}',
    period: '{period}: {from} to {to}',
  },
  stage: {
    title: 'Open claims by stage',
    subtitle: 'Each stage opens the claims in it.',
    chart: 'Open claims by stage',
    link: 'Stages & Aging',
  },
  age: {
    title: 'Open claims by age',
    subtitle: 'Calendar days since the claim was reported.',
    chart: 'Open claims by age',
    center: 'Open claims',
    none: 'No open claims at this date',
    link: 'Aging detail',
  },
  csv: {
    section: 'Section',
    measure: 'Measure',
    claims: 'Claims',
    amount: 'Amount (BWP)',
    days: 'Days',
    undated: 'Closed claims with no closing date',
    leftOut: 'Closed in the period, left out of the average',
  },
} satisfies Catalog;

export default en;
