/**
 * The tenant middleware: `X-Tenant-Id` names the tenant the caller wants, and the membership lookup decides on every
 * request whether the signed-in user may enter it. A tenant that does not exist and one the user is not a member of
 * answer the same 403.
 */
import type { MiddlewareHandler } from 'hono';

import { TENANT_HEADER } from '../../../contracts/index.js';
import type { Db } from '../db/index.js';
import { HttpProblem } from '../errors/index.js';
import type { ApiEnv } from '../router/env.js';
import { resolveTenantAccess } from './access.js';

export function requireTenantAccess(db: Db): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const requested = c.req.header(TENANT_HEADER);
    if (requested === undefined || requested.trim() === '') {
      throw new HttpProblem(400, `${TENANT_HEADER} is required.`);
    }
    const access = await resolveTenantAccess(db, c.get('session').authUserId, requested.trim());
    if (!access.ok) {
      throw new HttpProblem(403, 'You do not have access to this tenant.');
    }
    c.set('tenantId', access.tenantId);
    await next();
  };
}
