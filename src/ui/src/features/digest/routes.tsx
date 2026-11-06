import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'digest',
    routes: [{ path: 'digest', load: () => import('./DigestPage') }],
    nav: [{ id: 'digest', label: 'digest.nav', path: 'digest', order: 65, icon: 'fileText' }],
  },
];
