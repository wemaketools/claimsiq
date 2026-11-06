import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Exceptions & SLA',
  title: 'Exceptions & SLA',
  subtitle:
    'Claims that need review: overdue stages, old claims, reserve jumps, supplier delays and missing evidence.',
  empty: {
    title: 'No exceptions to review',
    description:
      'Exceptions appear once a claims dataset is loaded and the service-level rules have run.',
  },
} satisfies Catalog;

export default en;
