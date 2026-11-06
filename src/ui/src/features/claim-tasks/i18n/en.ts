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
    claim: 'Claim',
    chooseClaim: 'Choose the claim',
    claimsFailed: 'The claims could not be loaded',
    scopeNoClaim: 'No claim chosen yet',
  },
  assign: {
    button: 'Assign owner',
    buttonFor: 'Assign owner of {task}',
    title: 'Assign an owner',
    scope: '{task} on {claim}',
    consequence:
      'The task is assigned to the person you choose. The change is logged with you as the actor and the time.',
    confirm: 'Assign',
    owner: 'Owner',
    choose: 'Choose an owner',
    done: 'Task {task} assigned to {owner}.',
  },
  status: {
    OPEN: 'Open',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
    button: 'Change status',
    buttonFor: 'Change status of {task}',
    title: 'Change the status',
    scope: '{task} on {claim}, now {status}',
    consequence:
      'The task moves to the status you choose. The change is logged with you as the actor, the time and your note.',
    confirm: 'Change status',
    next: 'New status',
    choose: 'Choose a status',
    note: 'Note',
    noteHint: 'Optional: what happened, for the history.',
    done: 'Task {task} is now {status}.',
  },
  audit: {
    CREATED: 'Created as {to}',
    ASSIGNED: 'Assigned to {to}',
    STATUS_CHANGED: 'Status changed from {from} to {to}',
    unassignedFrom: 'not assigned',
    by: '{actor} · {time}',
    note: 'Note: {note}',
    title: 'History of {task}',
  },
  priority: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' },
} satisfies Catalog;

export default en;
