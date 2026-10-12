import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { availableSlots, parseIcs, icsToAppointments, upsertExternalAppointments } from '../src/agenda.js';
import { reminderSuggestions } from '../src/messaging.js';

// Martes 15 de septiembre de 2026, 10:00
process.env.SALON_TODAY = '2026-09-15';
process.env.SALON_NOW = '10:00';

let server;
let base;
const db = openDb(':memory:');

before(async () => {
  const pw = hashPassword('secreto123');
  db.prepare("INSERT INTO salons (id, name, api_key, booking_slug) VALUES (1, 'Salón Uno', 'sk_uno', 'salon-uno'), (2, 'Dos', 'sk_dos', 'dos')").run();
  db.prepare("INSERT INTO users (email, password_hash, role, salon_id) VALUES ('uno@x.com', ?, 'owner', 1), ('dos@x.com', ?, 'owner', 2)").run(pw, pw);
  db.prepare("INSERT INTO employees (id, salon_id, name) VALUES (1, 1, 'Laura M.'), (2, 1, 'Carlos R.')").run();
  db.prepare("INSERT INTO services (id, salon_id, name, price, duration_min) VALUES (1, 1, 'Color raíz', 55, 60), (2, 1, 'Corte hombre', 18, 20)").run();
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
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), headers: res.headers, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (email) => (await call('/api/login', { method: 'POST', body: { email, password: 'secreto123' } })).cookie;

test('huecos libres: horario, ahora, duración y profesionales ocupados', () => {
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const today = availableSlots(db, salon, { date: '2026-09-15', duration: 60 });
  assert.equal(today[0].time, '10:00', 'hoy empieza a partir de ahora');
  assert.equal(today.at(-1).time, '19:00', 'un servicio de 60 min no puede empezar después de las 19:00 (cierra 20:00)');
  assert.deepEqual(availableSlots(db, salon, { date: '2026-09-20', duration: 30 }), [], 'domingo cerrado');
  assert.equal(availableSlots(db, salon, { date: '2026-09-19', duration: 60 }).at(-1).time, '13:00', 'sábado hasta las 14:00');
  const online = availableSlots(db, salon, { date: '2026-09-15', duration: 60, forPublic: true });
  assert.equal(online[0].time, '11:00', 'online, al menos una hora de antelación');
});

test('el salón crea una cita y no se puede reservar el mismo hueco dos veces', async () => {
  const c = await login('uno@x.com');
  const a = await call('/api/appointments', { method: 'POST', cookie: c, body: { new_client: { name: 'Marta Gil', phone: '600111222', gender: 'M' }, employee_id: 1, date: '2026-09-16', start: '10:00', service_ids: [1, 2] } });
  assert.equal(a.status, 200);
  assert.equal(a.data.end, '11:20', '60 + 20 minutos');
  assert.equal(a.data.employee_name, 'Laura M.');
  const clash = await call('/api/appointments', { method: 'POST', cookie: c, body: { client_name: 'Otra', employee_id: 1, date: '2026-09-16', start: '10:30', service_ids: [2] } });
  assert.equal(clash.status, 400);
  const any = await call('/api/appointments', { method: 'POST', cookie: c, body: { client_name: 'Otra', date: '2026-09-16', start: '10:30', service_ids: [2] } });
  assert.equal(any.data.employee_name, 'Carlos R.', 'con «cualquiera» se asigna a quien está libre');
  const slots = await call('/api/agenda/slots?date=2026-09-16&services=1&employee=1', { cookie: c });
  assert.ok(!slots.data.slots.some((s) => s.time === '10:30'));
  const moved = await call(`/api/appointments/${a.data.id}`, { method: 'PUT', cookie: c, body: { date: '2026-09-17', start: '12:00' } });
  assert.equal(moved.data.start, '12:00');
  const week = await call('/api/agenda?from=2026-09-14&days=7', { cookie: c });
  assert.equal(week.data.appointments.length, 2);
  assert.equal((await call(`/api/appointments/${a.data.id}`, { cookie: await login('dos@x.com') })).status, 404, 'otro salón no la ve');
});

test('reserva online: crea la clienta, la cita y avisa en Mensajes; la clienta puede cancelar', async () => {
  const info = await call('/api/public/booking/salon-uno');
  assert.equal(info.data.salon.name, 'Salón Uno');
  assert.equal(info.data.employees[0].name, 'Laura', 'solo el nombre de pila');
  const slots = await call('/api/public/booking/salon-uno/slots?date=2026-09-18&services=2');
  assert.ok(slots.data.slots.includes('10:00'));
  const bad = await call('/api/public/booking/salon-uno', { method: 'POST', body: { service_ids: [2], date: '2026-09-18', start: '10:00', name: 'Ana', phone: '611222333' } });
  assert.equal(bad.status, 400, 'pide el consentimiento');
  const r = await call('/api/public/booking/salon-uno', { method: 'POST', body: { service_ids: [2], date: '2026-09-18', start: '10:00', name: 'Ana Ruiz', phone: '611 222 333', consent: true } });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'confirmada');
  const client = db.prepare("SELECT * FROM clients WHERE salon_id = 1 AND name = 'Ana Ruiz'").get();
  assert.ok(client);
  const msg = db.prepare("SELECT m.body FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.client_id = ? AND m.direction = 'in'").get(client.id);
  assert.match(msg.body, /Reserva online: Corte hombre/);
  const ics = await call(`/api/public/appointment/${r.data.token}/ics`);
  assert.match(ics.data, /BEGIN:VEVENT/);
  const cancel = await call(`/api/public/appointment/${r.data.token}/cancel`, { method: 'POST', body: {} });
  assert.equal(cancel.data.status, 'cancelada');
  assert.equal((await call('/api/public/booking/no-existe')).status, 404);
  db.prepare('UPDATE salons SET booking_enabled = 0 WHERE id = 1').run();
  assert.equal((await call('/api/public/booking/salon-uno')).status, 404, 'con las reservas cerradas no se puede reservar');
  db.prepare('UPDATE salons SET booking_enabled = 1 WHERE id = 1').run();
  const page = await fetch(`${base}/reservar/salon-uno`);
  assert.match(await page.text(), /reservar\.js/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors \*/, 'se puede incrustar en la web del salón');
});

test('citas desde otras plataformas: crear, mover y cancelar por referencia', async () => {
  const send = (appointments) => call('/api/ingest/appointments', { method: 'POST', headers: { Authorization: 'Bearer sk_uno' }, body: { appointments } });
  const first = await send([{ ref: 'bk1', source: 'booksy', date: '2026-09-22', start: '16:00', duration: 60, status: 'confirmed', employee: 'Laura M.', client: { name: 'Rosa Díaz', phone: '622333444' }, services: [{ name: 'Color raíz' }] }]);
  assert.equal(first.data.created, 1);
  const moved = await send([{ ref: 'bk1', source: 'booksy', date: '2026-09-23', start: '17:00', duration: 60, status: 'confirmed' }]);
  assert.equal(moved.data.updated, 1);
  const cancelled = await send([{ ref: 'bk1', source: 'booksy', date: '2026-09-23', start: '17:00', status: 'cancelled' }]);
  assert.equal(cancelled.data.cancelled, 1);
  const a = db.prepare("SELECT * FROM appointments WHERE external_ref = 'booksy:bk1'").get();
  assert.equal(a.status, 'cancelada');
  assert.equal(a.date, '2026-09-23');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE external_ref = 'booksy:bk1'").get().n, 1);
});

test('calendario iCal: leer eventos y convertirlos en citas', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc@google\r\nDTSTART:20260924T080000Z\r\nDTEND:20260924T090000Z\r\nSUMMARY:Elena Castro - Color raíz\r\nDESCRIPTION:Tel 633 444 555\r\nEND:VEVENT\r\n'
    + 'BEGIN:VEVENT\r\nUID:dia@google\r\nDTSTART;VALUE=DATE:20260925\r\nSUMMARY:Festivo\r\nEND:VEVENT\r\n'
    + 'BEGIN:VEVENT\r\nUID:x2\r\nDTSTART;TZID=Europe/Madrid:20260924T120000\r\nDTEND;TZID=Europe/Madrid:20260924T122000\r\nSUMMARY:Pedro \r\n Pérez · Corte hombre\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const events = parseIcs(ics);
  assert.equal(events.length, 2, 'el evento de día completo no es una cita');
  assert.deepEqual(events[0].start, { date: '2026-09-24', time: '10:00' }, 'UTC → hora de Madrid');
  assert.equal(events[1].summary, 'Pedro Pérez · Corte hombre', 'líneas plegadas');
  const appts = icsToAppointments(db, 1, events, { feedId: 9, employeeName: 'Laura M.' });
  assert.equal(appts[0].client.name, 'Elena Castro');
  assert.equal(appts[0].services[0].name, 'Color raíz');
  assert.equal(appts[0].client.phone, '633 444 555');
  assert.equal(appts[1].status, 'cancelada');
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const r = upsertExternalAppointments(db, salon, appts, 'ical');
  assert.equal(r.created, 2);
});

test('empezar el servicio de una cita y cobrarla la deja completada con tiempo real', async () => {
  const c = await login('uno@x.com');
  const a = await call('/api/appointments', { method: 'POST', cookie: c, body: { client_name: 'Luis', employee_id: 2, date: '2026-09-15', start: '12:00', service_ids: [2] } });
  const start = await call(`/api/appointments/${a.data.id}/start`, { method: 'POST', cookie: c, body: {} });
  assert.equal(start.status, 200);
  assert.equal(db.prepare('SELECT status FROM appointments WHERE id = ?').get(a.data.id).status, 'en_curso');
  const t = await call('/api/tickets', { method: 'POST', cookie: c, body: { employee_id: 2, method: 'tarjeta', time_start: '12:00', time_end: '12:22', open_visit_id: start.data.visit_id, lines: [{ kind: 'service', item_id: 2 }] } });
  const appt = db.prepare('SELECT status, ticket_id FROM appointments WHERE id = ?').get(a.data.id);
  assert.equal(appt.status, 'completada');
  assert.equal(appt.ticket_id, t.data.id);
  // Cobrar una cita sin cronómetro también la completa.
  const b = await call('/api/appointments', { method: 'POST', cookie: c, body: { client_name: 'Eva', employee_id: 2, date: '2026-09-15', start: '13:00', service_ids: [2] } });
  await call('/api/tickets', { method: 'POST', cookie: c, body: { employee_id: 2, appointment_id: b.data.id, lines: [{ kind: 'service', item_id: 2 }] } });
  assert.equal(db.prepare('SELECT status FROM appointments WHERE id = ?').get(b.data.id).status, 'completada');
});

test('agenda suscribible y recordatorio de las citas de mañana', async () => {
  const c = await login('uno@x.com');
  const settings = await call('/api/booking-settings', { cookie: c });
  assert.ok(settings.data.calendar_token);
  const feed = await call(`/api/public/calendar/${settings.data.calendar_token}`);
  assert.match(feed.headers.get('content-type'), /text\/calendar/);
  assert.match(feed.data, /SUMMARY:Marta Gil/);
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const cl = await call('/api/clients', { method: 'POST', cookie: c, body: { name: 'Nuria Gil', phone: '655666777' } });
  await call('/api/appointments', { method: 'POST', cookie: c, body: { client_id: cl.data.id, date: '2026-09-16', start: '18:00', service_ids: [2] } });
  const group = reminderSuggestions(db, salon).find((g) => g.kind === 'confirmacion');
  const item = group.items.find((i) => i.client_id === cl.data.id);
  assert.match(item.text, /mañana, miércoles 16, a las 18:00/);
  const bad = await call('/api/booking-settings', { method: 'PUT', cookie: c, body: { booking_slug: 'Con Espacios' } });
  assert.equal(bad.status, 400);
  const sched = await call('/api/booking-settings', { method: 'PUT', cookie: c, body: { schedule: { 1: null, 2: ['10:00', '19:00'], 3: ['10:00', '19:00'], 4: ['10:00', '19:00'], 5: ['10:00', '19:00'], 6: ['10:00', '14:00'], 0: null } } });
  assert.equal(sched.status, 200);
  assert.deepEqual(availableSlots(db, db.prepare('SELECT * FROM salons WHERE id = 1').get(), { date: '2026-09-21', duration: 20 }), [], 'lunes cerrado tras cambiar el horario');
});
