import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import type { ApiErrorKind } from '../../api/client';
import { t } from '../../lib/i18n';
import { describeError } from './errors';

function failure(kind: ApiErrorKind, detail: string | null = null): ApiError {
  return new ApiError({ kind, status: 500, title: 'Title', detail, endpointId: 'x.y' });
}

describe('describeError', () => {
  it.each([
    ['network', 'ui.error.network'],
    ['server', 'ui.error.server'],
    ['not_found', 'ui.error.notFound'],
    ['rate_limited', 'ui.error.rateLimited'],
    ['forbidden', 'ui.restricted.description'],
  ] as const)('uses the catalog text for a %s failure', (kind, key) => {
    expect(describeError(failure(kind, 'raw server detail'))).toBe(t(key));
  });

  it('names the endpoint and the drift for a contract failure', () => {
    const text = describeError(failure('contract', 'items: Required'));

    expect(text).toContain('x.y');
    expect(text).toContain('items: Required');
  });

  it('shows the detail of a validation failure, or its title without one', () => {
    expect(describeError(failure('validation', 'Amount is negative'))).toBe('Amount is negative');
    expect(describeError(failure('validation'))).toBe('Title');
  });
});
