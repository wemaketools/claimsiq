import type { PersonaId } from '../app/personas';

/** The display name of the demo user each role signs in as (the fixtures' "<Name> Demo" users; none has an e-mail). */
export const PROTOTYPE_USER_NAMES: Readonly<Record<PersonaId, string>> = {
  'head-of-claims': 'Mpho Demo',
  'claims-handler': 'Boitumelo Demo',
  'supplier-coordinator': 'Kagiso Demo',
  finance: 'Tiro Demo',
};
