/** The stage what-if: pick another stage and read the rules engine's stage, SLA and severity for it next to the real ones. Nothing is saved. */
import { useState } from 'react';
import type { ReactNode } from 'react';

import { endpoints } from '../../../../contracts/index';
import type { ClaimFacts } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  QueryView,
  Select,
  SkeletonBlock,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { t } from '../../lib/i18n';
import { SeverityChip, SlaChip, formatMoment, slaSummary, stageLabel } from '../claim-scope';

interface Row {
  readonly key: string;
  readonly label: string;
  readonly show: (facts: ClaimFacts) => ReactNode;
}

const ROWS: readonly Row[] = [
  {
    key: 'stage',
    label: t('claim-detail.whatIf.row.stage'),
    show: (f) => stageLabel(f.current_stage),
  },
  {
    key: 'sla',
    label: t('claim-detail.whatIf.row.sla'),
    show: (f) =>
      f.sla === null ? (
        t('claim-detail.whatIf.noClock')
      ) : (
        <>
          <SlaChip status={f.sla.status} />
          <span className="ciq-cell-sub">{slaSummary(f)}</span>
        </>
      ),
  },
  {
    key: 'severity',
    label: t('claim-detail.whatIf.row.severity'),
    show: (f) =>
      f.severity === null ? (
        t('claim-detail.whatIf.noSeverity')
      ) : (
        <SeverityChip severity={f.severity} />
      ),
  },
  {
    key: 'started',
    label: t('claim-detail.whatIf.row.started'),
    show: (f) => formatMoment(f.stage_started_at),
  },
];

export function WhatIfCard({ claimId }: { readonly claimId: string }) {
  const [picked, setPicked] = useState('');
  const query = useApiQuery(
    endpoints.claimsWhatIf,
    { params: { claimId }, query: picked === '' ? {} : { to_stage: picked } },
    { keepPrevious: true },
  );

  return (
    <Card
      title={t('claim-detail.whatIf.title')}
      subtitle={t('claim-detail.whatIf.subtitle')}
      actions={
        <>
          <Chip tone="warning" size="sm" icon="alertTriangle">
            {t('claim-detail.whatIf.label')}
          </Chip>
          <Button size="sm" icon="refresh" disabled={picked === ''} onClick={() => setPicked('')}>
            {t('claim-detail.whatIf.reset')}
          </Button>
        </>
      }
    >
      <QueryView
        query={query}
        errorTitle={t('claim-detail.whatIf.failed')}
        isEmpty={(data) => data.next_stages.length === 0}
        empty={<EmptyState compact title={t('claim-detail.whatIf.none')} />}
      >
        {(data) => {
          const shown = data.what_if?.to_stage === picked ? data.what_if : null;
          const columns: DataTableColumn<Row>[] = [
            {
              id: 'measure',
              header: t('claim-detail.whatIf.column.measure'),
              cell: (row) => row.label,
            },
            {
              id: 'now',
              header: t('claim-detail.whatIf.column.now'),
              cell: (row) => row.show(data.current),
            },
            {
              id: 'whatIf',
              header: t('claim-detail.whatIf.column.whatIf', {
                stage: stageLabel(shown?.to_stage ?? null),
              }),
              cell: (row) => (shown === null ? null : row.show(shown.facts)),
            },
          ];
          return (
            <div className="ciq-stack">
              <Select
                label={t('claim-detail.whatIf.pick')}
                placeholder={t('claim-detail.whatIf.placeholder')}
                value={picked}
                onChange={setPicked}
                options={data.next_stages.map((stage) => ({
                  value: stage,
                  label: stageLabel(stage),
                }))}
                hint={t('claim-detail.whatIf.hint')}
              />
              {picked === '' ? (
                <p className="ciq-text-muted">{t('claim-detail.whatIf.idle')}</p>
              ) : shown === null ? (
                <SkeletonBlock lines={4} />
              ) : (
                <>
                  <DataTable
                    caption={t('claim-detail.whatIf.caption', {
                      stage: stageLabel(shown.to_stage),
                    })}
                    columns={columns}
                    rows={[...ROWS]}
                    rowKey={(row) => row.key}
                  />
                  <p className="ciq-text-muted">
                    {t('claim-detail.whatIf.note', { date: formatMoment(shown.event_at) })}
                  </p>
                </>
              )}
            </div>
          );
        }}
      </QueryView>
    </Card>
  );
}
