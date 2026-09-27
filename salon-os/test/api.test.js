import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

process.env.SALON_TODAY = '2026-09-15';

let server;
let base;
const db = openDb(':memory:');

before(async () => {
  const pw = hashPassword('secreto123');
  db.prepare("INSERT INTO salons (id, name, api_key) VALUES (1, 'Uno', 'sk_uno'), (2, 'Dos', 'sk_dos')").run();
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES ('admin@x.com', ?, 'admin')").run(pw);
  db.prepare("INSERT INTO users (email, password_hash, role, salon_id) VALUES ('uno@x.com', ?, 'owner', 1), ('dos@x.com', ?, 'owner', 2)").run(pw, pw);
  server = createServer(createApp(db));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (email, password = 'secreto123') => (await call('/api/login', { method: 'POST', body: { email, password } })).cookie;

test('login correcto e incorrecto', async () => {
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'uno@x.com', password: 'mal' } })).status, 401);
  const cookie = await login('uno@x.com');
  assert.match(cookie, /^sid=[a-f0-9]{64}$/);
  const me = await call('/api/me', { cookie });
  assert.equal(me.data.salon.name, 'Uno');
  assert.equal((await call('/api/me')).status, 401);
});

test('flujo completo: catálogo → cobro → caja → métricas → cierre', async () => {
  const cookie = await login('uno@x.com');
  const emp = await call('/api/employees', { method: 'POST', cookie, body: { name: 'Laura', role: 'Estilista' } });
  const srv = await call('/api/services', { method: 'POST', cookie, body: { name: 'Corte', price: 30, duration_min: 45 } });
  const prd = await call('/api/products', { method: 'POST', cookie, body: { name: 'Champú', price: 18, kind: 'retail' } });
  const t = await call('/api/tickets', {
    method: 'POST', cookie,
    body: { employee_id: emp.data.id, method: 'efectivo', new_client: { name: 'Ana', phone: '600', gender: 'M' }, lines: [{ kind: 'service', item_id: srv.data.id }, { kind: 'product', item_id: prd.data.id, qty: 2 }] }
  });
  assert.equal(t.status, 200);
  assert.equal(t.data.total, 66);
  await call('/api/cash/movements', { method: 'POST', cookie, body: { direction: 'out', amount: 10, method: 'efectivo', category: 'Café' } });
  const cash = await call('/api/cash', { cookie });
  assert.equal(cash.data.inTotal, 66);
  assert.equal(cash.data.outTotal, 10);
  assert.equal(cash.data.cash.expected, 150 + 66 - 10);
  const dash = await call('/api/dashboard?period=month&ref=2026-09', { cookie });
  assert.equal(dash.data.metrics.revenue, 66);
  assert.equal(dash.data.metrics.retailUnits, 2);
  const close = await call('/api/cash/close', { method: 'POST', cookie, body: { counted: 200 } });
  assert.equal(close.data.diff, -6);
  const del = await call(`/api/tickets/${t.data.id}`, { method: 'DELETE', cookie, body: {} });
  assert.equal(del.status, 400, 'no se anulan cobros de una caja cerrada');
});

test('un salón no puede tocar datos de otro', async () => {
  const uno = await login('uno@x.com');
  const dos = await login('dos@x.com');
  const c = await call('/api/clients', { method: 'POST', cookie: uno, body: { name: 'Privada' } });
  assert.equal((await call(`/api/clients/${c.data.id}`, { cookie: dos })).status, 404);
  assert.equal((await call(`/api/clients/${c.data.id}`, { method: 'PUT', cookie: dos, body: { name: 'x' } })).status, 404);
  const list = await call('/api/clients', { cookie: dos });
  assert.equal(list.data.clients.length, 0);
  assert.equal((await call('/api/admin/overview', { cookie: uno })).status, 403);
  // El parámetro salon solo lo usa el distribuidor: un dueño sigue viendo lo suyo.
  const cross = await call('/api/clients?salon=1', { cookie: dos });
  assert.equal(cross.data.clients.length, 0);
});

test('el distribuidor ve la red y cualquier salón', async () => {
  const admin = await login('admin@x.com');
  const o = await call('/api/admin/overview?ref=2026-09', { cookie: admin });
  assert.equal(o.status, 200);
  assert.equal(o.data.salons.length, 2);
  assert.equal((await call('/api/clients', { cookie: admin })).status, 400, 'debe elegir salón');
  assert.equal((await call('/api/clients?salon=1', { cookie: admin })).status, 200);
  const created = await call('/api/admin/salons', { method: 'POST', cookie: admin, body: { name: 'Nuevo', owner_email: 'nuevo@x.com', owner_password: 'contraseña1', monthly_fee: 49 } });
  assert.equal(created.status, 200);
  assert.match(await login('nuevo@x.com', 'contraseña1'), /^sid=/);
});

test('API de integración con clave del salón', async () => {
  const body = { tickets: [{ ref: 'A1', date: '2026-09-10', employee: 'Toni', method: 'visa', client: { name: 'Pepe', phone: '611222333' }, lines: [{ type: 'service', name: 'Corte', price: 20 }] }] };
  assert.equal((await call('/api/ingest/tickets', { method: 'POST', body, headers: { Authorization: 'Bearer malo' } })).status, 401);
  const r = await call('/api/ingest/tickets', { method: 'POST', body, headers: { Authorization: 'Bearer sk_dos' } });
  assert.equal(r.data.created, 1);
  const again = await call('/api/ingest/tickets', { method: 'POST', body, headers: { Authorization: 'Bearer sk_dos' } });
  assert.equal(again.data.skipped, 1);
  const t = db.prepare("SELECT * FROM tickets WHERE external_ref = 'api:A1'").get();
  assert.equal(t.salon_id, 2);
  assert.equal(t.method, 'tarjeta');
  const h = await call('/api/ingest/hours', { method: 'POST', body: { entries: [{ employee: 'Toni', date: '2026-09-10', hours: 8 }] }, headers: { Authorization: 'Bearer sk_dos' } });
  assert.equal(h.data.saved, 1);
});

test('las peticiones que modifican datos deben ser JSON (CSRF)', async () => {
  const cookie = await login('uno@x.com');
  const res = await fetch(`${base}/api/clients`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=x' });
  assert.equal(res.status, 415);
});

test('archivos estáticos sin salir de public/', async () => {
  const ok = await fetch(`${base}/`);
  assert.equal(ok.status, 200);
  const bad = await fetch(`${base}/..%2Fsrc%2Fdb.js`);
  assert.notEqual(bad.status, 200);
});
