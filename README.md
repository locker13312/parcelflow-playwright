# ParcelFlow: Playwright + TypeScript test framework

[![Tests](https://github.com/locker13312/parcelflow-playwright/actions/workflows/tests.yml/badge.svg)](https://github.com/locker13312/parcelflow-playwright/actions/workflows/tests.yml)

UI, REST, gRPC, database and accessibility tests for ParcelFlow, a small shipment tracking app. The app
lives in this repo (`demo-app/`), so the suite runs anywhere with one command and does not depend on
third-party sites.

**Stack:** Playwright, TypeScript, gRPC (grpc-js, ts-proto, buf), PostgreSQL, Zod, axe-core, Allure,
Faker, ESLint, Prettier, GitHub Actions

## What is tested

ParcelFlow is a dispatcher tool. A dispatcher logs in, creates shipments, assigns drivers and moves
parcels through statuses. Customers track parcels by number without logging in, in the web UI, over
REST or over gRPC with live updates.

```
created ──> assigned ──> in_transit ──> delivered
   │            │
   └────────────┴──> cancelled
```

| Project    | Tests | Covered                                                                                                     |
| ---------- | ----: | ----------------------------------------------------------------------------------------------------------- |
| `api`      |    38 | Auth, validation (boundary values, equivalence classes), response schemas, full state transition table      |
| `grpc`     |    14 | `GetParcel` contract and error codes, `WatchParcel` server stream, REST and gRPC agree, workspace isolation |
| `db`       |     7 | Rows in PostgreSQL match the API, one event per status change, nothing written on 409 or 422                |
| `chromium` |    20 | Login, form validation, full dispatcher flow, filters, XSS, public tracking, WCAG 2.1 AA with axe-core      |
| `mobile`   |     2 | Main flows on a Pixel 7 viewport                                                                            |

82 tests, about 20 seconds locally. Test strategy, coverage matrix and what stays manual:
[docs/test-strategy.md](docs/test-strategy.md). Defects found by the suite:
[docs/bug-reports.md](docs/bug-reports.md).

## Run it

Requires Node.js 20+. Docker is needed only for the database checks.

```bash
npm ci
npx playwright install chromium

npm test              # everything; the db project is added when DATABASE_URL is set
npm run test:api      # REST only
npm run test:grpc     # gRPC only
npm run test:ui       # desktop and mobile UI
npm run test:smoke    # tests tagged @smoke
npm run report        # last Playwright HTML report
npm run allure:serve  # Allure report
```

Database checks:

```bash
docker compose up -d
export DATABASE_URL=postgres://parcelflow:parcelflow@localhost:5432/parcelflow
npm run test:db
```

Playwright starts the demo app automatically. To click around it yourself: `npm run app` and open
http://localhost:3000 (login `dispatcher@parcelflow.test` / `Passw0rd!`). gRPC listens on
`localhost:50051`.

## Structure

```
demo-app/              system under test: REST + gRPC server, optional PostgreSQL, vanilla JS front end
proto/                 gRPC contract (buf lint, STANDARD rules)
src/
  api/                 REST client and Zod response schemas
  grpc/                promise-based gRPC client; generated/ is produced by ts-proto, do not edit
  db/                  read-only queries for data checks
  config/              environment settings
  data/                test data factory
  fixtures/            custom Playwright fixtures
  helpers/             shared assertions
  pages/               page objects
tests/
  auth.setup.ts        logs in once and saves the session
  api/  grpc/  db/  ui/
docs/                  test strategy, bug reports
```

## Design decisions

- **Each test gets its own workspace.** A fixture generates a workspace id and sends it as the
  `X-Workspace` header from the API client and the browser (`extraHTTPHeaders`), and as `x-workspace`
  metadata from the gRPC client. Tests never see each other's data and run in parallel in any order
  without cleanup.
- **Preconditions go through the API.** The UI is driven only for the behaviour under test. A test that
  needs a delivered parcel creates it with `createShipmentInStatus` instead of clicking through the flow.
- **A response is not proof of storage.** Data created through the UI is read back from the API; data
  created through the API is read back from PostgreSQL.
- **One parcel, every interface.** The same parcel is checked through UI, REST, gRPC and the database,
  so a mismatch between them fails a test.
- **Strict contracts.** REST responses are validated against strict Zod schemas, so unexpected or
  missing fields fail the test. The gRPC client is generated from `.proto` with ts-proto; CI regenerates
  it and fails if the committed code is out of date.
- **Streams are tested without sleeps.** `ParcelWatch` collects stream messages and resolves when the
  expected number has arrived or the server closes the stream, with a gRPC deadline as the upper bound.
- **Login runs once.** The `setup` project logs in through the real form and saves `storageState`.
- **Page objects expose locators and actions, assertions stay in tests.** Locators use `data-testid`
  and roles, no CSS chains or XPath.
- **Data tables over copy-paste.** Boundary values, malformed tracking numbers and forbidden status
  transitions are arrays, one line per case.
- **Lint as a guard rail.** `eslint-plugin-playwright` blocks `waitForTimeout`, `force: true`,
  conditionals in tests and non-web-first assertions.

## CI

GitHub Actions on every push, pull request and on weekday nights:

1. Lint, formatting, type check, `buf lint` and a check that the generated gRPC client is up to date
2. Tests in 2 parallel shards against a PostgreSQL service container, one retry in CI
3. Shard reports merged into one Playwright HTML report and one Allure report, uploaded as artifacts with
   traces, screenshots and videos of failures

## Next steps

- Visual regression for the shipments table, with snapshots generated in the Playwright Docker image
- Load test for `WatchParcel` with many open streams (k6 with the gRPC module)
- Contract tests for REST generated from an OpenAPI spec
