/**
 * The personas of the persona switch. The switch is a view convenience for the demo, never authentication: it
 * changes what the shell shows as the active persona and nothing about what the signed-in user may do. The API
 * records the persona as the actor of a command.
 */
import { PERSONA_IDS, PersonaId } from '../../../contracts/index';

export { PERSONA_IDS };
export type { PersonaId };

export const DEFAULT_PERSONA: PersonaId = 'head-of-claims';

/** The screen each persona opens on, at sign-in and when the persona is switched. A deep link wins over it. */
export const PERSONA_LANDING: Readonly<Record<PersonaId, string>> = {
  'head-of-claims': '/overview',
  'claims-handler': '/actions',
  'supplier-coordinator': '/suppliers',
  finance: '/digest',
};

export function isPersonaId(value: unknown): value is PersonaId {
  return PersonaId.safeParse(value).success;
}
