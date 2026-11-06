import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'rules',
    routes: [{ path: 'rules', load: () => import('./RulesPage') }],
    nav: [{ id: 'rules', label: 'rules.nav', path: 'rules', order: 70, icon: 'sliders' }],
  },
];
