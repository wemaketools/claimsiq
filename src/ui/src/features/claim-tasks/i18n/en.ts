import type { Catalog } from '../../../lib/i18n';

const en = {
  create: {
    button: 'Create follow-up task',
    short: 'Follow-up task',
    buttonFor: 'Create follow-up task for {claim}',
    title: 'Create a follow-up task',
    scope: '{claim}',
    consequence:
      'A task is opened on the claim with you as the creator. Its creation and every later change are logged with the person and the time.',
    confirm: 'Create task',
    nextAction: 'Next action',
    nextActionHint:
      'What should happen next, for example: chase the repair estimate and confirm a date.',
    assignee: 'Assign to',
    unassigned: 'Not assigned yet',
    priority: 'Priority',
    due: 'Due date',
    created: 'Task {task} created for {claim}.',
  },
  priority: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' },
  status: { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done' },
} satisfies Catalog;

export default en;
