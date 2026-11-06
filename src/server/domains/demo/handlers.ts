/**
 * Reset: puts the active tenant's data set back as the fixture loaded it (tasks and their audit trail gone, rows and
 * rule configuration restored, its audit gone). It rewrites a tenant's data, so it answers 403 anywhere but
 * `APP_ENV` local or dev, and it runs as the owner, because the application role may delete neither audit trail nor
 * tasks. The caller is already a verified member of the tenant.
 */
import { isDataSetId } from '../../../contracts/index.js';
import { loadDataset } from '../../../read-model/index.js';
import { HttpProblem } from '../../lib/errors/index.js';
import type { HandlersOf } from '../../lib/router/contract.js';
import { committedFixture } from '../../lib/seed/fixtureFiles.js';
import { replaceDataSetRows } from '../../lib/seed/replace.js';

const RESET_ENVIRONMENTS: readonly string[] = ['local', 'dev'];

export const demoHandlers: HandlersOf<'demoReset'> = {
  demoReset: {
    run: async (ctx) => {
      if (!RESET_ENVIRONMENTS.includes(ctx.config.appEnv)) {
        throw new HttpProblem(403, 'Reset is only available in the local and dev environments.');
      }
      if (!isDataSetId(ctx.tenantId)) {
        throw new HttpProblem(404, `Tenant "${ctx.tenantId}" has no fixture to restore.`);
      }
      const { files, ruleConfig } = committedFixture(ctx.tenantId);
      const data = loadDataset(ctx.tenantId, files);
      await ctx.db.transaction().execute((trx) => replaceDataSetRows(trx, data, ruleConfig));
      return { tenant_id: ctx.tenantId, reset: true as const };
    },
  },
};
