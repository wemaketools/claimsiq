/**
 * SPA entry point: global styles (tokens, components, self-hosted fonts), the providers and the router.
 */
import './zodConfig';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './theme/index.css';
import type { ApiTransport } from './api/client';
import { AppProviders } from './app/AppProviders';
import { createAppRouter } from './app/router';
import { store } from './app/store';
import { readStoredTheme } from './lib/storage';

document.documentElement.dataset.theme = readStoredTheme() ?? 'light';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html must contain <div id="root">.');
}

/**
 * Where the API calls go. A prototype build answers them in the browser with the mock API over the bundled fixtures;
 * every other build sends them to the real API with the platform `fetch` (`/api/v1`, same origin: Vite proxies it in
 * development), the session's bearer token added by the API client. The comparison is inline so the bundler folds it
 * and a Supabase-mode bundle carries neither the mock API nor the fixtures.
 */
async function createTransport(): Promise<ApiTransport | undefined> {
  if (import.meta.env.VITE_AUTH_MODE === 'prototype') {
    return (await import('./api/mockTransport')).createMockTransport();
  }
  return undefined;
}

const router = createAppRouter();
const transport = await createTransport();

createRoot(container).render(
  <StrictMode>
    <AppProviders store={store} {...(transport === undefined ? {} : { transport })}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
