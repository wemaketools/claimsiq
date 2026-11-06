import { useMemo, useState } from 'react';

import { formatMoney } from '../../../../contracts/index';
import type { ClaimsSummary } from '../../../../contracts/index';
import { BarList, StackedBarChart } from '../../components/charts';
import {
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  QueryView,
  SkeletonBlock,
  Tabs,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import {
  ClaimFilterBar,
  ExportCsvButton,
  ageRows,
  claimsLink,
  groupRows,
  stageRows,
  useClaimScope,
} from '../claim-scope';
import type { BreakdownRow, ClaimFactsAnswer, ClaimLookups, GroupRow } from '../claim-scope';

/** Counts only come in whole numbers, so the axes label no halves. */
const wholeNumbers = (value: number): string => (Number.isInteger(value) ? formatCount(value) : '');

const GROUPS = ['product', 'broker', 'handler'] as const;
type Group = (typeof GROUPS)[number];

interface Valued {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly paid: string;
  readonly reserve: string;
  readonly incurred: string;
}

function columns<T extends Valued>(firstHeader: string): DataTableColumn<T>[] {
  return [
    { id: 'label', header: firstHeader, cell: (row) => row.label },
    {
      id: 'count',
      header: t('stages.column.claims'),
      numeric: true,
      cell: (row) => formatCount(row.count),
    },
    {
      id: 'paid',
      header: t('stages.column.paid'),
      numeric: true,
      cell: (row) => formatMoney(row.paid),
    },
    {
      id: 'reserve',
      header: t('stages.column.reserve'),
      numeric: true,
      cell: (row) => formatMoney(row.reserve),
    },
    {
      id: 'incurred',
      header: t('stages.column.incurred'),
      numeric: true,
      cell: (row) => formatMoney(row.incurred),
    },
  ];
}

function groupsOf(answer: ClaimFactsAnswer, lookups: ClaimLookups): Record<Group, GroupRow[]> {
  return {
    product: groupRows(answer.breakdowns.products, lookups.nameOf.product),
    broker: groupRows(answer.breakdowns.brokers, lookups.nameOf.broker),
    handler: groupRows(answer.breakdowns.handlers, lookups.nameOf.handler),
  };
}

function stagesTable(summary: ClaimsSummary, groups: Record<Group, GroupRow[]>): string[][] {
  const line = (section: string, item: string, row: Omit<Valued, 'id' | 'label'>) => [
    section,
    item,
    String(row.count),
    row.paid,
    row.reserve,
    row.incurred,
  ];
  const rows = (section: string, list: Valued[]) =>
    list.map((row) => line(section, row.label, row));
  const { open_totals: total } = summary;
  return [
    [
      t('stages.csv.section'),
      t('stages.csv.item'),
      t('stages.csv.claims'),
      t('stages.csv.paid'),
      t('stages.csv.reserve'),
      t('stages.csv.incurred'),
    ],
    ...rows(t('stages.stage.title'), stageRows(summary)),
    ...rows(t('stages.age.title'), ageRows(summary)),
    ...GROUPS.flatMap((group) =>
      rows(t('stages.group.caption', { group: t(`stages.group.${group}`) }), groups[group]),
    ),
    line(t('stages.total'), t('stages.total'), { count: summary.open, ...total }),
  ];
}

interface BreakdownProps {
  readonly title: string;
  readonly subtitle: string;
  readonly firstHeader: string;
  readonly caption: string;
  readonly rows: BreakdownRow[];
  readonly summary: ClaimsSummary;
}

function BreakdownTable({ title, subtitle, firstHeader, caption, rows, summary }: BreakdownProps) {
  const total = summary.open_totals;
  return (
    <Card
      title={title}
      subtitle={subtitle}
      flush
      footer={
        <span>
          {t('stages.total')}: {formatCount(summary.open)} · {formatMoney(total.paid)} ·{' '}
          {formatMoney(total.reserve)} · {formatMoney(total.incurred)}
        </span>
      }
    >
      <DataTable
        caption={caption}
        columns={columns<BreakdownRow>(firstHeader)}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => claimsLink(row.criterion)}
        rowLabel={(row) => t('stages.open', { label: row.label })}
      />
    </Card>
  );
}

/** Bars sized by incurred; the plotted number is for geometry only, the label is the decimal amount formatted. */
function valueItems(rows: BreakdownRow[]) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    value: Number(row.incurred),
    display: formatMoney(row.incurred),
    to: claimsLink(row.criterion),
  }));
}

function GroupTabs({
  groups,
  summary,
}: {
  groups: Record<Group, GroupRow[]>;
  summary: ClaimsSummary;
}) {
  const [group, setGroup] = useState<Group>('product');
  const total = summary.open_totals;
  return (
    <Card
      title={t('stages.group.title')}
      subtitle={t('stages.group.subtitle')}
      flush
      footer={
        <span>
          {t('stages.total')}: {formatCount(summary.open)} · {formatMoney(total.paid)} ·{' '}
          {formatMoney(total.reserve)} · {formatMoney(total.incurred)}
        </span>
      }
    >
      <Tabs
        label={t('stages.group.tabs')}
        selected={group}
        onSelect={(id) => setGroup(GROUPS.find((candidate) => candidate === id) ?? 'product')}
        tabs={GROUPS.map((id) => ({ id, label: t(`stages.group.${id}`) }))}
      >
        <DataTable
          caption={t('stages.group.caption', { group: t(`stages.group.${group}`) })}
          columns={columns<GroupRow>(t(`stages.group.${group}`))}
          rows={groups[group]}
          rowKey={(row) => row.id}
        />
      </Tabs>
    </Card>
  );
}

function Breakdowns({
  answer,
  groups,
}: {
  answer: ClaimFactsAnswer;
  groups: Record<Group, GroupRow[]> | undefined;
}) {
  const { summary } = answer;
  const stages = stageRows(summary);
  const ages = ageRows(summary);
  const series = [{ key: 'open', label: t('stages.stage.series'), tone: 'accent' as const }];
  return (
    <>
      <div className="ciq-grid ciq-grid--2">
        <Card title={t('stages.stage.title')} subtitle={t('stages.stage.subtitle')}>
          <StackedBarChart
            horizontal
            label={t('stages.stage.chart')}
            categoryLabel={t('stages.column.stage')}
            series={series}
            formatValue={wholeNumbers}
            points={stages.map((row) => ({ x: row.label, values: { open: row.count } }))}
          />
        </Card>
        <Card title={t('stages.value.stageTitle')} subtitle={t('stages.value.stageSubtitle')}>
          <BarList label={t('stages.value.stageChart')} items={valueItems(stages)} />
        </Card>
      </div>
      <div className="ciq-grid ciq-grid--2">
        <Card title={t('stages.age.title')} subtitle={t('stages.age.subtitle')}>
          {summary.open === 0 ? (
            <EmptyState compact title={t('stages.age.none')} />
          ) : (
            <StackedBarChart
              label={t('stages.age.chart')}
              categoryLabel={t('stages.column.age')}
              series={series}
              formatValue={wholeNumbers}
              points={ages.map((row) => ({ x: row.label, values: { open: row.count } }))}
            />
          )}
        </Card>
        <Card title={t('stages.value.ageTitle')} subtitle={t('stages.value.ageSubtitle')}>
          <BarList label={t('stages.value.ageChart')} items={valueItems(ages)} />
        </Card>
      </div>
      <BreakdownTable
        title={t('stages.stage.detail')}
        subtitle={t('stages.detailSubtitle')}
        firstHeader={t('stages.column.stage')}
        caption={t('stages.stage.caption')}
        rows={stages}
        summary={summary}
      />
      <BreakdownTable
        title={t('stages.age.detail')}
        subtitle={t('stages.age.detailSubtitle')}
        firstHeader={t('stages.column.age')}
        caption={t('stages.age.caption')}
        rows={ages}
        summary={summary}
      />
      {groups === undefined ? (
        <Card data-state="loading" title={t('stages.group.title')}>
          <SkeletonBlock lines={3} />
        </Card>
      ) : (
        <GroupTabs groups={groups} summary={summary} />
      )}
    </>
  );
}

export default function StagesPage() {
  const scope = useClaimScope();
  const answer = scope.facts.data;
  const lookups = scope.lookups.lookups;
  // The screen and the export are both made from this one view, and the export waits until it is complete and current.
  const view = useMemo(
    () =>
      answer === undefined || lookups === undefined
        ? undefined
        : { answer, groups: groupsOf(answer, lookups) },
    [answer, lookups],
  );
  const table = useMemo(
    () =>
      view === undefined || !scope.settled
        ? undefined
        : stagesTable(view.answer.summary, view.groups),
    [view, scope.settled],
  );

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('stages.title')}
        subtitle={t('stages.subtitle')}
        actions={<ExportCsvButton screen="stages" table={table} />}
      />
      <ClaimFilterBar scope={scope} />
      <QueryView
        query={scope.facts}
        loading={
          <Card data-state="loading">
            <SkeletonBlock lines={4} />
          </Card>
        }
        isEmpty={(data) => data.summary.claims === 0}
        empty={
          <Card data-state="empty">
            <EmptyState
              icon="layers"
              title={t('stages.empty.title')}
              description={
                scope.filtered
                  ? t('stages.empty.filteredDescription')
                  : t('stages.empty.description')
              }
            />
          </Card>
        }
      >
        {(data) => (
          <div className="ciq-page" aria-busy={scope.facts.isFetching}>
            <Breakdowns answer={data} groups={view?.groups} />
          </div>
        )}
      </QueryView>
    </div>
  );
}
