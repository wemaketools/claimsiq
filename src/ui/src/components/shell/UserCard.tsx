/**
 * The user card at the bottom of the sidebar: initials, name and the active persona, and a menu with the theme
 * toggle and sign out.
 */
import { useAppSelector, usePersona } from '../../app/hooks';
import { useAuth } from '../../auth/authContext';
import { initialsOf } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { useThemeToggle } from './useThemeToggle';

export function UserCard() {
  const user = useAppSelector((state) => state.session.user);
  const persona = usePersona();
  const themeToggle = useThemeToggle();
  const auth = useAuth();

  if (user === null) {
    return null;
  }
  const personaLabel = t(`shell.persona.${persona}`);

  return (
    <div className="ciq-user-card">
      <Menu
        label={t('shell.user.menu')}
        placement="none"
        className="ciq-user-card-menu"
        entries={[
          {
            kind: 'text',
            id: 'account',
            label: t('shell.user.signedInAs', { account: user.email ?? user.fullName }),
          },
          {
            id: 'theme',
            label: themeToggle.label,
            icon: themeToggle.icon,
            onSelect: themeToggle.toggle,
          },
          { kind: 'separator', id: 'sep' },
          {
            id: 'signout',
            label: t('shell.user.signOut'),
            icon: 'logOut',
            danger: true,
            onSelect: () => void auth.signOut(),
          },
        ]}
        trigger={(props) => (
          <button type="button" className="ciq-user-card-btn" {...props}>
            <span className="ciq-avatar" aria-hidden="true">
              {initialsOf(user.fullName)}
            </span>
            <span className="ciq-user-card-who">
              <span className="ciq-user-card-name">{user.fullName}</span>
              <span className="ciq-user-card-sub">{personaLabel}</span>
            </span>
            <span className="ciq-user-card-chevron" aria-hidden="true">
              <Icon name="chevronUp" />
            </span>
          </button>
        )}
      />
    </div>
  );
}
