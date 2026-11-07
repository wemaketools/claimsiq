/**
 * The master data the claim screens join to the engine's facts (client, product and handler names) and the choices of
 * the shared filters. Everything is read through the typed endpoints.
 */
import { useMemo } from 'react';

import { endpoints } from '../../../../contracts/index';
import type { ClaimFacts } from '../../../../contracts/index';
import type { ApiError } from '../../api/client';
import { useApiQuery } from '../../api/hooks';
import type { SelectOption } from '../../components/ui';
import { t } from '../../lib/i18n';

export interface ClaimLookups {
  readonly options: {
    readonly policies: readonly SelectOption[];
    readonly brokers: readonly SelectOption[];
    readonly products: readonly SelectOption[];
    readonly handlers: readonly SelectOption[];
  };
  readonly clientOf: (fact: ClaimFacts) => string;
  readonly productOf: (fact: ClaimFacts) => string;
  readonly handlerOf: (fact: ClaimFacts) => string;
  /** The name behind an id of a breakdown row; `null` is a policy that names no broker. */
  readonly nameOf: {
    readonly product: (id: string | null) => string;
    readonly broker: (id: string | null) => string;
    readonly handler: (id: string | null) => string;
  };
}

export interface LookupsResult {
  readonly lookups: ClaimLookups | undefined;
  readonly error: ApiError | null;
  readonly reload: () => void;
}

const byLabel = (a: SelectOption, b: SelectOption): number => a.label.localeCompare(b.label);

export function useClaimLookups(): LookupsResult {
  const policies = useApiQuery(endpoints.policiesList, {});
  const clients = useApiQuery(endpoints.clientsList, {});
  const brokers = useApiQuery(endpoints.brokersList, {});
  const products = useApiQuery(endpoints.productsList, {});
  const users = useApiQuery(endpoints.usersList, {});
  const claims = useApiQuery(endpoints.claimsList, {});
  const queries = [policies, clients, brokers, products, users, claims];
  const error =
    queries.find((query) => query.error !== null && query.data === undefined)?.error ?? null;

  const lookups = useMemo((): ClaimLookups | undefined => {
    if (
      policies.data === undefined ||
      clients.data === undefined ||
      brokers.data === undefined ||
      products.data === undefined ||
      users.data === undefined ||
      claims.data === undefined
    ) {
      return undefined;
    }
    const clientName = new Map(clients.data.items.map((c) => [c.client_id, c.name]));
    const productName = new Map(products.data.items.map((p) => [p.product_id, p.product_name]));
    const userName = new Map(users.data.items.map((u) => [u.user_id, u.display_name]));
    const policyById = new Map(policies.data.items.map((p) => [p.policy_id, p]));
    const brokerName = new Map(brokers.data.items.map((b) => [b.broker_id, b.name]));
    const handlerIds = new Set(claims.data.items.map((claim) => claim.handler_id));
    return {
      options: {
        policies: policies.data.items
          .map((policy) => ({ value: policy.policy_id, label: policy.policy_number }))
          .sort(byLabel),
        brokers: brokers.data.items
          .map((broker) => ({ value: broker.broker_id, label: broker.name }))
          .sort(byLabel),
        products: products.data.items
          .map((product) => ({ value: product.product_id, label: product.product_name }))
          .sort(byLabel),
        handlers: users.data.items
          .filter((user) => handlerIds.has(user.user_id))
          .map((user) => ({ value: user.user_id, label: user.display_name }))
          .sort(byLabel),
      },
      clientOf: (fact) => {
        const policy = policyById.get(fact.policy_id);
        return policy === undefined
          ? fact.policy_id
          : (clientName.get(policy.client_id) ?? policy.client_id);
      },
      productOf: (fact) => {
        const policy = policyById.get(fact.policy_id);
        return policy === undefined
          ? fact.policy_id
          : (productName.get(policy.product_id) ?? policy.product_id);
      },
      handlerOf: (fact) => userName.get(fact.handler_id) ?? fact.handler_id,
      nameOf: {
        product: (id) => (id === null ? '' : (productName.get(id) ?? id)),
        broker: (id) => (id === null ? t('claim-scope.noBroker') : (brokerName.get(id) ?? id)),
        handler: (id) => (id === null ? '' : (userName.get(id) ?? id)),
      },
    };
  }, [policies.data, clients.data, brokers.data, products.data, users.data, claims.data]);

  return {
    lookups,
    error,
    reload: () => queries.forEach((query) => query.reload()),
  };
}
