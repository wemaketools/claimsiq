/**
 * ScreenStates: the loading, empty and error states of a screen that has no data behind it yet, drawn with the
 * design-system pieces so every screen handles them the same way.
 */
import type { ReactNode } from 'react';

import type { ScreenStatusResult } from '../../app/screenStatus';
import { Card } from './Card';
import { EmptyState, ErrorState } from './EmptyState';
import type { IconName } from './Icon';
import { SkeletonBlock } from './Skeleton';

export interface ScreenStatesProps {
  readonly result: ScreenStatusResult;
  readonly emptyTitle: ReactNode;
  readonly emptyDescription: ReactNode;
  readonly emptyIcon?: IconName;
}

export function ScreenStates({
  result,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: ScreenStatesProps) {
  const { status, reload } = result;
  if (status.state === 'loading') {
    return (
      <Card data-state="loading">
        <SkeletonBlock lines={4} />
      </Card>
    );
  }
  if (status.state === 'error') {
    return (
      <div data-state="error">
        <ErrorState error={status.error} onRetry={reload} />
      </div>
    );
  }
  return (
    <Card data-state="empty">
      <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
    </Card>
  );
}
