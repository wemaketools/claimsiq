import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'claims',
    routes: [{ path: 'claims', load: () => import('./ClaimsPage') }],
    nav: [{ id: 'claims', label: 'claims.nav', path: 'claims', order: 40, icon: 'folder' }],
  },
];
