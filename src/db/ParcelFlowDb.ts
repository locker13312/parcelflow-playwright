import pg from 'pg';

export interface ShipmentRow {
  id: string;
  workspace: string;
  tracking_number: string;
  sender: string;
  recipient: string;
  address: string;
  weight_kg: string; // numeric comes back as a string to keep precision
  status: string;
  driver: string | null;
  created_at: Date;
}

export interface StatusEventRow {
  status: string;
  driver: string | null;
  at: Date;
}

/** Read-only access to the ParcelFlow database for data checks. Tests never write here. */
export class ParcelFlowDb {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 2 });
  }

  async shipment(id: string): Promise<ShipmentRow | undefined> {
    const { rows } = await this.pool.query<ShipmentRow>('SELECT * FROM shipments WHERE id = $1', [id]);
    return rows[0];
  }

  async shipmentCount(workspace: string): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>('SELECT count(*) FROM shipments WHERE workspace = $1', [
      workspace,
    ]);
    return Number(rows[0]?.count ?? 0);
  }

  async statusEvents(shipmentId: string): Promise<StatusEventRow[]> {
    const { rows } = await this.pool.query<StatusEventRow>(
      'SELECT status, driver, at FROM status_events WHERE shipment_id = $1 ORDER BY id',
      [shipmentId],
    );
    return rows;
  }

  async trackingNumbers(workspace: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ tracking_number: string }>(
      'SELECT tracking_number FROM shipments WHERE workspace = $1 ORDER BY tracking_number',
      [workspace],
    );
    return rows.map((r) => r.tracking_number);
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
