// ParcelFlow: a small shipment tracking app used as the system under test.
// In-memory storage and deterministic behaviour for stable tests. REST + static UI on PORT,
// gRPC tracking service on GRPC_PORT.
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startGrpcServer } from './grpc.js';
import { connectDatabase } from './db.js';

const PORT = Number(process.env.PORT ?? 3000);
const GRPC_PORT = Number(process.env.GRPC_PORT ?? 50051);
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');

const USERS = [{ email: 'dispatcher@parcelflow.test', password: 'Passw0rd!', name: 'Dana Dispatcher' }];
const DRIVERS = ['Olena Koval', 'Taras Bondar', 'Marta Lysenko'];

// Allowed status transitions. Anything else is rejected with 409.
const TRANSITIONS = {
  created: ['assigned', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

const WEIGHT_MIN = 0.1;
const WEIGHT_MAX = 50;

const sessions = new Map();

// Data is split into workspaces picked by the X-Workspace header. Every test uses its own
// workspace, so tests can run in parallel without seeing each other's shipments.
const workspaces = new Map();

function workspaceById(rawId) {
  const id = String(rawId).slice(0, 64);
  if (!workspaces.has(id)) workspaces.set(id, { id, shipments: new Map(), sequence: 0 });
  return workspaces.get(id);
}

function workspaceFor(req) {
  return workspaceById(req.headers['x-workspace'] ?? 'default');
}

// Status changes are published here, the gRPC WatchParcel stream listens to them.
const events = new EventEmitter();

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function currentUser(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return token ? sessions.get(token) : undefined;
}

function validateShipment(input) {
  const errors = [];
  for (const field of ['sender', 'recipient', 'address']) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') {
      errors.push({ field, message: `${field} is required` });
    } else if (input[field].length > 120) {
      errors.push({ field, message: `${field} must be at most 120 characters` });
    }
  }
  if (typeof input.weightKg !== 'number' || Number.isNaN(input.weightKg)) {
    errors.push({ field: 'weightKg', message: 'weightKg must be a number' });
  } else if (input.weightKg < WEIGHT_MIN || input.weightKg > WEIGHT_MAX) {
    errors.push({ field: 'weightKg', message: `weightKg must be between ${WEIGHT_MIN} and ${WEIGHT_MAX}` });
  }
  return errors;
}

function publicView(s) {
  return { trackingNumber: s.trackingNumber, status: s.status, history: s.history };
}

async function serveStatic(res, path) {
  const file = path === '/' || !path.includes('.') ? 'index.html' : path.slice(1);
  if (file.includes('..')) return send(res, 400, { error: 'Bad path' });
  try {
    const content = await readFile(join(PUBLIC_DIR, file));
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
    res.end(content);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') return send(res, 200, { status: 'ok' });

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req);
    if (body === null) return send(res, 400, { error: 'Invalid JSON' });
    const user = USERS.find((u) => u.email === body.email && u.password === body.password);
    if (!user) return send(res, 401, { error: 'Invalid email or password' });
    const token = randomUUID();
    sessions.set(token, user);
    return send(res, 200, { token, user: { email: user.email, name: user.name } });
  }

  const ws = workspaceFor(req);

  const trackMatch = pathname.match(/^\/api\/track\/([^/]+)$/);
  if (method === 'GET' && trackMatch) {
    const number = decodeURIComponent(trackMatch[1]);
    const found = [...ws.shipments.values()].find((s) => s.trackingNumber === number);
    return found ? send(res, 200, publicView(found)) : send(res, 404, { error: 'Shipment not found' });
  }

  // Everything below requires a valid session.
  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'Unauthorized' });

  if (method === 'GET' && pathname === '/api/drivers') return send(res, 200, DRIVERS);

  if (method === 'GET' && pathname === '/api/shipments') {
    const status = url.searchParams.get('status');
    const list = [...ws.shipments.values()].filter((s) => !status || s.status === status);
    return send(res, 200, list);
  }

  if (method === 'POST' && pathname === '/api/shipments') {
    const body = await readJson(req);
    if (body === null) return send(res, 400, { error: 'Invalid JSON' });
    const errors = validateShipment(body);
    if (errors.length) return send(res, 422, { error: 'Validation failed', details: errors });
    ws.sequence += 1;
    const now = new Date().toISOString();
    const shipment = {
      id: randomUUID(),
      trackingNumber: `PF-${String(ws.sequence).padStart(6, '0')}`,
      sender: body.sender.trim(),
      recipient: body.recipient.trim(),
      address: body.address.trim(),
      weightKg: body.weightKg,
      status: 'created',
      driver: null,
      createdAt: now,
      history: [{ status: 'created', at: now }],
    };
    await db.saveCreated(ws.id, shipment);
    ws.shipments.set(shipment.id, shipment);
    return send(res, 201, shipment);
  }

  const idMatch = pathname.match(/^\/api\/shipments\/([0-9a-f-]+)(\/status|\/assign)?$/);
  if (idMatch) {
    const shipment = ws.shipments.get(idMatch[1]);
    if (!shipment) return send(res, 404, { error: 'Shipment not found' });
    const action = idMatch[2];

    if (method === 'GET' && !action) return send(res, 200, shipment);

    if (method === 'POST' && action === '/assign') {
      const body = await readJson(req);
      if (body === null) return send(res, 400, { error: 'Invalid JSON' });
      if (!DRIVERS.includes(body.driver)) return send(res, 422, { error: 'Unknown driver' });
      if (shipment.status !== 'created') {
        return send(res, 409, { error: `Cannot assign a driver to a shipment in status ${shipment.status}` });
      }
      shipment.driver = body.driver;
      shipment.status = 'assigned';
      shipment.history.push({ status: 'assigned', at: new Date().toISOString() });
      await db.saveStatusChange(shipment);
      events.emit('shipment-changed', ws, shipment);
      return send(res, 200, shipment);
    }

    if (method === 'PATCH' && action === '/status') {
      const body = await readJson(req);
      if (body === null) return send(res, 400, { error: 'Invalid JSON' });
      if (!(body.status in TRANSITIONS)) return send(res, 422, { error: 'Unknown status' });
      if (!TRANSITIONS[shipment.status].includes(body.status)) {
        return send(res, 409, { error: `Transition ${shipment.status} -> ${body.status} is not allowed` });
      }
      if (body.status === 'assigned' && !shipment.driver) {
        return send(res, 409, { error: 'Use /assign to assign a driver' });
      }
      shipment.status = body.status;
      shipment.history.push({ status: body.status, at: new Date().toISOString() });
      await db.saveStatusChange(shipment);
      events.emit('shipment-changed', ws, shipment);
      return send(res, 200, shipment);
    }
  }

  return send(res, 404, { error: 'Not found' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Internal error' });
  }
});

const db = await connectDatabase(process.env.DATABASE_URL);

// gRPC starts first, so once /api/health answers both servers are ready.
await startGrpcServer({ port: GRPC_PORT, workspaceById, events });
server.listen(PORT, () =>
  console.log(`ParcelFlow is running on http://localhost:${PORT}, gRPC on localhost:${GRPC_PORT}`),
);
