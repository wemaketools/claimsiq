import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Suppliers',
  title: 'Suppliers',
  subtitle: 'Repairers, assessors and service partners, and where their work is held up.',
  caption: 'Suppliers',
  basis_one:
    'Waits and turnaround are in business days: a wait runs from the request to today, or to completion, and is held against the {target}-day target. An average or percentile appears from {count} request and always shows how many are behind it. Suppliers are listed alphabetically.',
  basis_other:
    'Waits and turnaround are in business days: a wait runs from the request to today, or to completion, and is held against the {target}-day target. An average or percentile appears from {count} requests and always shows how many are behind it. Suppliers are listed alphabetically.',
  column: {
    supplier: 'Supplier',
    open: 'Open requests',
    wait: 'Average wait',
    longest: 'Longest wait',
    breaches: 'Past target',
    cases: 'Open cases',
    late: 'Late actions',
    turnaround: 'Avg turnaround',
  },
  percentiles: {
    title: 'Waits against the baseline',
    subtitle_one:
      'The median and 90th percentile of open request waits, in business days, held against the {target}-day target and against every supplier’s waits together. A supplier is placed from {count} request; with fewer it shows how many it has and no percentile.',
    subtitle_other:
      'The median and 90th percentile of open request waits, in business days, held against the {target}-day target and against every supplier’s waits together. A supplier is placed from {count} requests; with fewer it shows how many it has and no percentile.',
    caption: 'Wait percentiles by supplier',
    chart: 'Median and 90th percentile wait by supplier',
    baseline: 'All suppliers (baseline)',
    baselineHint: 'Every supplier’s open waits together',
    column: {
      sample: 'Requests behind it',
      median: 'Median wait',
      p90: '90th percentile wait',
    },
    within: 'Within the target',
    over: 'Over the target',
    target: 'Target ({target} days)',
    notEnough: 'Not enough data: {count} of {minimum} needed',
    nonePlaced_one:
      'Not enough data yet: no supplier has {count} open request with a request time, so none is placed against the baseline.',
    nonePlaced_other:
      'Not enough data yet: no supplier has {count} open requests with a request time, so none is placed against the baseline.',
    method:
      'Percentiles use the nearest-rank method: each is a wait that was observed, and the median of two waits is the shorter one.',
  },
  hint: {
    late: 'Tasks past their due date and not done, on the claims behind this supplier’s figures.',
    cases: 'Open claims assigned to this supplier.',
    breaches: 'Open requests waiting longer than the target.',
  },
  unverified_one: '{count} with no request time',
  unverified_other: '{count} with no request time',
  sample_one: '{count} request',
  sample_other: '{count} requests',
  completedSample_one: '{count} completed request',
  completedSample_other: '{count} completed requests',
  notEnough: '{count} of {minimum} needed',
  noRequests: 'No requests',
  noneCompleted: 'None completed',
  inactive: 'Inactive',
  viewCases: 'View the cases behind {supplier}',
  csv: {
    supplier: 'Supplier',
    id: 'Supplier ID',
    type: 'Service type',
    open: 'Open requests',
    wait: 'Average wait (business days)',
    waitSample: 'Requests behind the average wait',
    median: 'Median wait (business days)',
    p90: '90th percentile wait (business days)',
    medianVsTarget: 'Median against the target',
    p90VsTarget: '90th percentile against the target',
    longest: 'Longest wait (business days)',
    breaches: 'Past the target',
    unverified: 'Requests with no request time',
    cases: 'Open assigned cases',
    late: 'Late actions',
    turnaround: 'Average turnaround (business days)',
    turnaroundSample: 'Completed requests behind the turnaround',
    contributing: 'Cases behind these figures',
  },
  empty: {
    title: 'No suppliers to show',
    description: 'Supplier performance appears once a claims dataset with suppliers is loaded.',
  },
} satisfies Catalog;

export default en;
