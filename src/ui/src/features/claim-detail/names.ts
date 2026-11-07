/** The names behind the identifiers of one claim; an identifier whose name is not known is shown as it is. */
import { useMemo } from 'react';

import type { Broker, Client, Policy, Product } from '../../../../contracts/index';
import type { ClaimDetailData } from './useClaimDetail';

export interface ClaimNames {
  readonly policy: (policyId: string) => Policy | undefined;
  readonly client: (clientId: string) => Client | undefined;
  readonly product: (productId: string) => Product | undefined;
  readonly broker: (brokerId: string) => Broker | undefined;
  readonly user: (userId: string) => string;
  readonly supplier: (supplierId: string) => string;
}

export function useClaimNames({ names }: ClaimDetailData): ClaimNames {
  const { policies, clients, products, brokers, users, suppliers } = names;
  return useMemo(() => {
    const find = <T, K extends keyof T>(items: readonly T[] | undefined, key: K, id: string) =>
      items?.find((item) => item[key] === id);
    return {
      policy: (id) => find(policies.data?.items, 'policy_id', id),
      client: (id) => find(clients.data?.items, 'client_id', id),
      product: (id) => find(products.data?.items, 'product_id', id),
      broker: (id) => find(brokers.data?.items, 'broker_id', id),
      user: (id) => find(users.data?.items, 'user_id', id)?.display_name ?? id,
      supplier: (id) => find(suppliers.data?.items, 'supplier_id', id)?.name ?? id,
    };
  }, [policies.data, clients.data, products.data, brokers.data, users.data, suppliers.data]);
}
