import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ShipmentInput } from '../data/shipmentFactory';
import type { Shipment, ShipmentStatus } from './schemas';

/**
 * Thin client over the REST API. It returns raw responses, so tests decide what to assert
 * (status codes, schemas, negative cases). Helpers with `create...` prefix are for test setup.
 */
export class ParcelFlowApi {
  private token?: string;

  constructor(private readonly request: APIRequestContext) {}

  private get headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  withToken(token: string | undefined): this {
    this.token = token;
    return this;
  }

  login(email: string, password: string): Promise<APIResponse> {
    return this.request.post('/api/auth/login', { data: { email, password } });
  }

  async authenticate(email: string, password: string): Promise<this> {
    const response = await this.login(email, password);
    if (!response.ok()) throw new Error(`Login failed with status ${response.status()}`);
    this.token = (await response.json()).token;
    return this;
  }

  listShipments(status?: ShipmentStatus): Promise<APIResponse> {
    return this.request.get('/api/shipments', { headers: this.headers, params: status ? { status } : {} });
  }

  getShipment(id: string): Promise<APIResponse> {
    return this.request.get(`/api/shipments/${id}`, { headers: this.headers });
  }

  postShipment(data: unknown): Promise<APIResponse> {
    return this.request.post('/api/shipments', { headers: this.headers, data });
  }

  assignDriver(id: string, driver: string): Promise<APIResponse> {
    return this.request.post(`/api/shipments/${id}/assign`, { headers: this.headers, data: { driver } });
  }

  updateStatus(id: string, status: string): Promise<APIResponse> {
    return this.request.patch(`/api/shipments/${id}/status`, { headers: this.headers, data: { status } });
  }

  track(trackingNumber: string): Promise<APIResponse> {
    return this.request.get(`/api/track/${encodeURIComponent(trackingNumber)}`);
  }

  async createShipment(input: ShipmentInput): Promise<Shipment> {
    const response = await this.postShipment(input);
    if (response.status() !== 201) throw new Error(`Shipment setup failed: ${response.status()}`);
    return response.json();
  }

  /** Moves a new shipment to the requested status through the allowed path. */
  async createShipmentInStatus(input: ShipmentInput, target: ShipmentStatus): Promise<Shipment> {
    let shipment = await this.createShipment(input);
    const path: Record<ShipmentStatus, string[]> = {
      created: [],
      assigned: ['assign'],
      in_transit: ['assign', 'in_transit'],
      delivered: ['assign', 'in_transit', 'delivered'],
      cancelled: ['cancelled'],
    };
    for (const step of path[target]) {
      const response =
        step === 'assign'
          ? await this.assignDriver(shipment.id, 'Olena Koval')
          : await this.updateStatus(shipment.id, step);
      if (!response.ok()) throw new Error(`Could not move shipment to ${step}: ${response.status()}`);
      shipment = await response.json();
    }
    return shipment;
  }
}
