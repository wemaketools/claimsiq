/**
 * AppShell: sidebar + main column (top bar, page content). Rendered for every signed-in route (RouteGuard).
 * Pages portal their title into the top bar through the page slots. Below 768px the sidebar is a drawer: closed, it
 * is hidden from focus and assistive technology (CSS visibility); opening it moves focus to the first nav link;
 * Escape or the scrim closes it and returns focus to the menu button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router';

import { features } from '../../app/featureRegistry';
import type { FeatureModule } from '../../app/featureRegistry';
import { t } from '../../lib/i18n';
import { DRAWER_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { MAIN_REGION_ID } from '../ui/focusReturn';
import { PageSlotsContext } from '../ui/pageSlots';
import type { PageSlots } from '../ui/pageSlots';
import { PrototypeBanner } from './PrototypeBanner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_ID = 'ciq-sidebar';

export function AppShell({ modules = features }: { readonly modules?: readonly FeatureModule[] }) {
  const drawerMode = useMediaQuery(DRAWER_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const open = drawerMode && drawerOpen;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    document.getElementById(SIDEBAR_ID)?.querySelector<HTMLElement>('a[href]')?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setDrawerOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const slots = useMemo<PageSlots>(() => ({ title: titleSlot }), [titleSlot]);

  const classes = ['ciq-app'];
  if (drawerMode) classes.push('ciq-app--drawer');
  if (open) classes.push('ciq-app--drawer-open');

  const closeToMenuButton = (): void => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  };
  const closeAfterNavigation = (): void => {
    setDrawerOpen(false);
    document.getElementById(MAIN_REGION_ID)?.focus();
  };

  return (
    <PageSlotsContext.Provider value={slots}>
      <div className={classes.join(' ')}>
        <a className="ciq-skip-link" href={`#${MAIN_REGION_ID}`}>
          {t('shell.skipToContent')}
        </a>
        <Sidebar
          id={SIDEBAR_ID}
          modules={modules}
          onNavigate={drawerMode ? closeAfterNavigation : undefined}
        />
        {open && (
          <div className="ciq-drawer-scrim" aria-hidden="true" onClick={closeToMenuButton} />
        )}
        <div className="ciq-main">
          <PrototypeBanner />
          <Topbar
            titleRef={setTitleSlot}
            onOpenMenu={() => setDrawerOpen((current) => !current)}
            menuOpen={open}
            menuButtonRef={menuButtonRef}
            sidebarId={SIDEBAR_ID}
          />
          <main className="ciq-content" id={MAIN_REGION_ID} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </PageSlotsContext.Provider>
  );
}
