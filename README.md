# ParcelFlow: Playwright + TypeScript test framework

[![Tests](https://github.com/locker13312/parcelflow-playwright/actions/workflows/tests.yml/badge.svg)](https://github.com/locker13312/parcelflow-playwright/actions/workflows/tests.yml)

UI and API test automation for ParcelFlow, a small shipment tracking app. The app lives in this repo
(`demo-app/`), so the suite runs anywhere with one command and does not depend on third-party sites.

**Stack:** Playwright, TypeScript, Zod, Faker, ESLint, Prettier, GitHub Actions

## What is tested

ParcelFlow is a dispatcher tool. A dispatcher logs in, creates shipments, assigns drivers and moves
parcels through statuses. Customers track parcels by number without logging in.

```
created ──> assigned ──> in_transit ──> delivered
   │            │
   └────────────┴──> cancelled
```

| Area        | Covered                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Auth API    | Valid login, wrong and empty credentials, missing and invalid tokens                                                               |
| Shipments   | Create and read back, response schemas, boundary values for weight, required fields, max length, wrong types, nothing saved on 422 |
| Status flow | Full happy path, every forbidden transition (state transition table), cancellation rules, driver assignment rules                  |
| Tracking    | Public endpoint returns the right state and does not expose private fields, unknown numbers                                        |
| UI          | Login and logout, form validation, full dispatcher flow, filters, empty state, XSS check, public tracking, mobile viewport         |

56 tests in total. The whole suite runs in about 20 seconds.

## Run it

Requires Node.js 20+.

```bash
npm ci
npx playwright install chromium

npm test              # everything: API, desktop UI, mobile UI
npm run test:api      # API only
npm run test:ui       # UI only
npm run test:smoke    # tests tagged @smoke
npm run report        # open the last HTML report
```

Playwright starts the demo app automatically. To click around it yourself: `npm run app` and open
http://localhost:3000 (login `dispatcher@parcelflow.test` / `Passw0rd!`).

## Structure

```
demo-app/              system under test: Node.js API + vanilla JS front end
src/
  api/                 API client and Zod response schemas
  config/              environment settings
  data/                test data factory
  fixtures/            custom Playwright fixtures
  helpers/             shared assertions
  pages/               page objects
tests/
  auth.setup.ts        logs in once and saves the session
  api/                 API tests
  ui/                  UI tests
```

## Design decisions

- Each test gets its own workspace. A fixture generates a workspace id and sends it as the
  `X-Workspace` header from both the API client and the browser (`extraHTTPHeaders`), so tests never
  see each other's shipments and run in parallel in any order without cleanup.
- Preconditions go through the API, the UI is driven only for the behaviour under test. A test that
  needs a delivered parcel creates it with `createShipmentInStatus` instead of clicking through the
  whole flow.
- Data created through the UI is read back from the API. A success toast alone does not prove the
  shipment was saved.
- Login runs once. The `setup` project logs in through the real form and saves `storageState`; UI
  projects reuse it, login tests start with a clean browser.
- API responses are validated against strict Zod schemas in `expectResponse()`, so unexpected or
  missing fields fail the test.
- Page objects expose locators and actions, assertions stay in tests. Locators use `data-testid` and
  roles, no CSS chains or XPath.
- Boundary values and forbidden status transitions are data tables, one line per case.
- `eslint-plugin-playwright` blocks `waitForTimeout`, `force: true`, conditionals in tests and
  non-web-first assertions.

## CI

GitHub Actions runs on every push and pull request:

1. Lint, formatting check, type check
2. API and UI tests in parallel, with one retry in CI
3. HTML report with traces, screenshots and videos of failures, uploaded as an artifact

## Next steps

- Visual regression for the shipments table
- Accessibility checks with axe-core
- Contract tests generated from an OpenAPI spec
- Sharding across several CI machines once the suite grows
