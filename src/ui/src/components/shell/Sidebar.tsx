/**
 * The sidebar: the tenant label, the wordmark Claims + accent IQ and "Claims Intelligence"; navigation built from
 * the feature registry; the user card at the bottom. Below 1280px it collapses to an icon rail, below 768px it is a
 * drawer.
 */
import { NavLink } from 'react-router';

import { features, navItemsFor } from '../../app/featureRegistry';
import { useTenant } from '../../app/hooks';
import type { FeatureModule } from '../../app/featureRegistry';
import { t } from '../../lib/i18n';
import { Icon } from '../ui/Icon';
import { UserCard } from './UserCard';

export interface SidebarProps {
  /** Called after a nav link is followed (closes the drawer). */
  readonly onNavigate?: () => void;
  readonly id?: string;
  /** The feature modules to build the navigation from (default: the registry). */
  readonly modules?: readonly FeatureModule[];
}

export function Sidebar({ onNavigate, id, modules = features }: SidebarProps) {
  const items = navItemsFor(modules);
  const tenant = useTenant();
  return (
    <aside className="ciq-sidebar" id={id} aria-label={t('shell.sidebar.label')}>
      <div className="ciq-brand">
        <div className="ciq-brand-tenant" title={tenant.name}>
          {tenant.name}
        </div>
        <div className="ciq-brand-name">
          {t('shell.brand.claims')}
          <span className="ciq-brand-iq">{t('shell.brand.iq')}</span>
        </div>
        <div className="ciq-brand-sub">{t('shell.brand.sub')}</div>
        <div className="ciq-brand-mark" aria-hidden="true">
          C<span className="ciq-brand-iq">{t('shell.brand.iq')}</span>
        </div>
      </div>
      <nav className="ciq-nav" aria-label={t('shell.nav.label')}>
        <ul className="ciq-nav-section">
          {items.map((item) => {
            const label = t(item.label);
            return (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? 'ciq-nav-item ciq-nav-item--active' : 'ciq-nav-item'
                  }
                  title={label}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} />
                  <span className="ciq-nav-label">{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <UserCard />
    </aside>
  );
}
