import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function OverviewPage() {
  const result = useScreenStatus('overview');
  return (
    <div className="ciq-page">
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('overview.empty.title')}
        emptyDescription={t('overview.empty.description')}
        emptyIcon="dashboard"
      />
    </div>
  );
}
