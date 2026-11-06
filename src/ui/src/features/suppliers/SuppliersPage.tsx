import { useScreenStatus } from '../../app/screenStatus';
import { PageHeader, ScreenStates } from '../../components/ui';
import { t } from '../../lib/i18n';

export default function SuppliersPage() {
  const result = useScreenStatus('suppliers');
  return (
    <div className="ciq-page">
      <PageHeader title={t('suppliers.title')} subtitle={t('suppliers.subtitle')} />
      <ScreenStates
        result={result}
        emptyTitle={t('suppliers.empty.title')}
        emptyDescription={t('suppliers.empty.description')}
        emptyIcon="truck"
      />
    </div>
  );
}
