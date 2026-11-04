// gRPC side of ParcelFlow: public tracking, unary and server streaming.
// It reads the same in-memory workspaces as the REST API and gets status changes through `events`.
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROTO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'proto');
const TRACKING_NUMBER = /^PF-\d{6}$/;
const FINAL = new Set(['delivered', 'cancelled']);

const toProtoStatus = (status) => `STATUS_${status.toUpperCase()}`;

function toParcel(shipment) {
  return {
    trackingNumber: shipment.trackingNumber,
    status: toProtoStatus(shipment.status),
    history: shipment.history.map((h) => ({ status: toProtoStatus(h.status), at: h.at })),
  };
}

export async function startGrpcServer({ port, workspaceById, events }) {
  const definition = protoLoader.loadSync('parcelflow/tracking/v1/tracking.proto', {
    includeDirs: [PROTO_ROOT],
    enums: String,
    defaults: true,
  });
  const { TrackingService } = grpc.loadPackageDefinition(definition).parcelflow.tracking.v1;

  // Validates the request and finds the shipment. Returns [shipment, workspace] or sends an error.
  function resolve(call, fail) {
    const number = String(call.request.trackingNumber ?? '')
      .trim()
      .toUpperCase();
    if (!TRACKING_NUMBER.test(number)) {
      fail({ code: grpc.status.INVALID_ARGUMENT, details: 'tracking_number must look like PF-000001' });
      return [];
    }
    const ws = workspaceById(String(call.metadata.get('x-workspace')[0] ?? 'default'));
    const shipment = [...ws.shipments.values()].find((s) => s.trackingNumber === number);
    if (!shipment) {
      fail({ code: grpc.status.NOT_FOUND, details: `Parcel ${number} not found` });
      return [];
    }
    return [shipment, ws];
  }

  const server = new grpc.Server();
  server.addService(TrackingService.service, {
    GetParcel(call, callback) {
      const [shipment] = resolve(call, (error) => callback(error));
      if (shipment) callback(null, { parcel: toParcel(shipment) });
    },

    WatchParcel(call) {
      // grpc-js sends a status to a streaming client when the call emits an error with code and details.
      const [shipment, ws] = resolve(call, (error) => call.emit('error', error));
      if (!shipment) return;

      call.write({ parcel: toParcel(shipment) });
      if (FINAL.has(shipment.status)) return call.end();

      const onChange = (changedWs, changed) => {
        if (changedWs !== ws || changed.id !== shipment.id) return;
        call.write({ parcel: toParcel(changed) });
        if (FINAL.has(changed.status)) stop(true);
      };
      const stop = (end) => {
        events.off('shipment-changed', onChange);
        if (end) call.end();
      };
      events.on('shipment-changed', onChange);
      call.on('cancelled', () => stop(false));
    },
  });

  await new Promise((ok, fail) =>
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) =>
      error ? fail(error) : ok(),
    ),
  );
  return server;
}
