import type { ClaimsSummary } from '../../../../contracts/index';
import { KpiCard, KpiGrid } from '../../components/ui';
import { claimsLink } from '../claim-scope';
import { overviewFigures } from './figures';

/** The headline figures as cards, one group per heading, each card opening the claims it counts. */
export function FigureGroups({
  summary,
  Heading,
  headingClassName,
}: {
  readonly summary: ClaimsSummary;
  /** The element of a group's heading, chosen by where the groups sit in the page's outline. */
  readonly Heading: 'h2' | 'h4';
  readonly headingClassName: string;
}) {
  return (
    <>
      {overviewFigures(summary).map((group) => (
        <section key={group.heading} className="ciq-stack">
          <Heading className={headingClassName}>{group.heading}</Heading>
          <KpiGrid>
            {group.figures.map((figure) => (
              <KpiCard
                key={figure.id}
                label={figure.label}
                value={figure.shown}
                hint={figure.hint}
                icon={figure.icon}
                tone={figure.tone}
                to={claimsLink(figure.criterion)}
              />
            ))}
          </KpiGrid>
        </section>
      ))}
    </>
  );
}
