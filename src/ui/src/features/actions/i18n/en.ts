import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Action Queue',
  title: 'Action Queue',
  subtitle: 'Follow-up tasks on claims, with their owner, due date and status.',
  caption: 'Action Queue',
  create: 'Create task',
  column: {
    claim: 'Claim',
    issue: 'Issue',
    owner: 'Owner',
    due: 'Due',
    priority: 'Priority',
    status: 'Status',
    updated: 'Updated',
    notes: 'Notes',
    actions: 'Actions',
  },
  filter: {
    label: 'Task filters',
    status: 'Status',
    allStatuses: 'All statuses',
    owner: 'Owner',
    allOwners: 'All owners',
    unassigned: 'Not assigned',
    priority: 'Priority',
    allPriorities: 'All priorities',
  },
  summary_one:
    '{count} task: {overdue} overdue, {open} open, {inProgress} in progress, {done} done.',
  summary_other:
    '{count} tasks: {overdue} overdue, {open} open, {inProgress} in progress, {done} done.',
  unassigned: 'Not assigned',
  noIssue: 'Not flagged',
  noNotes: 'No note',
  issuesUnknown: 'The claim flags could not be loaded',
  rowActions: 'Actions for {task}',
  openClaim: 'Open claim',
  history: {
    open: 'History of {task}',
    title: 'Task {task}',
    subtitle: 'Every change shows who made it and when.',
  },
  csv: {
    task: 'Task ID',
    claim: 'Claim ID',
    overdue: 'Overdue',
    yes: 'Yes',
    no: 'No',
  },
  empty: {
    title: 'No actions in the queue',
    description: 'Tasks appear here once they are raised from an exception or a claim.',
    noMatchTitle: 'No tasks match',
    noMatchDescription: 'Change or clear the filters to see more tasks.',
  },
} satisfies Catalog;

export default en;
