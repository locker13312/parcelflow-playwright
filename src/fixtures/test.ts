import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { ParcelFlowApi } from '../api/ParcelFlowApi';
import { ParcelFlowDb } from '../db/ParcelFlowDb';
import { TrackingGrpcClient } from '../grpc/TrackingGrpcClient';
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
  /** gRPC tracking client bound to the test workspace. */
  grpc: TrackingGrpcClient;
  /** Creates a gRPC client for any workspace, for isolation checks. Closed after the test. */
  grpcFor: (workspace: string) => TrackingGrpcClient;
  loginPage: LoginPage;
  shipmentsPage: ShipmentsPage;
  trackingPage: TrackingPage;
}

interface WorkerFixtures {
  /** Read-only PostgreSQL access, one pool per worker. */
  db: ParcelFlowDb;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  db: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here
    async ({}, use) => {
      if (!env.databaseUrl) throw new Error('DATABASE_URL is not set: start Postgres with `docker compose up -d`');
      const db = new ParcelFlowDb(env.databaseUrl);
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
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
  // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here
  grpcFor: async ({}, use) => {
    const clients: TrackingGrpcClient[] = [];
    await use((workspace) => {
      const client = new TrackingGrpcClient(env.grpcAddress, workspace);
      clients.push(client);
      return client;
    });
    clients.forEach((client) => client.close());
  },
  grpc: async ({ grpcFor, workspace }, use) => {
    await use(grpcFor(workspace));
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shipmentsPage: async ({ page }, use) => use(new ShipmentsPage(page)),
  trackingPage: async ({ page }, use) => use(new TrackingPage(page)),
});

export { expect };
