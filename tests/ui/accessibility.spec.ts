import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';

// WCAG 2.1 A and AA rules. Each scan runs on a page in a meaningful state: with data,
// with validation errors shown, with a tracking result, so dynamic content is checked too.
const scan = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

test.describe('Accessibility', () => {
  test.describe('public pages', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page has no WCAG violations', async ({ page, loginPage }) => {
      await loginPage.open();
      await expect(loginPage.heading).toBeVisible();
      expect((await scan(page)).violations).toEqual([]);
    });

    test('login error is announced and page stays accessible', async ({ page, loginPage }) => {
      await loginPage.open();
      await loginPage.login('dispatcher@parcelflow.test', 'wrong');
      await expect(loginPage.error).toBeVisible();
      expect((await scan(page)).violations).toEqual([]);
    });

    test('tracking result has no WCAG violations', async ({ api, page, trackingPage }) => {
      const shipment = await api.createShipmentInStatus(buildShipment(), 'assigned');
      await trackingPage.open();
      await trackingPage.track(shipment.trackingNumber);
      await expect(trackingPage.status).toHaveText('Assigned');
      expect((await scan(page)).violations).toEqual([]);
    });
  });

  test('shipments table with every row state has no WCAG violations', async ({ api, page, shipmentsPage }) => {
    for (const status of ['created', 'assigned', 'in_transit', 'delivered', 'cancelled'] as const) {
      await api.createShipmentInStatus(buildShipment(), status);
    }
    await shipmentsPage.open();
    await expect(shipmentsPage.rows).toHaveCount(5);
    expect((await scan(page)).violations).toEqual([]);
  });

  test('shipment form with validation errors has no WCAG violations', async ({ page, shipmentsPage }) => {
    await shipmentsPage.open();
    await shipmentsPage.createShipment({});
    await expect(shipmentsPage.formErrors).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });
});
