import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Action Queue',
  title: 'Action Queue',
  subtitle: 'Follow-up tasks on claims, with their owner, due date and status.',
  empty: {
    title: 'No actions in the queue',
    description: 'Tasks appear here once they are raised from an exception or a claim.',
  },
} satisfies Catalog;

export default en;
