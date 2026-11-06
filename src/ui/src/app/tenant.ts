/**
 * The tenant the demo runs for. It labels the shell and travels with every API call as `X-Tenant-Id`.
 */

export interface Tenant {
  readonly id: string;
  readonly name: string;
}

export const TENANT: Tenant = { id: 'DEMO', name: 'Fictional Botswana insurer demo' };
