/** "Export CSV": downloads the rows it is given, which the screen builds from the very figures it shows. */
import { useAppSelector } from '../../app/hooks';
import { Button } from '../../components/ui';
import { downloadCsv, toCsv } from '../../lib/csv';
import { t } from '../../lib/i18n';

export interface ExportCsvButtonProps {
  /** The screen in the file name: `claimsiq-overview-DEMO-2026-10-21.csv`. */
  readonly screen: string;
  /** Header row first. `undefined` while the screen has nothing to export. */
  readonly table: readonly (readonly string[])[] | undefined;
}

export function ExportCsvButton({ screen, table }: ExportCsvButtonProps) {
  const { dataSet, asOf } = useAppSelector((state) => state.dataContext);
  return (
    <Button
      icon="download"
      disabled={table === undefined}
      onClick={() => {
        if (table === undefined) return;
        downloadCsv(`claimsiq-${screen}-${dataSet}-${asOf}.csv`, toCsv(table));
      }}
    >
      {t('claim-scope.export.button')}
    </Button>
  );
}
