import type { Severity, TaskPriority, TaskStatus } from '../../../../contracts/index';
import { t } from '../../lib/i18n';

export const priorityLabel = (priority: TaskPriority): string =>
  t(`claim-tasks.priority.${priority}`);
export const statusLabel = (status: TaskStatus): string => t(`claim-tasks.status.${status}`);

/** The priority a new task starts with: it follows the claim's severity, and the user can change it. */
export function suggestedPriority(severity: Severity | null): TaskPriority {
  switch (severity) {
    case 'High':
      return 'HIGH';
    case 'Medium':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}
