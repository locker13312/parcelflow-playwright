# ParcelFlow: Playwright + TypeScript test framework

[![Tests](https://github.com/locker13312/autotest-dou/actions/workflows/tests.yml/badge.svg)](https://github.com/locker13312/autotest-dou/actions/workflows/tests.yml)

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

**Every test gets its own data.** A fixture creates a unique workspace id per test and sends it as the
`X-Workspace` header, both from the API client and from the browser (`extraHTTPHeaders`). Tests never
see each other's shipments, so they run fully in parallel and in any order, with no shared cleanup step.

**Setup through the API, checks through the UI.** UI tests that need a delivered or in-transit parcel
create it with an API call (`createShipmentInStatus`) instead of clicking through the flow every time.
The UI is only driven for the behaviour under test. This keeps tests fast and failures focused.

**UI changes are verified on the backend too.** When a test creates a shipment through the form, it
also reads it back from the API. A green toast on the screen is not proof that the data was saved.

**Login happens once.** The `setup` project logs in through the real login form and stores the session
with `storageState`. UI projects reuse it. Login tests opt out and start with a clean browser.

**Schemas instead of field-by-field checks.** Every API response is validated against a strict Zod
schema with `expectResponse()`. Unexpected or missing fields fail the test, which catches contract
changes that a handful of `toBe` checks would miss.

**Page objects hold locators, tests hold assertions.** Page objects expose locators and user actions.
Assertions stay in the tests, so a failing test reads like a requirement. Locators use `data-testid`
and roles, never CSS chains or XPath.

**Data-driven negative tests.** Boundary values and forbidden transitions are tables in the test file.
Adding a case is one line.

**Lint rules for test quality.** `eslint-plugin-playwright` blocks `waitForTimeout`, `force: true`,
conditionals in tests and non-web-first assertions.

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
