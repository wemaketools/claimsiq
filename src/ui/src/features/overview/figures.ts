/** The headline figures of the overview: the cards and the rows of the CSV are both made from these. */
import { formatMoney } from '../../../../contracts/index';
import type { ClaimsSummary } from '../../../../contracts/index';
import type { IconName } from '../../components/ui';
import { EMPTY_VALUE, formatCalendarDate, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { ClaimCriterion } from '../claim-scope';

export interface OverviewFigure {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: IconName;
  readonly tone: 'accent' | 'warning' | 'danger' | 'success' | 'info';
  /** The claims the figure counts, listed by the Claims page. */
  readonly criterion: ClaimCriterion;
  /** The figure as shown on its card. */
  readonly shown: string;
  /** The figure as exported: a plain count, a plain decimal amount in BWP, or days with one decimal. */
  readonly exported: { readonly claims: string; readonly amount: string; readonly days: string };
  /** Counts the card says in its hint and the CSV lists as rows after the figure, from the same data. */
  readonly notes: readonly FigureNote[];
}

export interface FigureNote {
  readonly label: string;
  readonly claims: number;
  readonly hint: string;
}

export interface FigureGroup {
  /** What the figures are about: the as-of date, or the period window. */
  readonly heading: string;
  readonly figures: OverviewFigure[];
  /** Says what moves the group's cards, when the heading alone does not. */
  readonly note?: string;
}

const base = (
  id: string,
  icon: IconName,
  tone: OverviewFigure['tone'],
  criterion: ClaimCriterion,
) => ({
  id,
  label: t(`overview.kpi.${id}.label`),
  icon,
  tone,
  criterion,
});

function counted(
  id: string,
  count: number,
  icon: IconName,
  tone: OverviewFigure['tone'],
  criterion: ClaimCriterion,
  hint = t(`overview.kpi.${id}.hint`),
): OverviewFigure {
  return {
    ...base(id, icon, tone, criterion),
    hint,
    shown: formatCount(count),
    exported: { claims: String(count), amount: '', days: '' },
    notes: [],
  };
}

function money(
  id: string,
  amount: string,
  icon: IconName,
  criterion: ClaimCriterion,
  hint = t(`overview.kpi.${id}.hint`),
): OverviewFigure {
  return {
    ...base(id, icon, 'accent', criterion),
    hint,
    shown: formatMoney(amount),
    exported: { claims: '', amount, days: '' },
    notes: [],
  };
}

export function overviewFigures(summary: ClaimsSummary): FigureGroup[] {
  const { period } = summary;
  const averaged = period.closed.count - period.closed.without_turnaround;
  const days = period.closed.average_turnaround_days;
  const turnaroundNotes: FigureNote[] = [
    {
      label: t('overview.csv.leftOut'),
      claims: period.closed.without_turnaround,
      hint: t('overview.kpi.turnaround.hint', {
        averaged: formatCount(averaged),
        left: formatCount(period.closed.without_turnaround),
      }),
    },
    ...(period.closed.undated > 0
      ? [
          {
            label: t('overview.csv.undated'),
            claims: period.closed.undated,
            hint: t('overview.kpi.turnaround.undated', {
              count: formatCount(period.closed.undated),
            }),
          },
        ]
      : []),
  ];
  return [
    {
      heading: t('overview.group.asOf', { date: formatCalendarDate(summary.as_of) }),
      figures: [
        counted('open', summary.open, 'folder', 'accent', { kind: 'open' }),
        counted('closed', summary.closed, 'checkCircle', 'success', { kind: 'closed' }),
        money('paid', summary.totals.paid, 'wallet', { kind: 'paid' }),
        money('reserve', summary.totals.reserve, 'scale', { kind: 'reserve' }),
        money('incurred', summary.totals.incurred, 'coins', { kind: 'incurred' }),
        counted('sla', summary.sla.breached, 'clock', 'danger', { kind: 'sla-breached' }),
        counted('highValue', summary.high_value_open_claims, 'flag', 'warning', {
          kind: 'high-value',
        }),
        counted('highPriority', summary.severity.High, 'alertTriangle', 'danger', {
          kind: 'high-priority',
        }),
      ],
    },
    {
      heading: t('overview.group.period', {
        period: t(`claim-scope.period.${period.option}`),
        from: formatCalendarDate(period.from),
        to: formatCalendarDate(period.to),
      }),
      figures: [
        counted('newClaims', period.new_claims, 'fileText', 'info', { kind: 'new-in-period' }),
        {
          ...money(
            'paidInPeriod',
            period.paid.amount,
            'receipt',
            { kind: 'paid-in-period' },
            t('overview.kpi.paidInPeriod.hint', { count: period.paid.claims }),
          ),
          tone: 'success',
        },
        {
          ...base('turnaround', 'timer', 'info', { kind: 'turnaround' }),
          hint: turnaroundNotes.map((note) => note.hint).join(' · '),
          notes: turnaroundNotes,
          shown:
            days === null
              ? EMPTY_VALUE
              : t('overview.kpi.turnaround.value', { days: days.toFixed(1) }),
          exported: {
            claims: String(averaged),
            amount: '',
            days: days === null ? '' : days.toFixed(1),
          },
        },
      ],
      note: t('overview.group.periodNote'),
    },
  ];
}
