const $ = (selector) => document.querySelector(selector);
const STATUS_LABELS = {
  created: 'Created',
  assigned: 'Assigned',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const session = {
  get token() {
    return localStorage.getItem('pf_token');
  },
  get user() {
    return JSON.parse(localStorage.getItem('pf_user') ?? 'null');
  },
  save(token, user) {
    localStorage.setItem('pf_token', token);
    localStorage.setItem('pf_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user');
  },
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(path, { ...options, headers });
  const body = res.status === 204 ? null : await res.json();
  if (res.status === 401 && session.token) {
    session.clear();
    location.hash = '#/login';
  }
  return { status: res.status, body };
}

function show(view) {
  document.querySelectorAll('.view').forEach((el) => (el.hidden = el.id !== `view-${view}`));
  const user = session.user;
  $('[data-testid="current-user"]').hidden = !user;
  $('[data-testid="logout"]').hidden = !user;
  if (user) $('[data-testid="current-user"]').textContent = user.name;
}

async function route() {
  const page = location.hash.replace('#/', '') || 'shipments';
  if (page === 'track') return show('track');
  if (!session.token) return show('login');
  show('shipments');
  await renderShipments();
}

async function renderShipments() {
  const status = $('[data-testid="status-filter"]').value;
  const { body: list } = await api(`/api/shipments${status ? `?status=${status}` : ''}`);
  const { body: drivers } = await api('/api/drivers');
  const tbody = $('[data-testid="shipments-table"] tbody');
  tbody.innerHTML = '';
  $('[data-testid="empty-state"]').hidden = list.length > 0;
  $('[data-testid="shipments-table"]').hidden = list.length === 0;

  for (const s of list) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'shipment-row';
    tr.dataset.tracking = s.trackingNumber;
    tr.innerHTML = `
      <td data-testid="cell-tracking">${s.trackingNumber}</td>
      <td data-testid="cell-recipient"></td>
      <td>${s.weightKg} kg</td>
      <td data-testid="cell-driver">${s.driver ?? '—'}</td>
      <td><span class="badge" data-testid="cell-status">${STATUS_LABELS[s.status]}</span></td>
      <td data-testid="cell-actions"></td>`;
    tr.querySelector('[data-testid="cell-recipient"]').textContent = s.recipient;
    const actions = tr.querySelector('[data-testid="cell-actions"]');

    if (s.status === 'created') {
      const select = document.createElement('select');
      select.dataset.testid = 'driver-select';
      select.setAttribute('aria-label', `Driver for ${s.trackingNumber}`);
      select.innerHTML = drivers.map((d) => `<option>${d}</option>`).join('');
      actions.append(
        select,
        button('Assign', 'assign', () => assign(s.id, select.value)),
      );
    }
    if (s.status === 'assigned') actions.append(button('Start delivery', 'start', () => setStatus(s.id, 'in_transit')));
    if (s.status === 'in_transit')
      actions.append(button('Mark delivered', 'deliver', () => setStatus(s.id, 'delivered')));
    if (['created', 'assigned'].includes(s.status)) {
      actions.append(button('Cancel', 'cancel', () => setStatus(s.id, 'cancelled'), 'danger'));
    }
    tbody.append(tr);
  }
}

function button(label, testid, onClick, extra = '') {
  const b = document.createElement('button');
  b.className = `small ${extra}`;
  b.textContent = label;
  b.dataset.testid = `action-${testid}`;
  b.addEventListener('click', onClick);
  return b;
}

async function assign(id, driver) {
  await api(`/api/shipments/${id}/assign`, { method: 'POST', body: JSON.stringify({ driver }) });
  await renderShipments();
}

async function setStatus(id, status) {
  await api(`/api/shipments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  await renderShipments();
}

$('[data-testid="login-form"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const error = $('[data-testid="login-error"]');
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
  });
  if (status !== 200) {
    error.textContent = body.error;
    error.hidden = false;
    return;
  }
  error.hidden = true;
  session.save(body.token, body.user);
  location.hash = '#/shipments';
});

$('[data-testid="logout"]').addEventListener('click', () => {
  session.clear();
  location.hash = '#/login';
});

$('[data-testid="shipment-form"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const errors = $('[data-testid="shipment-errors"]');
  const weight = form.get('weightKg');
  const { status, body } = await api('/api/shipments', {
    method: 'POST',
    body: JSON.stringify({
      sender: form.get('sender'),
      recipient: form.get('recipient'),
      address: form.get('address'),
      weightKg: weight === '' ? null : Number(weight),
    }),
  });
  if (status === 422) {
    errors.innerHTML = '';
    for (const d of body.details) {
      const li = document.createElement('li');
      li.dataset.testid = `error-${d.field}`;
      li.textContent = d.message;
      errors.append(li);
    }
    errors.hidden = false;
    return;
  }
  errors.hidden = true;
  e.target.reset();
  await renderShipments();
});

$('[data-testid="status-filter"]').addEventListener('change', renderShipments);

$('[data-testid="track-form"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const number = new FormData(e.target).get('trackingNumber').trim().toUpperCase();
  const error = $('[data-testid="track-error"]');
  const result = $('[data-testid="track-result"]');
  const { status, body } = await api(`/api/track/${encodeURIComponent(number)}`);
  if (status !== 200) {
    error.textContent = 'Parcel not found. Check the tracking number.';
    error.hidden = false;
    result.hidden = true;
    return;
  }
  error.hidden = true;
  $('[data-testid="track-status"]').textContent = STATUS_LABELS[body.status];
  $('[data-testid="track-history"]').innerHTML = body.history
    .map((h) => `<li data-testid="history-item">${STATUS_LABELS[h.status]}</li>`)
    .join('');
  result.hidden = false;
});

window.addEventListener('hashchange', route);
route();
