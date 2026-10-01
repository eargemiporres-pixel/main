/* Servidor HTTP: API JSON + archivos estáticos de la interfaz.
   Sin dependencias: solo módulos de Node. */
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tx } from './db.js';
import { hashPassword, verifyPassword, createSession, sessionUser, destroySession, parseCookies, newApiKey, loginAllowed, loginFailed } from './auth.js';
import { dashboard } from './metrics.js';
import { listClients, clientDetail } from './clients.js';
import { importTickets, importHours, normGender, normTime } from './importer.js';
import { csvToTickets } from './csv.js';
import { networkOverview, purchaseSignal } from './network.js';
import { today, currentMonth, isMonth, isDate, addMonths, monthStart } from './dates.js';

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
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
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
    const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; })}$`);
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
    const s = createSession(db, u.id);
    return { status: 200, body: { ok: true }, cookie: { value: s.token, maxAge: s.maxAge } };
  });

  on('POST', '/api/logout', 'none', ({ cookies }) => {
    destroySession(db, cookies.sid);
    return { status: 200, body: { ok: true }, cookie: { value: '', maxAge: 0 } };
  });

  on('GET', '/api/me', 'user', ({ user }) => ({
    user,
    salon: user.salon_id ? salonById(user.salon_id) : null,
    salons: user.role === 'admin' ? db.prepare('SELECT id, name, city FROM salons ORDER BY name').all() : [],
    today: today()
  }));

  on('POST', '/api/password', 'user', ({ user, body }) => {
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
  on('GET', '/api/clients', 'user', (ctx) => {
    const salon = salonFor(ctx);
    return listClients(db, salon.id, { q: ctx.query.get('q') || '', filter: ctx.query.get('filter') || 'todos' });
  });
  on('GET', '/api/clients/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const d = clientDetail(db, salon.id, Number(ctx.params.id));
    if (!d) throw notFound('Cliente no encontrado');
    return d;
  });
  const clientFields = (b) => {
    const name = str(b.name, 120);
    if (!name) throw bad('El nombre es obligatorio');
    return [name, str(b.phone, 40), str(b.email, 120), normGender(b.gender), str(b.notes, 2000)];
  };
  on('POST', '/api/clients', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const r = db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(salon.id, ...clientFields(ctx.body), today());
    return { id: Number(r.lastInsertRowid) };
  });
  on('PUT', '/api/clients/:id', 'user', (ctx) => {
    const salon = salonFor(ctx);
    owned('clients', Number(ctx.params.id), salon.id);
    db.prepare('UPDATE clients SET name = ?, phone = ?, email = ?, gender = ?, notes = ? WHERE id = ?').run(...clientFields(ctx.body), Number(ctx.params.id));
    return { ok: true };
  });

  /* --- Catálogo: equipo, servicios, productos --- */
  on('GET', '/api/catalog', 'user', (ctx) => {
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
  on('POST', '/api/tickets', 'user', (ctx) => {
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
      const t = db.prepare(`INSERT INTO tickets (salon_id, client_id, employee_id, date, time_start, time_end, method, total, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`).run(salon.id, clientId, employee?.id ?? null, date, normTime(b.time_start), normTime(b.time_end), method, total);
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
  on('GET', '/api/cash', 'user', (ctx) => {
    const salon = salonFor(ctx);
    const date = isDate(ctx.query.get('date')) ? ctx.query.get('date') : today();
    return cashDay(salon, date);
  });
  on('POST', '/api/cash/movements', 'user', (ctx) => {
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
  on('POST', '/api/cash/close', 'user', (ctx) => {
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
      const s = db.prepare('INSERT INTO salons (name, city, plan, monthly_fee, api_key) VALUES (?, ?, ?, ?, ?)')
        .run(name, str(body.city, 80), str(body.plan, 40) || 'Base', money(body.monthly_fee ?? 0, 'Cuota'), newApiKey());
      const sid = Number(s.lastInsertRowid);
      db.prepare("INSERT INTO users (email, name, password_hash, role, salon_id) VALUES (?, ?, ?, 'owner', ?)")
        .run(email, str(body.owner_name, 120), hashPassword(body.owner_password), sid);
      return { id: sid };
    });
  });
  on('PUT', '/api/admin/salons/:id', 'admin', ({ params, body }) => {
    const s = salonById(Number(params.id));
    if (!s) throw notFound();
    db.prepare('UPDATE salons SET plan = ?, monthly_fee = ?, active = ? WHERE id = ?')
      .run(str(body.plan, 40) || s.plan, money(body.monthly_fee ?? s.monthly_fee, 'Cuota'), body.active === false ? 0 : 1, s.id);
    return { ok: true };
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

  on('GET', '/api/health', 'none', () => ({ ok: true, today: today() }));
  on('GET', '/api/config', 'none', () => ({ demo: process.env.DEMO === '1' }));

  /* ---------- Despacho ---------- */

  async function serveStatic(res, pathname) {
    let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
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
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
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
        body: {}
      };
      if (req.method !== 'GET') {
        // Las peticiones que modifican datos deben ser JSON: un formulario de
        // otra web no puede enviarlas (protección CSRF junto a SameSite).
        if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Se espera JSON');
        ctx.body = await readBody(req);
        if (typeof ctx.body !== 'object' || ctx.body === null || Array.isArray(ctx.body)) throw bad('JSON no válido');
      }
      if (r.auth === 'user' || r.auth === 'admin') {
        ctx.user = sessionUser(db, cookies.sid);
        if (!ctx.user) throw new HttpError(401, 'Inicia sesión');
        if (r.auth === 'admin' && ctx.user.role !== 'admin') throw new HttpError(403, 'Solo para el distribuidor');
      } else if (r.auth === 'apikey') {
        const key = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        ctx.salon = key ? db.prepare('SELECT * FROM salons WHERE api_key = ? AND active = 1').get(key) : null;
        if (!ctx.salon) throw new HttpError(401, 'Clave de API no válida');
      }
      const out = await r.handler(ctx);
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

