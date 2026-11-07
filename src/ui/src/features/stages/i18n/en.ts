import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Stages & Aging',
  title: 'Stages & Aging',
  subtitle: 'Open claims by stage and by how long they have been open.',
  empty: {
    title: 'No claims by stage',
    description: 'No claims are reported as of this date for the data set.',
    filteredDescription:
      'No claims match these filters as of this date. Clear a filter to see more.',
  },
  stage: {
    title: 'Open claims by stage',
    subtitle: 'Claims in each workflow stage.',
    detail: 'Stage detail',
    chart: 'Open claims by stage',
    caption: 'Open claims and their value by stage',
    series: 'Open claims',
  },
  age: {
    title: 'Open claims by age',
    subtitle: 'Calendar days since the claim was reported.',
    detail: 'Age detail',
    detailSubtitle: 'Claims without a reported date are listed apart.',
    chart: 'Open claims by age',
    caption: 'Open claims and their value by age',
    none: 'No open claims at this date',
  },
  value: {
    stageTitle: 'Open incurred by stage',
    stageSubtitle: 'Value of the open claims: paid plus outstanding reserve.',
    stageChart: 'Open incurred by stage',
    ageTitle: 'Open incurred by age',
    ageSubtitle: 'Value of the open claims: paid plus outstanding reserve.',
    ageChart: 'Open incurred by age',
  },
  group: {
    title: 'Open claims by product, broker and owner',
    subtitle: 'Each tab splits the open claims once, so every tab adds up to the open count.',
    tabs: 'Group the open claims by',
    caption: 'Open claims and their value by {group}',
    product: 'Product',
    broker: 'Broker',
    handler: 'Owner',
    loading: 'Names are loading',
  },
  column: {
    stage: 'Stage',
    age: 'Age',
    claims: 'Claims',
    paid: 'Paid',
    reserve: 'Reserve',
    incurred: 'Incurred',
  },
  detailSubtitle: 'Each row opens the claims counted in it.',
  open: 'Open claims: {label}',
  total: 'All open claims',
  csv: {
    section: 'Section',
    item: 'Item',
    claims: 'Claims',
    paid: 'Paid (BWP)',
    reserve: 'Reserve (BWP)',
    incurred: 'Incurred (BWP)',
  },
} satisfies Catalog;

export default en;
