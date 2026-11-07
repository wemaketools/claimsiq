import { describe, expect, it } from 'vitest';

import { DATA_SETS, ENTITIES, ENTITY_NAMES, sumMoney } from '../../contracts/index.js';
import { readFixtureFiles, readFixtureJson, withEdit } from '../test-support/fixtureFiles.js';
import { loadDataset } from './load.js';

describe('loading the spec fixtures', () => {
  it('loads TEST (6 claims, 6 invoices) and DEMO (30 claims, 36 invoices) clean, keeps them apart, and reconciles TEST to expected_metrics.json', () => {
    const test = loadDataset('TEST', readFixtureFiles('test'));
    const demo = loadDataset('DEMO', readFixtureFiles('demo'));

    expect(test.issues).toEqual([]);
    expect(demo.issues).toEqual([]);
    expect([test.records.claim.length, test.records.invoice.length]).toEqual([6, 6]);
    expect([demo.records.claim.length, demo.records.invoice.length]).toEqual([30, 36]);
    expect(test.tenant).toMatchObject({ tenant_id: 'TEST', display_name: DATA_SETS.TEST.display_name });
    expect(demo.tenant).toMatchObject({ tenant_id: 'DEMO', display_name: DATA_SETS.DEMO.display_name });

    for (const [dataSet, loaded] of [['TEST', test], ['DEMO', demo]] as const) {
      for (const name of ENTITY_NAMES) {
        expect(loaded.records[name].every((row) => row.tenant_id === dataSet), `${name} of ${dataSet}`).toBe(true);
        expect(Object.keys(ENTITIES[name].schema.shape)).toContain('tenant_id');
        expect(Object.keys(ENTITIES[name].schema.shape)).toContain(ENTITIES[name].idField);
      }
    }

    const metrics = readFixtureJson('expected_metrics.json') as { TEST: { paid_to_date_BWP: number; outstanding_reserve_BWP: number; gross_incurred_BWP: number } };
    const paid = sumMoney(test.records.claim_payment.filter((p) => p.status === 'POSTED').map((p) => p.paid_amount));
    const reserve = sumMoney(test.records.claim.map((c) => c.current_outstanding_reserve));
    expect([paid, reserve, sumMoney([paid, reserve])]).toEqual(
      [metrics.TEST.paid_to_date_BWP, metrics.TEST.outstanding_reserve_BWP, metrics.TEST.gross_incurred_BWP].map((n) => `${n}.00`),
    );

    const mixed = loadDataset('TEST', readFixtureFiles('demo'));
    expect(mixed.records.claim).toEqual([]);
    expect(mixed.records.invoice).toEqual([]);
    expect(mixed.issues.some((issue) => issue.field === 'tenant_id')).toBe(true);
  });

  it('quarantines bad rows with row, field, problem and fix, loads the good rows, and cascades to children', () => {
    const base = readFixtureFiles('test');
    const files = [
      (f: typeof base) =>
        withEdit(f, 'claims.csv', (text) =>
          [
            text.trimEnd(),
            'TEST,CLM-201,POL-001,2026-10-01,2026-10-01,Reviewing,OPEN,USR-CLM,SUP-01,-5,BWP,',
            'TEST,CLM-101,POL-001,2026-10-01,2026-10-01,New,OPEN,USR-CLM,SUP-01,100,BWP,',
            'TEST,CLM-202,POL-NOPE,2026-10-01,2026-10-01,New,OPEN,USR-CLM,,100,BWP,',
            'TEST,CLM-203,POL-001,2026-02-30,2026-10-01,New,OPEN,USR-CLM,,100,BWP,',
            'TEST,CLM-204,POL-001,2026-10-01,2026-10-02,New,OPEN,USR-CLM,,100,BWP,',
          ].join('\n') + '\n',
        ),
      (f: typeof base) =>
        withEdit(f, 'claim_events.csv', (text) =>
          [text.trimEnd(), 'TEST,EVT-X-1,CLM-201,2026-10-02,,New,Reported,USR-CLM', 'TEST,EVT-X-2,CLM-204,,,New,Reported,USR-CLM'].join('\n') + '\n',
        ),
      (f: typeof base) =>
        withEdit(f, 'receipts.csv', (text) => `${text.trimEnd()}\nDEMO,RCP-OTHER,2026-10-10,10,BWP,X,POSTED\n`),
      (f: typeof base) =>
        withEdit(f, 'payment_allocations.csv', (text) => `${text.trimEnd()}\nTEST,ALLOC-OVER,RCP-UNAPP,INV-001,6000,2026-10-11\n`),
    ].reduce((acc, edit) => edit(acc), base);

    const loaded = loadDataset('TEST', files);

    const claimIds = loaded.records.claim.map((c) => c.claim_id);
    expect(claimIds).toEqual(['CLM-101', 'CLM-102', 'CLM-103', 'CLM-104', 'CLM-105', 'CLM-106', 'CLM-204']);
    expect(loaded.records.claim_event.map((e) => e.event_id)).toContain('EVT-X-2');
    expect(loaded.records.claim_event.map((e) => e.event_id)).not.toContain('EVT-X-1');
    expect(loaded.records.receipt.some((r) => r.receipt_id === 'RCP-OTHER')).toBe(false);
    expect(loaded.records.payment_allocation.some((a) => a.allocation_id === 'ALLOC-OVER')).toBe(false);

    expect(loaded.issues.map((issue) => issue.issue_no)).toEqual(loaded.issues.map((_issue, index) => index + 1));
    const quarantined = loaded.issues.filter((issue) => issue.kind === 'quarantined');
    for (const issue of loaded.issues) {
      expect(issue.row).toBeGreaterThanOrEqual(2);
      expect(issue.field.length).toBeGreaterThan(0);
      expect(issue.problem.length).toBeGreaterThan(0);
      expect(issue.fix.length).toBeGreaterThan(0);
    }
    const at = (recordId: string) => quarantined.filter((issue) => issue.record_id === recordId).map((issue) => `${issue.row}:${issue.field}`);
    expect(at('CLM-201').sort()).toEqual(['8:current_outstanding_reserve', '8:stage']);
    expect(at('CLM-101')).toEqual(['9:claim_id']);
    expect(at('CLM-202')).toEqual(['10:policy_id']);
    expect(at('CLM-203')).toEqual(['11:loss_at']);
    expect(at('EVT-X-1')).toEqual(['13:claim_id']);
    expect(at('ALLOC-OVER')).toEqual(['5:allocated_amount', '5:allocated_amount']);
    expect(at('RCP-OTHER')).toEqual(['6:tenant_id']);
    expect(quarantined.find((issue) => issue.record_id === 'CLM-201' && issue.field === 'stage')?.fix).toMatch(/Use one of: .*Triage/);
    expect(loaded.quarantinedRows).toBe(7);

    expect(loaded.issues.filter((issue) => issue.kind === 'warning')).toEqual([
      expect.objectContaining({ entity: 'claim_event', record_id: 'EVT-X-2', field: 'event_at', row: 14 }),
    ]);
  });
});
