/** The rules as a persona that may not edit them reads them: the saved value beside the spec's default. */
import { Card, Chip, DataTable } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import type { RuleConfigState } from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import { draftOf } from './draft';
import { RULE_GROUPS, formatRuleValue, ruleFieldsOf } from './fields';
import type { RuleFieldInfo } from './fields';

export function RulesValues({ data }: { readonly data: RuleConfigState }) {
  const saved = draftOf(data.config.claims);
  const defaults = draftOf(data.defaults.claims);
  const columns: DataTableColumn<RuleFieldInfo>[] = [
    {
      id: 'rule',
      header: t('rules.values.rule'),
      cell: (info) => (
        <>
          <span>{info.label}</span>
          {info.hint !== null && <span className="ciq-cell-sub">{info.hint}</span>}
        </>
      ),
    },
    {
      id: 'saved',
      header: t('rules.values.saved'),
      cell: (info) => (
        <span className="ciq-inline">
          <span>{formatRuleValue(info.kind, saved[info.field] ?? null)}</span>
          {saved[info.field] !== defaults[info.field] && (
            <Chip tone="info" size="sm">
              {t('rules.changedFromDefault')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'default',
      header: t('rules.values.default'),
      cell: (info) => formatRuleValue(info.kind, defaults[info.field] ?? null),
    },
  ];
  const fields = ruleFieldsOf(data.config.claims);
  return (
    <>
      {RULE_GROUPS.map((group) => (
        <Card
          key={group}
          title={t(`rules.group.${group}.title`)}
          subtitle={t(`rules.group.${group}.subtitle`)}
          flush
        >
          <DataTable
            caption={t('rules.values.caption', { group: t(`rules.group.${group}.title`) })}
            columns={columns}
            rows={fields.filter((info) => info.group === group)}
            rowKey={(info) => info.field}
          />
        </Card>
      ))}
    </>
  );
}
