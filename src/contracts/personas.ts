/** A persona is a view, never authentication; the API records it as the actor of a command. */
import { z } from 'zod';

export const PERSONA_IDS = ['head-of-claims', 'claims-handler', 'supplier-coordinator', 'finance'] as const;
export const PersonaId = z.enum(PERSONA_IDS);
export type PersonaId = z.infer<typeof PersonaId>;

/** The personas that may change the rule config; the others read it. */
export const RULE_EDITOR_PERSONAS: readonly PersonaId[] = ['head-of-claims', 'finance'];

export const canEditRules = (persona: PersonaId | null): boolean => persona !== null && RULE_EDITOR_PERSONAS.includes(persona);
