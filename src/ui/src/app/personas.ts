/**
 * The personas of the persona switch. The switch is a view convenience for the demo, never authentication: it
 * changes what the shell shows as the active persona and nothing about what the signed-in user may do.
 */

export const PERSONA_IDS = [
  'head-of-claims',
  'claims-handler',
  'supplier-coordinator',
  'finance',
] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const DEFAULT_PERSONA: PersonaId = 'head-of-claims';

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && (PERSONA_IDS as readonly string[]).includes(value);
}
