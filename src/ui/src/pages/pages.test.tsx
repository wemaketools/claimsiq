import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signedOutSession } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { LoadingScreen } from './LoadingScreen';
import { NotFoundPage } from './NotFoundPage';

describe('shell pages', () => {
  it('Not found offers the way back', () => {
    renderWithProviders(<NotFoundPage />, { state: { session: signedOutSession() } });

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the start page' })).toHaveAttribute('href', '/');
  });

  it('Loading screen announces progress under the wordmark', () => {
    renderWithProviders(<LoadingScreen message="Signing you in…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
    expect(screen.getByRole('status')).toHaveTextContent('ClaimsIQ');
  });
});
