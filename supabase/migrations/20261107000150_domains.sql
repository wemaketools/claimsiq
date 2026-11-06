-- The value types that several columns share, each defined once. The seed test compares the enum lists with the
-- contracts (src/contracts), so a list here cannot drift from them.

-- A contract `Moment`: `YYYY-MM-DD`, or a time with the +02:00 Africa/Gaborone offset. Stored as written, so a value
-- reads back exactly and compares in time order.
create domain moment as text
  check (value ~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?\+02:00)?$');

-- The four demo personas (src/contracts/personas.ts).
create domain persona as text
  check (value in ('head-of-claims', 'claims-handler', 'supplier-coordinator', 'finance'));

-- The claim stages (src/contracts/entities.ts).
create domain claim_stage as text
  check (value in ('New', 'Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement', 'Closed', 'Reopened'));
