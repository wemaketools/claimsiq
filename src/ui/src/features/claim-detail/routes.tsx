import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'claim-detail',
    routes: [{ path: 'claims/:claimId', load: () => import('./ClaimDetailPage') }],
  },
];
