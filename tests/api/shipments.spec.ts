import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';
import { errorSchema, shipmentSchema, validationErrorSchema } from '../../src/api/schemas';
import { expectResponse } from '../../src/helpers/assertions';
import { z } from 'zod';

test.describe('Shipments API: create', () => {
  test('creates a shipment with valid data @smoke', async ({ api }) => {
    const input = buildShipment();
    const shipment = await expectResponse(await api.postShipment(input), 201, shipmentSchema);

    expect(shipment).toMatchObject({ ...input, status: 'created', driver: null });
    expect(shipment.history.map((h) => h.status)).toEqual(['created']);

    // Read it back: the stored record must match what the API returned on create.
    const stored = await expectResponse(await api.getShipment(shipment.id), 200, shipmentSchema);
    expect(stored).toEqual(shipment);
  });

  test('assigns sequential tracking numbers', async ({ api }) => {
    const first = await api.createShipment(buildShipment());
    const second = await api.createShipment(buildShipment());
    expect([first.trackingNumber, second.trackingNumber]).toEqual(['PF-000001', 'PF-000002']);
  });

  // Boundary value analysis for weightKg: valid range is 0.1..50.
  for (const weightKg of [0.1, 50]) {
    test(`accepts boundary weight ${weightKg} kg`, async ({ api }) => {
      await expectResponse(await api.postShipment(buildShipment({ weightKg })), 201, shipmentSchema);
    });
  }
  for (const weightKg of [0, 0.09, 50.1, -1]) {
    test(`rejects out of range weight ${weightKg} kg`, async ({ api }) => {
      const body = await expectResponse(
        await api.postShipment(buildShipment({ weightKg })),
        422,
        validationErrorSchema,
      );
      expect(body.details).toEqual([expect.objectContaining({ field: 'weightKg' })]);
    });
  }

  const invalidPayloads = [
    { name: 'empty sender', data: buildShipment({ sender: '' }), field: 'sender' },
    { name: 'whitespace recipient', data: buildShipment({ recipient: '   ' }), field: 'recipient' },
    { name: 'address longer than 120 chars', data: buildShipment({ address: 'a'.repeat(121) }), field: 'address' },
    { name: 'weight as a string', data: { ...buildShipment(), weightKg: '5' }, field: 'weightKg' },
  ];
  for (const { name, data, field } of invalidPayloads) {
    test(`rejects ${name}`, async ({ api }) => {
      const body = await expectResponse(await api.postShipment(data), 422, validationErrorSchema);
      expect(body.details.map((d) => d.field)).toContain(field);
    });
  }

  test('reports every invalid field at once', async ({ api }) => {
    const body = await expectResponse(await api.postShipment({}), 422, validationErrorSchema);
    expect(body.details.map((d) => d.field).sort()).toEqual(['address', 'recipient', 'sender', 'weightKg']);
  });

  test('does not save anything when validation fails', async ({ api }) => {
    await api.postShipment(buildShipment({ weightKg: 0 }));
    const list = await expectResponse(await api.listShipments(), 200, z.array(shipmentSchema));
    expect(list).toHaveLength(0);
  });
});

test.describe('Shipments API: read', () => {
  test('filters the list by status', async ({ api }) => {
    const created = await api.createShipment(buildShipment());
    const delivered = await api.createShipmentInStatus(buildShipment(), 'delivered');

    const onlyDelivered = await expectResponse(await api.listShipments('delivered'), 200, z.array(shipmentSchema));
    expect(onlyDelivered.map((s) => s.id)).toEqual([delivered.id]);

    const all = await expectResponse(await api.listShipments(), 200, z.array(shipmentSchema));
    expect(all.map((s) => s.id)).toEqual([created.id, delivered.id]);
  });

  test('returns 404 for an unknown shipment', async ({ api }) => {
    await expectResponse(await api.getShipment(randomUUID()), 404, errorSchema);
  });
});
