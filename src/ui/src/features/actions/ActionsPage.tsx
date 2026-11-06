import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function ActionsPage() {
  const result = useScreenStatus('actions');
  return (
    <div className="ciq-page">
      <PageHeader title={t('actions.title')} subtitle={t('actions.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('actions.empty.title')}
        emptyDescription={t('actions.empty.description')}
        emptyIcon="listChecks"
      />
    </div>
  );
}
