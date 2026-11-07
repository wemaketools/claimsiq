/**
 * The route tree, built from the feature registry:
 *
 * - `/` goes to the first sidebar destination; with none registered the router cannot be built.
 * - `/signin`, `/forgot-password`, `/reset-password`: auth pages outside any shell. A prototype build has no
 *   passwords, so the last two go to `/signin`.
 * - Every feature route: signed in, inside AppShell.
 * - Anything else: Not found.
 * - A route that fails to load or throws renders RouteErrorPage: inside the shell for feature routes (the navigation
 *   stays usable), standalone otherwise.
 */
import { Suspense, lazy } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';

import { authMode } from '../auth/authMode';
import { ForgotPasswordPage } from '../auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';
import { SignInPage } from '../auth/SignInPage';
import { AppShell } from '../components/shell/AppShell';
import { SkeletonBlock } from '../components/ui/Skeleton';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { RootLayout } from './RootLayout';
import { RouteGuard } from './RouteGuard';
import { features as registeredFeatures, navItemsFor } from './featureRegistry';
import type { FeatureModule, FeatureRoute } from './featureRegistry';

const lazyComponents = new WeakMap<FeatureRoute, ComponentType>();

function routeElement(route: FeatureRoute): ReactNode {
  if (route.element !== undefined) {
    return route.element;
  }
  let Component = lazyComponents.get(route);
  if (Component === undefined && route.load !== undefined) {
    Component = lazy(route.load);
    lazyComponents.set(route, Component);
  }
  if (Component === undefined) {
    return null;
  }
  return (
    <Suspense fallback={<SkeletonBlock lines={6} />}>
      <Component />
    </Suspense>
  );
}

function featureRoutes(modules: readonly FeatureModule[]): RouteObject[] {
  return modules.flatMap((module) =>
    module.routes.map((route) => ({ path: route.path, element: routeElement(route) })),
  );
}

function passwordPage(page: ReactNode): ReactNode {
  return authMode() === 'prototype' ? <Navigate to="/signin" replace /> : page;
}

/** The route objects for a set of feature modules (exported for tests). */
export function buildRoutes(modules: readonly FeatureModule[]): RouteObject[] {
  const home = navItemsFor(modules)[0]?.to;
  if (home === undefined) {
    throw new Error(
      'No navigation destination is registered: add a features/<feature>/routes.tsx with a nav item.',
    );
  }
  return [
    {
      element: <RootLayout />,
      errorElement: <RouteErrorPage />,
      children: [
        { path: '/', element: <Navigate to={home} replace /> },
        { path: '/signin', element: <SignInPage /> },
        { path: '/forgot-password', element: passwordPage(<ForgotPasswordPage />) },
        { path: '/reset-password', element: passwordPage(<ResetPasswordPage />) },
        {
          element: (
            <RouteGuard>
              <AppShell modules={modules} />
            </RouteGuard>
          ),
          errorElement: <RouteErrorPage inShell />,
          children: [...featureRoutes(modules), { path: '*', element: <NotFoundPage inShell /> }],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}

export function createAppRouter(modules: readonly FeatureModule[] = registeredFeatures) {
  return createBrowserRouter(buildRoutes(modules));
}
