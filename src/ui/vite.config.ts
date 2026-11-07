/**
 * Vite + Vitest configuration for the ClaimsIQ SPA.
 *
 * Why it looks like this:
 * - `envDir` is the REPOSITORY ROOT, so the SPA reads `VITE_AUTH_MODE`, `VITE_SUPABASE_URL` and
 *   `VITE_SUPABASE_ANON_KEY` from the root `.env.local`. Those are the only browser-safe variables.
 * - `VITE_AUTH_MODE=prototype` builds a static demo that needs no Supabase and no other variable (see
 *   `resolveAuthMode` for what an unset value means).
 * - The Content-Security-Policy meta tag in index.html is filled in here, because it names the Supabase URL for auth
 *   (not in prototype builds) and differs between the dev server and production builds (see `contentSecurityPolicy`).
 * - In Supabase mode the dev server proxies `/api` to the local API server (`bun run dev:api`), so the SPA calls
 *   `/api/v1` on its own origin, as it will once deployed. `API_PORT` (root `.env.local` or the environment) moves it;
 *   it is read here with `loadEnv` and never reaches the bundle.
 * - The SPA bundles the shared contracts (`src/contracts`) and, in prototype builds, the in-browser mock API
 *   (`src/mock-api`, `src/read-model`) and the CSV fixtures (`fixtures/`), which sit outside `src/ui`, so the dev server may serve the repository root
 *   (`server.fs.allow`).
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const uiDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const rootNodeModules = fileURLToPath(new URL('../../node_modules', import.meta.url));

/** Build-time token in index.html that this config replaces with the policy. */
const CSP_TOKEN = '__CLAIMSIQ_CONTENT_SECURITY_POLICY__';

type AuthMode = 'supabase' | 'prototype';

/**
 * The build's authentication mode. An explicit value wins and must be one of the two. Unset, the dev server uses
 * `supabase`; a production build uses `supabase` only when the Supabase variables are there, and otherwise stops,
 * because a deploy that forgot the mode would ship a page that cannot sign anyone in.
 */
function resolveAuthMode(command: 'build' | 'serve', env: Record<string, string>): AuthMode {
  const chosen = env.VITE_AUTH_MODE;
  if (chosen === 'prototype' || chosen === 'supabase') {
    return chosen;
  }
  if (chosen !== undefined && chosen !== '') {
    throw new Error(`VITE_AUTH_MODE must be "prototype" or "supabase", got "${chosen}".`);
  }
  const hasSupabase = Boolean(env.VITE_SUPABASE_URL) && Boolean(env.VITE_SUPABASE_ANON_KEY);
  if (command === 'build' && !hasSupabase) {
    throw new Error(
      'VITE_AUTH_MODE is not set and VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are missing. Build the static demo ' +
        'with VITE_AUTH_MODE=prototype (bun run build:prototype), or provide the Supabase variables for real sign-in.',
    );
  }
  return 'supabase';
}

function originOf(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local Supabase stack (bun run supabase:start) and write the root .env.local ` +
        '(see README.md, Local development), or set it in the environment for deployed builds.',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL, got "${value}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute http(s) URL, got "${value}".`);
  }
  return url.origin;
}

/**
 * The SPA document gets its CSP from a <meta http-equiv> tag (vercel.json has no header rules).
 * - Production builds: scripts only from the app's own origin; network only to the app and Supabase Auth (the app
 *   alone in prototype builds, which call nothing else); fonts self-hosted, so no font origin is allowed.
 * - Dev server: Vite's React Fast Refresh preamble is an inline module script and HMR uses a websocket,
 *   so the dev policy adds 'unsafe-inline' for scripts and ws:/wss: for connections. Nothing else differs,
 *   so an external font, script or API request is still blocked while developing.
 * Inline style attributes stay allowed ('unsafe-inline' in style-src): React and Recharts set styles at runtime.
 */
function contentSecurityPolicy(authMode: AuthMode, supabaseUrl: string | undefined): Plugin {
  let isDevServer = false;
  return {
    name: 'claimsiq:content-security-policy',
    configResolved(config) {
      isDevServer = config.command === 'serve';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(CSP_TOKEN)) {
          throw new Error(
            `index.html must keep the Content-Security-Policy meta tag with content="${CSP_TOKEN}".`,
          );
        }
        const supabaseOrigin =
          authMode === 'prototype' ? '' : ` ${originOf('VITE_SUPABASE_URL', supabaseUrl)}`;
        const policy = [
          "default-src 'self'",
          isDevServer ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          `connect-src 'self'${supabaseOrigin}${isDevServer ? ' ws: wss:' : ''}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace(CSP_TOKEN, policy);
      },
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, repoRoot, ['VITE_', 'API_PORT']);
  const authMode = resolveAuthMode(command, env);
  // The same default as `API_PORT` in src/server/lib/config/schema.ts (the SPA config cannot import the server).
  const apiOrigin = `http://127.0.0.1:${env.API_PORT ?? '5274'}`;

  return {
    root: uiDir,
    envDir: repoRoot,
    plugins: [react(), contentSecurityPolicy(authMode, env.VITE_SUPABASE_URL)],
    // Crawl every source module at startup so dependencies reached only through lazy routes are
    // pre-bundled up front. Otherwise the dev server re-optimizes and reloads the page mid-session,
    // which breaks Playwright runs and screenshots.
    optimizeDeps: {
      entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**'],
    },
    server: {
      port: 5273,
      strictPort: true,
      fs: { strict: true, allow: [repoRoot, rootNodeModules] },
      warmup: { clientFiles: ['./src/main.tsx'] },
      ...(authMode === 'supabase' ? { proxy: { '/api': { target: apiOrigin } } } : {}),
    },
    preview: {
      port: 4273,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|react-router)[\\/]/,
                priority: 40,
              },
              {
                name: 'vendor-state',
                test: /[\\/]node_modules[\\/](@reduxjs|react-redux|redux|immer|reselect|redux-thunk)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-charts',
                test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|eventemitter3|es-toolkit)[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-supabase',
                test: /[\\/]node_modules[\\/]@supabase[\\/]/,
                priority: 20,
              },
              { name: 'vendor-zod', test: /[\\/]node_modules[\\/]zod[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      testTimeout: 15_000,
    },
  };
});
