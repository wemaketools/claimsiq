/**
 * RouteGuard: a usability layer over the API's own 401 checks.
 *
 * 1. While the session is being established → loading screen.
 * 2. Signed out → /signin, remembering the requested URL.
 * Otherwise it renders `children`, or the nested route (`<Outlet />`).
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '../pages/LoadingScreen';
import { useAppSelector } from './hooks';

export interface RouteGuardProps {
  readonly children?: ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const authStatus = useAppSelector((state) => state.session.authStatus);
  const location = useLocation();

  if (authStatus === 'initializing') {
    return <LoadingScreen />;
  }
  if (authStatus === 'signedOut') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/signin" replace state={{ from }} />;
  }
  return <>{children ?? <Outlet />}</>;
}
