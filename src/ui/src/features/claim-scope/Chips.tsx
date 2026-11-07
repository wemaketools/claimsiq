/** The severity and SLA chips of a claim, so the Claims list, the Exceptions queue and Claim Detail say them alike. */
import type { Severity, SlaStatus } from '../../../../contracts/index';
import { Chip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { severityLabel, slaLabel } from './labels';

const SLA_TONE = {
  breached: 'danger',
  approaching: 'warning',
  within: 'success',
  unknown: 'neutral',
} as const satisfies Record<SlaStatus, ChipTone>;
const SEVERITY_TONE = {
  High: 'danger',
  Medium: 'warning',
  Low: 'info',
} as const satisfies Record<Severity, ChipTone>;

export function SlaChip({ status }: { readonly status: SlaStatus }) {
  return (
    <Chip tone={SLA_TONE[status]} size="sm">
      {slaLabel(status)}
    </Chip>
  );
}

export function SeverityChip({ severity }: { readonly severity: Severity }) {
  return (
    <Chip tone={SEVERITY_TONE[severity]} size="sm">
      {severityLabel(severity)}
    </Chip>
  );
}
