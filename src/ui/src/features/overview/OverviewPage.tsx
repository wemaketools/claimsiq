import { useMemo } from 'react';

import type { ClaimsSummary, PaidTrend } from '../../../../contracts/index';
import { DonutChart, BarList } from '../../components/charts';
import {
  Card,
  CardLink,
  EmptyState,
  PageHeader,
  QueryView,
  SkeletonBlock,
} from '../../components/ui';
import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import {
  ClaimFilterBar,
  ExportCsvButton,
  ageRows,
  claimsLink,
  stageRows,
  useClaimScope,
} from '../claim-scope';
import { overviewFigures } from './figures';
import { FigureGroups } from './FigureGroups';
import { PaidTrendCard } from './PaidTrendCard';
import { trendRows, usePaidTrend } from './trends';

function overviewTable(summary: ClaimsSummary, trend: PaidTrend): string[][] {
  const groups = overviewFigures(summary);
  const section = (name: string, rows: { label: string; count: number }[]) =>
    rows.map((row) => [name, row.label, String(row.count), '', '']);
  return [
    [
      t('overview.csv.section'),
      t('overview.csv.measure'),
      t('overview.csv.claims'),
      t('overview.csv.amount'),
      t('overview.csv.days'),
    ],
    ...groups.flatMap((group) => [
      ...group.figures.flatMap((figure) => [
        [
          group.heading,
          figure.label,
          figure.exported.claims,
          figure.exported.amount,
          figure.exported.days,
        ],
        ...figure.notes.map((note) => [group.heading, note.label, String(note.claims), '', '']),
      ]),
    ]),
    ...section(t('overview.stage.title'), stageRows(summary)),
    ...section(t('overview.age.title'), ageRows(summary)),
    ...trendRows(trend),
  ];
}

function Breakdowns({ summary }: { readonly summary: ClaimsSummary }) {
  const stages = stageRows(summary);
  const ages = ageRows(summary);
  return (
    <div className="ciq-grid ciq-grid--2">
      <Card
        title={t('overview.stage.title')}
        subtitle={t('overview.stage.subtitle')}
        actions={<CardLink to="/stages">{t('overview.stage.link')}</CardLink>}
      >
        <BarList
          label={t('overview.stage.chart')}
          items={stages.map((row) => ({
            id: row.id,
            label: row.label,
            value: row.count,
            to: claimsLink(row.criterion),
          }))}
        />
      </Card>
      <Card
        title={t('overview.age.title')}
        subtitle={t('overview.age.subtitle')}
        actions={<CardLink to="/stages">{t('overview.age.link')}</CardLink>}
      >
        {summary.open === 0 ? (
          <EmptyState compact title={t('overview.age.none')} />
        ) : (
          <DonutChart
            label={t('overview.age.chart')}
            caption={t('overview.age.center')}
            centerValue={formatCount(summary.open)}
            segments={ages.map((row) => ({ id: row.id, label: row.label, value: row.count }))}
          />
        )}
      </Card>
    </div>
  );
}

export default function OverviewPage() {
  const scope = useClaimScope();
  const summary = scope.facts.data?.summary;
  const trend = usePaidTrend(scope.filters);
  const trendData = trend.data;
  const table = useMemo(
    () =>
      summary === undefined || trendData === undefined
        ? undefined
        : overviewTable(summary, trendData),
    [summary, trendData],
  );

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={<ExportCsvButton screen="overview" queries={[scope.facts, trend]} table={table} />}
      />
      <ClaimFilterBar scope={scope} withPeriod />
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
              icon="dashboard"
              title={t('overview.empty.title')}
              description={
                scope.filtered
                  ? t('overview.empty.filteredDescription')
                  : t('overview.empty.description')
              }
            />
          </Card>
        }
      >
        {(data) => (
          <div className="ciq-page" aria-busy={scope.facts.isFetching}>
            <FigureGroups
              summary={data.summary}
              Heading="h2"
              headingClassName="ciq-card-title"
              withNotes
            />
            <PaidTrendCard query={trend} />
            <Breakdowns summary={data.summary} />
          </div>
        )}
      </QueryView>
    </div>
  );
}
