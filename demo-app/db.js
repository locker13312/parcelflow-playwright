// Optional PostgreSQL persistence. When DATABASE_URL is set, every created shipment and every
// status change is written to the database before the API responds, so tests can check the stored
// data right after an API call. Without DATABASE_URL the app keeps working in memory only.
import pg from 'pg';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS shipments (
    id              uuid PRIMARY KEY,
    workspace       varchar(64)  NOT NULL,
    tracking_number varchar(9)   NOT NULL,
    sender          varchar(120) NOT NULL,
    recipient       varchar(120) NOT NULL,
    address         varchar(120) NOT NULL,
    weight_kg       numeric(5,2) NOT NULL CHECK (weight_kg BETWEEN 0.1 AND 50),
    status          varchar(16)  NOT NULL,
    driver          varchar(64),
    created_at      timestamptz  NOT NULL,
    UNIQUE (workspace, tracking_number)
  );
  CREATE TABLE IF NOT EXISTS status_events (
    id          bigserial   PRIMARY KEY,
    shipment_id uuid        NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
    status      varchar(16) NOT NULL,
    driver      varchar(64),
    at          timestamptz NOT NULL
  );
  CREATE INDEX IF NOT EXISTS status_events_shipment_idx ON status_events (shipment_id);
`;

const noop = { saveCreated: async () => {}, saveStatusChange: async () => {} };

export async function connectDatabase(url) {
  if (!url) return noop;
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  await pool.query(SCHEMA);

  return {
    async saveCreated(workspace, s) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO shipments (id, workspace, tracking_number, sender, recipient, address, weight_kg, status, driver, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            s.id,
            workspace,
            s.trackingNumber,
            s.sender,
            s.recipient,
            s.address,
            s.weightKg,
            s.status,
            s.driver,
            s.createdAt,
          ],
        );
        await client.query('INSERT INTO status_events (shipment_id, status, at) VALUES ($1, $2, $3)', [
          s.id,
          s.status,
          s.createdAt,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async saveStatusChange(s) {
      const last = s.history.at(-1);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE shipments SET status = $2, driver = $3 WHERE id = $1', [s.id, s.status, s.driver]);
        await client.query('INSERT INTO status_events (shipment_id, status, driver, at) VALUES ($1, $2, $3, $4)', [
          s.id,
          last.status,
          s.driver,
          last.at,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
