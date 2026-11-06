/** A date or a time in Africa/Gaborone as the screens show it; a missing one reads "Unknown", never an empty cell. */
import { GABORONE_ZONE } from '../../../../contracts/index';
import { formatCalendarDate, formatDateTime } from '../../lib/format';
import { t } from '../../lib/i18n';

export function formatMoment(moment: string | null): string {
  if (moment === null) return t('claim-scope.unknown');
  return moment.length === 10 ? formatCalendarDate(moment) : formatDateTime(moment, GABORONE_ZONE);
}
