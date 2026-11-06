/** The history of changes to the rules: who changed which value, when, from what to what. */
import { useMemo } from 'react';

import type { RuleConfigAuditEntry } from '../../../../contracts/index';
import { Card, Chip, DataTable, EmptyState } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { t } from '../../lib/i18n';
import { formatMoment } from '../claim-scope';
import { formatRuleValue, ruleFieldInfo } from './fields';

/** Newest save first; the values of one save keep the editor's order. */
const newestFirst = (audit: readonly RuleConfigAuditEntry[]): RuleConfigAuditEntry[] =>
  [...audit].sort((a, b) => b.version - a.version);

const COLUMNS: readonly DataTableColumn<RuleConfigAuditEntry>[] = [
  { id: 'time', header: t('rules.audit.column.time'), cell: (entry) => formatMoment(entry.at) },
  {
    id: 'actor',
    header: t('rules.audit.column.actor'),
    cell: (entry) => t(`shell.persona.${entry.actor}`),
  },
  {
    id: 'rule',
    header: t('rules.audit.column.rule'),
    cell: (entry) => ruleFieldInfo(entry.field).label,
  },
  {
    id: 'from',
    header: t('rules.audit.column.from'),
    cell: (entry) => formatRuleValue(ruleFieldInfo(entry.field).kind, entry.from),
  },
  {
    id: 'to',
    header: t('rules.audit.column.to'),
    cell: (entry) => formatRuleValue(ruleFieldInfo(entry.field).kind, entry.to),
  },
  {
    id: 'action',
    header: t('rules.audit.column.action'),
    cell: (entry) => (
      <Chip tone={entry.action === 'RESTORED' ? 'info' : 'neutral'} size="sm">
        {t(`rules.audit.action.${entry.action}`)}
      </Chip>
    ),
  },
];

export function AuditCard({ audit }: { readonly audit: readonly RuleConfigAuditEntry[] }) {
  const rows = useMemo(() => newestFirst(audit), [audit]);
  return (
    <Card title={t('rules.audit.title')} subtitle={t('rules.audit.subtitle')} flush>
      <DataTable
        caption={t('rules.audit.caption')}
        columns={COLUMNS}
        rows={rows}
        rowKey={(entry) => `${entry.version}-${entry.field}`}
        empty={
          <EmptyState
            compact
            icon="clock"
            title={t('rules.audit.empty.title')}
            description={t('rules.audit.empty.description')}
          />
        }
      />
    </Card>
  );
}
