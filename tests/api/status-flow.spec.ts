import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';
import { errorSchema, shipmentSchema, trackingSchema, type ShipmentStatus } from '../../src/api/schemas';
import { expectResponse } from '../../src/helpers/assertions';

test.describe('Shipment status flow', () => {
  test('happy path: created > assigned > in transit > delivered @smoke', async ({ api, guestApi }) => {
    const shipment = await api.createShipment(buildShipment());

    const assigned = await expectResponse(await api.assignDriver(shipment.id, 'Taras Bondar'), 200, shipmentSchema);
    expect(assigned).toMatchObject({ status: 'assigned', driver: 'Taras Bondar' });

    await expectResponse(await api.updateStatus(shipment.id, 'in_transit'), 200, shipmentSchema);
    const delivered = await expectResponse(await api.updateStatus(shipment.id, 'delivered'), 200, shipmentSchema);
    expect(delivered.history.map((h) => h.status)).toEqual(['created', 'assigned', 'in_transit', 'delivered']);

    // The public tracking endpoint must show the same state and must not leak private fields.
    const tracking = await expectResponse(await guestApi.track(shipment.trackingNumber), 200, trackingSchema);
    expect(tracking.status).toBe('delivered');
    expect(tracking).not.toHaveProperty('recipient');
  });

  // State transition testing: every transition that the business rules forbid.
  const forbidden: Array<{ from: ShipmentStatus; to: ShipmentStatus }> = [
    { from: 'created', to: 'in_transit' },
    { from: 'created', to: 'delivered' },
    { from: 'assigned', to: 'delivered' },
    { from: 'in_transit', to: 'cancelled' },
    { from: 'in_transit', to: 'created' },
    { from: 'delivered', to: 'cancelled' },
    { from: 'delivered', to: 'in_transit' },
    { from: 'cancelled', to: 'created' },
    { from: 'cancelled', to: 'assigned' },
  ];
  for (const { from, to } of forbidden) {
    test(`rejects transition ${from} > ${to}`, async ({ api }) => {
      const shipment = await api.createShipmentInStatus(buildShipment(), from);
      await expectResponse(await api.updateStatus(shipment.id, to), 409, errorSchema);

      const unchanged = await expectResponse(await api.getShipment(shipment.id), 200, shipmentSchema);
      expect(unchanged.status).toBe(from);
    });
  }

  for (const from of ['created', 'assigned'] as const) {
    test(`allows cancelling from ${from}`, async ({ api }) => {
      const shipment = await api.createShipmentInStatus(buildShipment(), from);
      const cancelled = await expectResponse(await api.updateStatus(shipment.id, 'cancelled'), 200, shipmentSchema);
      expect(cancelled.status).toBe('cancelled');
    });
  }

  test('rejects an unknown status value', async ({ api }) => {
    const shipment = await api.createShipment(buildShipment());
    await expectResponse(await api.updateStatus(shipment.id, 'lost'), 422, errorSchema);
  });

  test('rejects an unknown driver', async ({ api }) => {
    const shipment = await api.createShipment(buildShipment());
    await expectResponse(await api.assignDriver(shipment.id, 'Unknown Driver'), 422, errorSchema);
  });

  test('cannot reassign a driver after the shipment left', async ({ api }) => {
    const shipment = await api.createShipmentInStatus(buildShipment(), 'in_transit');
    await expectResponse(await api.assignDriver(shipment.id, 'Marta Lysenko'), 409, errorSchema);
  });

  test('tracking an unknown number returns 404', async ({ guestApi }) => {
    await expectResponse(await guestApi.track('PF-999999'), 404, errorSchema);
  });
});
