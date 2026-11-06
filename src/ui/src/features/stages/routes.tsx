import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'stages',
    routes: [{ path: 'stages', load: () => import('./StagesPage') }],
    nav: [{ id: 'stages', label: 'stages.nav', path: 'stages', order: 20, icon: 'layers' }],
  },
];
