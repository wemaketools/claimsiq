/**
 * Contract-first routing: one route per entry of `endpoints`, mounted from the contract list, so an endpoint without a
 * handler is a type error and one without a route is a failing test. For every request the route
 *   - reads the as-of date (`X-As-Of`) and the acting persona (`X-Persona`),
 *   - validates the query and the body with the contract's own zod schemas (400 for a bad query, 422 for a bad body),
 *   - runs the handler, and checks its answer against the contract's response schema (a drifting handler is a 500, not a
 *     wrong answer on a screen).
 * A handler gets the tenant only through `ctx.tenant`, which opens `withTenant`.
 */
import type { Context, Hono } from 'hono';
import type { z } from 'zod';

import {
  AS_OF_HEADER,
  DEFAULT_AS_OF,
  PERSONA_HEADER,
  PersonaId,
  endpoints,
  isRealDate,
} from '../../../contracts/index.js';
import type { EndpointContract, Endpoints } from '../../../contracts/index.js';
import type { ReadModel } from '../../../read-model/index.js';
import { TaskRuleViolation } from '../../../read-model/index.js';
import type { AppConfig } from '../config/index.js';
import { withTenant } from '../db/index.js';
import type { Db, TenantId, TenantScope } from '../db/index.js';
import { HttpProblem } from '../errors/index.js';
import type { FieldProblem } from '../errors/index.js';
import { loadReadModel } from '../read-model/load.js';
import type { VerifiedToken } from '../auth/verify.js';
import type { ApiEnv } from './env.js';

export interface RequestContext<Q, B> {
  readonly config: AppConfig;
  /** The owner's connection (no row level security): only for what `withTenant` cannot do, such as the demo reset. */
  readonly db: Db;
  readonly tenantId: TenantId;
  readonly session: VerifiedToken;
  readonly asOf: string;
  /** The persona acting, or `null` when the request names none. */
  readonly actor: PersonaId | null;
  readonly query: Q;
  readonly body: B;
  readonly params: Readonly<Record<string, string>>;
  readonly idempotencyKey: string | null;
  readonly now: Date;
  /** Runs `work` as one transaction in the tenant, under the application role and its row level security. */
  tenant<R>(work: (scope: TenantScope) => Promise<R>): Promise<R>;
  /** The tenant's records as the shared read model, read in one transaction. */
  model(): Promise<ReadModel>;
}

export interface EndpointHandler<R, Q, B> {
  /** The success status; 200 when absent. */
  readonly status?: 200 | 201;
  run(ctx: RequestContext<Q, B>): Promise<R>;
}

type HandlerOf<E> = E extends EndpointContract<infer R, infer Q, infer B> ? EndpointHandler<R, Q, B> : never;

export type Handlers = { readonly [K in keyof Endpoints]: HandlerOf<Endpoints[K]> };
export type HandlersOf<K extends keyof Endpoints> = Pick<Handlers, K>;

export interface MountDeps {
  readonly config: AppConfig;
  readonly db: Db;
  readonly now: () => Date;
}

const fieldProblems = (error: z.ZodError): FieldProblem[] =>
  error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code, message: issue.message }));

async function bodyOf(c: Context<ApiEnv>, endpoint: EndpointContract<unknown, unknown, unknown>): Promise<unknown> {
  if (endpoint.body === null) {
    return undefined;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(await c.req.text());
  } catch {
    throw new HttpProblem(400, 'The request body is not valid JSON.');
  }
  const checked = endpoint.body.safeParse(payload);
  if (!checked.success) {
    throw new HttpProblem(422, 'The request has invalid values.', fieldProblems(checked.error));
  }
  return checked.data;
}

function queryOf(c: Context<ApiEnv>, endpoint: EndpointContract<unknown, unknown, unknown>): unknown {
  if (endpoint.query === null) {
    return undefined;
  }
  const checked = endpoint.query.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!checked.success) {
    throw new HttpProblem(400, 'The query has invalid values.', fieldProblems(checked.error));
  }
  return checked.data;
}

export function mountEndpoints(app: Hono<ApiEnv>, handlers: Handlers, deps: MountDeps): void {
  for (const [key, endpoint] of Object.entries(endpoints) as [keyof Endpoints, EndpointContract<unknown, unknown, unknown>][]) {
    const handler = handlers[key] as EndpointHandler<unknown, unknown, unknown>;
    app.on(endpoint.method, endpoint.path, async (c) => {
      const asOf = c.req.header(AS_OF_HEADER) ?? DEFAULT_AS_OF;
      if (!isRealDate(asOf)) {
        throw new HttpProblem(400, `${AS_OF_HEADER} must be a date as YYYY-MM-DD.`);
      }
      const actor = PersonaId.safeParse(c.req.header(PERSONA_HEADER));
      const query = queryOf(c, endpoint);
      const body = await bodyOf(c, endpoint);
      const tenantId = c.get('tenantId');

      let result: unknown;
      try {
        result = await handler.run({
          config: deps.config,
          db: deps.db,
          tenantId,
          session: c.get('session'),
          asOf,
          actor: actor.success ? actor.data : null,
          query,
          body,
          params: c.req.param(),
          idempotencyKey: c.req.header('Idempotency-Key') ?? null,
          now: deps.now(),
          tenant: (work) => withTenant(deps.db, tenantId, work),
          model: () => withTenant(deps.db, tenantId, (scope) => loadReadModel(scope)),
        });
      } catch (error) {
        if (error instanceof TaskRuleViolation) {
          throw new HttpProblem(422, 'The request has invalid values.', [{ field: error.field, code: 'invalid', message: error.message }]);
        }
        throw error;
      }

      const checked = endpoint.response.safeParse(result);
      if (!checked.success) {
        throw new Error(`The answer of ${endpoint.id} does not match its contract: ${checked.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
      }
      return c.json(checked.data as object, handler.status ?? 200);
    });
  }
}
