import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { analyzeConversation } from '../src/insights.js';
import { parseWhatsAppWebhook, renderTemplate, reminderSuggestions } from '../src/messaging.js';
import { importTickets } from '../src/importer.js';

process.env.SALON_TODAY = '2026-09-15';
process.env.WA_VERIFY_TOKEN = 'verifica';
process.env.WA_APP_SECRET = 'secreto-app';

let server;
let base;
const db = openDb(':memory:');

before(async () => {
  const pw = hashPassword('secreto123');
  db.prepare("INSERT INTO salons (id, name, api_key) VALUES (1, 'Uno', 'sk_uno'), (2, 'Dos', 'sk_dos')").run();
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES ('admin@x.com', ?, 'admin')").run(pw);
  db.prepare("INSERT INTO users (email, password_hash, role, salon_id) VALUES ('uno@x.com', ?, 'owner', 1), ('dos@x.com', ?, 'owner', 2)").run(pw, pw);
  db.prepare("INSERT INTO salon_channels (salon_id, wa_phone_number_id) VALUES (1, 'PN1')").run();
  db.prepare("INSERT INTO employees (salon_id, name) VALUES (1, 'Laura M.')").run();
  db.prepare("INSERT INTO services (salon_id, name, price, duration_min) VALUES (1, 'Mechas / balayage', 95, 150)").run();
  server = createServer(createApp(db));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, cookie, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined)
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (email) => (await call('/api/login', { method: 'POST', body: { email, password: 'secreto123' } })).cookie;

const waPayload = (from, text, id, name = 'Marta Gil') => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: {
    metadata: { phone_number_id: 'PN1' },
    contacts: [{ wa_id: from, profile: { name } }],
    messages: [{ from, id, timestamp: '1757930400', type: 'text', text: { body: text } }]
  } }] }]
});

test('verificación del webhook de WhatsApp', async () => {
  const ok = await call('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=12345');
  assert.equal(ok.status, 200);
  assert.equal(ok.data, 12345);
  const bad = await call('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1');
  assert.equal(bad.status, 403);
});

test('mensaje entrante por WhatsApp: firma, ficha nueva, conversación e insights', async () => {
  const raw = JSON.stringify(waPayload('34611222333', 'Hola! ¿Cuánto cuesta un balayage? Me caso en junio y tengo el cuero cabelludo muy sensible', 'wamid.1'));
  const unsigned = await call('/api/webhooks/whatsapp', { method: 'POST', raw });
  assert.equal(unsigned.status, 401, 'sin firma válida no entra');
  const sig = `sha256=${createHmac('sha256', 'secreto-app').update(raw).digest('hex')}`;
  const r = await call('/api/webhooks/whatsapp', { method: 'POST', raw, headers: { 'X-Hub-Signature-256': sig } });
  assert.equal(r.data.received, 1);
  const again = await call('/api/webhooks/whatsapp', { method: 'POST', raw, headers: { 'X-Hub-Signature-256': sig } });
  assert.equal(again.data.received, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 1, 'el mismo mensaje no se duplica');

  const client = db.prepare("SELECT * FROM clients WHERE salon_id = 1 AND phone = '34611222333'").get();
  assert.equal(client.name, 'Marta Gil');
  const conv = db.prepare('SELECT * FROM conversations WHERE client_id = ?').get(client.id);
  assert.equal(conv.unread, 1);
  const ins = JSON.parse(db.prepare('SELECT data FROM client_insights WHERE client_id = ?').get(client.id).data);
  assert.ok(ins.tags.includes('Prepara eventos'));
  assert.ok(ins.tags.includes('Cuero cabelludo sensible o alergias'));
  assert.equal(ins.services[0].name, 'Mechas / balayage');
});

test('bandeja: listar, leer, responder en modo manual y aislamiento entre salones', async () => {
  const uno = await login('uno@x.com');
  const dos = await login('dos@x.com');
  const list = await call('/api/conversations', { cookie: uno });
  assert.equal(list.data.conversations.length, 1);
  assert.equal(list.data.counts.unread, 1);
  const id = list.data.conversations[0].id;
  const detail = await call(`/api/conversations/${id}`, { cookie: uno });
  assert.equal(detail.data.messages.length, 1);
  assert.ok(detail.data.templates.length >= 4, 'se crean plantillas por defecto');
  assert.equal((await call('/api/messages/summary', { cookie: uno })).data.unread, 0, 'abrirla la marca como leída');
  const sent = await call(`/api/conversations/${id}/messages`, { method: 'POST', cookie: uno, body: { text: 'Hola Marta, desde 95 €. ¿Te hacemos un diagnóstico?' } });
  assert.equal(sent.data.status, 'manual');
  assert.match(sent.data.link, /^https:\/\/wa\.me\/34611222333\?text=/);
  assert.equal((await call(`/api/conversations/${id}`, { cookie: dos })).status, 404);
  assert.equal((await call(`/api/conversations/${id}/messages`, { method: 'POST', cookie: dos, body: { text: 'x' } })).status, 404);
  const put = await call(`/api/conversations/${id}`, { method: 'PUT', cookie: uno, body: { status: 'cerrada' } });
  assert.equal(put.status, 200);
  const ficha = await call(`/api/clients/${detail.data.conversation.client_id}`, { cookie: uno });
  assert.equal(ficha.data.conversations.length, 1);
  assert.ok(ficha.data.insights.inboundCount >= 1);
});

test('mensaje nuevo a un cliente y mensajes entrantes por API', async () => {
  const uno = await login('uno@x.com');
  const c = await call('/api/clients', { method: 'POST', cookie: uno, body: { name: 'Lucía Pérez', phone: '600 111 222' } });
  const r = await call('/api/conversations', { method: 'POST', cookie: uno, body: { client_id: c.data.id, channel: 'whatsapp', text: 'Hola Lucía' } });
  assert.equal(r.status, 200);
  assert.ok(r.data.link.includes('34600111222'));
  const ing = await call('/api/ingest/messages', { method: 'POST', headers: { Authorization: 'Bearer sk_uno' }, body: { messages: [{ channel: 'whatsapp', from: '600111222', body: 'Gracias, me encanta', id: 'x1' }] } });
  assert.equal(ing.data.saved, 1);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(r.data.id);
  assert.equal(conv.unread, 1, 'la respuesta llega a la misma conversación');
});

test('análisis de conversación por reglas', () => {
  const a = analyzeConversation([
    { direction: 'in', body: '¿Tenéis hueco el sábado por la mañana con Laura?', created_at: '2026-09-01 10:00:00' },
    { direction: 'out', body: 'Sí, a las 10', created_at: '2026-09-01 10:20:00' },
    { direction: 'in', body: 'Genial, mil gracias, me encanta como queda', created_at: '2026-09-01 10:25:00' }
  ], { services: [], employees: ['Laura M.'] });
  assert.equal(a.mood, 'Muy satisfecha');
  assert.deepEqual(a.preferences, ['Sábados', 'Mañanas']);
  assert.ok(a.tags.includes('Confía en Laura M.'));
  assert.equal(a.responseMinutes, 20);
  const angry = analyzeConversation([{ direction: 'in', body: 'El color está fatal, no me ha gustado nada', created_at: '2026-09-01 10:00:00' }]);
  assert.equal(angry.mood, 'Molesta o preocupada');
});

test('webhook: extracción de mensajes y estados', () => {
  const out = parseWhatsAppWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: 'P' }, statuses: [{ id: 'w1', status: 'read' }], messages: [{ from: '346', id: 'w2', type: 'image' }] } }] }] });
  assert.equal(out.length, 2);
  assert.equal(out[0].body, '[Imagen recibida]');
  assert.equal(out[1].status, 'read');
  assert.equal(renderTemplate('Hola {nombre}, {otro}', { nombre: 'Ana' }), 'Hola Ana, {otro}');
});

test('recordatorios: a quién toca escribir', async () => {
  db.prepare("INSERT INTO clients (id, salon_id, name, phone) VALUES (900, 1, 'Rosa Díaz', '622333444'), (901, 1, 'Eva Gil', '622333555')").run();
  const client = (id) => ({ name: id === 900 ? 'Rosa Díaz' : 'Eva Gil', phone: id === 900 ? '622333444' : '622333555' });
  importTickets(db, 1, [
    // Rosa viene cada 30 días; su última visita fue hace 31: le toca volver.
    { ref: 'r1', date: '2026-06-16', client: client(900), lines: [{ name: 'Mechas / balayage', price: 95 }] },
    { ref: 'r2', date: '2026-07-16', client: client(900), lines: [{ name: 'Mechas / balayage', price: 95 }] },
    { ref: 'r3', date: '2026-08-15', client: client(900), lines: [{ name: 'Mechas / balayage', price: 95 }] },
    // Eva vino una vez hace 30 días: segunda visita.
    { ref: 'e1', date: '2026-08-16', client: client(901), lines: [{ name: 'Corte', price: 30 }] }
  ], 'api');
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const groups = Object.fromEntries(reminderSuggestions(db, salon).map((g) => [g.kind, g]));
  assert.ok(groups.recordatorio.items.some((i) => i.client_id === 900));
  assert.match(groups.recordatorio.items.find((i) => i.client_id === 900).text, /Hola Rosa/);
  assert.ok(groups.segunda_visita.items.some((i) => i.client_id === 901));
  const uno = await login('uno@x.com');
  const sent = await call('/api/reminders/send', { method: 'POST', cookie: uno, body: { items: [{ client_id: 900, kind: 'recordatorio', text: 'Hola Rosa' }] } });
  assert.equal(sent.data.results[0].status, 'manual');
  const after = Object.fromEntries(reminderSuggestions(db, salon).map((g) => [g.kind, g]));
  assert.ok(!after.recordatorio.items.some((i) => i.client_id === 900), 'no se repite un recordatorio recién enviado');
});

test('solicitudes de prueba desde la web y alta del salón', async () => {
  assert.equal((await call('/api/leads', { method: 'POST', body: { name: '' } })).status, 400);
  assert.equal((await call('/api/leads', { method: 'POST', body: { name: 'Ana' } })).status, 400, 'pide email o teléfono');
  const ok = await call('/api/leads', { method: 'POST', body: { name: 'Ana Peluquera', salon_name: 'Salón Ana', email: 'ana@salon.es', team_size: '3-5' } });
  assert.equal(ok.status, 200);
  const admin = await login('admin@x.com');
  assert.equal((await call('/api/admin/leads', { cookie: await login('uno@x.com') })).status, 403);
  const leads = await call('/api/admin/leads', { cookie: admin });
  assert.equal(leads.data.leads[0].salon_name, 'Salón Ana');
  const created = await call('/api/admin/salons', { method: 'POST', cookie: admin, body: { name: 'Salón Ana', owner_email: 'ana@salon.es', owner_password: 'contraseña1', lead_id: leads.data.leads[0].id } });
  assert.equal(created.status, 200);
  assert.equal(db.prepare('SELECT status FROM leads WHERE id = ?').get(leads.data.leads[0].id).status, 'en prueba');
});

test('primeros pasos y menú típico para un salón nuevo', async () => {
  const admin = await login('admin@x.com');
  const o = await call('/api/onboarding?salon=2', { cookie: admin });
  assert.equal(o.data.done, 0);
  const r = await call('/api/onboarding/starter-catalog?salon=2', { method: 'POST', cookie: admin, body: {} });
  assert.ok(r.data.services > 5);
  const o2 = await call('/api/onboarding?salon=2', { cookie: admin });
  assert.equal(o2.data.steps.find((s) => s.key === 'servicios').done, true);
});

test('la web comercial se sirve en / y la app en /app', async () => {
  const home = await fetch(`${base}/`);
  assert.match(await home.text(), /Prueba|prueba/);
  const app = await fetch(`${base}/app`);
  assert.match(await app.text(), /<div id="app">/);
  const css = await fetch(`${base}/app/styles.css`);
  assert.equal(css.status, 200);
});
