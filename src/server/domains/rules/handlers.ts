/**
 * The rule config: read it, save it, restore the spec's. A write runs in one `withTenant` transaction that locks the
 * tenant's `rule_configs` row, applies the shared rules (`src/read-model/ruleConfigEdits.ts`, the mock API's too: who
 * may, which version, which values changed) and writes the new config and its audit entries together. The audit
 * entry's actor is the persona acting (`X-Persona`); the signed-in account is recorded beside it.
 */
import { instantOf } from '../../../contracts/index.js';
import { reads, restoredRuleConfig, savedRuleConfig } from '../../../read-model/index.js';
import type { RuleEditOutcome } from '../../../read-model/index.js';
import type { TenantScope } from '../../lib/db/index.js';
import { HttpProblem } from '../../lib/errors/index.js';
import { loadRuleConfig } from '../../lib/read-model/load.js';
import type { HandlersOf, RequestContext } from '../../lib/router/contract.js';

type EditContext = RequestContext<unknown, { readonly version: number }>;

async function apply(
  scope: TenantScope,
  ctx: EditContext,
  edit: (current: Awaited<ReturnType<typeof loadRuleConfig>>) => RuleEditOutcome,
) {
  // The lock serializes two saves of one tenant, so the second meets the first one's version and gets its 409.
  const locked = await scope.selectFrom('rule_configs').select('data_set').forUpdate().executeTakeFirst();
  if (locked === undefined) {
    throw new Error(`Tenant ${scope.tenantId} has no rule configuration.`);
  }
  const current = await loadRuleConfig(scope);
  const outcome = edit(current);
  if (outcome.kind === 'refused') {
    throw new HttpProblem(outcome.status, outcome.message);
  }
  if (outcome.kind === 'saved') {
    await scope
      .updateTable('rule_configs')
      .set({ config: JSON.stringify(outcome.config), version: outcome.version, updated_at: ctx.now, updated_by: outcome.actor })
      .where('data_set', '=', locked.data_set)
      .execute();
    await scope
      .insertInto(
        'rule_config_audit_entries',
        outcome.entries.map((entry) => ({
          data_set: locked.data_set,
          version: entry.version,
          at: ctx.now,
          actor: entry.actor,
          action: entry.action,
          field: entry.field,
          from_value: entry.from,
          to_value: entry.to,
          actor_user_id: ctx.session.authUserId,
        })),
      )
      .execute();
  }
  return reads.ruleConfig({ tenantId: scope.tenantId, ...(await loadRuleConfig(scope)) });
}

export const ruleHandlers: HandlersOf<'ruleConfigGet' | 'ruleConfigSave' | 'ruleConfigRestore'> = {
  ruleConfigGet: {
    run: async (ctx) => await ctx.tenant(async (scope) => reads.ruleConfig({ tenantId: scope.tenantId, ...(await loadRuleConfig(scope)) })),
  },
  ruleConfigSave: {
    run: async (ctx) =>
      await ctx.tenant((scope) =>
        apply(scope, ctx, (current) => savedRuleConfig(current, ctx.body.claims, { actor: ctx.actor, version: ctx.body.version, at: instantOf(ctx.now) })),
      ),
  },
  ruleConfigRestore: {
    run: async (ctx) =>
      await ctx.tenant((scope) =>
        apply(scope, ctx, (current) => restoredRuleConfig(current, { actor: ctx.actor, version: ctx.body.version, at: instantOf(ctx.now) })),
      ),
  },
};
