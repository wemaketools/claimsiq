import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function StagesPage() {
  const result = useScreenStatus('stages');
  return (
    <div className="ciq-page">
      <PageHeader title={t('stages.title')} subtitle={t('stages.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('stages.empty.title')}
        emptyDescription={t('stages.empty.description')}
        emptyIcon="layers"
      />
    </div>
  );
}
