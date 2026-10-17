import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

process.env.SALON_TODAY = '2026-10-17';

let server;
let base;
const db = openDb(':memory:');

before(async () => {
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES ('admin@x.com', ?, 'admin')").run(hashPassword('secreto123'));
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
  return { status: res.status, data: await res.json().catch(() => null), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (email, password = 'secreto123') => (await call('/api/login', { method: 'POST', body: { email, password } })).cookie;
const SIGNUP = { salon_name: 'Salón Lucía', city: 'Valencia', name: 'Lucía', email: 'lucia@x.com', password: 'clave-segura', accept: true };

test('alta libre: crea el salón en prueba y entra directamente', async () => {
  assert.equal((await call('/api/signup', { method: 'POST', body: { ...SIGNUP, accept: false } })).status, 400);
  assert.equal((await call('/api/signup', { method: 'POST', body: { ...SIGNUP, password: 'corta' } })).status, 400);
  const r = await call('/api/signup', { method: 'POST', body: SIGNUP });
  assert.equal(r.status, 200);
  assert.match(r.cookie, /^sid=[a-f0-9]{64}$/);
  const me = await call('/api/me', { cookie: r.cookie });
  assert.equal(me.data.salon.name, 'Salón Lucía');
  assert.equal(me.data.salon.plan, 'Prueba');
  assert.equal(me.data.salon.signup_source, 'registro');
  assert.deepEqual(me.data.trial, { ends: '2026-11-16', days_left: 30, expired: false });
  assert.ok(me.data.salon.booking_slug, 'tiene página de reservas');
  // El mismo email no se puede registrar dos veces.
  const dup = await call('/api/signup', { method: 'POST', body: { ...SIGNUP, salon_name: 'Otro' } });
  assert.equal(dup.status, 400);
  assert.match(dup.data.error, /Ya existe una cuenta/);
  // El distribuidor ve el salón nuevo.
  const admin = await login('admin@x.com');
  const me2 = await call('/api/me', { cookie: admin });
  assert.ok(me2.data.salons.some((s) => s.name === 'Salón Lucía'));
});

test('usuarios del equipo: el equipo solo ve agenda, cobros, clientes y mensajes', async () => {
  const owner = await login('lucia@x.com', 'clave-segura');
  const emp = await call('/api/employees', { method: 'POST', cookie: owner, body: { name: 'Marta', role: 'Estilista' } });
  const created = await call('/api/team/users', { method: 'POST', cookie: owner, body: { name: 'Marta', email: 'marta@x.com', password: 'marta-1234', role: 'staff', employee_id: emp.data.id } });
  assert.equal(created.status, 200);
  const list = await call('/api/team/users', { cookie: owner });
  assert.equal(list.data.users.length, 2);
  assert.equal(list.data.users.find((u) => u.email === 'marta@x.com').employee_name, 'Marta');

  const staff = await login('marta@x.com', 'marta-1234');
  assert.equal((await call('/api/agenda?from=2026-10-12&to=2026-10-18', { cookie: staff })).status, 200);
  assert.equal((await call('/api/clients', { cookie: staff })).status, 200);
  assert.equal((await call('/api/catalog', { cookie: staff })).status, 200);
  assert.equal((await call('/api/dashboard', { cookie: staff })).status, 403);
  assert.equal((await call('/api/settings', { cookie: staff })).status, 403);
  assert.equal((await call('/api/team/users', { cookie: staff })).status, 403);

  // No se puede dejar el salón sin dueño ni desactivarse a uno mismo.
  const ownerId = list.data.users.find((u) => u.role === 'owner').id;
  assert.equal((await call(`/api/team/users/${ownerId}`, { method: 'PUT', cookie: owner, body: { role: 'staff' } })).status, 400);
  assert.equal((await call(`/api/team/users/${ownerId}`, { method: 'DELETE', cookie: owner, body: {} })).status, 400);

  // Desactivar a una persona la saca de la sesión y no le deja entrar.
  const martaId = created.data.id;
  await call(`/api/team/users/${martaId}`, { method: 'PUT', cookie: owner, body: { active: false } });
  assert.equal((await call('/api/clients', { cookie: staff })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'marta@x.com', password: 'marta-1234' } })).status, 403);
});

test('recuperar la contraseña con un enlace de un solo uso', async () => {
  const owner = await login('lucia@x.com', 'clave-segura');
  const users = (await call('/api/team/users', { cookie: owner })).data.users;
  const marta = users.find((u) => u.email === 'marta@x.com');
  await call(`/api/team/users/${marta.id}`, { method: 'PUT', cookie: owner, body: { active: true } });
  const link = (await call(`/api/team/users/${marta.id}/reset-link`, { method: 'POST', cookie: owner, body: {} })).data.link;
  const token = new URL(link.replace('#/restablecer', '')).searchParams.get('codigo');
  assert.match(token, /^[a-f0-9]{48}$/);
  const r = await call('/api/password/reset', { method: 'POST', body: { token, password: 'nueva-clave-1' } });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/me', { cookie: r.cookie })).data.user.email, 'marta@x.com');
  assert.equal((await call('/api/password/reset', { method: 'POST', body: { token, password: 'otra-clave-2' } })).status, 400, 'el enlace solo vale una vez');
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'marta@x.com', password: 'nueva-clave-1' } })).status, 200);
  // Sin email configurado, el formulario lo dice en vez de fingir que se ha enviado.
  const f = await call('/api/password/forgot', { method: 'POST', body: { email: 'marta@x.com' } });
  assert.equal(f.data.mail, false);
});

test('prueba caducada: se puede consultar pero no modificar hasta elegir plan', async () => {
  const owner = await login('lucia@x.com', 'clave-segura');
  const salonId = (await call('/api/me', { cookie: owner })).data.salon.id;
  db.prepare("UPDATE salons SET trial_ends = '2026-10-10' WHERE id = ?").run(salonId);
  const me = await call('/api/me', { cookie: owner });
  assert.equal(me.data.trial.expired, true);
  assert.equal((await call('/api/clients', { cookie: owner })).status, 200);
  const blocked = await call('/api/clients', { method: 'POST', cookie: owner, body: { name: 'Nueva' } });
  assert.equal(blocked.status, 402);
  // El distribuidor pasa el salón a un plan de pago y vuelve a funcionar.
  const admin = await login('admin@x.com');
  assert.equal((await call(`/api/admin/salons/${salonId}`, { method: 'PUT', cookie: admin, body: { plan: 'Base', monthly_fee: 49 } })).status, 200);
  assert.equal((await call('/api/clients', { method: 'POST', cookie: owner, body: { name: 'Nueva' } })).status, 200);
  // Desactivado, el salón no puede entrar.
  await call(`/api/admin/salons/${salonId}`, { method: 'PUT', cookie: admin, body: { active: false } });
  assert.equal((await call('/api/clients', { cookie: owner })).status, 403);
  await call(`/api/admin/salons/${salonId}`, { method: 'PUT', cookie: admin, body: { active: true } });
});

test('el alta libre se puede cerrar con SIGNUP=0', async () => {
  process.env.SIGNUP = '0';
  try {
    assert.equal((await call('/api/signup', { method: 'POST', body: { ...SIGNUP, email: 'otra@x.com' } })).status, 403);
    assert.equal((await call('/api/config')).data.signup, false);
  } finally {
    delete process.env.SIGNUP;
  }
});

test('las bases de datos antiguas admiten el rol de equipo sin perder usuarios', () => {
  const dir = mkdtempSync(join(tmpdir(), 'salonpro-'));
  const file = join(dir, 'viejo.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE salons (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE employees (id INTEGER PRIMARY KEY, salon_id INTEGER, name TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT '', password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'owner')), salon_id INTEGER REFERENCES salons(id), created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    INSERT INTO salons (id, name) VALUES (1, 'Viejo');
    INSERT INTO users (id, email, password_hash, role, salon_id) VALUES (7, 'viejo@x.com', 'h', 'owner', 1);
    INSERT INTO sessions VALUES ('t', 7, '2099-01-01');`);
  old.close();
  try {
    const up = openDb(file);
    const u = up.prepare('SELECT * FROM users WHERE id = 7').get();
    assert.equal(u.email, 'viejo@x.com');
    assert.equal(u.active, 1);
    assert.equal(up.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1, 'las sesiones se conservan');
    up.prepare("INSERT INTO users (email, password_hash, role, salon_id) VALUES ('equipo@x.com', 'h', 'staff', 1)").run();
    up.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
