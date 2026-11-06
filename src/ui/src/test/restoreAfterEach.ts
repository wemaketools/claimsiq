/**
 * Restores run after the current test: `restoreAfterEach(configureApiClient(...))` undoes a global setting a test
 * installed, even when the test fails.
 */
import { afterEach } from 'vitest';

const pending: Array<() => void> = [];

afterEach(() => {
  while (pending.length > 0) pending.pop()?.();
});

export function restoreAfterEach(restore: () => void): void {
  pending.push(restore);
}
