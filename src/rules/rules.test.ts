import { describe, expect, it } from 'vitest';

import { endpoints, formatMoney } from '../contracts/index.js';
import type { ClaimEvent, ClaimRecord } from '../contracts/index.js';
import { createMockApi } from '../mock-api/api.js';
import { claimRecords } from '../mock-api/asOfViews.js';
import { loadDataset } from '../mock-api/fixtures/index.js';
import { memoryStore } from '../mock-api/storage.js';
import { readFixtureFiles, readFixtureJson } from '../mock-api/test-support/fixtureFiles.js';
import { ageBucketLabel, businessDaysBetween, computeClaimFacts, computeClaimsFacts, parseRuleConfig, weekdaySet } from './index.js';
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
    expect(byClaim['CLM-102']?.reserve_movements.map((m) => m.material)).toEqual([false, false]);
    expect(byClaim['CLM-101']?.supplier_waits[0]).toMatchObject({ requested_at: '2026-10-06', status: 'delayed', business_days_waited: 11 });

    // CLM-103 is closed: no age, no SLA, no severity. CLM-105 is recent and not past its New target. CLM-104 is approved, not paid.
    expect(byClaim['CLM-103']).toMatchObject({ age_bucket: null, sla: null, severity: null, closed_turnaround_days: 5 });
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
    expect(await ask()).toEqual({ tenant_id: 'TEST', as_of: AS_OF, items, summary });
    const early = await ask('2026-10-12');
    expect(early.items.map((fact) => fact.claim_id)).toEqual(['CLM-101', 'CLM-102', 'CLM-103', 'CLM-106']);
    expect(early.items.find((fact) => fact.claim_id === 'CLM-103')).toMatchObject({ is_open: true, reserve: '4000.00', stage_check: 'NOT_COMPARABLE' });
    expect(early.summary.open).toBe(4);
    const demo = await api.fetch(endpoints.claimsFacts.path, { headers: { 'X-Tenant-Id': 'DEMO' } });
    expect(endpoints.claimsFacts.response.parse(await demo.json()).summary.claims).toBe(30);
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
