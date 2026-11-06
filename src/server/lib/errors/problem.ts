/** `application/problem+json` answers: the shape the SPA's API client normalizes into an `ApiError`. */
import type { FieldProblem } from '../../../read-model/index.js';

export const PROBLEM_JSON = 'application/problem+json';
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** An error the caller can act on, with the status it maps to. Its title reaches the client, so it never carries a value that could be secret. */
export class HttpProblem extends Error {
  readonly status: number;
  readonly title: string;
  readonly errors: readonly FieldProblem[];
  readonly headers: Readonly<Record<string, string>>;

  constructor(status: number, title: string, errors: readonly FieldProblem[] = [], headers: Readonly<Record<string, string>> = {}) {
    super(title);
    this.name = 'HttpProblem';
    this.status = status;
    this.title = title;
    this.errors = errors;
    this.headers = headers;
  }
}

export function problemResponse(problem: HttpProblem, correlationId: string): Response {
  const body = {
    type: 'about:blank',
    title: problem.title,
    status: problem.status,
    ...(problem.errors.length > 0 ? { errors: problem.errors } : {}),
    correlationId,
  };
  return new Response(JSON.stringify(body), {
    status: problem.status,
    headers: { ...problem.headers, 'content-type': PROBLEM_JSON, [CORRELATION_ID_HEADER]: correlationId },
  });
}

/** A caller-supplied correlation id is kept when it is short and plain, else a new one is made. */
export function resolveCorrelationId(supplied: string | null | undefined): string {
  return supplied !== null && supplied !== undefined && /^[A-Za-z0-9._-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
}
