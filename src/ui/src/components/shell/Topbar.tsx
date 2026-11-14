/**
 * The top bar (at least 64px high, sticky; below 768px it wraps the data controls onto a second row): the menu button below 768px, the page title (from PageHeader), the data controls, the
 * persona switch and the theme toggle. Switching the persona opens `/`, which `LandingRedirect` sends to the new persona's screen. The persona switch and the toggle are always the last items, so they never move between pages.
 * Pages never put actions here; their primary action renders in the page head (PageHeader).
 */
import type { Ref } from 'react';
import { useNavigate } from 'react-router';

import { LANDING_ROUTE } from '../../app/LandingRedirect';
import { PERSONA_IDS, isPersonaId } from '../../app/personas';
import { useAppDispatch, usePersona } from '../../app/hooks';
import { choosePersona } from '../../app/sessionActions';
import { t } from '../../lib/i18n';
import { DataControls } from './DataControls';
import { IconButton } from '../ui/Button';
import { useThemeToggle } from './useThemeToggle';

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
  const navigate = useNavigate();
  const persona = usePersona();
  const themeToggle = useThemeToggle();

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
      <DataControls />
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
              void navigate(LANDING_ROUTE);
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
          icon={themeToggle.icon}
          label={themeToggle.label}
          onClick={themeToggle.toggle}
        />
      </div>
    </header>
  );
}
