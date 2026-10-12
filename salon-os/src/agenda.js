/* Agenda del salón: horario, huecos libres por profesional, citas,
   reservas online, sincronización con agendas externas (API e iCal) y
   exportación a calendarios (Google, Apple, Outlook). */
import { randomBytes } from 'node:crypto';
import { today, addDays, isDate } from './dates.js';

export const TZ = process.env.SALON_TZ || 'Europe/Madrid';
export const DEFAULT_SCHEDULE = { 0: null, 1: ['09:30', '20:00'], 2: ['09:30', '20:00'], 3: ['09:30', '20:00'], 4: ['09:30', '20:00'], 5: ['09:30', '20:00'], 6: ['09:00', '14:00'] };
export const STEP = 15;
const MIN_ADVANCE = 60; // minutos mínimos de antelación para reservar online
const MAX_DAYS = 45;

export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const token = () => randomBytes(16).toString('hex');

/* Fecha y minuto actuales en la zona del salón (o fijados para tests). */
export function nowLocal() {
  if (process.env.SALON_TODAY) return { date: process.env.SALON_TODAY, minutes: process.env.SALON_NOW ? toMin(process.env.SALON_NOW) : 0 };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function scheduleOf(salon) {
  try {
    const s = salon.schedule ? JSON.parse(salon.schedule) : null;
    if (s && typeof s === 'object') return { ...DEFAULT_SCHEDULE, ...s };
  } catch { /* horario por defecto */ }
  return { ...DEFAULT_SCHEDULE };
}

export function validateSchedule(input) {
  const out = {};
  for (let d = 0; d < 7; d++) {
    const v = input?.[d] ?? input?.[String(d)];
    if (!v) { out[d] = null; continue; }
    if (!Array.isArray(v) || !isTime(v[0]) || !isTime(v[1]) || toMin(v[1]) <= toMin(v[0])) throw new Error('Horario no válido');
    out[d] = [v[0], v[1]];
  }
  return out;
}

export function ensureBookingSetup(db, salon) {
  if (salon.booking_slug && salon.calendar_token) return salon;
  let slug = salon.booking_slug;
  if (!slug) {
    const baseSlug = salon.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';
    slug = baseSlug;
    for (let i = 2; db.prepare('SELECT 1 FROM salons WHERE booking_slug = ? AND id <> ?').get(slug, salon.id); i++) slug = `${baseSlug}-${i}`;
  }
  const cal = salon.calendar_token || token();
  db.prepare('UPDATE salons SET booking_slug = ?, calendar_token = ? WHERE id = ?').run(slug, cal, salon.id);
  return { ...salon, booking_slug: slug, calendar_token: cal };
}

/* Servicios elegidos → líneas con duración y precio del menú. */
export function servicesFor(db, salonId, ids) {
  const list = (Array.isArray(ids) ? ids : []).slice(0, 10).map(Number).filter(Boolean);
  const rows = list.map((id) => db.prepare('SELECT id, name, duration_min, price FROM services WHERE id = ? AND salon_id = ? AND active = 1').get(id, salonId)).filter(Boolean);
  if (!rows.length) throw new Error('Elige al menos un servicio');
  return rows;
}

function busyByEmployee(db, salonId, date, ignoreId = null) {
  const busy = new Map();
  for (const a of db.prepare("SELECT id, employee_id, start, end FROM appointments WHERE salon_id = ? AND date = ? AND status NOT IN ('cancelada', 'no_presentada')").all(salonId, date)) {
    if (a.id === ignoreId) continue;
    if (!busy.has(a.employee_id)) busy.set(a.employee_id, []);
    busy.get(a.employee_id).push([toMin(a.start), toMin(a.end)]);
  }
  return busy;
}

/* Huecos libres de un día para una duración. Devuelve [{time, employees:[id]}]. */
export function availableSlots(db, salon, { date, duration, employeeId = null, ignoreId = null, forPublic = false }) {
  if (!isDate(date) || !(duration > 0)) return [];
  const hours = scheduleOf(salon)[weekday(date)];
  if (!hours) return [];
  const now = nowLocal();
  if (date < now.date) return [];
  if (forPublic && date > addDays(now.date, MAX_DAYS)) return [];
  const open = toMin(hours[0]);
  const close = toMin(hours[1]);
  const emps = db.prepare('SELECT id FROM employees WHERE salon_id = ? AND active = 1 ORDER BY id').all(salon.id).map((e) => e.id)
    .filter((id) => !employeeId || id === Number(employeeId));
  const busy = busyByEmployee(db, salon.id, date, ignoreId);
  const earliest = date === now.date ? now.minutes + (forPublic ? MIN_ADVANCE : 0) : 0;
  const slots = [];
  for (let t = open; t + duration <= close; t += STEP) {
    if (t < earliest) continue;
    const free = emps.filter((id) => !(busy.get(id) || []).some(([a, b]) => t < b && t + duration > a));
    if (free.length) slots.push({ time: fromMin(t), employees: free });
  }
  return slots;
}

/* Elige profesional: el pedido, o el libre con menos citas ese día. */
function pickEmployee(db, salon, date, start, duration, employeeId, ignoreId) {
  const slot = availableSlots(db, salon, { date, duration, employeeId, ignoreId }).find((s) => s.time === start);
  if (!slot) return null;
  if (employeeId) return Number(employeeId);
  const load = new Map(db.prepare("SELECT employee_id, COUNT(*) AS n FROM appointments WHERE salon_id = ? AND date = ? AND status <> 'cancelada' GROUP BY employee_id").all(salon.id, date).map((r) => [r.employee_id, r.n]));
  return [...slot.employees].sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0))[0];
}

export function createAppointment(db, salon, { clientId = null, clientName = '', clientPhone = '', employeeId = null, date, start, serviceIds, notes = '', status = 'confirmada', source = 'salon', ignoreAvailability = false }) {
  if (!isDate(date) || !isTime(start)) throw new Error('Elige día y hora');
  const services = servicesFor(db, salon.id, serviceIds);
  const duration = services.reduce((s, x) => s + (x.duration_min || 15), 0);
  let emp = employeeId ? Number(employeeId) : null;
  if (!ignoreAvailability) {
    emp = pickEmployee(db, salon, date, start, duration, employeeId, null);
    if (!emp) throw new Error('Ese hueco ya no está libre. Elige otra hora.');
  }
  const r = db.prepare(`INSERT INTO appointments (salon_id, client_id, client_name, client_phone, employee_id, date, start, end, status, source, notes, token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(salon.id, clientId, clientName, clientPhone, emp, date, start, fromMin(toMin(start) + duration), status, source, notes, token());
  const id = Number(r.lastInsertRowid);
  const ins = db.prepare('INSERT INTO appointment_services (appointment_id, service_id, name, duration_min, price) VALUES (?, ?, ?, ?, ?)');
  for (const sv of services) ins.run(id, sv.id, sv.name, sv.duration_min, sv.price);
  return getAppointment(db, salon.id, id);
}

export function rescheduleAppointment(db, salon, id, { date, start, employeeId = null }) {
  const a = getAppointment(db, salon.id, id);
  if (!a) throw new Error('Cita no encontrada');
  const duration = toMin(a.end) - toMin(a.start);
  const emp = pickEmployee(db, salon, date, start, duration, employeeId, a.id);
  if (!emp) throw new Error('Ese hueco no está libre. Elige otra hora.');
  db.prepare('UPDATE appointments SET date = ?, start = ?, end = ?, employee_id = ? WHERE id = ?').run(date, start, fromMin(toMin(start) + duration), emp, a.id);
  return getAppointment(db, salon.id, a.id);
}

export function getAppointment(db, salonId, id) {
  const a = db.prepare(`SELECT a.*, e.name AS employee_name, c.name AS client_full_name, c.phone AS client_full_phone
      FROM appointments a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.id = ? AND a.salon_id = ?`).get(id, salonId);
  if (!a) return null;
  return {
    ...a,
    client_name: a.client_full_name || a.client_name,
    client_phone: a.client_full_phone || a.client_phone,
    services: db.prepare('SELECT service_id, name, duration_min, price FROM appointment_services WHERE appointment_id = ? ORDER BY id').all(a.id)
  };
}

export function listAppointments(db, salonId, from, to, { clientId = null } = {}) {
  const rows = db.prepare(`SELECT a.*, e.name AS employee_name, c.name AS client_full_name, c.phone AS client_full_phone
      FROM appointments a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.salon_id = ? AND a.date >= ? AND a.date < ? ${clientId ? 'AND a.client_id = ?' : ''} ORDER BY a.date, a.start`)
    .all(...[salonId, from, to, ...(clientId ? [clientId] : [])]);
  const svc = db.prepare('SELECT name, duration_min, price, service_id FROM appointment_services WHERE appointment_id = ? ORDER BY id');
  return rows.map((a) => ({ ...a, client_name: a.client_full_name || a.client_name, client_phone: a.client_full_phone || a.client_phone, services: svc.all(a.id) }));
}

/* ---- Citas que llegan de otros sistemas (Booksy, Treatwell, Fresha…) ---- */
const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const STATUS_MAP = { confirmed: 'confirmada', confirmada: 'confirmada', pending: 'pendiente', pendiente: 'pendiente', cancelled: 'cancelada', canceled: 'cancelada', cancelada: 'cancelada', completed: 'completada', completada: 'completada', no_show: 'no_presentada', noshow: 'no_presentada', no_presentada: 'no_presentada' };

function findOrCreateClient(db, salonId, c) {
  if (!c || !String(c.name ?? '').trim()) return { id: null, name: '', phone: '' };
  const ph = digits(c.phone).slice(-9);
  if (ph.length === 9) {
    for (const row of db.prepare("SELECT id, name, phone FROM clients WHERE salon_id = ? AND phone <> ''").all(salonId)) {
      if (digits(row.phone).slice(-9) === ph) return row;
    }
  } else {
    const byName = db.prepare('SELECT id, name, phone FROM clients WHERE salon_id = ? AND lower(name) = lower(?)').get(salonId, String(c.name).trim());
    if (byName) return byName;
  }
  const r = db.prepare('INSERT INTO clients (salon_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)').run(salonId, String(c.name).trim(), String(c.phone ?? '').trim(), String(c.email ?? '').trim(), today());
  return { id: Number(r.lastInsertRowid), name: String(c.name).trim(), phone: String(c.phone ?? '') };
}

/* Inserta o actualiza citas externas por su referencia (idempotente). */
export function upsertExternalAppointments(db, salon, list, source = 'api') {
  const res = { created: 0, updated: 0, cancelled: 0, errors: [] };
  const emps = new Map(db.prepare('SELECT id, name FROM employees WHERE salon_id = ?').all(salon.id).map((e) => [norm(e.name), e.id]));
  const services = db.prepare('SELECT id, name, duration_min, price FROM services WHERE salon_id = ?').all(salon.id);
  list.forEach((a, i) => {
    const ref = String(a.ref ?? a.id ?? '').trim();
    const start = String(a.start ?? '').slice(0, 5);
    if (!ref) return res.errors.push({ index: i, error: 'falta la referencia (ref)' });
    if (!isDate(a.date) || !isTime(start)) return res.errors.push({ index: i, ref, error: 'fecha u hora no válidas' });
    const extRef = `${a.source || source}:${ref}`;
    const status = STATUS_MAP[norm(a.status)] || 'confirmada';
    const lines = (Array.isArray(a.services) ? a.services : []).map((s) => {
      const m = services.find((x) => norm(x.name) === norm(s.name));
      return { id: m?.id ?? null, name: String(s.name ?? m?.name ?? 'Servicio'), duration: Number(s.duration) > 0 ? Number(s.duration) : m?.duration_min || 30, price: Number(s.price) >= 0 && s.price !== undefined ? Number(s.price) : m?.price || 0 };
    });
    const duration = a.end && isTime(String(a.end).slice(0, 5)) ? toMin(String(a.end).slice(0, 5)) - toMin(start) : (Number(a.duration) > 0 ? Number(a.duration) : lines.reduce((s, l) => s + l.duration, 0) || 30);
    const end = fromMin(toMin(start) + Math.max(5, duration));
    const empId = a.employee ? emps.get(norm(a.employee)) ?? null : null;
    const client = findOrCreateClient(db, salon.id, a.client);
    const existing = db.prepare('SELECT id, status FROM appointments WHERE salon_id = ? AND external_ref = ?').get(salon.id, extRef);
    if (existing) {
      db.prepare('UPDATE appointments SET date = ?, start = ?, end = ?, status = ?, employee_id = COALESCE(?, employee_id), notes = ? WHERE id = ?')
        .run(a.date, start, end, status, empId, String(a.notes ?? ''), existing.id);
      if (status === 'cancelada' && existing.status !== 'cancelada') res.cancelled++; else res.updated++;
      return;
    }
    const r = db.prepare(`INSERT INTO appointments (salon_id, client_id, client_name, client_phone, employee_id, date, start, end, status, source, external_ref, notes, token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(salon.id, client.id, client.name || String(a.client?.name ?? ''), client.phone || '', empId, a.date, start, end, status, a.source || source, extRef, String(a.notes ?? ''), token());
    const id = Number(r.lastInsertRowid);
    for (const l of lines) db.prepare('INSERT INTO appointment_services (appointment_id, service_id, name, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(id, l.id, l.name, l.duration, l.price);
    res.created++;
  });
  return res;
}

/* ---- iCal (.ics): leer calendarios externos y publicar la agenda ---- */
function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
const icsText = (v) => String(v ?? '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/* Convierte una fecha-hora de iCal a fecha y hora locales del salón. */
function icsDateTime(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!m || !m[4]) return null; // eventos de día completo: no son citas
  if (m[7] === 'Z') {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  void params; // TZID: se asume la zona del salón
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

export function parseIcs(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    cur[name.toUpperCase()] = { value: line.slice(i + 1), params };
  }
  return events.map((e) => {
    const start = e.DTSTART && icsDateTime(e.DTSTART.value, e.DTSTART.params);
    const end = e.DTEND && icsDateTime(e.DTEND.value, e.DTEND.params);
    return {
      uid: e.UID?.value || '',
      summary: icsText(e.SUMMARY?.value),
      description: icsText(e.DESCRIPTION?.value),
      status: (e.STATUS?.value || '').toUpperCase(),
      start, end
    };
  }).filter((e) => e.uid && e.start);
}

/* Convierte eventos de un calendario externo en citas. El título suele
   llevar el nombre de la clienta y el servicio ("Marta Gil - Color raíz"). */
export function icsToAppointments(db, salonId, events, { feedId, employeeName = null }) {
  const services = db.prepare('SELECT name FROM services WHERE salon_id = ? ORDER BY length(name) DESC').all(salonId).map((s) => s.name);
  const t = today();
  return events.filter((e) => e.start.date >= addDays(t, -7) && e.start.date <= addDays(t, 90)).map((e) => {
    const text = `${e.summary}`;
    const found = services.filter((s) => norm(text).includes(norm(s)));
    let name = text;
    for (const s of found) name = name.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), '');
    name = name.replace(/[-–·:|()]+/g, ' ').replace(/\s+/g, ' ').trim();
    const phone = (e.description.match(/(\+?\d[\d\s]{8,})/) || [])[1] || '';
    return {
      ref: `${feedId}:${e.uid}`,
      source: 'ical',
      date: e.start.date,
      start: e.start.time,
      end: e.end && e.end.date === e.start.date ? e.end.time : null,
      status: e.status === 'CANCELLED' ? 'cancelada' : 'confirmada',
      employee: employeeName,
      client: name ? { name, phone } : null,
      services: found.map((s) => ({ name: s })),
      notes: e.description.slice(0, 500)
    };
  });
}

export async function syncFeed(db, salon, feed) {
  try {
    const res = await fetch(feed.url.replace(/^webcal:/i, 'https:'), { headers: { Accept: 'text/calendar' } });
    if (!res.ok) throw new Error(`El calendario respondió ${res.status}`);
    const events = parseIcs(await res.text());
    const emp = feed.employee_id ? db.prepare('SELECT name FROM employees WHERE id = ?').get(feed.employee_id)?.name : null;
    const r = upsertExternalAppointments(db, salon, icsToAppointments(db, salon.id, events, { feedId: feed.id, employeeName: emp }), 'ical');
    const msg = `${r.created} nuevas, ${r.updated} actualizadas${r.cancelled ? `, ${r.cancelled} canceladas` : ''}`;
    db.prepare("UPDATE calendar_feeds SET last_sync = datetime('now'), last_result = ? WHERE id = ?").run(msg, feed.id);
    return { ok: true, ...r, message: msg };
  } catch (err) {
    db.prepare("UPDATE calendar_feeds SET last_sync = datetime('now'), last_result = ? WHERE id = ?").run(`Error: ${err.message}`, feed.id);
    return { ok: false, error: err.message };
  }
}

export async function syncAllFeeds(db) {
  for (const feed of db.prepare('SELECT * FROM calendar_feeds').all()) {
    const salon = db.prepare('SELECT * FROM salons WHERE id = ? AND active = 1').get(feed.salon_id);
    if (salon) await syncFeed(db, salon, feed);
  }
}

const icsEscape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
const icsLocal = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

/* Agenda del salón como calendario suscribible (próximas 8 semanas). */
export function agendaIcs(db, salon) {
  const t = today();
  const rows = listAppointments(db, salon.id, addDays(t, -7), addDays(t, 56)).filter((a) => a.status !== 'cancelada');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SalonPro//Agenda//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEscape(salon.name)}`, `X-WR-TIMEZONE:${TZ}`];
  for (const a of rows) {
    lines.push('BEGIN:VEVENT', `UID:salonos-${salon.id}-${a.id}`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZ}:${icsLocal(a.date, a.start)}`, `DTEND;TZID=${TZ}:${icsLocal(a.date, a.end)}`,
      `SUMMARY:${icsEscape(`${a.client_name || 'Cita'} · ${a.services.map((s) => s.name).join(' + ')}`)}`,
      `DESCRIPTION:${icsEscape([a.employee_name ? `Con ${a.employee_name}` : '', a.client_phone, a.notes].filter(Boolean).join('\n'))}`,
      `STATUS:${a.status === 'pendiente' ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* Una cita como archivo .ics para que la clienta la guarde en su calendario. */
export function appointmentIcs(salon, a) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SalonPro//Cita//ES', 'BEGIN:VEVENT', `UID:salonos-cita-${a.token}`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${TZ}:${icsLocal(a.date, a.start)}`, `DTEND;TZID=${TZ}:${icsLocal(a.date, a.end)}`,
    `SUMMARY:${icsEscape(`${a.services.map((s) => s.name).join(' + ')} en ${salon.name}`)}`,
    `LOCATION:${icsEscape(`${salon.name}${salon.city ? `, ${salon.city}` : ''}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/* Citas de mañana sin recordatorio enviado: para el grupo "Citas de mañana". */
export function tomorrowAppointments(db, salonId) {
  const t = addDays(nowLocal().date, 1);
  return listAppointments(db, salonId, t, addDays(t, 1)).filter((a) => ['pendiente', 'confirmada'].includes(a.status));
}
