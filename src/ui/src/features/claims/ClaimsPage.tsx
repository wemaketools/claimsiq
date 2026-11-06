import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function ClaimsPage() {
  const result = useScreenStatus('claims');
  return (
    <div className="ciq-page">
      <PageHeader title={t('claims.title')} subtitle={t('claims.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('claims.empty.title')}
        emptyDescription={t('claims.empty.description')}
        emptyIcon="folder"
      />
    </div>
  );
}
