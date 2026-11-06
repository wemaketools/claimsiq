/**
 * The centred auth surface (`.ciq-auth-page`): wordmark, one card, optional extra content below (the demo accounts or
 * roles). Sign-in, forgot and reset password render outside the app shell.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { PrototypeBanner } from '../components/shell/PrototypeBanner';
import { Card } from '../components/ui/Card';
import { t } from '../lib/i18n';

export interface AuthLayoutProps {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly children?: ReactNode;
  readonly below?: ReactNode;
  readonly wide?: boolean;
}

export function Wordmark() {
  return (
    <span className="ciq-brand-name">
      {t('shell.brand.claims')}
      <span className="ciq-brand-iq">{t('shell.brand.iq')}</span>
    </span>
  );
}

export function AuthLayout({ title, subtitle, children, below, wide = false }: AuthLayoutProps) {
  useEffect(() => {
    document.title = t('shell.documentTitle', { title });
  }, [title]);
  return (
    <>
      <PrototypeBanner />
      <main className="ciq-auth-page">
        <div className="ciq-auth-brand">
          <Wordmark />
          <span className="ciq-brand-sub">{t('shell.brand.sub')}</span>
        </div>
        <Card
          className={wide ? 'ciq-auth-card ciq-auth-card--wide' : 'ciq-auth-card'}
          headingLevel={2}
        >
          <h1 className="ciq-card-title">{title}</h1>
          {subtitle !== undefined && <p className="ciq-card-sub">{subtitle}</p>}
          {children}
        </Card>
        {below}
      </main>
    </>
  );
}
