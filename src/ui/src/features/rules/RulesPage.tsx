import { useState } from 'react';

import { canEditRules, endpoints } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import { usePersona } from '../../app/hooks';
import { Banner, PageHeader, QueryView } from '../../components/ui';
import { t } from '../../lib/i18n';
import { formatMoment } from '../claim-scope';
import { AuditCard } from './AuditCard';
import { RulesEditor } from './RulesEditor';
import { RulesValues } from './RulesValues';

export default function RulesPage() {
  const persona = usePersona();
  const editable = canEditRules(persona);
  const query = useApiQuery(endpoints.ruleConfigGet, {});
  const [conflict, setConflict] = useState(false);
  const data = query.data;

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('rules.title')}
        subtitle={t('rules.subtitle')}
        meta={
          data === undefined
            ? undefined
            : data.saved_at === null || data.saved_by === null
              ? t('rules.meta.seeded', { version: data.version })
              : t('rules.meta.saved', {
                  version: data.version,
                  time: formatMoment(data.saved_at),
                  actor: t(`shell.persona.${data.saved_by}`),
                })
        }
      />
      {!editable && (
        <Banner tone="info" title={t('rules.restricted.title')}>
          {t('rules.restricted.body', { persona: t(`shell.persona.${persona}`) })}
        </Banner>
      )}
      {conflict && (
        <Banner tone="warning" title={t('rules.conflict.title')}>
          {t('rules.conflict.body')}
        </Banner>
      )}
      <QueryView query={query} errorTitle={t('rules.loadFailed')}>
        {(rules) => (
          <>
            {editable ? (
              <RulesEditor
                key={rules.version}
                data={rules}
                onConflict={() => setConflict(true)}
                onSaved={() => setConflict(false)}
              />
            ) : (
              <RulesValues data={rules} />
            )}
            <AuditCard audit={rules.audit} />
          </>
        )}
      </QueryView>
    </div>
  );
}
