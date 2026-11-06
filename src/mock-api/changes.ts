/**
 * The changes made on top of a fixture (tasks and their audit trail, the saved rule config and its audit), kept in browser storage under one key per
 * data set and tenant. Reset removes the key and the fixture shows again, exactly.
 */
import { z } from 'zod';

import { ClaimsRuleConfig, Instant, PersonaId, RuleConfigAuditEntry, TaskRecord } from '../contracts/index.js';
import type { DataSetId } from '../contracts/index.js';
import type { KeyValueStore } from './storage.js';

const ChangesState = z.object({
  version: z.literal(1),
  next_task_number: z.number().int().min(1),
  tasks: z.array(TaskRecord),
  /** Idempotency-Key of a create to the task it made, so a retried create does not make a second task. */
  created_by_key: z.record(z.string(), z.string()),
  /** The rule config saved over the spec's, with the version it reached; null while the spec's config is in force. */
  rule_config: z
    .object({
      claims: ClaimsRuleConfig,
      version: z.number().int().min(2),
      saved_at: Instant,
      saved_by: PersonaId,
      audit: z.array(RuleConfigAuditEntry),
    })
    .nullable()
    .default(null),
});
export type Changes = z.infer<typeof ChangesState>;
export type SavedRuleConfig = NonNullable<Changes['rule_config']>;

export function emptyChanges(): Changes {
  return { version: 1, next_task_number: 1, tasks: [], created_by_key: {}, rule_config: null };
}

export function changesKey(dataSet: DataSetId, tenantId: string): string {
  return `ciq.mock.v1.${dataSet}.${tenantId}`;
}

export function readChanges(store: KeyValueStore, key: string): Changes {
  let text: string | null;
  try {
    text = store.getItem(key);
  } catch {
    return emptyChanges();
  }
  if (text === null) {
    return emptyChanges();
  }
  try {
    const parsed = ChangesState.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : emptyChanges();
  } catch {
    return emptyChanges();
  }
}

export function writeChanges(store: KeyValueStore, key: string, changes: Changes): void {
  store.setItem(key, JSON.stringify(changes));
}

export function clearChanges(store: KeyValueStore, key: string): void {
  store.removeItem(key);
}
