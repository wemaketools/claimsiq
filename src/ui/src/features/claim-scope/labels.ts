import type { Severity, SlaStatus } from '../../../../contracts/index';
import { t } from '../../lib/i18n';

export const slaLabel = (status: SlaStatus): string => t(`claim-scope.sla.${status}`);
export const severityLabel = (severity: Severity): string => t(`claim-scope.severity.${severity}`);
