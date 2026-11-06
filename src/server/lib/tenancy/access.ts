/**
 * Which tenant a signed-in user may enter. The `X-Tenant-Id` header only says which tenant the caller wants: it is
 * trusted after this lookup and not before. An unknown tenant and a tenant the user is not a member of give the same
 * answer, so a caller cannot probe which tenants exist.
 *
 * The lookup runs as the connection owner (RLS does not apply): the tenant is not known yet.
 */
import { PersonaId } from '../../../contracts/index.js';
import type { Db } from '../db/index.js';
import { isTenantId, toTenantId } from '../db/index.js';
import type { TenantId } from '../db/index.js';

export type TenantAccess =
  | { readonly ok: true; readonly tenantId: TenantId; /** The view the account starts in. */ readonly persona: PersonaId }
  | { readonly ok: false; readonly reason: 'not_a_member' };

export async function resolveTenantAccess(db: Db, authUserId: string, requestedTenant: string): Promise<TenantAccess> {
  if (!isTenantId(requestedTenant)) {
    return { ok: false, reason: 'not_a_member' };
  }
  const membership = await db
    .selectFrom('tenant_memberships')
    .select('persona')
    .where('auth_user_id', '=', authUserId)
    .where('tenant_id', '=', requestedTenant)
    .executeTakeFirst();
  if (membership === undefined) {
    return { ok: false, reason: 'not_a_member' };
  }
  return { ok: true, tenantId: toTenantId(requestedTenant), persona: PersonaId.parse(membership.persona) };
}
