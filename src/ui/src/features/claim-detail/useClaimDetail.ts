/** Everything the Claim Detail page reads: the claim record, the engine's facts for it, its tasks and the names. */
import { endpoints } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';

export function useClaimDetail(claimId: string) {
  const claim = useApiQuery(endpoints.claimsGet, { params: { claimId } });
  const facts = useApiQuery(endpoints.claimsFacts, { query: { claim_id: claimId } });
  const tasks = useApiQuery(endpoints.tasksList, {
    query: { subject_type: 'CLAIM', subject_id: claimId },
  });
  const policies = useApiQuery(endpoints.policiesList, {});
  const clients = useApiQuery(endpoints.clientsList, {});
  const products = useApiQuery(endpoints.productsList, {});
  const brokers = useApiQuery(endpoints.brokersList, {});
  const users = useApiQuery(endpoints.usersList, {});
  const suppliers = useApiQuery(endpoints.suppliersList, {});
  const names = [policies, clients, products, brokers, users, suppliers];
  return {
    claim,
    facts,
    tasks,
    names: { policies, clients, products, brokers, users, suppliers },
    namesFailed: names.some((query) => query.status === 'error' && query.data === undefined),
    reload: () => {
      claim.reload();
      facts.reload();
      tasks.reload();
      names.forEach((query) => query.reload());
    },
  };
}
export type ClaimDetailData = ReturnType<typeof useClaimDetail>;
