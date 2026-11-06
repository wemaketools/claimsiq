/**
 * "Export CSV": downloads the rows it is given, which the screen builds from the very figures it shows. The button is
 * the one place that decides when that is allowed: only while the screen's figures answer the filters now chosen, so
 * it is off while a request is on its way and after a failed one (the screen may still show the previous figures).
 */
import { useAppSelector } from '../../app/hooks';
import { Button } from '../../components/ui';
import { downloadCsv, toCsv } from '../../lib/csv';
import { t } from '../../lib/i18n';
import type { ClaimScope } from './useClaimScope';

export interface ExportCsvButtonProps {
  /** The screen in the file name: `claimsiq-overview-DEMO-2026-10-21.csv`. */
  readonly screen: string;
  readonly scope: ClaimScope;
  /** Header row first. `undefined` while the screen has nothing to export. */
  readonly table: readonly (readonly string[])[] | undefined;
}

export function ExportCsvButton({ screen, scope, table }: ExportCsvButtonProps) {
  const { dataSet, asOf } = useAppSelector((state) => state.dataContext);
  const current = !scope.facts.isFetching && scope.facts.status === 'success';
  return (
    <Button
      icon="download"
      disabled={table === undefined || !current}
      onClick={() => {
        if (table === undefined || !current) return;
        downloadCsv(`claimsiq-${screen}-${dataSet}-${asOf}.csv`, toCsv(table));
      }}
    >
      {t('claim-scope.export.button')}
    </Button>
  );
}
