import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { ParcelFlowApi } from '../api/ParcelFlowApi';
import { env } from '../config/env';
import { LoginPage } from '../pages/LoginPage';
import { ShipmentsPage } from '../pages/ShipmentsPage';
import { TrackingPage } from '../pages/TrackingPage';

interface Fixtures {
  /** Isolated data space for the current test. */
  workspace: string;
  /** API client logged in as the dispatcher. */
  api: ParcelFlowApi;
  /** API client without a token, for auth and public endpoint checks. */
  guestApi: ParcelFlowApi;
  loginPage: LoginPage;
  shipmentsPage: ShipmentsPage;
  trackingPage: TrackingPage;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here
  workspace: async ({}, use) => {
    await use(`test-${randomUUID()}`);
  },
  // The header goes to API calls and to every request the browser page makes,
  // so UI and API in one test work with the same data and never touch other tests.
  extraHTTPHeaders: async ({ workspace }, use) => {
    await use({ 'X-Workspace': workspace });
  },
  api: async ({ request }, use) => {
    const api = await new ParcelFlowApi(request).authenticate(env.dispatcher.email, env.dispatcher.password);
    await use(api);
  },
  guestApi: async ({ request }, use) => {
    await use(new ParcelFlowApi(request));
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shipmentsPage: async ({ page }, use) => use(new ShipmentsPage(page)),
  trackingPage: async ({ page }, use) => use(new TrackingPage(page)),
});

export { expect };
