/* Servidor HTTP: API JSON + archivos estáticos de la interfaz.
   Sin dependencias: solo módulos de Node. */
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { tx } from './db.js';
import { hashPassword, verifyPassword, createSession, sessionUser, destroySession, parseCookies, newApiKey, loginAllowed, loginFailed, rateLimiter } from './auth.js';
import {
  AccountError, signup, signupOpen, trialInfo, trialDays, createResetToken, resetPassword, resetLink,
  listTeamUsers, createTeamUser, updateTeamUser, deleteTeamUser
} from './accounts.js';
import { mailConfigured, sendPlatformEmail } from './mailer.js';
import { migrate, migrationSchema } from './migration.js';
import { history, clientMoney } from './history.js';
import { dashboard } from './metrics.js';
import { listClients, clientDetail } from './clients.js';
import { importTickets, importHours, normGender, normTime } from './importer.js';
import { csvToTickets } from './csv.js';
import { networkOverview, purchaseSignal } from './network.js';
import { today, currentMonth, isMonth, isDate, addMonths, monthStart, periodRange, addDays as addDaysIso } from './dates.js';
import {
  listConversations, conversationDetail, getOrCreateConversation, sendMessage, recordInbound, reminderSuggestions,
  ensureTemplates, channelsFor, channelStatus, parseWhatsAppWebhook, phoneKey
} from './messaging.js';
import { getInsights, refreshClientInsights } from './insights.js';
import { aiAvailable, aiClientSummary } from './ai.js';
import { onboardingSteps, loadStarterCatalog } from './onboarding.js';
import { serviceTimes, reportData, reportXlsx } from './servicetimes.js';
import {
  scheduleOf, validateSchedule, ensureBookingSetup, availableSlots, createAppointment, rescheduleAppointment, getAppointment,
  listAppointments, upsertExternalAppointments, syncFeed, agendaIcs, appointmentIcs, nowLocal, toMin, nextAvailability
} from './agenda.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.csv': 'text/csv; charset=utf-8' };
const MAX_BODY = 12 * 1024 * 1024;
const METHODS = ['tarjeta', 'efectivo', 'bizum', 'transferencia', 'otro'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (msg = 'No encontrado') => new HttpError(404, msg);

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const money = (v, field) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e7) throw bad(`${field}: importe no válido`);
  return Math.round(n * 100) / 100;
};
const round2 = (n) => Math.round(n * 100) / 100;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Archivo demasiado grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({ parsed: {}, raw: '' });
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve({ parsed: JSON.parse(raw), raw }); }
      catch { reject(bad('JSON no válido')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

/* ---------- Rutas ---------- */

export function createApp(db) {
  const routes = [];
  const on = (method, path, auth, handler) => {
    const keys = [];
    const PARAM = { slug: '([a-z0-9-]{1,80})', token: '([a-f0-9]{16,64})' };
    const re = new RegExp(`^${path.replace(/\./g, '\\.').replace(/:(\w+)/g, (_, k) => { keys.push(k); return PARAM[k] || '(\\d+)'; })}$`);
    routes.push({ method, re, keys, auth, handler });
  };

  const salonById = (id) => db.prepare('SELECT * FROM salons WHERE id = ?').get(id);

  /* El dueño trabaja siempre con su salón; el distribuidor elige con ?salon=ID. */
  function salonFor(ctx) {
    const { user, query } = ctx;
    const id = user.role === 'admin' ? Number(query.get('salon')) : user.salon_id;
    if (!id) throw bad('Elige un salón');
    const s = salonById(id);
    if (!s) throw notFound('Salón no encontrado');
    return s;
  }

  const owned = (table, id, salonId) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND salon_id = ?`).get(id, salonId);
    if (!row) throw notFound();
    return row;
  };

  /* --- Sesión --- */
  on('POST', '/api/login', 'none', ({ body, ip }) => {
    if (!loginAllowed(ip)) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(str(body.email).toLowerCase());
    if (!u || !verifyPassword(body.password ?? '', u.password_hash)) {
      loginFailed(ip);
      throw new HttpError(401, 'Email o contraseña incorrectos');
    }
    if (!u.active) throw new HttpError(403, 'Tu usuario está desactivado. Habla con el dueño del salón.');
    const s = createSession(db, u.id);
    return { status: 200, body: { ok: true }, cookie: { value: s.token, maxAge: s.maxAge } };
  });

  on('POST', '/api/logout', 'none', ({ cookies }) => {
    destroySession(db, cookies.sid);
    return { status: 200, body: { ok: true }, cookie: { value: '', maxAge: 0 } };
  });

  on('GET', '/api/me', 'team', ({ user }) => {
    const salon = user.salon_id ? ensureBookingSetup(db, salonById(user.salon_id)) : null;
    return {
      user,
      salon,
      trial: trialInfo(salon),
      support: { email: process.env.SUPPORT_EMAIL || '', phone: process.env.SUPPORT_PHONE || '' },
      salons: user.role === 'admin' ? db.prepare('SELECT id, name, city FROM salons ORDER BY name').all() : [],
      today: today()
    };
  });

  /* --- Alta libre y recuperar la contraseña --- */
  const signups = rateLimiter(5, 3600000);
  const forgots = rateLimiter(5, 3600000);
  const account = (fn) => {
    try { return fn(); } catch (err) { if (err instanceof AccountError) throw bad(err.message); throw err; }
  };

  on('POST', '/api/signup', 'none', ({ body, ip }) => {
    if (!signupOpen()) throw new HttpError(403, 'El alta libre está cerrada. Pide tu prueba en la web y te damos acceso.');
    if (body.website) return { status: 200, body: { ok: true } }; // campo trampa para bots
    if (!signups.allowed(ip)) throw new HttpError(429, 'Has creado varias cuentas seguidas. Inténtalo más tarde.');
    const { userId } = account(() => signup(db, body));
    signups.hit(ip);
    const s = createSession(db, userId);
    return { status: 200, body: { ok: true, trial_days: trialDays() }, cookie: { value: s.token, maxAge: s.maxAge } };
  });

  on('POST', '/api/password/forgot', 'none', async ({ body, ip, origin }) => {
    if (!forgots.allowed(ip)) throw new HttpError(429, 'Demasiadas peticiones. Espera unos minutos.');
    forgots.hit(ip);
    if (!mailConfigured()) {
      return { ok: false, mail: false, message: 'El envío de emails aún no está activado. Pide a tu dueño o a tu distribuidor un enlace para cambiar la contraseña.' };
    }
    const u = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND active = 1').get(str(body.email, 120).toLowerCase());
    if (u) {
      const link = resetLink(origin, createResetToken(db, u.id));
      await sendPlatformEmail({
        to: u.email,
        subject: 'Cambia tu contraseña de SalonPro',
        text: `Hola${u.name ? ` ${u.name}` : ''}:\n\nPara elegir una contraseña nueva, abre este enlace (caduca en 24 horas):\n${link}\n\nSi no lo has pedido tú, ignora este mensaje.\n\nSalonPro`
      });
    }
    // Misma respuesta exista o no la cuenta, para no revelar qué emails están dados de alta.
    return { ok: true, mail: true, message: 'Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña.' };
  });

  on('POST', '/api/password/reset', 'none', ({ body }) => {
    const userId = account(() => resetPassword(db, body.token, body.password));
    const s = createSession(db, userId);
    return { status: 200, body: { ok: true }, cookie: { value: s.token, maxAge: s.maxAge } };
  });

  /* --- Usuarios del equipo (solo el dueño) --- */
  on('GET', '/api/team/users', 'user', (ctx) => ({ users: listTeamUsers(db, salonFor(ctx).id), mail: mailConfigured() }));
  on('POST', '/api/team/users', 'user', (ctx) => account(() => createTeamUser(db, salonFor(ctx).id, ctx.body)));
  on('PUT', '/api/team/users/:id', 'user', (ctx) => account(() => updateTeamUser(db, salonFor(ctx).id, Number(ctx.params.id), ctx.user.id, ctx.body)));
  on('DELETE', '/api/team/users/:id', 'user', (ctx) => account(() => deleteTeamUser(db, salonFor(ctx).id, Number(ctx.params.id), ctx.user.id)));
  on('POST', '/api/team/users/:id/reset-link', 'user', (ctx) => {
    const u = db.prepare('SELECT id FROM users WHERE id = ? AND salon_id = ?').get(Number(ctx.params.id), salonFor(ctx).id);
    if (!u) throw notFound('Usuario no encontrado');
    return { link: resetLink(ctx.origin, createResetToken(db, u.id)) };
  });

  on('POST', '/api/password', 'team', ({ user, body }) => {
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(body.current ?? '', u.password_hash)) throw bad('La contraseña actual no es correcta');
    if (String(body.next ?? '').length < 8) throw bad('La nueva contraseña debe tener al menos 8 caracteres');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.next), user.id);
    return { ok: true };
  });

  /* --- Panel --- */
  on('GET', '/api/dashboard', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const period = ['month', 'quarter', 'year'].includes(ctx.query.get('period')) ? ctx.query.get('period') : 'month';
    const ref = isMonth(ctx.query.get('ref')) ? ctx.query.get('ref') : currentMonth();
    return { salon: { id: salon.id, name: salon.name }, ...dashboard(db, salon, period, ref), signal: purchaseSignal(db, salon.id) };
  });

  /* --- Clientes --- */
  on('GET', '/api/clients', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return listClients(db, salon.id, { q: ctx.query.get('q') || '', filter: ctx.query.get('filter') || 'todos' });
  });
  on('GET', '/api/clients/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const d = clientDetail(db, salon.id, Number(ctx.params.id));
    if (!d) throw notFound('Cliente no encontrado');
    const conversations = db.prepare('SELECT id, channel, status, last_message_at, last_preview, unread FROM conversations WHERE client_id = ? ORDER BY last_message_at DESC').all(d.client.id);
    const appointments = listAppointments(db, salon.id, addDaysIso(nowLocal().date, -1), addDaysIso(nowLocal().date, 120), { clientId: d.client.id }).filter((x) => x.status !== 'cancelada');
    return { ...d, insights: getInsights(db, d.client.id), conversations, appointments, money: clientMoney(db, salon.id, d.client.id) };
  });
  const clientFields = (b) => {
    const name = str(b.name, 120);
    if (!name) throw bad('El nombre es obligatorio');
    return [name, str(b.phone, 40), str(b.email, 120), normGender(b.gender), str(b.notes, 2000)];
  };
  on('POST', '/api/clients', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const r = db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(salon.id, ...clientFields(ctx.body), today());
    return { id: Number(r.lastInsertRowid) };
  });
  on('PUT', '/api/clients/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    owned('clients', Number(ctx.params.id), salon.id);
    db.prepare('UPDATE clients SET name = ?, phone = ?, email = ?, gender = ?, notes = ? WHERE id = ?').run(...clientFields(ctx.body), Number(ctx.params.id));
    return { ok: true };
  });

  /* --- Catálogo: equipo, servicios, productos --- */
  on('GET', '/api/catalog', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return {
      employees: db.prepare('SELECT * FROM employees WHERE salon_id = ? ORDER BY active DESC, name').all(salon.id),
      services: db.prepare('SELECT * FROM services WHERE salon_id = ? ORDER BY active DESC, category, name').all(salon.id),
      products: db.prepare('SELECT * FROM products WHERE salon_id = ? ORDER BY active DESC, kind, name').all(salon.id)
    };
  });
  const catalog = {
    employees: (b) => ({ cols: ['name', 'role', 'active'], vals: [str(b.name, 80), str(b.role, 80), b.active === false ? 0 : 1] }),
    services: (b) => ({
      cols: ['name', 'category', 'gender', 'price', 'duration_min', 'active'],
      vals: [str(b.name, 120), str(b.category, 80), normGender(b.gender), money(b.price ?? 0, 'Precio'), Math.max(0, Math.min(600, Math.round(Number(b.duration_min) || 0))), b.active === false ? 0 : 1]
    }),
    products: (b) => ({
      cols: ['name', 'kind', 'price', 'cost', 'active'],
      vals: [str(b.name, 120), b.kind === 'tecnico' ? 'tecnico' : 'retail', money(b.price ?? 0, 'Precio'), money(b.cost ?? 0, 'Coste'), b.active === false ? 0 : 1]
    })
  };
  for (const [table, fields] of Object.entries(catalog)) {
    on('POST', `/api/${table}`, 'user', (ctx) => {
      const salon = salonFor(ctx);
      const { cols, vals } = fields(ctx.body);
      if (!vals[0]) throw bad('El nombre es obligatorio');
      const r = db.prepare(`INSERT INTO ${table} (salon_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(salon.id, ...vals);
      return { id: Number(r.lastInsertRowid) };
    });
    on('PUT', `/api/${table}/:id`, 'user', (ctx) => {
      const salon = salonFor(ctx);
      owned(table, Number(ctx.params.id), salon.id);
      const { cols, vals } = fields(ctx.body);
      if (!vals[0]) throw bad('El nombre es obligatorio');
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...vals, Number(ctx.params.id));
      return { ok: true };
    });
  }

  /* --- Cobro manual (para salones sin TPV integrado) --- */
  on('POST', '/api/tickets', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const date = b.date ? str(b.date, 10) : today();
    if (!isDate(date)) throw bad('Fecha no válida');
    const method = METHODS.includes(b.method) ? b.method : 'tarjeta';
    const employee = b.employee_id ? owned('employees', Number(b.employee_id), salon.id) : null;
    if (!Array.isArray(b.lines) || !b.lines.length) throw bad('Añade al menos un servicio o producto');
    const lines = b.lines.map((l) => {
      const kind = l.kind === 'product' ? 'product' : 'service';
      const item = owned(kind === 'product' ? 'products' : 'services', Number(l.item_id), salon.id);
      const qty = Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1)));
      const price = l.price != null && l.price !== '' ? money(l.price, item.name) : item.price;
      const emp = l.employee_id ? owned('employees', Number(l.employee_id), salon.id).id : employee?.id ?? null;
      return { kind, item, qty, price, total: round2(price * qty), emp, duration: kind === 'service' ? item.duration_min : 0 };
    });
    return tx(db, () => {
      let clientId = null;
      if (b.client_id) clientId = owned('clients', Number(b.client_id), salon.id).id;
      else if (b.new_client && str(b.new_client.name)) {
        clientId = Number(db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(salon.id, str(b.new_client.name, 120), str(b.new_client.phone, 40), str(b.new_client.email, 120), normGender(b.new_client.gender), date).lastInsertRowid);
      }
      const total = round2(lines.reduce((s, l) => s + l.total, 0));
      // Con cronómetro, la hora de inicio es la del servicio en curso.
      const visit = b.open_visit_id ? owned('open_visits', Number(b.open_visit_id), salon.id) : null;
      const ts = normTime(b.time_start);
      const te = normTime(b.time_end);
      const timeSource = ts && te ? (visit ? 'cronometro' : 'manual') : '';
      const t = db.prepare(`INSERT INTO tickets (salon_id, client_id, employee_id, date, time_start, time_end, method, total, source, time_source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`).run(salon.id, clientId, employee?.id ?? null, date, ts, te, method, total, timeSource);
      if (visit) db.prepare('DELETE FROM open_visits WHERE id = ?').run(visit.id);
      const apptId = visit?.appointment_id || (b.appointment_id ? owned('appointments', Number(b.appointment_id), salon.id).id : null);
      if (apptId) db.prepare("UPDATE appointments SET status = 'completada', ticket_id = ? WHERE id = ?").run(Number(t.lastInsertRowid), apptId);
      const tid = Number(t.lastInsertRowid);
      const ins = db.prepare('INSERT INTO ticket_lines (ticket_id, kind, item_id, name, qty, unit_price, total, employee_id, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const l of lines) ins.run(tid, l.kind, l.item.id, l.item.name, l.qty, l.price, l.total, l.emp, l.duration);
      return { id: tid, total, client_id: clientId };
    });
  });
  on('DELETE', '/api/tickets/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const t = owned('tickets', Number(ctx.params.id), salon.id);
    if (db.prepare('SELECT 1 FROM cash_closings WHERE salon_id = ? AND date = ?').get(salon.id, t.date)) throw bad('La caja de ese día ya está cerrada');
    db.prepare('DELETE FROM tickets WHERE id = ?').run(t.id);
    return { ok: true };
  });

  /* --- Caja del día --- */
  function cashDay(salon, date) {
    const tickets = db.prepare(`SELECT t.id, t.time_start, t.time_end, t.method, t.total, t.source, c.name AS client, e.name AS employee,
        (SELECT group_concat(name, ' + ') FROM ticket_lines WHERE ticket_id = t.id) AS concept
        FROM tickets t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN employees e ON e.id = t.employee_id
        WHERE t.salon_id = ? AND t.date = ? ORDER BY COALESCE(t.time_start, '99'), t.id`).all(salon.id, date);
    const movements = db.prepare('SELECT * FROM cash_movements WHERE salon_id = ? AND date = ? ORDER BY id').all(salon.id, date);
    const byMethod = {};
    for (const t of tickets) byMethod[t.method] = round2((byMethod[t.method] || 0) + t.total);
    for (const m of movements.filter((x) => x.direction === 'in')) byMethod[m.method] = round2((byMethod[m.method] || 0) + m.amount);
    const inTotal = round2(tickets.reduce((s, t) => s + t.total, 0) + movements.filter((m) => m.direction === 'in').reduce((s, m) => s + m.amount, 0));
    const outTotal = round2(movements.filter((m) => m.direction === 'out').reduce((s, m) => s + m.amount, 0));
    const closing = db.prepare('SELECT * FROM cash_closings WHERE salon_id = ? AND date = ?').get(salon.id, date) || null;
    const opening = closing ? closing.opening : salon.opening_float;
    const cashIn = byMethod.efectivo || 0;
    const cashOut = movements.filter((m) => m.direction === 'out' && m.method === 'efectivo').reduce((s, m) => s + m.amount, 0);
    return {
      date, tickets, movements, byMethod, inTotal, outTotal, net: round2(inTotal - outTotal),
      cash: { opening, cashIn, cashOut: round2(cashOut), expected: round2(opening + cashIn - cashOut) },
      closing,
      recentClosings: db.prepare('SELECT date, expected, counted, diff FROM cash_closings WHERE salon_id = ? ORDER BY date DESC LIMIT 7').all(salon.id)
    };
  }
  on('GET', '/api/cash', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const date = isDate(ctx.query.get('date')) ? ctx.query.get('date') : today();
    return cashDay(salon, date);
  });
  on('POST', '/api/cash/movements', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const date = isDate(b.date) ? b.date : today();
    if (db.prepare('SELECT 1 FROM cash_closings WHERE salon_id = ? AND date = ?').get(salon.id, date)) throw bad('La caja de ese día ya está cerrada');
    const amount = money(b.amount, 'Importe');
    if (!amount) throw bad('El importe debe ser mayor que 0');
    const r = db.prepare('INSERT INTO cash_movements (salon_id, date, direction, amount, category, method, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(salon.id, date, b.direction === 'in' ? 'in' : 'out', amount, str(b.category, 80), METHODS.includes(b.method) ? b.method : 'efectivo', str(b.note, 300));
    return { id: Number(r.lastInsertRowid) };
  });
  on('DELETE', '/api/cash/movements/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const m = owned('cash_movements', Number(ctx.params.id), salon.id);
    if (db.prepare('SELECT 1 FROM cash_closings WHERE salon_id = ? AND date = ?').get(salon.id, m.date)) throw bad('La caja de ese día ya está cerrada');
    db.prepare('DELETE FROM cash_movements WHERE id = ?').run(m.id);
    return { ok: true };
  });
  on('POST', '/api/cash/close', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const date = isDate(ctx.body.date) ? ctx.body.date : today();
    const counted = money(ctx.body.counted, 'Efectivo contado');
    const day = cashDay(salon, date);
    if (day.closing) throw bad('La caja de ese día ya está cerrada');
    const diff = round2(counted - day.cash.expected);
    db.prepare('INSERT INTO cash_closings (salon_id, date, opening, expected, counted, diff) VALUES (?, ?, ?, ?, ?, ?)')
      .run(salon.id, date, day.cash.opening, day.cash.expected, counted, diff);
    return { ok: true, diff };
  });

  /* --- Horas trabajadas --- */
  on('GET', '/api/hours', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const month = isMonth(ctx.query.get('month')) ? ctx.query.get('month') : currentMonth();
    const rows = db.prepare(`SELECT employee_id, SUM(hours) AS hours, COUNT(*) AS days FROM work_hours
        WHERE salon_id = ? AND date >= ? AND date < ? GROUP BY employee_id`).all(salon.id, monthStart(month), monthStart(addMonths(month, 1)));
    return { month, hoursPerEmployee: salon.hours_per_employee, rows };
  });
  /* Registro mensual: fija el total de horas del mes para cada empleado. */
  on('POST', '/api/hours/month', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const month = ctx.body.month;
    if (!isMonth(month)) throw bad('Mes no válido');
    const from = monthStart(month);
    const to = monthStart(addMonths(month, 1));
    const entries = Array.isArray(ctx.body.entries) ? ctx.body.entries : [];
    tx(db, () => {
      for (const e of entries) {
        const emp = owned('employees', Number(e.employee_id), salon.id);
        if (e.hours === '' || e.hours == null) continue;
        const h = Number(e.hours);
        if (!(h >= 0 && h <= 400)) throw bad(`Horas no válidas para ${emp.name}`);
        db.prepare('DELETE FROM work_hours WHERE employee_id = ? AND date >= ? AND date < ?').run(emp.id, from, to);
        db.prepare('INSERT INTO work_hours (salon_id, employee_id, date, hours) VALUES (?, ?, ?, ?)').run(salon.id, emp.id, from, h);
      }
    });
    return { ok: true };
  });

  /* --- Pedidos de compra de producto --- */
  on('GET', '/api/orders', 'user', (ctx) => {
    const salon = salonFor(ctx);
    return {
      orders: db.prepare('SELECT * FROM purchase_orders WHERE salon_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(salon.id),
      signal: purchaseSignal(db, salon.id)
    };
  });
  on('POST', '/api/orders', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const date = isDate(b.date) ? b.date : today();
    const amount = money(b.amount, 'Importe');
    if (!amount) throw bad('El importe debe ser mayor que 0');
    const r = db.prepare('INSERT INTO purchase_orders (salon_id, date, supplier, amount, kind, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(salon.id, date, str(b.supplier, 120), amount, ['tecnico', 'retail', 'mixto'].includes(b.kind) ? b.kind : 'tecnico', str(b.notes, 500));
    return { id: Number(r.lastInsertRowid) };
  });
  on('DELETE', '/api/orders/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    owned('purchase_orders', Number(ctx.params.id), salon.id);
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(Number(ctx.params.id));
    return { ok: true };
  });

  /* --- Importación CSV / Excel --- */
  on('POST', '/api/import/csv', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const parsed = csvToTickets(String(ctx.body.csv ?? ''));
    if (parsed.error) return { ok: false, ...parsed };
    const result = importTickets(db, salon.id, parsed.tickets, 'csv', { dryRun: !!ctx.body.dryRun });
    return {
      ok: true, dryRun: !!ctx.body.dryRun, mapping: parsed.mapping, rowCount: parsed.rowCount,
      warnings: parsed.warnings.slice(0, 20), preview: parsed.tickets.slice(0, 5), result
    };
  });

  /* --- Traer los datos de otro programa --- */
  on('GET', '/api/migrate/schema', 'user', () => migrationSchema());
  on('POST', '/api/migrate', 'user', (ctx) => {
    const b = ctx.body;
    return migrate(db, salonFor(ctx), { kind: str(b.kind, 20), rows: b.rows, mapping: b.mapping, source: str(b.source, 20), dryRun: b.dryRun !== false });
  });

  /* --- Histórico: facturas, cobros, bonos y caja --- */
  on('GET', '/api/history', 'user', (ctx) => {
    const q = ctx.query;
    const tab = ['invoices', 'payments', 'vouchers', 'cash'].includes(q.get('tab')) ? q.get('tab') : 'invoices';
    return history(db, salonFor(ctx).id, { tab, from: q.get('from'), to: q.get('to'), q: str(q.get('q'), 80), status: str(q.get('status'), 20) });
  });

  /* --- Ajustes del salón --- */
  on('GET', '/api/settings', 'user', (ctx) => salonFor(ctx));
  on('PUT', '/api/settings', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const name = str(b.name, 120);
    if (!name) throw bad('El nombre es obligatorio');
    const hpe = Number(b.hours_per_employee);
    const target = Number(b.product_target_pct);
    if (!(hpe > 0 && hpe <= 400)) throw bad('Horas por empleado no válidas');
    if (!(target >= 0 && target <= 100)) throw bad('Objetivo de consumo no válido');
    db.prepare('UPDATE salons SET name = ?, city = ?, hours_per_employee = ?, product_target_pct = ?, opening_float = ? WHERE id = ?')
      .run(name, str(b.city, 80), hpe, target, money(b.opening_float ?? 0, 'Fondo de caja'), salon.id);
    return { ok: true };
  });
  on('POST', '/api/settings/apikey', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const key = newApiKey();
    db.prepare('UPDATE salons SET api_key = ? WHERE id = ?').run(key, salon.id);
    return { api_key: key };
  });

  /* --- Consola del distribuidor --- */
  on('GET', '/api/admin/overview', 'admin', ({ query }) => networkOverview(db, isMonth(query.get('ref')) ? query.get('ref') : currentMonth()));
  on('POST', '/api/admin/salons', 'admin', ({ body }) => {
    const name = str(body.name, 120);
    const email = str(body.owner_email, 120).toLowerCase();
    if (!name) throw bad('El nombre del salón es obligatorio');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Email del dueño no válido');
    if (String(body.owner_password ?? '').length < 8) throw bad('La contraseña debe tener al menos 8 caracteres');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw bad('Ya existe un usuario con ese email');
    return tx(db, () => {
      const plan = str(body.plan, 40) || 'Base';
      const s = db.prepare('INSERT INTO salons (name, city, plan, monthly_fee, api_key, trial_ends) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, str(body.city, 80), plan, money(body.monthly_fee ?? 0, 'Cuota'), newApiKey(), plan === 'Prueba' ? addDaysIso(today(), trialDays()) : null);
      const sid = Number(s.lastInsertRowid);
      db.prepare("INSERT INTO users (email, name, password_hash, role, salon_id) VALUES (?, ?, ?, 'owner', ?)")
        .run(email, str(body.owner_name, 120), hashPassword(body.owner_password), sid);
      if (body.lead_id) db.prepare("UPDATE leads SET status = 'en prueba' WHERE id = ?").run(Number(body.lead_id));
      return { id: sid };
    });
  });
  on('PUT', '/api/admin/salons/:id', 'admin', ({ params, body }) => {
    const s = salonById(Number(params.id));
    if (!s) throw notFound();
    const minPm = body.min_price_minute != null && body.min_price_minute !== '' ? Number(body.min_price_minute) : s.min_price_minute;
    if (!(minPm > 0 && minPm < 20)) throw bad('Precio mínimo por minuto no válido');
    const active = body.active === undefined ? s.active : body.active === false ? 0 : 1;
    let trialEnds = s.trial_ends;
    if (body.trial_ends !== undefined) {
      if (body.trial_ends && !isDate(body.trial_ends)) throw bad('Fecha de fin de prueba no válida');
      trialEnds = body.trial_ends || null;
    }
    db.prepare('UPDATE salons SET plan = ?, monthly_fee = ?, active = ?, min_price_minute = ?, trial_ends = ? WHERE id = ?')
      .run(str(body.plan, 40) || s.plan, money(body.monthly_fee ?? s.monthly_fee, 'Cuota'), active, minPm, trialEnds, s.id);
    return { ok: true };
  });
  on('GET', '/api/admin/salons/:id/users', 'admin', ({ params }) => {
    if (!salonById(Number(params.id))) throw notFound();
    return { users: listTeamUsers(db, Number(params.id)) };
  });
  on('POST', '/api/admin/users/:id/reset-link', 'admin', ({ params, origin }) => {
    const u = db.prepare("SELECT id FROM users WHERE id = ? AND role != 'admin'").get(Number(params.id));
    if (!u) throw notFound('Usuario no encontrado');
    return { link: resetLink(origin, createResetToken(db, u.id)) };
  });

  /* --- API de integración para TPVs (clave por salón) --- */
  on('POST', '/api/ingest/tickets', 'apikey', ({ salon, body }) => {
    if (!Array.isArray(body.tickets)) throw bad('Envía { "tickets": [...] }');
    if (body.tickets.length > 5000) throw bad('Máximo 5000 tickets por envío');
    return importTickets(db, salon.id, body.tickets, 'api');
  });
  on('POST', '/api/ingest/hours', 'apikey', ({ salon, body }) => {
    if (!Array.isArray(body.entries)) throw bad('Envía { "entries": [...] }');
    return importHours(db, salon.id, body.entries);
  });
  on('POST', '/api/ingest/expenses', 'apikey', ({ salon, body }) => {
    if (!Array.isArray(body.expenses)) throw bad('Envía { "expenses": [...] }');
    let saved = 0;
    const errors = [];
    const ins = db.prepare("INSERT INTO cash_movements (salon_id, date, direction, amount, category, method, note, source) VALUES (?, ?, 'out', ?, ?, ?, ?, 'api')");
    tx(db, () => body.expenses.forEach((e, i) => {
      const amount = Number(e.amount);
      if (!isDate(e.date) || !(amount > 0)) return errors.push({ index: i, error: 'fecha o importe no válidos' });
      ins.run(salon.id, e.date, round2(amount), str(e.category, 80), METHODS.includes(e.method) ? e.method : 'transferencia', str(e.note, 300));
      saved++;
    }));
    return { saved, errors };
  });


  /* --- Agenda --- */
  const parseServiceIds = (v) => String(v || '').split(',').map(Number).filter(Boolean);
  const durationOf = (salonId, ids) => ids.reduce((sum, id) => sum + (db.prepare('SELECT duration_min FROM services WHERE id = ? AND salon_id = ?').get(id, salonId)?.duration_min || 0), 0);
  const agendaError = (fn) => { try { return fn(); } catch (err) { if (err instanceof HttpError) throw err; throw bad(err.message); } };

  on('GET', '/api/agenda', 'team', (ctx) => {
    const salon = ensureBookingSetup(db, salonFor(ctx));
    const from = isDate(ctx.query.get('from')) ? ctx.query.get('from') : nowLocal().date;
    const days = Math.max(1, Math.min(31, Number(ctx.query.get('days')) || 7));
    const to = addDaysIso(from, days);
    return {
      from, to, today: nowLocal().date,
      schedule: scheduleOf(salon),
      employees: db.prepare('SELECT id, name, role FROM employees WHERE salon_id = ? AND active = 1 ORDER BY id').all(salon.id),
      appointments: listAppointments(db, salon.id, from, to),
      bookingSlug: salon.booking_slug
    };
  });
  on('GET', '/api/agenda/slots', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const ids = parseServiceIds(ctx.query.get('services'));
    const duration = durationOf(salon.id, ids);
    if (!duration) throw bad('Elige al menos un servicio');
    return { duration, slots: availableSlots(db, salon, { date: ctx.query.get('date'), duration, employeeId: Number(ctx.query.get('employee')) || null, ignoreId: Number(ctx.query.get('ignore')) || null }) };
  });
  // Primero los huecos: próximos días donde cabe el servicio, con profesional propuesto.
  on('GET', '/api/agenda/availability', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const ids = parseServiceIds(ctx.query.get('services'));
    const duration = durationOf(salon.id, ids);
    if (!duration) throw bad('Elige al menos un servicio');
    const days = Math.min(14, Math.max(1, Number(ctx.query.get('days')) || 4));
    const employeeId = Number(ctx.query.get('employee')) || null;
    if (employeeId) owned('employees', employeeId, salon.id);
    return {
      duration,
      employees: db.prepare('SELECT id, name FROM employees WHERE salon_id = ? AND active = 1 ORDER BY name').all(salon.id),
      days: nextAvailability(db, salon, { duration, employeeId, from: ctx.query.get('from'), days })
    };
  });
  on('POST', '/api/appointments', 'team', (ctx) => agendaError(() => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    let client = null;
    if (b.client_id) client = owned('clients', Number(b.client_id), salon.id);
    else if (b.new_client && str(b.new_client.name)) {
      const id = Number(db.prepare('INSERT INTO clients (salon_id, name, phone, gender, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(salon.id, str(b.new_client.name, 120), str(b.new_client.phone, 40), normGender(b.new_client.gender), today()).lastInsertRowid);
      client = { id, name: str(b.new_client.name, 120), phone: str(b.new_client.phone, 40) };
    }
    if (b.employee_id) owned('employees', Number(b.employee_id), salon.id);
    return createAppointment(db, salon, {
      clientId: client?.id ?? null, clientName: client?.name || str(b.client_name, 120), clientPhone: client?.phone || '',
      employeeId: Number(b.employee_id) || null, date: str(b.date, 10), start: str(b.start, 5),
      serviceIds: b.service_ids, notes: str(b.notes, 500), status: b.status === 'pendiente' ? 'pendiente' : 'confirmada', source: 'salon'
    });
  }));
  on('GET', '/api/appointments/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const a = getAppointment(db, salon.id, Number(ctx.params.id));
    if (!a) throw notFound('Cita no encontrada');
    return a;
  });
  on('PUT', '/api/appointments/:id', 'team', (ctx) => agendaError(() => {
    const salon = salonFor(ctx);
    const a = getAppointment(db, salon.id, Number(ctx.params.id));
    if (!a) throw notFound('Cita no encontrada');
    const b = ctx.body;
    if (b.date || b.start) {
      if (b.employee_id) owned('employees', Number(b.employee_id), salon.id);
      return rescheduleAppointment(db, salon, a.id, { date: str(b.date, 10) || a.date, start: str(b.start, 5) || a.start, employeeId: Number(b.employee_id) || null });
    }
    const statuses = ['pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada', 'no_presentada'];
    const status = statuses.includes(b.status) ? b.status : a.status;
    db.prepare('UPDATE appointments SET status = ?, notes = ? WHERE id = ?').run(status, b.notes !== undefined ? str(b.notes, 500) : a.notes, a.id);
    return getAppointment(db, salon.id, a.id);
  }));
  /* Empieza el servicio de una cita: arranca el cronómetro del cobro. */
  on('POST', '/api/appointments/:id/start', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const a = getAppointment(db, salon.id, Number(ctx.params.id));
    if (!a) throw notFound('Cita no encontrada');
    const lines = a.services.filter((s) => s.service_id).map((s) => ({ kind: 'service', item_id: s.service_id, name: s.name, qty: 1, price: s.price, duration: s.duration_min }));
    if (!lines.length) throw bad('La cita no tiene servicios del menú');
    const started = new Date().toISOString();
    const r = db.prepare('INSERT INTO open_visits (salon_id, client_id, client_name, employee_id, lines, started_at, appointment_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(salon.id, a.client_id, a.client_name || '', a.employee_id, JSON.stringify(lines), started, a.id);
    db.prepare("UPDATE appointments SET status = 'en_curso' WHERE id = ?").run(a.id);
    return { visit_id: Number(r.lastInsertRowid), started_at: started };
  });

  on('GET', '/api/booking-settings', 'user', (ctx) => {
    const salon = ensureBookingSetup(db, salonFor(ctx));
    return {
      schedule: scheduleOf(salon), booking_slug: salon.booking_slug, booking_enabled: !!salon.booking_enabled, booking_auto_confirm: !!salon.booking_auto_confirm,
      calendar_token: salon.calendar_token, api_key_set: Boolean(salon.api_key),
      feeds: db.prepare('SELECT f.*, e.name AS employee_name FROM calendar_feeds f LEFT JOIN employees e ON e.id = f.employee_id WHERE f.salon_id = ? ORDER BY f.id').all(salon.id)
    };
  });
  on('PUT', '/api/booking-settings', 'user', (ctx) => agendaError(() => {
    const salon = ensureBookingSetup(db, salonFor(ctx));
    const b = ctx.body;
    const schedule = b.schedule ? JSON.stringify(validateSchedule(b.schedule)) : salon.schedule;
    let slug = b.booking_slug !== undefined ? str(b.booking_slug, 60).toLowerCase() : salon.booking_slug;
    if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) throw bad('La dirección solo puede tener letras, números y guiones');
    if (db.prepare('SELECT 1 FROM salons WHERE booking_slug = ? AND id <> ?').get(slug, salon.id)) throw bad('Esa dirección ya la usa otro salón');
    db.prepare('UPDATE salons SET schedule = ?, booking_slug = ?, booking_enabled = ?, booking_auto_confirm = ? WHERE id = ?')
      .run(schedule, slug, b.booking_enabled === undefined ? salon.booking_enabled : b.booking_enabled ? 1 : 0, b.booking_auto_confirm === undefined ? salon.booking_auto_confirm : b.booking_auto_confirm ? 1 : 0, salon.id);
    return { ok: true };
  }));
  on('POST', '/api/calendar-feeds', 'user', async (ctx) => {
    const salon = salonFor(ctx);
    const url = str(ctx.body.url, 1000);
    if (!/^(https?|webcal):\/\//i.test(url)) throw bad('Pega la dirección iCal completa (empieza por https:// o webcal://)');
    if (ctx.body.employee_id) owned('employees', Number(ctx.body.employee_id), salon.id);
    const r = db.prepare('INSERT INTO calendar_feeds (salon_id, name, url, employee_id) VALUES (?, ?, ?, ?)').run(salon.id, str(ctx.body.name, 80), url, Number(ctx.body.employee_id) || null);
    const feed = db.prepare('SELECT * FROM calendar_feeds WHERE id = ?').get(Number(r.lastInsertRowid));
    return { id: feed.id, sync: await syncFeed(db, salon, feed) };
  });
  on('POST', '/api/calendar-feeds/:id/sync', 'user', async (ctx) => {
    const salon = salonFor(ctx);
    return syncFeed(db, salon, owned('calendar_feeds', Number(ctx.params.id), salon.id));
  });
  on('DELETE', '/api/calendar-feeds/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    owned('calendar_feeds', Number(ctx.params.id), salon.id);
    db.prepare('DELETE FROM calendar_feeds WHERE id = ?').run(Number(ctx.params.id));
    return { ok: true };
  });
  /* Citas desde Booksy, Treatwell, Fresha… vía Make/Zapier o integración directa. */
  on('POST', '/api/ingest/appointments', 'apikey', ({ salon, body }) => {
    if (!Array.isArray(body.appointments)) throw bad('Envía { "appointments": [...] }');
    return upsertExternalAppointments(db, salon, body.appointments.slice(0, 2000), 'api');
  });

  /* --- Reservas online (públicas, sin sesión) --- */
  const bookingSalon = (slug) => {
    const s = db.prepare('SELECT * FROM salons WHERE booking_slug = ? AND active = 1').get(slug);
    if (!s || !s.booking_enabled) throw notFound('Este salón no tiene las reservas online activadas');
    return s;
  };
  const publicAppt = (a, salon) => ({
    token: a.token, status: a.status, date: a.date, start: a.start, end: a.end, employee: a.employee_name ? a.employee_name.split(' ')[0] : null,
    services: a.services.map((x) => ({ name: x.name, duration: x.duration_min, price: x.price })), client_name: a.client_name,
    salon: { name: salon.name, city: salon.city, slug: salon.booking_slug }
  });
  const bookingHits = new Map();
  on('GET', '/api/public/booking/:slug', 'none', ({ params }) => {
    const s = bookingSalon(params.slug);
    const n = nowLocal();
    return {
      salon: { name: s.name, city: s.city }, schedule: scheduleOf(s), today: n.date,
      services: db.prepare('SELECT id, name, category, gender, price, duration_min FROM services WHERE salon_id = ? AND active = 1 ORDER BY category, name').all(s.id),
      employees: db.prepare('SELECT id, name, role FROM employees WHERE salon_id = ? AND active = 1 ORDER BY id').all(s.id).map((e) => ({ id: e.id, name: e.name.split(' ')[0], role: e.role }))
    };
  });
  on('GET', '/api/public/booking/:slug/slots', 'none', ({ params, query }) => {
    const s = bookingSalon(params.slug);
    const ids = parseServiceIds(query.get('services'));
    const duration = durationOf(s.id, ids);
    if (!duration) throw bad('Elige al menos un servicio');
    return { slots: availableSlots(db, s, { date: query.get('date'), duration, employeeId: Number(query.get('employee')) || null, forPublic: true }).map((x) => x.time) };
  });
  on('POST', '/api/public/booking/:slug', 'none', ({ params, body, ip }) => agendaError(() => {
    const s = bookingSalon(params.slug);
    if (body.website) return { ok: true };
    const hits = (bookingHits.get(ip) || []).filter((t) => Date.now() - t < 3600000);
    if (hits.length >= 8) throw new HttpError(429, 'Has hecho varias reservas seguidas. Inténtalo más tarde o llama al salón.');
    const name = str(body.name, 120);
    const phone = str(body.phone, 40);
    if (!name) throw bad('Escribe tu nombre');
    if (phone.replace(/\D/g, '').length < 9) throw bad('Escribe un teléfono válido para confirmarte la cita');
    if (!body.consent) throw bad('Acepta el uso de tus datos para gestionar la cita');
    const ids = (Array.isArray(body.service_ids) ? body.service_ids : []).map(Number);
    const duration = durationOf(s.id, ids);
    const ok = availableSlots(db, s, { date: str(body.date, 10), duration, employeeId: Number(body.employee_id) || null, forPublic: true }).some((x) => x.time === body.start);
    if (!ok) throw bad('Ese hueco ya no está libre. Elige otra hora.');
    return tx(db, () => {
      const key = phoneKey(phone);
      let client = db.prepare("SELECT id, name, phone FROM clients WHERE salon_id = ? AND phone <> ''").all(s.id).find((c) => phoneKey(c.phone) === key);
      if (!client) {
        const id = Number(db.prepare('INSERT INTO clients (salon_id, name, phone, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(s.id, name, phone, str(body.email, 120), 'Creada desde la reserva online', today()).lastInsertRowid);
        client = { id, name, phone };
      }
      const a = createAppointment(db, s, {
        clientId: client.id, clientName: client.name, clientPhone: client.phone, employeeId: Number(body.employee_id) || null,
        date: str(body.date, 10), start: str(body.start, 5), serviceIds: ids, notes: str(body.notes, 500),
        status: s.booking_auto_confirm ? 'confirmada' : 'pendiente', source: 'web'
      });
      bookingHits.set(ip, [...hits, Date.now()]);
      recordInbound(db, s.id, {
        channel: 'whatsapp', from: phone, name: client.name,
        body: `Reserva online: ${a.services.map((x) => x.name).join(' + ')} el ${a.date.split('-').reverse().join('/')} a las ${a.start}${a.employee_name ? ` con ${a.employee_name}` : ''}.${a.notes ? ` Nota: ${a.notes}` : ''}`
      });
      return publicAppt(a, s);
    });
  }));
  const apptByToken = (tok) => {
    const row = db.prepare('SELECT id, salon_id FROM appointments WHERE token = ?').get(tok);
    if (!row) throw notFound('No encontramos esta cita');
    const salon = salonById(row.salon_id);
    return { salon, a: getAppointment(db, salon.id, row.id) };
  };
  on('GET', '/api/public/appointment/:token', 'none', ({ params }) => { const { salon, a } = apptByToken(params.token); return publicAppt(a, salon); });
  on('POST', '/api/public/appointment/:token/cancel', 'none', ({ params }) => {
    const { salon, a } = apptByToken(params.token);
    const n = nowLocal();
    if (['cancelada', 'completada', 'no_presentada'].includes(a.status)) throw bad('Esta cita ya no se puede cancelar');
    if (a.date < n.date || (a.date === n.date && toMin(a.start) <= n.minutes)) throw bad('Esta cita ya ha pasado');
    db.prepare("UPDATE appointments SET status = 'cancelada' WHERE id = ?").run(a.id);
    if (a.client_phone) recordInbound(db, salon.id, { channel: 'whatsapp', from: a.client_phone, name: a.client_name, body: `Ha cancelado su cita online del ${a.date.split('-').reverse().join('/')} a las ${a.start}.` });
    return publicAppt(getAppointment(db, salon.id, a.id), salon);
  });
  on('GET', '/api/public/appointment/:token/ics', 'none', ({ params }) => {
    const { salon, a } = apptByToken(params.token);
    return { raw: appointmentIcs(salon, a), contentType: 'text/calendar; charset=utf-8', filename: 'cita.ics' };
  });
  /* Agenda del salón para suscribirse desde Google Calendar, Apple o Outlook. */
  on('GET', '/api/public/calendar/:token', 'none', ({ params }) => {
    const salon = db.prepare('SELECT * FROM salons WHERE calendar_token = ?').get(params.token);
    if (!salon) throw notFound();
    return { raw: agendaIcs(db, salon), contentType: 'text/calendar; charset=utf-8' };
  });

  /* --- Tiempos reales de servicio y rentabilidad --- */
  const periodOf = (q) => ({
    period: ['month', 'quarter', 'year'].includes(q.get('period')) ? q.get('period') : 'month',
    ref: isMonth(q.get('ref')) ? q.get('ref') : currentMonth()
  });
  on('GET', '/api/service-times', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const { period, ref } = periodOf(ctx.query);
    const range = periodRange(period, ref);
    return { period, ref, label: range.label, ...serviceTimes(db, salon, range.from, range.to) };
  });
  /* Reporte del salón para el distribuidor (pantalla y Excel). */
  on('GET', '/api/admin/report', 'admin', (ctx) => {
    const salon = salonFor(ctx);
    const { period, ref } = periodOf(ctx.query);
    return reportData(db, salon, period, ref);
  });
  on('GET', '/api/admin/report.xlsx', 'admin', (ctx) => {
    const salon = salonFor(ctx);
    const { period, ref } = periodOf(ctx.query);
    const data = reportData(db, salon, period, ref);
    const slug = salon.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return {
      binary: reportXlsx(data),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `reporte-${slug}-${ref}${period === 'month' ? '' : `-${period === 'quarter' ? 'trimestre' : 'anual'}`}.xlsx`
    };
  });

  /* --- Servicios en curso (cronómetro) --- */
  on('GET', '/api/visits/open', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return {
      visits: db.prepare(`SELECT v.*, e.name AS employee_name FROM open_visits v LEFT JOIN employees e ON e.id = v.employee_id
          WHERE v.salon_id = ? ORDER BY v.started_at`).all(salon.id).map((v) => ({ ...v, lines: JSON.parse(v.lines || '[]') })),
      now: new Date().toISOString()
    };
  });
  on('POST', '/api/visits/open', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const employee = b.employee_id ? owned('employees', Number(b.employee_id), salon.id) : null;
    let clientId = null;
    let clientName = str(b.client_name, 120);
    if (b.client_id) { const c = owned('clients', Number(b.client_id), salon.id); clientId = c.id; clientName = c.name; }
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 30).map((l) => {
      const kind = l.kind === 'product' ? 'product' : 'service';
      const item = owned(kind === 'product' ? 'products' : 'services', Number(l.item_id), salon.id);
      return { kind, item_id: item.id, name: item.name, qty: Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1))), price: l.price != null && l.price !== '' ? money(l.price, item.name) : item.price, duration: item.duration_min || 0 };
    });
    if (!lines.some((l) => l.kind === 'service')) throw bad('Añade al menos un servicio para empezar a medir');
    const started = new Date().toISOString();
    const r = db.prepare('INSERT INTO open_visits (salon_id, client_id, client_name, employee_id, lines, started_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(salon.id, clientId, clientName, employee?.id ?? null, JSON.stringify(lines), started);
    return { id: Number(r.lastInsertRowid), started_at: started };
  });
  on('DELETE', '/api/visits/open/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    owned('open_visits', Number(ctx.params.id), salon.id);
    db.prepare('DELETE FROM open_visits WHERE id = ?').run(Number(ctx.params.id));
    return { ok: true };
  });

  /* --- Comunicación con clientes --- */
  const CHANNELS = ['whatsapp', 'email', 'sms'];
  const authorName = (user) => user.name || user.email;

  on('GET', '/api/messages/summary', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return db.prepare("SELECT COALESCE(SUM(unread), 0) AS unread, COALESCE(SUM(status = 'abierta'), 0) AS open FROM conversations WHERE salon_id = ?").get(salon.id);
  });
  on('GET', '/api/conversations', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return { ...listConversations(db, salon.id, { filter: ctx.query.get('filter') || 'abiertas', q: ctx.query.get('q') || '' }), channels: channelStatus(channelsFor(db, salon.id)) };
  });
  on('GET', '/api/conversations/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const d = conversationDetail(db, salon.id, Number(ctx.params.id));
    if (!d) throw notFound('Conversación no encontrada');
    ensureTemplates(db, salon.id);
    return {
      ...d,
      insights: d.conversation.client_id ? getInsights(db, d.conversation.client_id) : null,
      templates: db.prepare('SELECT id, kind, name, body FROM message_templates WHERE salon_id = ? ORDER BY id').all(salon.id),
      employees: db.prepare('SELECT id, name FROM employees WHERE salon_id = ? AND active = 1 ORDER BY name').all(salon.id),
      channels: channelStatus(channelsFor(db, salon.id)),
      salonName: salon.name
    };
  });
  /* Mensaje nuevo a un cliente (o a un teléfono/email). Crea la conversación si no existe. */
  on('POST', '/api/conversations', 'team', async (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const channel = CHANNELS.includes(b.channel) ? b.channel : 'whatsapp';
    let contact = str(b.contact, 120);
    let name = '';
    let clientId = null;
    if (b.client_id) {
      const c = owned('clients', Number(b.client_id), salon.id);
      clientId = c.id;
      name = c.name;
      contact = channel === 'email' ? c.email : c.phone;
      if (!contact) throw bad(channel === 'email' ? 'Este cliente no tiene email' : 'Este cliente no tiene teléfono');
    }
    if (!contact) throw bad('Indica el teléfono o el email');
    if (channel !== 'email' && phoneKey(contact).length < 9) throw bad('Teléfono no válido');
    const conv = getOrCreateConversation(db, salon.id, { channel, contact, name, clientId, createClient: false });
    const sent = await sendMessage(db, salon, conv, b.text, { author: authorName(ctx.user), template: str(b.template, 40) || null });
    return { id: conv.id, ...sent };
  });
  on('POST', '/api/conversations/:id/messages', 'team', async (ctx) => {
    const salon = salonFor(ctx);
    const conv = owned('conversations', Number(ctx.params.id), salon.id);
    return sendMessage(db, salon, conv, ctx.body.text, { author: authorName(ctx.user), template: str(ctx.body.template, 40) || null });
  });
  on('PUT', '/api/conversations/:id', 'team', (ctx) => {
    const salon = salonFor(ctx);
    const conv = owned('conversations', Number(ctx.params.id), salon.id);
    const status = ['abierta', 'pendiente', 'cerrada'].includes(ctx.body.status) ? ctx.body.status : conv.status;
    let assigned = conv.assigned_to;
    if (ctx.body.assigned_to !== undefined) assigned = ctx.body.assigned_to ? owned('employees', Number(ctx.body.assigned_to), salon.id).id : null;
    let clientId = conv.client_id;
    if (ctx.body.client_id) clientId = owned('clients', Number(ctx.body.client_id), salon.id).id;
    db.prepare('UPDATE conversations SET status = ?, assigned_to = ?, client_id = ? WHERE id = ?').run(status, assigned, clientId, conv.id);
    if (clientId && clientId !== conv.client_id) refreshClientInsights(db, salon.id, clientId);
    return { ok: true };
  });

  on('GET', '/api/templates', 'team', (ctx) => {
    const salon = salonFor(ctx);
    ensureTemplates(db, salon.id);
    return { templates: db.prepare('SELECT * FROM message_templates WHERE salon_id = ? ORDER BY id').all(salon.id) };
  });
  const templateFields = (b) => {
    const name = str(b.name, 80);
    const body = str(b.body, 1000);
    if (!name || !body) throw bad('La plantilla necesita nombre y texto');
    return [str(b.kind, 40) || 'otro', name, body];
  };
  on('POST', '/api/templates', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const r = db.prepare('INSERT INTO message_templates (salon_id, kind, name, body) VALUES (?, ?, ?, ?)').run(salon.id, ...templateFields(ctx.body));
    return { id: Number(r.lastInsertRowid) };
  });
  on('PUT', '/api/templates/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    owned('message_templates', Number(ctx.params.id), salon.id);
    db.prepare('UPDATE message_templates SET kind = ?, name = ?, body = ? WHERE id = ?').run(...templateFields(ctx.body), Number(ctx.params.id));
    return { ok: true };
  });
  on('DELETE', '/api/templates/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    owned('message_templates', Number(ctx.params.id), salon.id);
    db.prepare('DELETE FROM message_templates WHERE id = ?').run(Number(ctx.params.id));
    return { ok: true };
  });

  on('GET', '/api/reminders', 'team', (ctx) => {
    const salon = salonFor(ctx);
    return { groups: reminderSuggestions(db, salon), channels: channelStatus(channelsFor(db, salon.id)) };
  });
  /* Envía recordatorios. Con WhatsApp conectado salen solos; en modo manual
     se devuelven los enlaces para enviarlos uno a uno desde el móvil. */
  on('POST', '/api/reminders/send', 'team', async (ctx) => {
    const salon = salonFor(ctx);
    const items = Array.isArray(ctx.body.items) ? ctx.body.items.slice(0, 200) : [];
    if (!items.length) throw bad('Elige al menos un cliente');
    const results = [];
    for (const it of items) {
      const c = owned('clients', Number(it.client_id), salon.id);
      if (phoneKey(c.phone).length < 9) { results.push({ client_id: c.id, name: c.name, status: 'error', error: 'Sin teléfono' }); continue; }
      const conv = getOrCreateConversation(db, salon.id, { channel: 'whatsapp', contact: c.phone, name: c.name, clientId: c.id, createClient: false });
      const r = await sendMessage(db, salon, conv, it.text, { author: authorName(ctx.user), template: str(it.kind, 40) || 'recordatorio' });
      results.push({ client_id: c.id, name: c.name, conversation_id: conv.id, ...r });
    }
    return { results };
  });

  on('POST', '/api/clients/:id/insights/ai', 'team', async (ctx) => {
    const salon = salonFor(ctx);
    const c = owned('clients', Number(ctx.params.id), salon.id);
    const messages = db.prepare(`SELECT m.direction, m.body, m.created_at FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
        WHERE cv.salon_id = ? AND cv.client_id = ? ORDER BY m.created_at, m.id`).all(salon.id, c.id);
    if (!messages.length) throw bad('Este cliente aún no tiene conversaciones');
    const history = db.prepare(`SELECT tk.date, group_concat(l.name, ' + ') AS services FROM tickets tk JOIN ticket_lines l ON l.ticket_id = tk.id
        WHERE tk.client_id = ? GROUP BY tk.id ORDER BY tk.date DESC LIMIT 10`).all(c.id);
    const r = await aiClientSummary({ salonName: salon.name, client: c, history, messages });
    if (r.error) throw bad(r.error);
    const data = refreshClientInsights(db, salon.id, c.id);
    data.ai = { ...r.data, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
    db.prepare("UPDATE client_insights SET data = ?, source = 'ia' WHERE client_id = ?").run(JSON.stringify(data), c.id);
    return data;
  });

  on('GET', '/api/channels', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const ch = channelsFor(db, salon.id);
    return {
      wa_phone_number_id: ch.wa_phone_number_id, wa_number: ch.wa_number, wa_token_set: Boolean(ch.wa_token),
      email_from: ch.email_from, email_key_set: Boolean(ch.email_api_key),
      status: channelStatus(ch), webhookReady: Boolean(process.env.WA_VERIFY_TOKEN)
    };
  });
  on('PUT', '/api/channels', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const b = ctx.body;
    const cur = channelsFor(db, salon.id);
    const id = str(b.wa_phone_number_id, 40);
    if (id && db.prepare('SELECT 1 FROM salon_channels WHERE wa_phone_number_id = ? AND salon_id <> ?').get(id, salon.id)) throw bad('Ese número de WhatsApp ya está conectado a otro salón');
    const row = [
      id, b.wa_token ? str(b.wa_token, 600) : cur.wa_token, str(b.wa_number, 30),
      b.email_api_key ? str(b.email_api_key, 200) : cur.email_api_key, str(b.email_from, 120)
    ];
    if (b.clear_wa) { row[0] = ''; row[1] = ''; }
    if (b.clear_email) { row[3] = ''; }
    db.prepare(`INSERT INTO salon_channels (salon_id, wa_phone_number_id, wa_token, wa_number, email_api_key, email_from) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (salon_id) DO UPDATE SET wa_phone_number_id = excluded.wa_phone_number_id, wa_token = excluded.wa_token, wa_number = excluded.wa_number,
        email_api_key = excluded.email_api_key, email_from = excluded.email_from`).run(salon.id, ...row);
    return { ok: true };
  });

  /* Webhook de WhatsApp Business (Cloud API de Meta). Una sola URL para toda la
     red: cada mensaje llega con el phone_number_id del salón que lo recibe. */
  on('GET', '/api/webhooks/whatsapp', 'none', ({ query }) => {
    const expected = process.env.WA_VERIFY_TOKEN;
    if (expected && query.get('hub.mode') === 'subscribe' && query.get('hub.verify_token') === expected) return { raw: query.get('hub.challenge') || '' };
    return { raw: 'Token de verificación no válido', status: 403 };
  });
  on('POST', '/api/webhooks/whatsapp', 'none', ({ body, rawBody, headers }) => {
    const secret = process.env.WA_APP_SECRET;
    if (secret) {
      const sig = String(headers['x-hub-signature-256'] || '');
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      if (!ok) throw new HttpError(401, 'Firma no válida');
    }
    let received = 0;
    for (const m of parseWhatsAppWebhook(body)) {
      const ch = db.prepare('SELECT salon_id FROM salon_channels WHERE wa_phone_number_id = ?').get(m.phoneNumberId);
      if (!ch) continue;
      if (m.status) {
        const st = { sent: 'enviado', delivered: 'entregado', read: 'leído', failed: 'error' }[m.status];
        if (st) db.prepare("UPDATE messages SET status = ? WHERE salon_id = ? AND external_id = ? AND direction = 'out'").run(st, ch.salon_id, m.externalId);
        continue;
      }
      recordInbound(db, ch.salon_id, { channel: 'whatsapp', from: m.from, name: m.name, body: m.body, externalId: m.externalId, at: m.at });
      received++;
    }
    return { ok: true, received };
  });
  /* Mensajes entrantes de otros canales (email reenviado, Instagram vía Make/Zapier…). */
  on('POST', '/api/ingest/messages', 'apikey', ({ salon, body }) => {
    if (!Array.isArray(body.messages)) throw bad('Envía { "messages": [...] }');
    let saved = 0;
    const errors = [];
    body.messages.slice(0, 1000).forEach((m, i) => {
      const channel = ['whatsapp', 'email', 'sms', 'instagram', 'web'].includes(m.channel) ? m.channel : 'whatsapp';
      if (!m.from || !m.body) return errors.push({ index: i, error: 'faltan from o body' });
      const r = recordInbound(db, salon.id, { channel, from: String(m.from), name: str(m.name, 120), body: str(m.body, 4000), externalId: m.id ? `${channel}:${m.id}` : null, at: m.at || null });
      if (r.conversationId) saved++;
    });
    return { saved, errors };
  });

  /* --- Primeros pasos para salones nuevos (pilotos) --- */
  on('GET', '/api/onboarding', 'user', (ctx) => onboardingSteps(db, salonFor(ctx)));
  on('POST', '/api/onboarding/starter-catalog', 'user', (ctx) => loadStarterCatalog(db, salonFor(ctx).id));

  /* --- Solicitudes de prueba desde la web comercial --- */
  const leadHits = new Map();
  on('POST', '/api/leads', 'none', ({ body, ip }) => {
    if (body.website) return { ok: true }; // campo trampa para bots
    const hits = (leadHits.get(ip) || []).filter((t) => Date.now() - t < 3600000);
    if (hits.length >= 5) throw new HttpError(429, 'Has enviado varias solicitudes. Inténtalo más tarde.');
    leadHits.set(ip, [...hits, Date.now()]);
    const name = str(body.name, 120);
    const email = str(body.email, 120);
    const phone = str(body.phone, 40);
    if (!name) throw bad('Escribe tu nombre');
    if (!email && !phone) throw bad('Déjanos un email o un teléfono para contactarte');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('El email no parece válido');
    db.prepare('INSERT INTO leads (name, salon_name, email, phone, city, team_size, message) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name, str(body.salon_name, 120), email, phone, str(body.city, 80), str(body.team_size, 20), str(body.message, 1000));
    return { ok: true };
  });
  on('GET', '/api/admin/leads', 'admin', () => ({ leads: db.prepare('SELECT * FROM leads ORDER BY created_at DESC, id DESC LIMIT 500').all() }));
  on('PUT', '/api/admin/leads/:id', 'admin', ({ params, body }) => {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(params.id));
    if (!lead) throw notFound();
    const status = ['nuevo', 'contactado', 'en prueba', 'cliente', 'descartado'].includes(body.status) ? body.status : lead.status;
    db.prepare('UPDATE leads SET status = ?, notes = ? WHERE id = ?').run(status, body.notes !== undefined ? str(body.notes, 1000) : lead.notes, lead.id);
    return { ok: true };
  });

  on('GET', '/api/health', 'none', () => ({ ok: true, today: today() }));
  on('GET', '/api/config', 'none', async () => ({
    demo: process.env.DEMO === '1', ai: await aiAvailable(), landing: process.env.WEB_DEMO !== '1',
    signup: signupOpen(), trial_days: trialDays(), mail: mailConfigured(), web_demo: process.env.WEB_DEMO === '1',
    terms_url: process.env.TERMS_URL || '', privacy_url: process.env.PRIVACY_URL || ''
  }));

  /* ---------- Despacho ---------- */

  async function serveStatic(res, pathname) {
    // "/" es la web comercial; la aplicación vive en "/app".
    let rel = pathname === '/' ? 'landing.html' : decodeURIComponent(pathname.replace(/^\/app(\/|$)/, '/').slice(1)) || 'index.html';
    // Página pública de reservas de cada salón: /reservar/<salón>[/cita/<código>]
    if (/^\/reservar\/[a-z0-9-]+(\/cita\/[a-f0-9]+)?\/?$/.test(pathname)) rel = 'reservar.html';
    let file = normalize(join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    let data;
    try { data = await readFile(file); }
    catch {
      if (extname(rel)) { res.writeHead(404); return res.end('No encontrado'); }
      file = join(PUBLIC, 'index.html');
      data = await readFile(file);
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // La página de reservas se puede incrustar en la web del salón; el resto no.
    const embeddable = url.pathname.startsWith('/reservar/');
    if (!embeddable) res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors ${embeddable ? '*' : "'none'"}`);
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método no permitido');
        return await serveStatic(res, url.pathname);
      }
      let match = null;
      let allowed = false;
      for (const r of routes) {
        const m = url.pathname.match(r.re);
        if (!m) continue;
        allowed = true;
        if (r.method === req.method) { match = { r, m }; break; }
      }
      if (!match) throw new HttpError(allowed ? 405 : 404, allowed ? 'Método no permitido' : 'Ruta no encontrada');
      const { r, m } = match;
      const cookies = parseCookies(req.headers.cookie);
      const ctx = {
        query: url.searchParams,
        params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])),
        cookies,
        ip: req.socket.remoteAddress || '',
        origin: process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, '') : `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host || 'localhost'}`,
        body: {}
      };
      if (req.method !== 'GET') {
        // Las peticiones que modifican datos deben ser JSON: un formulario de
        // otra web no puede enviarlas (protección CSRF junto a SameSite).
        if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Se espera JSON');
        const { parsed, raw } = await readBody(req);
        ctx.body = parsed;
        ctx.rawBody = raw;
        ctx.headers = req.headers;
        if (typeof ctx.body !== 'object' || ctx.body === null || Array.isArray(ctx.body)) throw bad('JSON no válido');
      }
      if (r.auth === 'user' || r.auth === 'admin' || r.auth === 'team') {
        ctx.user = sessionUser(db, cookies.sid);
        if (!ctx.user) throw new HttpError(401, 'Inicia sesión');
        if (r.auth === 'admin' && ctx.user.role !== 'admin') throw new HttpError(403, 'Solo para el distribuidor');
        if (r.auth === 'user' && ctx.user.role === 'staff') throw new HttpError(403, 'Tu usuario no tiene acceso a esta sección. Pídeselo al dueño del salón.');
        if (ctx.user.role !== 'admin') {
          const own = salonById(ctx.user.salon_id);
          if (!own || !own.active) throw new HttpError(403, 'Esta cuenta está desactivada. Escríbenos para reactivarla.');
          const trial = trialInfo(own);
          const always = ['/api/logout', '/api/password'];
          if (trial?.expired && req.method !== 'GET' && !always.includes(url.pathname)) {
            throw new HttpError(402, 'Tu prueba gratuita ha terminado. Tus datos siguen guardados: elige un plan para seguir trabajando.');
          }
        }
      } else if (r.auth === 'apikey') {
        const key = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        ctx.salon = key ? db.prepare('SELECT * FROM salons WHERE api_key = ? AND active = 1').get(key) : null;
        if (!ctx.salon) throw new HttpError(401, 'Clave de API no válida');
      }
      const out = await r.handler(ctx);
      if (out && out.binary) {
        res.writeHead(200, {
          'Content-Type': out.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${out.filename || 'archivo'}"`,
          'Cache-Control': 'no-store'
        });
        return res.end(out.binary);
      }
      if (out && out.raw !== undefined) {
        res.writeHead(out.status || 200, { 'Content-Type': out.contentType || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(out.filename ? { 'Content-Disposition': `attachment; filename="${out.filename}"` } : {}) });
        return res.end(String(out.raw));
      }
      if (out && out.cookie) {
        const secure = process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        return send(res, out.status, out.body, { 'Set-Cookie': `sid=${out.cookie.value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${out.cookie.maxAge}${secure}` });
      }
      send(res, 200, out ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Error interno' });
    }
  };
}

