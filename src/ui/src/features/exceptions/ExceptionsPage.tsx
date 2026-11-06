import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function ExceptionsPage() {
  const result = useScreenStatus('exceptions');
  return (
    <div className="ciq-page">
      <PageHeader title={t('exceptions.title')} subtitle={t('exceptions.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('exceptions.empty.title')}
        emptyDescription={t('exceptions.empty.description')}
        emptyIcon="alertTriangle"
      />
    </div>
  );
}
