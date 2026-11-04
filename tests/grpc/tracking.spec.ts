import { status } from '@grpc/grpc-js';
import { test, expect } from '../../src/fixtures/test';
import { buildShipment } from '../../src/data/shipmentFactory';
import { unwrap } from '../../src/grpc/TrackingGrpcClient';
import { Status } from '../../src/grpc/generated/parcelflow/tracking/v1/tracking';

test.describe('Tracking gRPC: GetParcel', () => {
  test('returns the same state as the REST API @smoke', async ({ api, guestApi, grpc }) => {
    const shipment = await api.createShipmentInStatus(buildShipment(), 'in_transit');

    const result = await grpc.getParcel(shipment.trackingNumber);
    expect(result).toMatchObject({
      ok: true,
      value: { trackingNumber: shipment.trackingNumber, status: Status.STATUS_IN_TRANSIT },
    });
    const parcel = unwrap(result);
    expect(parcel.history.map((h) => h.status)).toEqual([
      Status.STATUS_CREATED,
      Status.STATUS_ASSIGNED,
      Status.STATUS_IN_TRANSIT,
    ]);

    // Both public interfaces must agree on the parcel's history, down to the timestamps.
    const rest = await (await guestApi.track(shipment.trackingNumber)).json();
    expect(parcel.history.map((h) => h.at)).toEqual(shipment.history.map((h) => h.at));
    expect(parcel.history.map((h) => h.at)).toEqual(rest.history.map((h: { at: string }) => h.at));
  });

  test('accepts a lowercase tracking number', async ({ api, grpc }) => {
    const shipment = await api.createShipment(buildShipment());
    const result = await grpc.getParcel(shipment.trackingNumber.toLowerCase());
    expect(result).toMatchObject({ ok: true, value: { status: Status.STATUS_CREATED } });
  });

  const invalidNumbers = ['', 'PF-1', 'PF-0000001', 'XX-000001', 'PF 000001'];
  for (const trackingNumber of invalidNumbers) {
    test(`rejects malformed number "${trackingNumber}" with INVALID_ARGUMENT`, async ({ grpc }) => {
      expect(await grpc.getParcel(trackingNumber)).toMatchObject({ ok: false, code: status.INVALID_ARGUMENT });
    });
  }

  test('returns NOT_FOUND for an unknown parcel', async ({ grpc }) => {
    expect(await grpc.getParcel('PF-999999')).toEqual({
      ok: false,
      code: status.NOT_FOUND,
      details: 'Parcel PF-999999 not found',
    });
  });

  test('does not see parcels from another workspace', async ({ api, grpcFor }) => {
    const shipment = await api.createShipment(buildShipment());
    const otherWorkspace = grpcFor('another-workspace');
    expect(await otherWorkspace.getParcel(shipment.trackingNumber)).toMatchObject({
      ok: false,
      code: status.NOT_FOUND,
    });
  });
});

test.describe('Tracking gRPC: WatchParcel stream', () => {
  test('streams every status change and closes after delivery', async ({ api, grpc }) => {
    const shipment = await api.createShipment(buildShipment());
    const watch = grpc.watchParcel(shipment.trackingNumber);
    await watch.next(1); // current state arrives first, before any change

    await api.assignDriver(shipment.id, 'Olena Koval');
    await api.updateStatus(shipment.id, 'in_transit');
    await api.updateStatus(shipment.id, 'delivered');

    const result = await watch.end();
    expect(unwrap(result).map((p) => p.status)).toEqual([
      Status.STATUS_CREATED,
      Status.STATUS_ASSIGNED,
      Status.STATUS_IN_TRANSIT,
      Status.STATUS_DELIVERED,
    ]);
  });

  test('closes after cancellation', async ({ api, grpc }) => {
    const shipment = await api.createShipment(buildShipment());
    const watch = grpc.watchParcel(shipment.trackingNumber);
    await watch.next(1);

    await api.updateStatus(shipment.id, 'cancelled');

    const result = await watch.end();
    expect(unwrap(result).map((p) => p.status)).toEqual([Status.STATUS_CREATED, Status.STATUS_CANCELLED]);
  });

  test('sends one message and closes for a parcel already in a final status', async ({ api, grpc }) => {
    const shipment = await api.createShipmentInStatus(buildShipment(), 'delivered');
    const result = await grpc.watchParcel(shipment.trackingNumber).end();
    expect(unwrap(result).map((p) => p.status)).toEqual([Status.STATUS_DELIVERED]);
  });

  test('a rejected transition does not produce a stream message', async ({ api, grpc }) => {
    const shipment = await api.createShipment(buildShipment());
    const watch = grpc.watchParcel(shipment.trackingNumber);
    await watch.next(1);

    expect((await api.updateStatus(shipment.id, 'delivered')).status()).toBe(409);
    await api.updateStatus(shipment.id, 'cancelled');

    const result = await watch.end();
    expect(unwrap(result).map((p) => p.status)).toEqual([Status.STATUS_CREATED, Status.STATUS_CANCELLED]);
  });

  test('fails with NOT_FOUND for an unknown parcel', async ({ grpc }) => {
    expect(await grpc.watchParcel('PF-999999').end()).toMatchObject({ ok: false, code: status.NOT_FOUND });
  });
});
