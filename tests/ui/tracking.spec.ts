import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';

test.describe('Public tracking', () => {
  // Tracking is public: customers use it without logging in.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('customer sees the current status and history @smoke @mobile', async ({ api, trackingPage }) => {
    const shipment = await api.createShipmentInStatus(buildShipment(), 'in_transit');
    await trackingPage.open();
    await trackingPage.track(shipment.trackingNumber);

    await expect(trackingPage.status).toHaveText('In transit');
    await expect(trackingPage.historyItems).toHaveText(['Created', 'Assigned', 'In transit']);
  });

  test('accepts a lowercase tracking number', async ({ api, trackingPage }) => {
    const shipment = await api.createShipment(buildShipment());
    await trackingPage.open();
    await trackingPage.track(shipment.trackingNumber.toLowerCase());

    await expect(trackingPage.status).toHaveText('Created');
  });

  for (const value of ['PF-999999', 'not a number', '']) {
    test(`shows a friendly error for "${value}"`, async ({ trackingPage }) => {
      await trackingPage.open();
      await trackingPage.track(value);
      await expect(trackingPage.error).toHaveText('Parcel not found. Check the tracking number.');
    });
  }
});
