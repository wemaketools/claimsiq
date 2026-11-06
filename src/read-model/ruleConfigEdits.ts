/**
 * What saving the rule config and restoring its defaults do: who may, which version it must start from, which values
 * changed (one audit entry each) and the config that results. The mock API keeps the result in browser storage and the
 * server writes it to the database, so both apply the same rules and refuse with the same words.
 */
import { PERSONA_HEADER, RuleConfig, canEditRules, ruleFieldValues } from '../contracts/index.js';
import type { EditableClaimsRules, PersonaId, RuleConfigAuditEntry } from '../contracts/index.js';
import { InvalidValues } from './problems.js';

/** The saved state a change starts from. */
export interface RuleConfigHistory {
  /** The spec's config. */
  readonly defaults: RuleConfig;
  readonly version: number;
  readonly saved_at: string | null;
  readonly saved_by: PersonaId | null;
  readonly audit: readonly RuleConfigAuditEntry[];
}

export interface RuleEditRequest {
  /** The persona acting, or null when the request names none. */
  readonly actor: PersonaId | null;
  /** The version the caller loaded. */
  readonly version: number;
  /** The instant of the change, `instantOf(now)`. */
  readonly at: string;
}

export type RuleEditOutcome =
  | { readonly kind: 'refused'; readonly status: 400 | 403 | 409; readonly message: string }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'saved'; readonly actor: PersonaId; readonly config: RuleConfig; readonly version: number; readonly entries: readonly RuleConfigAuditEntry[] };

/** The config in force and its history: the part of a `ReadModel` an edit starts from. */
export interface RuleConfigCurrent {
  readonly ruleConfig: RuleConfig;
  readonly ruleHistory: RuleConfigHistory;
}

function change(current: RuleConfigCurrent, claims: EditableClaimsRules, action: RuleConfigAuditEntry['action'], request: RuleEditRequest, actor: PersonaId): RuleEditOutcome {
  const config = RuleConfig.safeParse({ ...current.ruleConfig, claims: { ...current.ruleConfig.claims, ...claims } });
  if (!config.success) {
    throw InvalidValues.fromZod(config.error);
  }
  const before = new Map(ruleFieldValues(current.ruleConfig.claims).map(({ field, value }) => [field, value]));
  const after = new Map(ruleFieldValues(config.data.claims).map(({ field, value }) => [field, value]));
  const version = current.ruleHistory.version + 1;
  const entries = [...new Set([...before.keys(), ...after.keys()])]
    .filter((field) => before.get(field) !== after.get(field))
    .map((field) => ({ version, at: request.at, actor, action, field, from: before.get(field) ?? null, to: after.get(field) ?? null }));
  return entries.length === 0 ? { kind: 'unchanged' } : { kind: 'saved', actor, config: config.data, version, entries };
}

function guarded(current: RuleConfigCurrent, request: RuleEditRequest, then: (actor: PersonaId) => RuleEditOutcome): RuleEditOutcome {
  if (request.actor === null) {
    return { kind: 'refused', status: 400, message: `${PERSONA_HEADER} must name the persona acting.` };
  }
  if (!canEditRules(request.actor)) {
    return { kind: 'refused', status: 403, message: 'Only the Head of Claims and Finance can change the rules.' };
  }
  if (request.version !== current.ruleHistory.version) {
    return {
      kind: 'refused',
      status: 409,
      message: `The rules were saved again since you loaded them (you have version ${request.version}, the current one is ${current.ruleHistory.version}). Reload and make the change again.`,
    };
  }
  return then(request.actor);
}

/** The values the editor sent over the saved config, with one audit entry per value that differs. */
export function savedRuleConfig(current: RuleConfigCurrent, claims: EditableClaimsRules, request: RuleEditRequest): RuleEditOutcome {
  return guarded(current, request, (actor) => change(current, claims, 'CHANGED', request, actor));
}

/** The spec's config over the saved one, with one audit entry per value that differs. */
export function restoredRuleConfig(current: RuleConfigCurrent, request: RuleEditRequest): RuleEditOutcome {
  return guarded(current, request, (actor) => change(current, current.ruleHistory.defaults.claims, 'RESTORED', request, actor));
}
