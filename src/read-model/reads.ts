/**
 * The answers of the read endpoints, as pure functions over a `ReadModel`: the mock API builds the model from the
 * parsed fixtures and the changes kept in the browser, the server from the tenant's database rows, and both answer
 * through these functions, so the two transports cannot drift apart. `claims.facts`, `claims.whatIf` and `suppliers.insights`
 * run the rules engine (`src/rules`) here.
 */
import type {
  ClaimFactsQuery,
  ClaimWhatIfQuery,
  ClaimRecord,
  DataIssue,
  InvoicesQuery,
  SupplierInsightsQuery,
  TaskListItem,
  TaskQuery,
  TaskRecord,
} from '../contracts/index.js';
import {
  breakdownOfOpenClaims,
  computeClaimFacts,
  computeClaimsFacts,
  isTaskOverdue,
  nextStages,
  summarizeSuppliers,
  withHypotheticalStage,
} from '../rules/index.js';
import type { RuleConfig } from '../rules/index.js';
import { claimRecords, invoiceRecords } from './asOfViews.js';
import type { RecordSet } from './asOfViews.js';
import { InvalidValues } from './problems.js';

export interface ReadModel extends RecordSet {
  readonly tenantId: string;
  /** Every task of the tenant with its audit trail, whatever its source. */
  readonly tasks: readonly TaskRecord[];
  readonly ruleConfig: RuleConfig;
  readonly issues: readonly DataIssue[];
}

const byId = (a: { task_id: string }, b: { task_id: string }): number => (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0);

/** Tasks in id order, which is the order they were made in. */
export const tasksInOrder = (tasks: readonly TaskRecord[]): TaskRecord[] => [...tasks].sort(byId);

const collection = <T>(model: ReadModel, asOf: string, items: readonly T[]) => ({
  tenant_id: model.tenantId,
  as_of: asOf,
  items: [...items],
});

/** The claims visible at the as-of date that match the claim filters (broker and product reach a claim through the policy). */
function narrowedClaims(model: ReadModel, asOf: string, query: Omit<ClaimFactsQuery, 'period'>) {
  const { claim_id, policy_id, broker_id, product_id, handler_id } = query;
  const policies = new Map(model.records.policy.map((policy) => [policy.policy_id, policy]));
  const claims = claimRecords(model, asOf).filter((claim) => {
    const policy = policies.get(claim.policy_id);
    return (
      (claim_id === undefined || claim.claim_id === claim_id) &&
      (policy_id === undefined || claim.policy_id === policy_id) &&
      (handler_id === undefined || claim.handler_id === handler_id) &&
      (broker_id === undefined || policy?.broker_id === broker_id) &&
      (product_id === undefined || policy?.product_id === product_id)
    );
  });
  return { policies, claims };
}

/** The distinct rows the loader rejected: one row can carry several problems. */
export const quarantinedRowCount = (issues: readonly DataIssue[]): number =>
  new Set(issues.filter((issue) => issue.kind === 'quarantined').map((issue) => `${issue.entity}:${issue.row}`)).size;

export const claimNotFoundMessage = (claimId: string, asOf: string): string => `Claim "${claimId}" does not exist as of ${asOf}.`;

export const reads = {
  claimsList: (model: ReadModel, asOf: string) => collection(model, asOf, claimRecords(model, asOf)),

  /** `null` when the claim does not exist as of the date. */
  claimsGet: (model: ReadModel, asOf: string, claimId: string): { tenant_id: string; as_of: string; item: ClaimRecord } | null => {
    const [item] = claimRecords(model, asOf, claimId);
    return item === undefined ? null : { tenant_id: model.tenantId, as_of: asOf, item };
  },

  /**
   * `null` when the claim does not exist as of the date. A stage the claim may not move to is refused as an invalid
   * `to_stage`. The claim record is only read: the what-if event exists for the engine's run and nowhere else.
   */
  claimsWhatIf: (model: ReadModel, asOf: string, claimId: string, query: ClaimWhatIfQuery) => {
    const [claim] = claimRecords(model, asOf, claimId);
    if (claim === undefined) return null;
    const context = { asOf, config: model.ruleConfig };
    const current = computeClaimFacts(claim, context);
    const from = current.current_stage ?? claim.stage;
    const allowed = nextStages(from);
    const to = query.to_stage;
    if (to !== undefined && !allowed.includes(to)) {
      throw InvalidValues.field(
        'to_stage',
        `Claim ${claimId} is in ${from} and cannot move to ${to}. It may move to: ${allowed.join(', ')}.`,
      );
    }
    return {
      tenant_id: model.tenantId,
      as_of: asOf,
      claim_id: claimId,
      current,
      next_stages: allowed,
      what_if:
        to === undefined
          ? null
          : { to_stage: to, event_at: asOf, facts: computeClaimFacts(withHypotheticalStage(claim, to, from, asOf), context) },
    };
  },

  claimsFacts: (model: ReadModel, asOf: string, query: ClaimFactsQuery) => {
    const { policies, claims } = narrowedClaims(model, asOf, query);
    const { items, summary } = computeClaimsFacts(claims, { asOf, config: model.ruleConfig, period: query.period });
    return {
      tenant_id: model.tenantId,
      as_of: asOf,
      items,
      summary,
      breakdowns: {
        products: breakdownOfOpenClaims(items, (fact) => policies.get(fact.policy_id)?.product_id ?? null),
        brokers: breakdownOfOpenClaims(items, (fact) => policies.get(fact.policy_id)?.broker_id ?? null),
        handlers: breakdownOfOpenClaims(items, (fact) => fact.handler_id),
      },
    };
  },

  suppliersInsights: (model: ReadModel, asOf: string, query: SupplierInsightsQuery) => {
    const { items } = computeClaimsFacts(narrowedClaims(model, asOf, query).claims, { asOf, config: model.ruleConfig });
    return {
      tenant_id: model.tenantId,
      as_of: asOf,
      ...summarizeSuppliers(model.records.supplier, items, tasksInOrder(model.tasks), { asOf, config: model.ruleConfig }),
    };
  },

  policiesList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.policy),
  clientsList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.client),
  brokersList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.broker),
  productsList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.product),
  suppliersList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.supplier),
  usersList: (model: ReadModel, asOf: string) => collection(model, asOf, model.records.user),

  invoicesList: (model: ReadModel, asOf: string, query: InvoicesQuery) =>
    collection(
      model,
      asOf,
      invoiceRecords(model, asOf).filter((invoice) => query.policy_id === undefined || invoice.policy_id === query.policy_id),
    ),

  tasksList: (model: ReadModel, asOf: string, query: TaskQuery) => {
    const { subject_type, subject_id, assigned_to, status } = query;
    const tasks: TaskListItem[] = tasksInOrder(model.tasks)
      .filter((task) => subject_type === undefined || task.subject_type === subject_type)
      .filter((task) => subject_id === undefined || task.subject_id === subject_id)
      .filter((task) => assigned_to === undefined || task.assigned_to === assigned_to)
      .filter((task) => status === undefined || task.status === status)
      .map((task) => ({ ...task, overdue: isTaskOverdue(task, asOf) }));
    return collection(model, asOf, tasks);
  },

  dataIssues: (model: ReadModel) => ({
    tenant_id: model.tenantId,
    quarantined_rows: quarantinedRowCount(model.issues),
    issues: [...model.issues],
  }),
};
