import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Suppliers',
  title: 'Suppliers',
  subtitle: 'Repairers, assessors and service partners, and where their work is held up.',
  caption: 'Suppliers',
  basis:
    'Waits and turnaround are in business days: a wait runs from the request to today, or to completion, and is held against the {target}-day target. An average appears from {minimum} requests and always shows how many are behind it. Suppliers are listed alphabetically, not ranked.',
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
