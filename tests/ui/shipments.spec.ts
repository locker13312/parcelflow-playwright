import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';

test.describe('Shipments page', () => {
  test('shows an empty state when there are no shipments', async ({ shipmentsPage }) => {
    await shipmentsPage.open();
    await expect(shipmentsPage.emptyState).toBeVisible();
    await expect(shipmentsPage.table).toBeHidden();
  });

  test('creates a shipment through the form and stores it in the API @smoke @mobile', async ({
    api,
    shipmentsPage,
  }) => {
    const input = buildShipment();
    await shipmentsPage.open();
    await shipmentsPage.createShipment(input);

    const row = shipmentsPage.row('PF-000001');
    await expect(row.recipient).toHaveText(input.recipient);
    await expect(row.status).toHaveText('Created');

    // UI and backend must agree: check the record through the API, not only on the screen.
    const [stored] = await (await api.listShipments()).json();
    expect(stored).toMatchObject({ ...input, trackingNumber: 'PF-000001', status: 'created' });
  });

  test('shows validation errors and does not create a shipment', async ({ api, shipmentsPage }) => {
    await shipmentsPage.open();
    await shipmentsPage.createShipment({ sender: 'ACME', weightKg: 51 });

    await expect(shipmentsPage.fieldError('recipient')).toHaveText('recipient is required');
    await expect(shipmentsPage.fieldError('address')).toHaveText('address is required');
    await expect(shipmentsPage.fieldError('weightKg')).toHaveText('weightKg must be between 0.1 and 50');
    expect(await (await api.listShipments()).json()).toHaveLength(0);
  });

  test('dispatcher moves a shipment through the whole flow', async ({ api, shipmentsPage }) => {
    const shipment = await api.createShipment(buildShipment()); // setup through the API is faster
    await shipmentsPage.open();
    const row = shipmentsPage.row(shipment.trackingNumber);

    await row.assignDriver('Marta Lysenko');
    await expect(row.status).toHaveText('Assigned');
    await expect(row.driver).toHaveText('Marta Lysenko');

    await row.action('start').click();
    await expect(row.status).toHaveText('In transit');
    await expect(row.action('cancel')).toBeHidden(); // a parcel on the road cannot be cancelled

    await row.action('deliver').click();
    await expect(row.status).toHaveText('Delivered');
    await expect(row.root.getByRole('button')).toHaveCount(0);
  });

  test('filters shipments by status', async ({ api, shipmentsPage }) => {
    await api.createShipment(buildShipment());
    const delivered = await api.createShipmentInStatus(buildShipment(), 'delivered');
    await shipmentsPage.open();
    await expect(shipmentsPage.rows).toHaveCount(2);

    await shipmentsPage.filterByStatus('delivered');
    await expect(shipmentsPage.rows).toHaveCount(1);
    await expect(shipmentsPage.row(delivered.trackingNumber).status).toHaveText('Delivered');
  });

  test('renders user input as text, not as HTML', async ({ api, page, shipmentsPage }) => {
    const payload = '<img src=x onerror="window.__xss = true">';
    await api.createShipment(buildShipment({ recipient: payload }));
    await shipmentsPage.open();

    await expect(shipmentsPage.row('PF-000001').recipient).toHaveText(payload);
    expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  });
});
