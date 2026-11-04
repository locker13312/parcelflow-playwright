import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';

// The API response alone does not prove the data was stored correctly. These tests act through the
// API and then read the PostgreSQL tables directly. They run only when DATABASE_URL is set.
test.describe('PostgreSQL data checks', () => {
  test('created shipment is stored with the same values the API returned @smoke', async ({ api, db, workspace }) => {
    const input = buildShipment({ weightKg: 12.25 });
    const shipment = await api.createShipment(input);

    const row = await db.shipment(shipment.id);
    expect(row).toEqual({
      id: shipment.id,
      workspace,
      tracking_number: shipment.trackingNumber,
      sender: input.sender,
      recipient: input.recipient,
      address: input.address,
      weight_kg: '12.25',
      status: 'created',
      driver: null,
      created_at: new Date(shipment.createdAt),
    });
  });

  test('stores trimmed values, not the raw input', async ({ api, db }) => {
    const shipment = await api.createShipment(buildShipment({ sender: '  ACME Ltd  ', recipient: ' Ivan Petrenko ' }));
    expect(await db.shipment(shipment.id)).toMatchObject({ sender: 'ACME Ltd', recipient: 'Ivan Petrenko' });
  });

  test('every status change writes one event, in order, with the same timestamps as the API', async ({ api, db }) => {
    const shipment = await api.createShipmentInStatus(buildShipment(), 'delivered');

    const events = await db.statusEvents(shipment.id);
    expect(events.map((e) => e.status)).toEqual(['created', 'assigned', 'in_transit', 'delivered']);
    expect(events.map((e) => e.at.toISOString())).toEqual(shipment.history.map((h) => h.at));
    expect(await db.shipment(shipment.id)).toMatchObject({ status: 'delivered', driver: 'Olena Koval' });
  });

  test('driver is recorded on the assignment event', async ({ api, db }) => {
    const shipment = await api.createShipment(buildShipment());
    await api.assignDriver(shipment.id, 'Taras Bondar');

    const events = await db.statusEvents(shipment.id);
    expect(events.at(-1)).toMatchObject({ status: 'assigned', driver: 'Taras Bondar' });
  });

  test('a rejected transition changes nothing in the database', async ({ api, db }) => {
    const shipment = await api.createShipment(buildShipment());
    expect((await api.updateStatus(shipment.id, 'delivered')).status()).toBe(409);

    expect(await db.shipment(shipment.id)).toMatchObject({ status: 'created' });
    expect(await db.statusEvents(shipment.id)).toHaveLength(1);
  });

  test('a failed validation writes no rows', async ({ api, db, workspace }) => {
    expect((await api.postShipment(buildShipment({ weightKg: 0 }))).status()).toBe(422);
    expect(await db.shipmentCount(workspace)).toBe(0);
  });

  test('tracking numbers are unique and sequential within a workspace', async ({ api, db, workspace }) => {
    for (let i = 0; i < 3; i++) await api.createShipment(buildShipment());
    expect(await db.trackingNumbers(workspace)).toEqual(['PF-000001', 'PF-000002', 'PF-000003']);
  });
});
