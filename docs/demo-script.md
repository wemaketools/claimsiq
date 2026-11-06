# Head of Claims demo script (7 to 9 minutes)

The Head of Claims journey of the requirements (CL §10), as clicks you can follow in the hosted prototype. Every figure below was read from the running prototype build on the data set named in the step. All data is synthetic.

## Before you start

- **Open** the hosted URL (or run it yourself: `bun run dev:prototype`, then http://localhost:5273; see the README). The build shows the banner "Prototype: synthetic demo data" on every page.
- **Click "Head of Claims"** on the sign-in page. There is no password. You land on Overview as Mpho Demo, Head of Claims.
- **The prototype opens on the DEMO data set** (30 claims of a fictional insurer). The scripted journey cites the spec's golden TEST set (6 claims you can check by hand), so step 1 switches to TEST and steps 2 to 8 stay on it. DEMO is the right set for showing density and filters; use it for the closing minute.
- **As of 21 Oct 2026** (the date box in the top bar) stays as it is. Every age and service-level count is derived at that date.
- Tasks you create in step 7 stay in your browser until **Reset** (step 8), so the demo can be run again from a clean TEST set.

Money is BWP ("P9,000.00"). The times in a task's history are the real clock time of your clicks; the as-of date drives everything else.

## 1. Open claims overview (about 1 minute)

1. On Overview you are on DEMO: 25 open claims, 5 closed, paid to date P77,500.00, outstanding reserve P413,500.00, incurred P491,000.00. Say: "this is the fictional insurer's book".
2. In the top bar, **Data set**, choose **TEST**.
3. You should see, under "As of 21 Oct 2026":

| Card | TEST |
|---|---|
| Open claims | 5 ("Not closed at the as-of date") |
| Closed claims | 1 |
| Paid to date | P9,000.00 ("Posted payments only") |
| Outstanding reserve | P68,000.00 |
| Incurred | P77,000.00 ("Paid plus outstanding reserve") |
| SLA breaches | 3 |
| High-value claims | 1 |

4. Say: P9,000 + P68,000 = P77,000, and each card is a link to the claims it counts. Click **Open claims**: the Claims list shows CLM-101, 102, 104, 105 and 106 (not CLM-103). Go back with **Overview** in the sidebar.

## 2. Inspect the pipeline (about 1 minute)

1. Sidebar, **Stages & Aging**.
2. "Open claims by stage": New 1, Triage 1, Assessment 2, Approved 1 (Negotiation and Settlement 0), 5 open in all. "All open claims: 5" sits under the stage table; the value column shows Assessment holding P41,000.00 of the P73,000.00 open incurred.
3. The age chart: 0-7 days 2, 8-30 days 2, 31-60 days 1.
4. Closed is not a stage here. Say: the one closed claim is counted separately (Overview: Closed claims 1) and is in no open figure.

## 3. Review late cases (about 1.5 minutes)

1. Sidebar, **Exceptions & SLA**. The line above the table reads "4 claims need review: 3 High, 0 Medium, 1 Low."
2. Walk the rows, each of which says which configured timer was missed and how:
   - **CLM-102**, High: "Triage: 31 business days over a 3-day target".
   - **CLM-106**, High: "Assessment: 10 business days over a 5-day target", plus "High value and delayed" and "Supplier delay".
   - **CLM-101**, High: "Assessment: 8 business days over a 5-day target", plus a supplier delay and a material reserve change.
   - **CLM-105**, Low: "New: 1 of 2 business days used, 1 left before the target is missed" (approaching, not breached).
3. Say what is not here: CLM-104 is within target, and the closed CLM-103 has no service targets. A flag is a review cue, not a finding; the page says so.

## 4. CLM-106: high value, waiting on a supplier (about 1 minute)

1. Click **CLM-106** in the table. Claim CLM-106, Property All Risk, Naledi Engineering (fictional): Open, Assessment, High.
2. "Why this claim is flagged": "Incurred P30,000.00 is at or above the P25,000.00 high-value line and the claim is delayed".
3. Scroll to **Supplier requests**: Repair estimate REQ-CLM-106, supplier Mma-Motor Repairs (fictional), requested 2 Oct 2026, completed Pending, wait "13 of 5 business days (8 over)", status Delayed. Say: the wait runs from the actual request time (2 Oct), not from when the claim entered the stage (30 Sep).
4. The action needed is the follow-up with the supplier; you create it in step 7.

## 5. CLM-101: reserve movement, not proven leakage (about 1 minute)

1. Sidebar, **Claims**, click **CLM-101** (or open it from Exceptions).
2. **Reserve history**: 1 Oct 2026 P0.00 to P8,000.00 (opening reserve); 16 Oct 2026 P8,000.00 to P11,000.00, +P3,000.00, 37.5%, "Review: material change", "at least 30% of the earlier amount", reason given "Additional repair scope".
3. Say what the card says: a material move is a cue to look at the evidence behind it, not a finding. The P3,000 is not called leakage.
4. **Payments** shows no posted payment: nothing has been paid on this claim (paid P0.00, incurred P11,000.00).

## 6. Paid against reserve: CLM-104 and CLM-103 (about 1 minute)

1. Sidebar, **Claims**. In the list:
   - **CLM-104**: Approved, paid P0.00, reserve P9,000.00, incurred P9,000.00, SLA Within target.
   - **CLM-103**: Closed, paid P4,000.00, reserve P0.00, incurred P4,000.00, no SLA.
2. Click **CLM-104**: the panel "Approved is not paid" says "No posted payment exists yet. The P9,000.00 still held as an outstanding reserve has not been paid."
3. Click back, then **CLM-103**: closed 15 Oct 2026, "The claim is closed, so no service targets or review indicators apply." Under **Payments**: SYN-PAY-CLM-103, 13 Oct 2026, P4,000.00, Posted. **Reserve history** shows the release on 15 Oct 2026, P4,000.00 to P0.00, -P4,000.00, flagged "Released on closure" (reason "Paid and closed") with no review flag: the reserve was paid out and the claim closed.

## 7. Act: assign a supplier chase and change status (about 1.5 minutes)

1. Open **CLM-106** again and click **Create follow-up task**.
2. The dialog shows "Acting as Head of Claims" and "Scope CLM-106". Choose **Assign to: Mpho Demo**, **Due date** 23 Oct 2026, and **Next action**: "Chase Mma-Motor Repairs for the repair estimate (REQ-CLM-106)". Click **Create task**.
3. The claim's "Follow-up tasks" card now shows TASK-0001, Open, Priority High, assigned to Mpho Demo, due 23 Oct 2026, "Created as Open", Head of Claims.
4. Sidebar, **Action Queue**: "1 task: 0 overdue, 1 open, 0 in progress, 0 done." The row is CLM-106 with its issues (Stage target missed by more than 2 days, High value and delayed, Supplier delay), owner Mpho Demo, due 23 Oct 2026, High, Open.
5. In the row, the **...** button (Actions), **Change status**, choose **In progress**, **Change status**. The row now reads In progress and the summary "0 open, 1 in progress".
6. Click the arrow at the end of the row (History): "Created as Open" and "Status changed from Open to In progress", each with Head of Claims and the time. Close it, then reload the page: the task is still there, In progress.

## 8. Cross-link, then reset (about 1 minute)

1. Open **CLM-106** and click **View policy invoices**. The page is marked "A stand-in for Premium Collections" and says it joins on the policy identifier only, never on a name.
2. Policy SYN-BW-00006 (POL-006), Naledi Engineering (fictional), Property All Risk, cover 1 Jan 2026 to 31 Dec 2026. One invoice: INV-006, issued 27 May 2026, due 1 Jun 2026, P7,000.00, allocated P0.00, outstanding P7,000.00, Issued, receipts none allocated.
3. In the top bar click **Reset** and confirm. The toast reads "The TEST fixture is back as loaded." Open **Action Queue**: "No actions in the queue". The demo is ready to run again.

## If there is time

- Switch **Data set** back to **DEMO** and use the filter bar (Broker, Product, Handler): Overview, Stages & Aging and the Claims list change together.
- **Suppliers**: Mma-Motor Repairs (fictional) on TEST shows two open requests, longest wait 13 business days, two past target; averages appear only from two requests and say how many are behind them.
- **Viewing as**: switch persona (Claims Handler, Supplier Coordinator, Finance). It is a view, not a permission; the actor in each task history is the persona you were viewing as.
- **Export CSV** on any screen downloads what is on screen, filters included.

## Words to keep to

An alert is not fraud, a reserve change is not confirmed leakage, and a high claim is not an illegitimate one. Say "review indicator" or "exception", never "fraud".
