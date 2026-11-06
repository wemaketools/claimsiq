import type { Catalog } from '../../../lib/i18n';

const en = {
  filters: {
    label: 'Claim filters',
    policy: 'Policy',
    allPolicies: 'All policies',
    broker: 'Broker',
    allBrokers: 'All brokers',
    product: 'Product',
    allProducts: 'All products',
    handler: 'Handler',
    allHandlers: 'All handlers',
    period: 'Period',
    loadFailed: 'The filter choices could not be loaded',
  },
  export: {
    button: 'Export CSV',
  },
  noBroker: 'No broker',
  period: {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    mtd: 'Month to date',
  },
  stage: {
    New: 'New',
    Triage: 'Triage',
    Assessment: 'Assessment',
    Negotiation: 'Negotiation',
    Approved: 'Approved',
    Settlement: 'Settlement',
    Closed: 'Closed',
    Reopened: 'Reopened',
    unknown: 'Unknown',
  },
  age: {
    bucket: '{bucket} days',
    unknown: 'Age unknown',
  },
  sla: {
    breached: 'Breached',
    approaching: 'Approaching',
    within: 'Within target',
    unknown: 'Unknown',
  },
  severity: {
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
  },
  criteria: {
    open: 'Open claims',
    closed: 'Closed claims',
    'sla-breached': 'Open claims past their stage target',
    'high-value': 'High-value open claims',
    paid: 'Claims with payments',
    reserve: 'Claims with an outstanding reserve',
    incurred: 'Claims with incurred cost',
    stage: 'Open claims in {stage}',
    age: 'Open claims aged {age}',
    'new-in-period': 'Claims reported in the period',
    'paid-in-period': 'Claims with payments posted in the period',
    turnaround: 'Claims closed in the period with both dates (the claims averaged)',
    'high-priority': 'Open claims with High severity',
    stageUnknown: 'Open claims with no stage recorded',
    ageUnknown: 'Open claims with no reported date',
  },
} satisfies Catalog;

export default en;
