/** The read endpoints: the tenant's records as the shared read model, answered by `reads` (`src/read-model`). */
import { claimNotFoundMessage, reads } from '../../../read-model/index.js';
import { HttpProblem } from '../../lib/errors/index.js';
import type { HandlersOf } from '../../lib/router/contract.js';

type ReadEndpoints =
  | 'claimsList'
  | 'claimsGet'
  | 'claimsFacts'
  | 'claimsPaidTrend'
  | 'claimsWhatIf'
  | 'suppliersInsights'
  | 'policiesList'
  | 'clientsList'
  | 'brokersList'
  | 'productsList'
  | 'invoicesList'
  | 'suppliersList'
  | 'usersList'
  | 'tasksList'
  | 'dataIssues';

export const readHandlers: HandlersOf<ReadEndpoints> = {
  claimsList: { run: async (c) => reads.claimsList(await c.model(), c.asOf) },
  claimsGet: {
    run: async (c) => {
      const claimId = c.params.claimId ?? '';
      const found = reads.claimsGet(await c.model(), c.asOf, claimId);
      if (found === null) {
        throw new HttpProblem(404, claimNotFoundMessage(claimId, c.asOf));
      }
      return found;
    },
  },
  claimsWhatIf: {
    run: async (c) => {
      const claimId = c.params.claimId ?? '';
      const found = reads.claimsWhatIf(await c.model(), c.asOf, claimId, c.query);
      if (found === null) {
        throw new HttpProblem(404, claimNotFoundMessage(claimId, c.asOf));
      }
      return found;
    },
  },
  claimsFacts: { run: async (c) => reads.claimsFacts(await c.model(), c.asOf, c.query) },
  claimsPaidTrend: { run: async (c) => reads.claimsPaidTrend(await c.model(), c.asOf, c.query) },
  suppliersInsights: { run: async (c) => reads.suppliersInsights(await c.model(), c.asOf, c.query) },
  policiesList: { run: async (c) => reads.policiesList(await c.model(), c.asOf) },
  clientsList: { run: async (c) => reads.clientsList(await c.model(), c.asOf) },
  brokersList: { run: async (c) => reads.brokersList(await c.model(), c.asOf) },
  productsList: { run: async (c) => reads.productsList(await c.model(), c.asOf) },
  invoicesList: { run: async (c) => reads.invoicesList(await c.model(), c.asOf, c.query) },
  suppliersList: { run: async (c) => reads.suppliersList(await c.model(), c.asOf) },
  usersList: { run: async (c) => reads.usersList(await c.model(), c.asOf) },
  tasksList: { run: async (c) => reads.tasksList(await c.model(), c.asOf, c.query) },
  dataIssues: { run: async (c) => reads.dataIssues(await c.model()) },
};
