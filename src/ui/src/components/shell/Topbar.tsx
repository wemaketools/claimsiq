/**
 * The top bar (64px, sticky): the menu button below 768px, the page title (from PageHeader), the persona switch and
 * the theme toggle. The persona switch and the toggle are always the last items, so they never move between pages.
 * Pages never put actions here; their primary action renders in the page head (PageHeader).
 */
import type { Ref } from 'react';

import { PERSONA_IDS, isPersonaId } from '../../app/personas';
import { useAppDispatch, useAppSelector, usePersona } from '../../app/hooks';
import { chooseTheme, choosePersona } from '../../app/sessionActions';
import { t } from '../../lib/i18n';
import { IconButton } from '../ui/Button';

export interface TopbarProps {
  /** Receives the title slot element (PageHeader portals the page title into it). */
  readonly titleRef: (element: HTMLElement | null) => void;
  /** Shown below 768px: opens the navigation drawer. */
  readonly onOpenMenu: () => void;
  readonly menuOpen: boolean;
  readonly sidebarId: string;
  /** Receives the menu button, so the drawer can return focus to it. */
  readonly menuButtonRef?: Ref<HTMLButtonElement>;
}

const SWITCH_ID = 'ciq-persona-switch';

export function Topbar({ titleRef, onOpenMenu, menuOpen, sidebarId, menuButtonRef }: TopbarProps) {
  const dispatch = useAppDispatch();
  const persona = usePersona();
  const theme = useAppSelector((state) => state.session.theme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="ciq-topbar">
      <IconButton
        ref={menuButtonRef}
        icon="menu"
        label={t('shell.topbar.openMenu')}
        className="ciq-topbar-menu-btn"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls={sidebarId}
      />
      <h1 className="ciq-topbar-title" ref={titleRef} />
      <div className="ciq-topbar-spacer" />
      <div className="ciq-persona-switch">
        <label htmlFor={SWITCH_ID} className="ciq-persona-switch-label">
          {t('shell.persona.label')}
        </label>
        <select
          id={SWITCH_ID}
          value={persona}
          onChange={(event) => {
            if (isPersonaId(event.target.value)) {
              dispatch(choosePersona(event.target.value));
            }
          }}
        >
          {PERSONA_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`shell.persona.${id}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="ciq-topbar-actions">
        <IconButton
          icon={nextTheme === 'dark' ? 'moon' : 'sun'}
          label={nextTheme === 'dark' ? t('shell.theme.useDark') : t('shell.theme.useLight')}
          onClick={() => dispatch(chooseTheme(nextTheme))}
        />
      </div>
    </header>
  );
}
