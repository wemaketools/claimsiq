/**
 * A deterministic claims fixture of any size for speed checks: the DEMO tenant, its master data and its users, with
 * generated clients, policies, claims and their events, reserves, payments and supplier requests. It is a test aid, not
 * a data set of the product. The same count always gives the same files; every claim reconciles with the engine (its
 * recorded stage and reserve equal the latest event), so the fixture loads with no data issues.
 */
import type { FixtureFiles } from '../fixtures/index.js';

const AS_OF = '2026-10-21';
const STAGES = ['New', 'Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement', 'Closed'] as const;
const FIRST_REPORTED = '2026-06-01';
const LAST_REPORTED = '2026-10-20';

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
const dateOf = (day: number): string => new Date(day * DAY).toISOString().slice(0, 10);

function header(files: FixtureFiles, name: string): string {
  return (files[name] ?? '').split('\n')[0]?.trim() ?? '';
}

const csv = (head: string, rows: readonly (readonly (string | number)[])[]): string =>
  [head, ...rows.map((row) => row.join(','))].join('\n') + '\n';

/** `base` supplies tenants, users, brokers, products and suppliers (the DEMO files); everything about claims is generated. */
export function generateClaimsFixture(base: FixtureFiles, claimCount: number): FixtureFiles {
  const next = random(20261021);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const between = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1));
  const first = dayNumber(FIRST_REPORTED);
  const last = dayNumber(LAST_REPORTED);
  const asOf = dayNumber(AS_OF);

  const clients: (string | number)[][] = [];
  const policies: (string | number)[][] = [];
  const claims: (string | number)[][] = [];
  const events: (string | number)[][] = [];
  const reserves: (string | number)[][] = [];
  const payments: (string | number)[][] = [];
  const requests: (string | number)[][] = [];

  for (let n = 1; n <= claimCount; n += 1) {
    const code = String(n).padStart(4, '0');
    const claimId = `GCLM-${code}`;
    const policyId = `GPOL-${code}`;
    const reported = between(first, last);
    clients.push(['DEMO', `GCLI-${code}`, `Client ${code} (fictional)`, pick(['SME', 'Corporate']), 'South-East', String(n % 3 === 0)]);
    policies.push(['DEMO', policyId, `GEN-BW-${code}`, `GCLI-${code}`, pick(['BRK-01', 'BRK-02', 'BRK-03']), pick(['PRD-01', 'PRD-02', 'PRD-03', 'PRD-04']), '2026-01-01', '2026-12-31', 'ACTIVE']);

    const lastStage = between(0, STAGES.length - 1);
    let day = reported;
    let previous: string | null = null;
    for (let step = 0; step <= lastStage; step += 1) {
      day = Math.min(asOf, step === 0 ? reported : day + between(1, 6));
      const stage = STAGES[step] as string;
      events.push(['DEMO', `GEVT-${code}-${step + 1}`, claimId, dateOf(day), previous ?? '', stage, step === 0 ? 'Reported' : 'Progressed', 'USR-CLM']);
      previous = stage;
    }
    const closed = lastStage === STAGES.length - 1;
    const closedDay = day;

    const opening = between(2, 60) * 1000;
    const raised = next() < 0.35 ? opening + between(2, 20) * 500 : opening;
    const raisedDay = Math.min(asOf, Math.max(reported, closed ? closedDay - 1 : reported + between(3, 20)));
    reserves.push(['DEMO', `GRSV-${code}-1`, claimId, dateOf(reported), 0, opening, 'Synthetic estimate']);
    if (raised !== opening) {
      reserves.push(['DEMO', `GRSV-${code}-2`, claimId, dateOf(raisedDay), opening, raised, 'Synthetic revision']);
    }
    if (closed) {
      reserves.push(['DEMO', `GRSV-${code}-3`, claimId, dateOf(closedDay), raised, 0, 'Closing release']);
    }
    const reserve = closed ? 0 : raised;

    if (closed || next() < 0.4) {
      payments.push(['DEMO', `GPAY-${code}`, claimId, dateOf(Math.min(asOf, closed ? closedDay : reported + between(2, 15))), between(1, 20) * 500, 'BWP', `GEN-C-${code}`, next() < 0.9 ? 'POSTED' : 'PENDING']);
    }
    const supplier = next() < 0.75 ? pick(['SUP-01', 'SUP-02', 'SUP-03']) : '';
    if (supplier !== '' && !closed && next() < 0.5) {
      requests.push(['DEMO', `GREQ-${code}`, claimId, supplier, dateOf(Math.min(asOf, reported + between(1, 10))), '', 'Assessment report']);
    }
    claims.push(['DEMO', claimId, policyId, dateOf(reported), dateOf(reported), STAGES[lastStage] as string, closed ? 'CLOSED' : 'OPEN', next() < 0.7 ? 'USR-CLM' : 'USR-SUP', supplier, reserve, 'BWP', closed ? dateOf(closedDay) : '']);
  }

  return {
    ...Object.fromEntries(
      Object.keys(base).map((name) => [name, name === 'tasks.csv' || name === 'premium_invoices.csv' || name === 'receipts.csv' || name === 'payment_allocations.csv' || name === 'payment_attempts.csv' ? `${header(base, name)}\n` : (base[name] ?? '')]),
    ),
    'clients.csv': csv(header(base, 'clients.csv'), clients),
    'policies.csv': csv(header(base, 'policies.csv'), policies),
    'claims.csv': csv(header(base, 'claims.csv'), claims),
    'claim_events.csv': csv(header(base, 'claim_events.csv'), events),
    'reserve_events.csv': csv(header(base, 'reserve_events.csv'), reserves),
    'claim_payments.csv': csv(header(base, 'claim_payments.csv'), payments),
    'supplier_requests.csv': csv(header(base, 'supplier_requests.csv'), requests),
  };
}
