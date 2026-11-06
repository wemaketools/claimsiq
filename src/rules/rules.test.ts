import { describe, expect, it } from 'vitest';

import { endpoints, formatMoney } from '../contracts/index.js';
import type { ClaimEvent, ClaimRecord } from '../contracts/index.js';
import { createMockApi } from '../mock-api/api.js';
import { claimRecords } from '../read-model/asOfViews.js';
import { loadDataset } from '../read-model/fixtures/index.js';
import { memoryStore } from '../mock-api/storage.js';
import { readFixtureFiles, readFixtureJson } from '../read-model/test-support/fixtureFiles.js';
import { ageBucketLabel, businessDaysBetween, computeClaimFacts, computeClaimsFacts, isTaskOverdue, parseRuleConfig, summarizeClaimFacts, summarizeSuppliers, weekdaySet } from './index.js';
import type { RuleContext } from './index.js';

const AS_OF = '2026-10-21';
const RULE_CONFIG_JSON = readFixtureJson('proposed_rule_config.json') as { claims: Record<string, unknown> };
const METRICS = (readFixtureJson('expected_metrics.json') as { TEST: Record<string, number | Record<string, number>> }).TEST;
const bwp = (amount: number | Record<string, number> | undefined): string => `${String(amount)}.00`;

const testData = loadDataset('TEST', readFixtureFiles('test'));
const records = (asOf = AS_OF): ClaimRecord[] => claimRecords(testData, asOf);
const withClaims = (changes: Record<string, unknown>) => parseRuleConfig({ ...RULE_CONFIG_JSON, claims: { ...RULE_CONFIG_JSON.claims, ...changes } });
const contextOf = (config = parseRuleConfig(RULE_CONFIG_JSON), asOf = AS_OF): RuleContext => ({ asOf, config });
const run = (config = parseRuleConfig(RULE_CONFIG_JSON), asOf = AS_OF) => computeClaimsFacts(records(asOf), contextOf(config, asOf));
const event = (claim: ClaimRecord, id: string, at: string | null, to: ClaimEvent['to_stage']): ClaimEvent => ({
  tenant_id: claim.tenant_id,
  event_id: id,
  claim_id: claim.claim_id,
  event_at: at,
  from_stage: null,
  to_stage: to,
  reason: 'Test',
  actor_id: claim.handler_id,
});

describe('the claims rules engine on the TEST fixture', () => {
  it('reproduces expected_metrics.json and the worked cases, and serves the same facts through the mock API', async () => {
    const { items, summary } = run();

    expect(summary).toMatchObject({
      claims: METRICS.claims,
      open: METRICS.open_claims,
      closed: METRICS.closed_claims,
      totals: { paid: bwp(METRICS.paid_to_date_BWP), reserve: bwp(METRICS.outstanding_reserve_BWP), incurred: bwp(METRICS.gross_incurred_BWP) },
      stage_mismatches: 0,
    });
    const openStages = Object.fromEntries(summary.by_stage.filter((s) => s.stage !== 'Closed' && s.count > 0).map((s) => [s.stage, s.count]));
    expect(openStages).toEqual(METRICS.claim_stages_open);
    expect(summary.by_stage.find((s) => s.stage === 'Closed')?.count).toBe(1);
    expect(summary.by_stage.reduce((total, s) => total + s.count, summary.unknown_stage.count)).toBe(summary.claims);
    expect(summary.by_age_bucket.map((b) => [b.bucket, b.count])).toEqual([['0-7', 2], ['8-30', 2], ['31-60', 1], ['61-90', 0], ['>90', 0]]);
    expect(summary.sla).toEqual({ breached: 3, approaching: 1, within: 1, unknown: 0 });
    expect(summary.severity).toEqual({ High: 3, Medium: 0, Low: 1, none: 1 });
    expect(summary.average_closed_turnaround_days).toBe(5);

    const byClaim = Object.fromEntries(items.map((fact) => [fact.claim_id, fact]));
    const worked = ['CLM-101', 'CLM-102', 'CLM-103', 'CLM-104', 'CLM-105', 'CLM-106'].map((id) => {
      const f = byClaim[id];
      return [id, f?.current_stage, f?.is_open, f?.paid, f?.reserve, f?.incurred];
    });
    expect(worked).toEqual([
      ['CLM-101', 'Assessment', true, '0.00', '11000.00', '11000.00'],
      ['CLM-102', 'Triage', true, '5000.00', '12000.00', '17000.00'],
      ['CLM-103', 'Closed', false, '4000.00', '0.00', '4000.00'],
      ['CLM-104', 'Approved', true, '0.00', '9000.00', '9000.00'],
      ['CLM-105', 'New', true, '0.00', '6000.00', '6000.00'],
      ['CLM-106', 'Assessment', true, '0.00', '30000.00', '30000.00'],
    ]);
    expect(items.every((fact) => fact.stage_check === 'MATCHES' && fact.reserve_check === 'MATCHES')).toBe(true);

    // CLM-101: the reserve moved P8,000 to P11,000, a review cue; the current reserve is the latest value, not a sum of events.
    expect(byClaim['CLM-101']?.reserve_movements.map((m) => [m.kind, m.old_amount, m.new_amount, m.change_percent, m.material])).toEqual([
      ['INITIAL', '0.00', '8000.00', null, false],
      ['INCREASE', '8000.00', '11000.00', 37.5, true],
    ]);
    // It is material by the share of the prior amount (37.5% of P8,000 against 30%), not by the P5,000 amount.
    expect(byClaim['CLM-101']?.reserve_movements.map((m) => [m.material_by, m.threshold_amount, m.threshold_percent])).toEqual([
      [null, '5000.00', 30],
      ['PERCENT', '5000.00', 30],
    ]);
    expect(byClaim['CLM-102']?.reserve_movements.map((m) => m.material)).toEqual([false, false]);
    expect(byClaim['CLM-101']?.supplier_waits[0]).toMatchObject({ requested_at: '2026-10-06', status: 'delayed', business_days_waited: 11 });

    // CLM-103 is closed: no age, no SLA, no severity. CLM-105 is recent and not past its New target. CLM-104 is approved, not paid.
    expect(byClaim['CLM-103']).toMatchObject({ age_bucket: null, sla: null, severity: null, closed_turnaround_days: 5 });
    // Its P4,000 to P0 reserve on the day it closed is a closing release, listed but never a review cue.
    expect(byClaim['CLM-103']?.reserve_movements.map((m) => [m.kind, m.material, m.material_by])).toEqual([
      ['INITIAL', false, null],
      ['CLOSING_RELEASE', false, null],
    ]);
    expect(byClaim['CLM-103']?.material_reserve_change).toBe(false);
    expect(byClaim['CLM-105']).toMatchObject({ age_days: 1, age_bucket: '0-7', severity: 'Low' });
    expect(byClaim['CLM-105']?.sla).toMatchObject({ status: 'approaching', business_days_left: 1 });
    expect(byClaim['CLM-104']).toMatchObject({ paid: '0.00', severity: null, severity_reasons: [] });
    expect(byClaim['CLM-104']?.sla).toMatchObject({ status: 'within', business_days_left: 4 });

    // CLM-106: P30,000 incurred is high value and the supplier request of 2 Oct is 13 business days old against a target of 5.
    expect(byClaim['CLM-106']).toMatchObject({ high_value: true, supplier_delayed: true, severity: 'High' });
    expect(byClaim['CLM-106']?.supplier_waits[0]).toMatchObject({ request_id: 'REQ-CLM-106', requested_at: '2026-10-02', business_days_waited: 13, business_days_over: 8 });
    expect(byClaim['CLM-106']?.severity_reasons.map((r) => r.rule)).toEqual(expect.arrayContaining(['SLA_LATE', 'SUPPLIER_DELAY', 'HIGH_VALUE_DELAYED']));
    expect(byClaim['CLM-106']?.sla).toMatchObject({ status: 'breached', stage_started_at: '2026-09-30', business_days_in_stage: 15, business_days_over: 10 });
    expect(byClaim['CLM-102']).toMatchObject({ age_days: 50, age_bucket: '31-60', high_value: false, severity: 'High' });

    // The API serves the same facts, limited by the as-of date.
    const api = createMockApi({ fixtures: { TEST: readFixtureFiles('test'), DEMO: readFixtureFiles('demo') }, storage: memoryStore(), ruleConfig: RULE_CONFIG_JSON });
    const ask = async (asOf?: string) => {
      const response = await api.fetch(endpoints.claimsFacts.path, { headers: { 'X-Tenant-Id': 'TEST', ...(asOf === undefined ? {} : { 'X-As-Of': asOf }) } });
      return endpoints.claimsFacts.response.parse(await response.json());
    };
    expect(await ask()).toMatchObject({ tenant_id: 'TEST', as_of: AS_OF, items, summary });
    const early = await ask('2026-10-12');
    expect(early.items.map((fact) => fact.claim_id)).toEqual(['CLM-101', 'CLM-102', 'CLM-103', 'CLM-106']);
    expect(early.items.find((fact) => fact.claim_id === 'CLM-103')).toMatchObject({ is_open: true, reserve: '4000.00', stage_check: 'NOT_COMPARABLE' });
    expect(early.summary.open).toBe(4);
    const demo = await api.fetch(endpoints.claimsFacts.path, { headers: { 'X-Tenant-Id': 'DEMO' } });
    expect(endpoints.claimsFacts.response.parse(await demo.json()).summary.claims).toBe(30);

    // Policy, broker, product and handler narrow the claims before the engine runs: items and summary cover the same set.
    const narrowed = async (query: string) => {
      const response = await api.fetch(`${endpoints.claimsFacts.path}?${query}`, { headers: { 'X-Tenant-Id': 'TEST' } });
      return endpoints.claimsFacts.response.parse(await response.json());
    };
    const ofBroker = await narrowed('broker_id=BRK-01');
    expect(ofBroker.items.map((fact) => fact.claim_id)).toEqual(['CLM-101', 'CLM-104']);
    expect(ofBroker.summary).toEqual(summarizeClaimFacts(ofBroker.items, contextOf()));
    expect(ofBroker.summary).toMatchObject({ claims: 2, totals: { incurred: '20000.00' } });
    expect((await narrowed('broker_id=BRK-01&product_id=PRD-01')).items.map((fact) => fact.claim_id)).toEqual(['CLM-101']);
    expect((await narrowed('policy_id=POL-006&handler_id=USR-CLM')).items.map((fact) => fact.claim_id)).toEqual(['CLM-106']);
    expect((await narrowed('handler_id=USR-SUP')).summary).toMatchObject({ claims: 0, open: 0, totals: { incurred: '0.00' } });
    expect(summary.open_unknown_stage.count).toBe(0);

    // The period figures, worked by hand from the fixture (window: the last 30 days, 22 Sep to 21 Oct, both ends in).
    // Reported in it: CLM-101 (1 Oct), 103, 104, 105 and 106 (25 Sep); CLM-102 (1 Sep) is not. CLM-102's P5,000 was paid on
    // 22 Sep, the first day of the window, and CLM-103's P4,000 on 13 Oct. CLM-103 closed on 15 Oct, 5 days after it was reported.
    expect(summary.period).toEqual({
      option: '30d',
      from: '2026-09-22',
      to: '2026-10-21',
      new_claims: 5,
      paid: { amount: '9000.00', claims: 2 },
      closed: { count: 1, average_turnaround_days: 5, without_turnaround: 0, undated: 0 },
      high_priority: 3,
    });
    const inWindow = async (option: string) => (await narrowed(`period=${option}`)).summary.period;
    // 7 days: 15 to 21 Oct. Reported: CLM-104 (15 Oct) and CLM-105. No payment (the last was 13 Oct). CLM-103 closed on 15 Oct.
    expect(await inWindow('7d')).toMatchObject({ from: '2026-10-15', new_claims: 2, paid: { amount: '0.00', claims: 0 }, closed: { count: 1 } });
    // Month to date: from 1 Oct. CLM-106 (25 Sep) drops out and so does CLM-102's payment.
    expect(await inWindow('mtd')).toMatchObject({ from: '2026-10-01', new_claims: 4, paid: { amount: '4000.00', claims: 1 } });
    expect(await inWindow('90d')).toMatchObject({ from: '2026-07-24', new_claims: 6, paid: { amount: '9000.00' } });
    expect(ofBroker.summary.period).toMatchObject({ new_claims: 2, paid: { amount: '0.00' }, high_priority: 1 });
    expect(ofBroker.breakdowns.brokers).toEqual([expect.objectContaining({ id: 'BRK-01', claims: 2, incurred: '20000.00' })]);
    expect(ofBroker.breakdowns.products.map((row) => [row.id, row.claims])).toEqual([['PRD-01', 1], ['PRD-04', 1]]);
  });

  it('moves its results when a threshold in the rule config changes, and refuses a config it cannot honour', () => {
    const base = run();
    const factOf = (result: typeof base, id: string) => result.items.find((fact) => fact.claim_id === id);

    const roomier = run(withClaims({ stage_sla_business_days: { ...(RULE_CONFIG_JSON.claims.stage_sla_business_days as object), Assessment: 15 } }));
    expect(factOf(base, 'CLM-101')?.sla?.status).toBe('breached');
    expect(factOf(roomier, 'CLM-101')?.sla).toMatchObject({ status: 'within', business_days_left: 2 });
    expect(roomier.summary.sla.breached).toBe(base.summary.sla.breached - 2);

    expect(factOf(run(withClaims({ high_value_incurred_BWP: 10000 })), 'CLM-101')?.high_value).toBe(true);
    expect(factOf(base, 'CLM-101')?.high_value).toBe(false);
    expect(factOf(run(withClaims({ high_value_incurred_BWP: 40000 })), 'CLM-106')?.high_value).toBe(false);

    expect(factOf(run(withClaims({ material_reserve_delta_percent: 50 })), 'CLM-101')?.material_reserve_change).toBe(false);
    expect(factOf(run(withClaims({ material_reserve_delta_absolute_BWP: 2000 })), 'CLM-102')?.material_reserve_change).toBe(true);

    expect(factOf(run(withClaims({ supplier_wait_target_business_days: 15 })), 'CLM-106')?.supplier_delayed).toBe(false);
    expect(factOf(run(withClaims({ severity_high_sla_days_late: 20 })), 'CLM-106')?.severity_reasons.map((r) => r.rule)).toContain('SLA_BREACH');
    expect(run(withClaims({ approaching_window_business_days: 4 })).summary.sla.approaching).toBe(2);
    expect(run(withClaims({ business_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] })).items.find((f) => f.claim_id === 'CLM-106')?.sla?.business_days_in_stage).toBe(21);
    expect(run(withClaims({ age_bucket_upper_days: [30, 60] })).summary.by_age_bucket.map((b) => [b.bucket, b.count])).toEqual([['0-30', 4], ['31-60', 1], ['>60', 0]]);

    expect(() => withClaims({ holidays_excluded: true })).toThrow(/holidays/);
    expect(() => withClaims({ stage_sla_business_days: { Triaged: 3 } })).toThrow();
    expect(() => withClaims({ age_bucket_upper_days: [30, 7] })).toThrow(/increasing/);
    expect(() => parseRuleConfig({ as_of: AS_OF })).toThrow();
  });

  it('treats missing evidence as unknown and orders events, payments and reserves deterministically', () => {
    const context = contextOf();
    const claim = (id: string): ClaimRecord => {
      const found = records().find((candidate) => candidate.claim_id === id);
      if (found === undefined) throw new Error(`${id} is not in the TEST view`);
      return found;
    };
    const [clm104, clm101, clm103] = [claim('CLM-104'), claim('CLM-101'), claim('CLM-103')] as const;

    // An approval event without a time: the stage start is unknown, so the SLA is unknown, never within.
    const undated = computeClaimFacts({ ...clm104, events: clm104.events.map((e) => (e.to_stage === 'Approved' ? { ...e, event_at: null } : e)) }, context);
    expect(undated.sla).toMatchObject({ status: 'unknown', unknown_reason: 'MISSING_EVENT_TIME', business_days_in_stage: null });
    expect(undated).toMatchObject({ undated_events: 1, current_stage: 'New', stage_check: 'DIFFERS', severity: 'Low' });
    expect(undated.severity_reasons.map((r) => r.rule)).toEqual(['SLA_UNKNOWN']);

    const noEvents = computeClaimFacts({ ...clm104, events: [] }, context);
    expect(noEvents).toMatchObject({ current_stage: null, stage_check: 'UNKNOWN', is_open: true });
    expect(noEvents.sla?.unknown_reason).toBe('NO_STAGE_EVENT');
    const reopened = computeClaimFacts({ ...clm103, events: [...clm103.events, event(clm103, 'EVT-CLM-103-3', '2026-10-18', 'Reopened')] }, context);
    expect(reopened).toMatchObject({ is_open: true, current_stage: 'Reopened', age_bucket: '8-30' });
    expect(reopened.sla).toMatchObject({ status: 'unknown', unknown_reason: 'NO_TARGET_FOR_STAGE' });
    // The same release on a claim that never closed is a reserve move to review like any other.
    const neverClosed = computeClaimFacts({ ...clm103, events: clm103.events.filter((e) => e.to_stage !== 'Closed'), closed_at: null, status: 'OPEN' }, context);
    expect(neverClosed.reserve_movements.map((m) => [m.kind, m.material])).toEqual([['INITIAL', false], ['DECREASE', true]]);
    // Only a claim that is closed at the moment of the release has a closing release: not after a reopen, and not
    // when an earlier closure was followed by a reopen; a release after closing again is one.
    const reserve = (id: string, at: string, from: string, to: string): ClaimRecord['reserve_events'][number] => ({ ...clm103.reserve_events[0], reserve_event_id: id, event_at: at, old_amount: from, new_amount: to }) as ClaimRecord['reserve_events'][number];
    const history = (stages: ReadonlyArray<readonly [string | null, ClaimEvent['to_stage']]>, ...reserves: ClaimRecord['reserve_events']): ClaimRecord => ({
      ...clm103,
      closed_at: '2026-10-12',
      events: stages.map(([at, stage], index) => event(clm103, `EVT-X-${index}`, at, stage)),
      reserve_events: [reserve('RSV-X-0', '2026-10-10', '0.00', '4000.00'), ...reserves],
    });
    const movementKinds = (claim: ClaimRecord) => computeClaimFacts(claim, context).reserve_movements.map((m) => [m.kind, m.material]);
    expect(movementKinds(history([['2026-10-10', 'New'], ['2026-10-12', 'Closed'], ['2026-10-14', 'Reopened']], reserve('RSV-X-1', '2026-10-18', '4000.00', '0.00')))).toEqual([['INITIAL', false], ['DECREASE', true]]);
    expect(movementKinds(history([['2026-10-10', 'New'], ['2026-10-12', 'Closed'], ['2026-10-14', 'Reopened']], reserve('RSV-X-1', '2026-10-13', '4000.00', '1000.00'), reserve('RSV-X-2', '2026-10-18', '1000.00', '0.00')))).toEqual([['INITIAL', false], ['DECREASE', true], ['DECREASE', true]]);
    expect(movementKinds(history([['2026-10-10', 'New'], ['2026-10-12', 'Closed'], ['2026-10-14', 'Reopened'], ['2026-10-20', 'Closed']], reserve('RSV-X-1', '2026-10-20', '4000.00', '0.00')))).toEqual([['INITIAL', false], ['CLOSING_RELEASE', false]]);
    // A Closed event with no time cannot place the closure, so the closed date does: closed from it, unless a later dated event moved the claim on, and never when that date is missing too.
    const undatedClosure = [['2026-10-10', 'New'], [null, 'Closed']] as const;
    const release = reserve('RSV-X-1', '2026-10-18', '4000.00', '0.00');
    expect(movementKinds(history(undatedClosure, release))).toEqual([['INITIAL', false], ['CLOSING_RELEASE', false]]);
    expect(movementKinds(history([...undatedClosure, ['2026-10-14', 'Reopened']], release))).toEqual([['INITIAL', false], ['DECREASE', true]]);
    expect(movementKinds({ ...history(undatedClosure, release), closed_at: null })).toEqual([['INITIAL', false], ['DECREASE', true]]);
    expect(computeClaimFacts({ ...history(undatedClosure, release), closed_at: null }, context).is_open).toBe(true);
    expect(movementKinds({ ...history([], reserve('RSV-X-1', '2026-10-12', '4000.00', '0.00')), events: [] })).toEqual([['INITIAL', false], ['CLOSING_RELEASE', false]]);

    const unverified = computeClaimFacts({ ...clm101, supplier_requests: clm101.supplier_requests.map((r) => ({ ...r, requested_at: null })) }, context);
    expect(unverified).toMatchObject({ supplier_delayed: false, supplier_delay_unverified: true });
    expect(unverified.supplier_waits[0]).toMatchObject({ status: 'unverified', business_days_waited: null });
    const answered = computeClaimFacts({ ...clm101, supplier_requests: clm101.supplier_requests.map((r) => ({ ...r, completed_at: '2026-10-08' })) }, context);
    expect(answered).toMatchObject({ supplier_delayed: false });
    expect(answered.supplier_waits[0]).toMatchObject({ status: 'completed', business_days_waited: 2 });

    // Only POSTED payments up to the as-of date are paid.
    const payment = { ...clm103.payments[0], claim_payment_id: 'CPAY-X', paid_amount: '1000.00' } as ClaimRecord['payments'][number];
    const paid = (...extra: ClaimRecord['payments']) => computeClaimFacts({ ...clm103, payments: [...clm103.payments, ...extra] }, context).paid;
    expect(paid(...(['PENDING', 'VOID', 'REJECTED'] as const).map((status) => ({ ...payment, status })))).toBe('4000.00');
    expect(paid({ ...payment, status: 'POSTED' })).toBe('5000.00');
    expect(paid({ ...payment, status: 'POSTED', paid_at: '2026-12-01' })).toBe('4000.00');
    // In the period only posted payments inside the window count; an unknown reported or closed date is left out, not guessed.
    const paidInPeriod = (...extra: ClaimRecord['payments']) => computeClaimFacts({ ...clm103, payments: [...clm103.payments, ...extra] }, context).paid_in_period;
    expect(paidInPeriod({ ...payment, status: 'POSTED', paid_at: '2026-09-21' }, { ...payment, status: 'PENDING', paid_at: '2026-10-20' })).toBe('4000.00');
    expect(paidInPeriod({ ...payment, status: 'POSTED', paid_at: '2026-09-22' })).toBe('5000.00');
    const noReported = { ...computeClaimsFacts([{ ...clm103, reported_at: null }], context).summary.period };
    expect(noReported).toMatchObject({ new_claims: 0, closed: { count: 1, average_turnaround_days: null, without_turnaround: 1, undated: 0 } });
    expect(computeClaimsFacts([{ ...clm103, closed_at: null }], context).summary.period.closed).toEqual({ count: 0, average_turnaround_days: null, without_turnaround: 0, undated: 1 });

    // The latest event wins whatever the input order; a tie on time goes to the larger event id.
    const tied = [event(clm104, 'EVT-B', '2026-10-20', 'Settlement'), event(clm104, 'EVT-A', '2026-10-20', 'Negotiation')];
    expect(computeClaimFacts({ ...clm104, events: tied }, context).current_stage).toBe('Settlement');
    expect(computeClaimFacts({ ...clm104, events: [...tied].reverse() }, context).current_stage).toBe('Settlement');

    // The current reserve is the latest event's new value; a claim without reserve events falls back to its record.
    const reserveOf = (claim: ClaimRecord) => computeClaimFacts(claim, context);
    expect(reserveOf(clm101)).toMatchObject({ reserve: '11000.00', reserve_check: 'MATCHES' });
    expect(reserveOf({ ...clm101, reserve_events: [], current_outstanding_reserve: '7000.00' })).toMatchObject({ reserve: '7000.00', reserve_check: 'UNKNOWN' });
    expect(reserveOf({ ...clm101, current_outstanding_reserve: '1.00' }).reserve_check).toBe('DIFFERS');

    // Business days count completed weekdays after the start: Friday to Monday is one; a weekend alone is none.
    const weekdays = weekdaySet(parseRuleConfig(RULE_CONFIG_JSON).claims.business_days);
    expect([['2026-10-16', '2026-10-19'], ['2026-10-16', '2026-10-18'], ['2026-10-17', '2026-10-19'], ['2026-10-19', '2026-10-19'], ['2026-10-20', '2026-10-19']].map(([a, b]) => businessDaysBetween(a ?? '', b ?? '', weekdays))).toEqual([1, 0, 1, 0, 0]);
    expect([0, 7, 8, 30, 31, 60, 61, 90, 91].map((days) => ageBucketLabel([7, 30, 60, 90], days))).toEqual(['0-7', '0-7', '8-30', '8-30', '31-60', '31-60', '61-90', '61-90', '>90']);
  });

  it('summarizes each supplier from the facts: open requests, waits, breaches, cases, late actions and turnaround, with averages only from the minimum sample', async () => {
    const suppliers = testData.records.supplier;
    const insights = (config = parseRuleConfig(RULE_CONFIG_JSON), claims = records(), tasks: Parameters<typeof summarizeSuppliers>[2] = []) =>
      summarizeSuppliers(suppliers, computeClaimsFacts(claims, contextOf(config)).items, tasks, contextOf(config));
    const rowOf = (result: ReturnType<typeof insights>, id: string) => result.items.find((item) => item.supplier_id === id);

    // By hand: REQ-CLM-101 was sent on 6 Oct and REQ-CLM-106 on 2 Oct, both with SUP-02 and both still open on 21 Oct.
    // Business days after the request day up to 21 Oct: 11 and 13, so the mean is 12.0 and both pass the 5-day target.
    // SUP-02 is assigned CLM-101 and CLM-106; SUP-01 is assigned the open CLM-102, 104 and 105 (CLM-103 is closed); SUP-03 has nothing.
    const base = insights();
    expect(base).toMatchObject({ min_sample: 2, target_business_days: 5 });
    expect(base.items.map((item) => item.supplier_id)).toEqual(['SUP-01', 'SUP-02', 'SUP-03']);
    expect(rowOf(base, 'SUP-02')).toEqual({
      supplier_id: 'SUP-02',
      open_requests: 2,
      wait: { sample: 2, average: 12, longest: 13 },
      breaches: 2,
      unverified: 0,
      open_assigned_cases: 2,
      late_actions: 0,
      turnaround: { sample: 0, average: null },
      cases: 2,
    });
    expect(rowOf(base, 'SUP-01')).toMatchObject({ open_requests: 0, wait: { sample: 0, average: null, longest: null }, open_assigned_cases: 3, cases: 3 });
    expect(rowOf(base, 'SUP-03')).toMatchObject({ open_requests: 0, open_assigned_cases: 0, cases: 0 });

    // Below the minimum sample there is no average, but the longest wait and the breaches are still the cases' own facts.
    const strict = rowOf(insights(withClaims({ supplier_min_sample: 3 })), 'SUP-02');
    expect(strict).toMatchObject({ wait: { sample: 2, average: null, longest: 13 }, breaches: 2 });

    // A raised target moves the breaches; a request with no time is unverified, not a sample; a completed request is turnaround.
    expect(rowOf(insights(withClaims({ supplier_wait_target_business_days: 12 })), 'SUP-02')).toMatchObject({ breaches: 1 });
    const clm101 = records().find((claim) => claim.claim_id === 'CLM-101');
    const clm106 = records().find((claim) => claim.claim_id === 'CLM-106');
    if (clm101 === undefined || clm106 === undefined) throw new Error('TEST claims missing');
    const request = (claim: ClaimRecord) => claim.supplier_requests[0] as ClaimRecord['supplier_requests'][number];
    const others = records().filter((claim) => !['CLM-101', 'CLM-106'].includes(claim.claim_id));
    const edited = [
      ...others,
      { ...clm101, supplier_requests: [{ ...request(clm101), completed_at: '2026-10-13' }] },
      { ...clm106, supplier_requests: [{ ...request(clm106), requested_at: null }] },
    ];
    expect(rowOf(insights(parseRuleConfig(RULE_CONFIG_JSON), edited), 'SUP-02')).toMatchObject({
      open_requests: 1,
      wait: { sample: 0, average: null, longest: null },
      breaches: 0,
      unverified: 1,
      turnaround: { sample: 1, average: null },
      cases: 2,
    });
    // Completed 13 Oct after 6 Oct: 7, 8, 9, 12 and 13 Oct make 5 business days; one request is enough when the minimum is 1.
    expect(rowOf(insights(withClaims({ supplier_min_sample: 1 }), edited), 'SUP-02')?.turnaround).toEqual({ sample: 1, average: 5 });

    // Late actions are the not-done tasks on a supplier's cases whose due date is before the as-of date (due on the day is not late).
    const task = (subject_id: string, due_at: string | null, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') => ({ subject_type: 'CLAIM' as const, subject_id, due_at, status });
    const tasks = [
      task('CLM-106', '2026-10-19', 'OPEN'),
      task('CLM-106', '2026-10-20T09:00:00+02:00', 'IN_PROGRESS'),
      task('CLM-106', '2026-10-21', 'OPEN'),
      task('CLM-101', '2026-10-01', 'DONE'),
      task('CLM-101', null, 'OPEN'),
      task('CLM-104', '2026-10-10', 'OPEN'),
    ];
    const withTasks = insights(parseRuleConfig(RULE_CONFIG_JSON), records(), tasks);
    expect(rowOf(withTasks, 'SUP-02')?.late_actions).toBe(2);
    expect(rowOf(withTasks, 'SUP-01')?.late_actions).toBe(1);
    expect(tasks.map((item) => isTaskOverdue(item, AS_OF))).toEqual([true, true, false, false, false, true]);

    // The API serves the same rows over the filtered claims, and flags each task overdue.
    const api = createMockApi({ fixtures: { TEST: readFixtureFiles('test'), DEMO: readFixtureFiles('demo') }, storage: memoryStore(), ruleConfig: RULE_CONFIG_JSON });
    const get = async (path: string) => (await api.fetch(path, { headers: { 'X-Tenant-Id': 'TEST' } })).json();
    expect(endpoints.suppliersInsights.response.parse(await get(endpoints.suppliersInsights.path))).toMatchObject({ tenant_id: 'TEST', as_of: AS_OF, ...base });
    const ofBroker = endpoints.suppliersInsights.response.parse(await get(`${endpoints.suppliersInsights.path}?broker_id=BRK-01`));
    expect(rowOf(ofBroker, 'SUP-02')).toMatchObject({ open_requests: 1, open_assigned_cases: 1, cases: 1 });
    expect(rowOf(ofBroker, 'SUP-01')).toMatchObject({ open_assigned_cases: 1 });
  });

  it('formats money as P12,345.67', () => {
    expect([formatMoney('12345.67'), formatMoney('0.00'), formatMoney('999.50'), formatMoney('1000000.00'), formatMoney('77000'), formatMoney('-1500.5')]).toEqual([
      'P12,345.67',
      'P0.00',
      'P999.50',
      'P1,000,000.00',
      'P77,000.00',
      '-P1,500.50',
    ]);
  });
});
