import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Claims',
  title: 'Claims',
  subtitle: 'Every claim with its stage, owner and money, as of the date chosen above.',
  empty: {
    title: 'No claims to list',
    description: 'No claims are reported as of this date for the data set.',
    noMatchTitle: 'No claims match',
    noMatchDescription:
      'Nothing is reported as of this date for these filters. Clear a filter or show all claims.',
  },
  caption: 'Claims',
  criterion: {
    label: 'Showing',
    count_one: '{count} claim',
    count_other: '{count} claims',
    showAll: 'Show all claims',
    unknown: 'This view is not one the Claims page knows, so every claim is listed.',
  },
  column: {
    claim: 'Claim',
    client: 'Client',
    product: 'Product',
    stage: 'Stage',
    age: 'Age (days)',
    handler: 'Handler',
    paid: 'Paid',
    paidInPeriod: 'Paid in period',
    reserve: 'Reserve',
    incurred: 'Incurred',
    sla: 'SLA',
    severity: 'Severity',
  },
  csv: {
    claim: 'Claim ID',
    paid: 'Paid (BWP)',
    paidInPeriod: 'Paid in period (BWP)',
    reserve: 'Reserve (BWP)',
    incurred: 'Incurred (BWP)',
  },
} satisfies Catalog;

export default en;
