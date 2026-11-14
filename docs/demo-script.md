# Head of Claims demo script (7 to 9 minutes, plus 4 for the P1 features)

The Head of Claims journey of the requirements (CL §10), as clicks you can follow in the hosted prototype. The hosted prototype serves the DEMO data set only (30 claims of a fictional insurer), so every figure below was read from the running prototype build on DEMO. All data is synthetic.

The spec's golden TEST set (6 claims you can check by hand: CLM-101 to 106) is not in the hosted prototype. It is in the Data set switch of the local build (`bun run dev`, see the README), and its walkthrough, with the figures, is the acceptance spec CLM-AT-01 to 16 (`e2e_tests/specs/acceptance.spec.ts`, `docs/acceptance.md`).

## Before you start

- **Open** the hosted URL (or run it yourself: `bun run dev:prototype`, then http://localhost:5273; see the README). The build shows the banner "Prototype: synthetic demo data" on every page and has no Data set switch.
- **Click "Head of Claims"** on the sign-in page. There is no password. You land on Overview as Mpho Demo, Head of Claims. Each role lands on its own screen: Claims Handler on Action Queue, Supplier Coordinator on Suppliers, Finance on Digest.
- **As of 21 Oct 2026** (the date box in the top bar) stays as it is. Every age and service-level count is derived at that date.
- **Say once:** DEMO is a deliberately late book. All 25 open claims are past their stage target, so every exception is High; there is no Medium or Low and no claim "approaching" its target.
- Tasks you create in step 7 and rules you change in the P1 steps stay in your browser until **Reset** (step 8, and the end of step 10), so the demo can be run again from the loaded data.
- **Viewing as** (top bar) switches the persona view. Switching opens that persona's own screen, so switch back to Head of Claims and click **Overview** when you want to carry on.

Money is BWP ("P8,000.00"). The times in a task's history are the real clock time of your clicks; the as-of date drives everything else.

## 1. Open claims overview (about 1 minute)

1. On Overview, under "As of 21 Oct 2026", you should see:

| Card | DEMO |
|---|---|
| Open claims | 25 ("Not closed at the as-of date") |
| Closed claims | 5 |
| Paid to date | P77,500.00 ("Posted payments only") |
| Outstanding reserve | P413,500.00 |
| Incurred | P491,000.00 ("Paid plus outstanding reserve") |
| SLA breaches | 25 |
| High-value claims | 8 |
| High-priority exceptions | 25 |

2. Say: P77,500 + P413,500 = P491,000, and each card is a link to the claims it counts. This is the fictional insurer's book.
3. Click **Open claims**: the Claims list shows "Showing: Open claims · 25 claims". The five closed claims (DCLM-001, 013, 018, 025 and 027) are not in it. Go back with **Overview** in the sidebar.

## 2. Inspect the pipeline (about 1 minute)

1. Sidebar, **Stages & Aging**.
2. "Open claims by stage": New 5, Triage 1, Assessment 6, Negotiation 4, Approved 5, Settlement 4, 25 open in all. "All open claims: 25" sits under the stage table with the totals (P34,500.00 paid, P413,500.00 reserve, P448,000.00 incurred); Approved holds the most, P154,000.00 of the P448,000.00 open incurred.
3. The age chart: 0-7 days 0, 8-30 days 6, 31-60 days 9, 61-90 days 7, over 90 days 3.
4. Closed is not a stage here. Say: the five closed claims are counted separately (Overview: Closed claims 5) and are in no open figure.

## 3. Review late cases (about 1.5 minutes)

1. Sidebar, **Exceptions & SLA**. The line above the table reads "25 claims need review: 25 High, 0 Medium, 0 Low."
2. Walk the first rows, each of which says which configured timer was missed and how:
   - **DCLM-015**, High: "New: 71 business days over a 2-day target", plus "High value and delayed" (incurred P28,000.00 is at or above the P25,000.00 high-value line).
   - **DCLM-021**, High: "Assessment: 68 business days over a 5-day target".
   - **DCLM-028**, High: "Assessment: 44 business days over a 5-day target", plus "Supplier delay": "Request DREQ-028: waiting 14 business days against a 5-day target".
3. Choose **Reason: Supplier delay**: two claims remain, DCLM-028 and DCLM-016. Choose **Material reserve change**: "No exceptions match". Say: DEMO holds no material reserve movement. Clear the filter.
4. Say: a flag is a review cue, not a finding; the page says so. The closed claims have no service targets and are not here.

## 4. DCLM-028: waiting on a supplier (about 1 minute)

1. Click **DCLM-028** in the table. Claim DCLM-028, Personal Accident, Fictional Client 28: Open, Assessment, High, Stage SLA Breached.
2. "Why this claim is flagged": "Stage target missed by more than 2 days" (Assessment: 44 business days over a 5-day target) and "Supplier delay" (Request DREQ-028).
3. Scroll to **Supplier requests**: Assessment report DREQ-028, supplier Kweneng Assessors (fictional), requested 1 Oct 2026, completed Pending, wait "14 of 5 business days (9 over)", status Delayed. Say: the wait runs from the actual request time (1 Oct), not from when the claim entered the stage (13 Aug).
4. The action needed is the follow-up with the supplier; you create it in step 7.

## 5. DCLM-007: reserve held, nothing moved (about 1 minute)

1. Sidebar, **Claims**, click **DCLM-007** (Fictional Client 07, Business Package, Approved, P45,000.00).
2. **Reserve history**: one row, 7 Sep 2026, P0.00 to P45,000.00, "Opening reserve", reason given "Synthetic estimate", no review flag. Say what the card says: a material move is a cue to look at the evidence behind it, not a finding; DEMO has none, so no claim here is called leakage.
3. **Payments** shows no posted payment: nothing has been paid on this claim (paid P0.00, incurred P45,000.00).

## 6. Paid against reserve: DCLM-007 and DCLM-001 (about 1 minute)

1. Sidebar, **Claims**. In the list:
   - **DCLM-007**: Approved, paid P0.00, reserve P45,000.00, incurred P45,000.00, SLA Breached.
   - **DCLM-001**: Closed, paid P8,000.00, reserve P0.00, incurred P8,000.00, no SLA.
2. Click **DCLM-007**: the panel "Approved is not paid" says "No posted payment exists yet. The P45,000.00 still held as an outstanding reserve has not been paid."
3. Click back, then **DCLM-001**: closed 16 Oct 2026, "The claim is closed, so no service targets or review indicators apply." Under **Payments**: SYN-C-001, 25 Sep 2026, P8,000.00, Posted, total P8,000.00. Say: the claim was paid in full and closed, and nothing is held back.

## 7. Act: assign a supplier chase and change status (about 1.5 minutes)

1. Open **DCLM-028** again and click **Create follow-up task**.
2. The dialog shows "Acting as Head of Claims" and "Scope DCLM-028". Choose **Assign to: Mpho Demo**, **Priority** High, **Due date** 23 Oct 2026, and **Next action**: "Chase Kweneng Assessors for the assessment report (DREQ-028)". Click **Create task**. The toast reads "Task TASK-0001 created for DCLM-028."
3. The claim's "Follow-up tasks" card now shows TASK-0001, Open, Priority High, assigned to Mpho Demo, due 23 Oct 2026, "Created as Open", Head of Claims.
4. Sidebar, **Action Queue**: "1 task: 0 overdue, 1 open, 0 in progress, 0 done." The row is DCLM-028 with its issues (Stage target missed by more than 2 days, Supplier delay), owner Mpho Demo, due 23 Oct 2026, High, Open.
5. In the row, the **...** button (Actions), **Change status**, choose **In progress**, **Change status**. The toast reads "Task TASK-0001 is now In progress." and the summary "0 open, 1 in progress".
6. Click the arrow at the end of the row (History): "Created as Open", "Assigned to Mpho Demo" and "Status changed from Open to In progress", each with Head of Claims and the time. Close it, then reload the page: the task is still there, In progress.

## 8. Cross-link, then reset (about 1 minute)

1. Open **DCLM-028** and click **View policy invoices**. The page is marked "A stand-in for Premium Collections" and says it joins on the policy identifier only, never on a name.
2. Policy SYN-BW-00028 (POL-028), Fictional Client 28, Personal Accident, Kopano Brokers (fictional), cover 1 Jan 2026 to 31 Dec 2026, Active. One invoice: DINV-028, issued 10 Oct 2026, due 17 Oct 2026, P4,000.00, allocated P4,000.00, outstanding P0.00, Issued, receipt DRCP-028.
3. In the top bar click **Reset** ("Reset the DEMO data set?") and confirm. The toast reads "The DEMO fixture is back as loaded." Open **Action Queue**: "No actions in the queue". The demo is ready to run again.

## The P1 features (about 4 minutes)

Four additions after step 8, in the same session (Reset has just put the data back, so the rule version counts from 1). Stay **Viewing as: Head of Claims**; only the Head of Claims and Finance can change the rules, and the other personas read them. The same clicks work in the local API build, where the changes are kept in the database until Reset.

### 9. What-if: move DCLM-026 to Assessment (about 1 minute)

1. Open **DCLM-026** (Sidebar, **Claims**). It is Triage, P28,000.00 incurred, Stage SLA Breached, severity High.
2. Scroll to **Stage what-if** ("What-if: not saved"). Under **Move the claim to** only the stages the claim may move to are listed (Assessment, Negotiation, Approved, Settlement, Closed). Choose **Assessment**.
3. The table sets the real view beside the preview: Stage SLA "Breached, Triage: 5 business days over a 3-day target" against "Within target, Assessment: 0 of 5 business days used"; Severity High against None; Stage clock started 9 Oct 2026 against 21 Oct 2026.
4. Say: the preview adds one event dated the as-of date, runs the same rules, and changes nothing ("No claim, event or task was changed"). Press **Reset** in the card, or reload, and it is gone.

### 10. The rule editor (about 1.5 minutes)

1. Sidebar, **Rules**. Note the **High-value line** is 25000 and **Supplier sample minimum** is 2.
2. Set **High-value line** to 40000 and **Supplier sample minimum** to 3. **Save changes**, confirm in the dialog (it lists each old and new value: "Supplier sample minimum: 2 requests to 3 requests", "High-value line: P25,000.00 to P40,000.00"): "The rules were saved (version 2)."
3. Sidebar, **Overview**: **High-value claims** is now 5 (it was 8: the claims at P28,000.00 are under the new line, the five at P45,000.00 stay). Sidebar, **Suppliers**: Kweneng Assessors (fictional) now reads "Not enough data: 2 of 3 needed" in the percentile table instead of a placement.
4. Back on **Rules**, "History of changes to the rules" lists each changed value with who and when. Switch **Viewing as** to Claims Handler: the app opens Action Queue, so click **Rules** again: "Read-only for this persona", no fields. Switch back to Head of Claims (it opens Overview), then **Rules**.
5. **Restore defaults**, confirm: "The spec’s rules are back (version 3)." Overview shows High-value claims 8 again. Say: a change is audited, a stale save is refused, and **Reset** also clears the history. Press **Reset** now so the next run starts at version 1.

### 11. Trends and percentiles (about 1 minute)

1. **Overview**, card **Paid by month**: Jul 2026 P17,000.00, Aug 2026 P7,500.00, Sep 2026 P36,000.00 and Oct 2026 P17,000.00, "P77,500.00 posted on 20 payments over 4 months", equal to the Paid to date card. Only posted payments count; the chart has the same figures as a table.
2. **Suppliers**, **Waits against the baseline**: Kweneng Assessors (fictional) and the all-suppliers baseline both show median 14 and 90th percentile 14 business days, "Over the target" (5 days), from 2 requests. Mma-Motor Repairs and Pula Survey Specialists show 0 requests, "No requests", and no percentile. Say: a percentile is an observed wait (nearest rank), and the table is the alphabetical list, not a ranking.

### 12. The digest (about 1 minute)

1. Sidebar, **Digest** (it is where Finance lands). One page: Data set DEMO, As of 21 Oct 2026, Filters "None, all claims"; the headline figures are the Overview cards (25 open, P77,500.00 paid, P413,500.00 reserve, P491,000.00 incurred); then Top exceptions (the first five: DCLM-015, 021, 006, 010, 008), "No open claim has a material reserve movement", Supplier delays (Kweneng Assessors, median 14, 90th percentile 14) and Open actions ("No open actions" after Reset).
2. Choose **Broker: Kopano Brokers (fictional)**: the header says so and the sheet follows (7 open claims, P137,000.00 incurred). **Clear filters**.
3. **Print or save as PDF**: the sheet prints light on one A4 page whatever the screen theme, with no sidebar or controls. Say: it adds no figure of its own; every number is the one the other screens show.

## If there is time

- Use the filter bar (Broker, Product, Handler): Overview, Stages & Aging and the Claims list change together.
- **Suppliers**: Kweneng Assessors (fictional) shows two open requests, longest wait 14 business days, two past target; averages and percentiles appear only from the sample minimum and say how many requests are behind them.
- **Viewing as**: switch persona (Claims Handler, Supplier Coordinator, Finance). It is a view, not a permission, and it opens that persona's screen (Action Queue, Suppliers, Digest); the actor in each task history is the persona you were viewing as.
- **Sidebar** on a laptop or tablet window (768 to 1279px wide): the profile menu opens in full over the page from the icon strip, and the **Full sidebar** toggle at the bottom expands the sidebar to show the screen names. The browser remembers the choice.
- **Export CSV** on any screen downloads what is on screen, filters included.

## Words to keep to

An alert is not fraud, a reserve change is not confirmed leakage, and a high claim is not an illegitimate one. Say "review indicator" or "exception", never "fraud".
