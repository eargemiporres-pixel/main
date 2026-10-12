import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { importTickets } from '../src/importer.js';
import { serviceTimes, reportData, reportXlsx } from '../src/servicetimes.js';

process.env.SALON_TODAY = '2026-09-15';

let server;
let base;
const db = openDb(':memory:');

before(async () => {
  const pw = hashPassword('secreto123');
  db.prepare("INSERT INTO salons (id, name) VALUES (1, 'Uno'), (2, 'Dos')").run();
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES ('admin@x.com', ?, 'admin')").run(pw);
  db.prepare("INSERT INTO users (email, password_hash, role, salon_id) VALUES ('uno@x.com', ?, 'owner', 1)").run(pw);
  db.prepare("INSERT INTO employees (id, salon_id, name) VALUES (1, 1, 'Laura')").run();
  db.prepare(`INSERT INTO services (id, salon_id, name, gender, price, duration_min) VALUES
      (1, 1, 'Color raíz', 'M', 54, 60), (2, 1, 'Corte hombre', 'H', 20, 20), (3, 1, 'Peinado', 'M', 30, 30)`).run();
  db.prepare("INSERT INTO clients (id, salon_id, name, gender) VALUES (1, 1, 'Ana', 'M'), (2, 1, 'Luis', 'H')").run();
  server = createServer(createApp(db));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (email) => (await call('/api/login', { method: 'POST', body: { email, password: 'secreto123' } })).cookie;

test('tiempo real por servicio: exacto con un servicio y repartido con varios', () => {
  importTickets(db, 1, [
    // Un solo servicio: 72 minutos reales para un color de 60 en el menú.
    { ref: 'a', date: '2026-09-02', time_start: '10:00', time_end: '11:12', employee: 'Laura', client: { name: 'Ana' }, lines: [{ type: 'service', name: 'Color raíz', price: 54 }] },
    // Dos servicios (60 + 30 de menú) en 108 minutos: 72 y 36.
    { ref: 'b', date: '2026-09-03', time_start: '10:00', time_end: '11:48', employee: 'Laura', client: { name: 'Ana' }, lines: [{ type: 'service', name: 'Color raíz', price: 54 }, { type: 'service', name: 'Peinado', price: 30 }] },
    // Sin horas: cuenta en veces pero no en tiempo real.
    { ref: 'c', date: '2026-09-04', employee: 'Laura', client: { name: 'Luis' }, lines: [{ type: 'service', name: 'Corte hombre', price: 20 }] }
  ], 'csv');
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const t = serviceTimes(db, salon, '2026-09-01', '2026-10-01');
  const color = t.services.find((s) => s.name === 'Color raíz');
  assert.equal(color.units, 2);
  assert.equal(color.realMinutes, 72);
  assert.equal(Math.round(color.deviationPct), 20);
  assert.equal(color.perMinReal, 0.75);
  assert.equal(color.profitable, false, '0,75 €/min está por debajo de 0,85');
  assert.equal(color.minPrice, 62, '0,85 × 72 min, redondeado hacia arriba');
  const peinado = t.services.find((s) => s.name === 'Peinado');
  assert.equal(peinado.realMinutes, 36);
  const corte = t.services.find((s) => s.name === 'Corte hombre');
  assert.equal(corte.measuredUnits, 0);
  assert.equal(corte.basedOn, 'menu', 'sin medir, se juzga con el menú');
  assert.equal(corte.profitable, true, '20 € / 20 min = 1 €/min');
  assert.equal(t.summary.measuredUnits, 3);
  assert.equal(t.summary.sources.csv, 2);
});

test('reporte: ticket medio por género, equipo y Excel válido', () => {
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const r = reportData(db, salon, 'month', '2026-09');
  assert.equal(r.gender.women.tickets, 2);
  assert.equal(r.gender.women.avgTicket, 69);
  assert.equal(r.gender.men.avgTicket, 20);
  assert.equal(r.summary.servicesWomen, 3);
  assert.equal(r.summary.servicesMen, 1);
  assert.equal(r.team[0].services, 4);
  const x = reportXlsx(r);
  assert.equal(String.fromCharCode(x[0], x[1]), 'PK');
  const text = new TextDecoder().decode(x);
  for (const sheet of ['Resumen', 'Equipo', 'Servicios', 'Rentabilidad']) assert.ok(text.includes(`name="${sheet}"`));
});

test('el reporte es solo para el distribuidor', async () => {
  const owner = await login('uno@x.com');
  assert.equal((await call('/api/admin/report?period=month&ref=2026-09', { cookie: owner })).status, 403);
  assert.equal((await call('/api/admin/report.xlsx?period=month&ref=2026-09', { cookie: owner })).status, 403);
  const admin = await login('admin@x.com');
  const json = await call('/api/admin/report?salon=1&period=month&ref=2026-09', { cookie: admin });
  assert.equal(json.data.salon.name, 'Uno');
  const file = await call('/api/admin/report.xlsx?salon=1&period=month&ref=2026-09', { cookie: admin });
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition'), /reporte-uno-2026-09\.xlsx/);
  assert.equal(String.fromCharCode(file.data[0], file.data[1]), 'PK');
  const thr = await call('/api/admin/salons/1', { method: 'PUT', cookie: admin, body: { min_price_minute: 0.7 } });
  assert.equal(thr.status, 200);
  const again = await call('/api/admin/report?salon=1&period=month&ref=2026-09', { cookie: admin });
  assert.equal(again.data.times.services.find((s) => s.name === 'Color raíz').profitable, true, 'con 0,70 €/min el color pasa a rentable');
  assert.equal(db.prepare('SELECT active FROM salons WHERE id = 1').get().active, 1);
});

test('cronómetro: empezar servicio y cobrar guarda el tiempo real', async () => {
  const owner = await login('uno@x.com');
  const v = await call('/api/visits/open', { method: 'POST', cookie: owner, body: { employee_id: 1, client_id: 2, lines: [{ kind: 'service', item_id: 2 }] } });
  assert.equal(v.status, 200);
  const open = await call('/api/visits/open', { cookie: owner });
  assert.equal(open.data.visits.length, 1);
  assert.equal(open.data.visits[0].client_name, 'Luis');
  const t = await call('/api/tickets', { method: 'POST', cookie: owner, body: { employee_id: 1, client_id: 2, method: 'efectivo', time_start: '12:00', time_end: '12:24', open_visit_id: v.data.id, lines: [{ kind: 'service', item_id: 2 }] } });
  assert.equal(t.status, 200);
  const row = db.prepare('SELECT time_source, time_start, time_end FROM tickets WHERE id = ?').get(t.data.id);
  assert.equal(row.time_source, 'cronometro');
  assert.equal((await call('/api/visits/open', { cookie: owner })).data.visits.length, 0, 'al cobrar se cierra');
  assert.equal((await call('/api/visits/open', { method: 'POST', cookie: owner, body: { lines: [] } })).status, 400);
  const times = await call('/api/service-times?period=month&ref=2026-09', { cookie: owner });
  assert.equal(times.data.summary.sources.cronometro, 1);
});
