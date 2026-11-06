/**
 * Sign-in of a prototype build: no form, because there are no accounts. It keeps the layout of the password page (a
 * short card, then the demo-accounts card), and a click on a role signs in as it at once.
 */
import { PERSONA_IDS } from '../app/personas';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import type { PrototypeAuthActions } from './authContext';
import { DemoAccounts } from './DemoAccounts';
import { PROTOTYPE_USER_NAMES } from './prototypeUsers';

export function PrototypeSignIn({ auth }: { readonly auth: PrototypeAuthActions }) {
  return (
    <AuthLayout
      title={t('auth.signIn.title')}
      subtitle={t('auth.prototype.subtitle')}
      below={
        <DemoAccounts
          title={t('auth.prototype.title')}
          subtitle={t('auth.prototype.hint')}
          accounts={PERSONA_IDS.map((role) => ({
            id: role,
            name: t(`shell.persona.${role}`),
            detail: PROTOTYPE_USER_NAMES[role],
          }))}
          onPick={auth.signInAsRole}
        />
      }
    />
  );
}
