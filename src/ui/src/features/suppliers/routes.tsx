import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'suppliers',
    routes: [{ path: 'suppliers', load: () => import('./SuppliersPage') }],
    nav: [{ id: 'suppliers', label: 'suppliers.nav', path: 'suppliers', order: 50, icon: 'truck' }],
  },
];
