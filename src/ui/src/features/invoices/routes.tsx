import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'invoices',
    routes: [{ path: 'policies/:policyId/invoices', load: () => import('./PolicyInvoicesPage') }],
  },
];
