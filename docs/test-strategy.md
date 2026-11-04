# ParcelFlow test strategy

## Product and risks

ParcelFlow is a dispatcher tool for parcel delivery. A dispatcher creates shipments, assigns drivers and
moves parcels through statuses. Customers track parcels by number without logging in, over the web UI,
REST or gRPC.

Highest risks, in order:

1. **Wrong status shown to a customer.** Tracking must match the real state on every interface: UI, REST
   and gRPC.
2. **Broken status rules.** A parcel must never skip a status, return to an earlier status or be cancelled
   while on the road.
3. **Data loss or corruption.** What the API returns must be what is stored, and failed requests must
   store nothing.
4. **Private data leaks.** Public tracking must not expose recipient, address or driver.
5. **Unusable UI for keyboard and screen reader users.** The dispatcher works in the app all day.

## Test levels

| Level    | Tool                      | What it proves                                               | Tests |
| -------- | ------------------------- | ------------------------------------------------------------ | ----: |
| REST API | Playwright `request`, Zod | Business rules, validation, status codes, response contracts |    38 |
| gRPC     | grpc-js, ts-proto         | Tracking contract, error codes, live status stream           |    14 |
| Database | node-postgres             | Stored data matches the API, no partial writes               |     7 |
| UI       | Playwright, Page Objects  | Dispatcher and customer flows work end to end in the browser |    16 |
| A11y     | axe-core                  | WCAG 2.1 A/AA on every screen in a filled state              |     6 |

Most rules are checked at the API level because it is faster and more precise. The UI suite covers only
what a user does and sees, and takes preconditions from the API.

## What stays manual

- Exploratory sessions on new features before automation (charter-based, 60 min).
- Visual review of layout on real phones, the automated mobile project uses Chromium emulation.
- Screen reader walkthrough (NVDA) of the main flow. Automated rules catch only part of a11y issues: reading order
  and announcement wording need a person.

## Test design

- **Boundary values** for weight: 0, 0.09, 0.1, 50, 50.1, -1.
- **Equivalence classes** for text fields: empty, whitespace only, 120 and 121 characters, wrong type.
- **State transition table** for statuses: every allowed transition plus every forbidden one, as data
  rows in `tests/api/status-flow.spec.ts`.
- **Cross-interface checks**: the same parcel read through UI, REST, gRPC and the database must agree.

## Coverage matrix

| Requirement                                  | REST | gRPC | DB  | UI  |
| -------------------------------------------- | :--: | :--: | :-: | :-: |
| Dispatcher logs in, invalid credentials fail |  ✓   |      |     |  ✓  |
| Protected endpoints need a valid token       |  ✓   |      |     |  ✓  |
| Shipment is created with valid data          |  ✓   |      |  ✓  |  ✓  |
| Invalid shipment is rejected, nothing saved  |  ✓   |      |  ✓  |  ✓  |
| Status changes follow the transition table   |  ✓   |      |  ✓  |  ✓  |
| Every status change is recorded in history   |  ✓   |  ✓   |  ✓  |  ✓  |
| Public tracking shows current status         |  ✓   |  ✓   |     |  ✓  |
| Public tracking hides private fields         |  ✓   |  ✓   |     |     |
| Customer gets live status updates            |      |  ✓   |     |     |
| Workspaces do not see each other's data      |  ✓   |  ✓   |  ✓  |     |
| User input is rendered as text (XSS)         |      |      |     |  ✓  |
| Screens meet WCAG 2.1 AA                     |      |      |     |  ✓  |

## Entry and exit criteria

- A pull request merges only with lint, type check, generated gRPC client check and all tests green.
- A test that fails on retry is a bug in the product or in the test, not "flaky": it gets a ticket and is
  fixed or quarantined with `test.fixme` and a link to the ticket within a day.

## Environments

| Run                   | Where          | Database         |
| --------------------- | -------------- | ---------------- |
| Local                 | `npm test`     | optional, Docker |
| Pull request and main | GitHub Actions | Postgres service |
| Nightly               | GitHub Actions | Postgres service |
