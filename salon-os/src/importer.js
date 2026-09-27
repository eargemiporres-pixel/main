/* Importador común de cobros. Lo usan la importación CSV/Excel y la API de
   integración con TPVs: ambos entregan "tickets normalizados" y aquí se
   resuelven cliente, empleado y servicio/producto (creándolos si no existen).
   Es idempotente: un ticket con la misma referencia no se importa dos veces. */
import { tx } from './db.js';
import { isDate } from './dates.js';

const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const digits = (s) => String(s ?? '').replace(/\D/g, '');

export function normMethod(m) {
  const s = norm(m);
  if (!s) return 'tarjeta';
  if (/efectivo|cash|metalico|contado/.test(s)) return 'efectivo';
  if (/bizum/.test(s)) return 'bizum';
  if (/tarjeta|card|datafono|tpv|visa|mastercard|credito|debito|contactless/.test(s)) return 'tarjeta';
  if (/transfer/.test(s)) return 'transferencia';
  return 'otro';
}

export function normGender(g) {
  const s = norm(g);
  if (['m', 'f', 'mujer', 'femenino', 'female', 'w', 'woman', 'senora', 'dama'].includes(s)) return 'M';
  if (['h', 'v', 'hombre', 'masculino', 'male', 'man', 'varon', 'caballero', 'senor'].includes(s)) return 'H';
  return 'U';
}

export function normTime(t) {
  const m = String(t ?? '').trim().match(/^(\d{1,2})[:.h](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const num = (v) => (typeof v === 'number' ? v : Number(v));

function validate(t) {
  if (!isDate(t.date)) return 'fecha no válida (usa AAAA-MM-DD)';
  if (!Array.isArray(t.lines) || t.lines.length === 0) return 'el ticket no tiene líneas';
  for (const l of t.lines) {
    if (!String(l.name ?? '').trim()) return 'hay una línea sin concepto';
    if (l.qty != null && !(num(l.qty) > 0)) return `cantidad no válida en "${l.name}"`;
    if (l.price == null && l.total == null) return `falta el importe en "${l.name}"`;
    if (l.price != null && !Number.isFinite(num(l.price))) return `precio no válido en "${l.name}"`;
    if (l.total != null && !Number.isFinite(num(l.total))) return `importe no válido en "${l.name}"`;
  }
  return null;
}

export function importTickets(db, salonId, tickets, source = 'api', { dryRun = false } = {}) {
  const res = { created: 0, skipped: 0, errors: [], clientsCreated: 0, employeesCreated: 0, itemsCreated: 0, revenue: 0 };

  const emps = new Map(db.prepare('SELECT id, name FROM employees WHERE salon_id = ?').all(salonId).map((e) => [norm(e.name), e.id]));
  const services = new Map(db.prepare('SELECT id, name, duration_min FROM services WHERE salon_id = ?').all(salonId).map((s) => [norm(s.name), s]));
  const products = new Map(db.prepare('SELECT id, name FROM products WHERE salon_id = ?').all(salonId).map((p) => [norm(p.name), p]));
  const clientsByPhone = new Map();
  const clientsByName = new Map();
  for (const c of db.prepare('SELECT id, name, phone FROM clients WHERE salon_id = ?').all(salonId)) {
    if (digits(c.phone).length >= 6) clientsByPhone.set(digits(c.phone), c.id);
    if (!clientsByName.has(norm(c.name))) clientsByName.set(norm(c.name), c.id);
  }
  const existsRef = db.prepare('SELECT 1 FROM tickets WHERE salon_id = ? AND external_ref = ?');
  const insEmp = db.prepare('INSERT INTO employees (salon_id, name) VALUES (?, ?)');
  const insSrv = db.prepare('INSERT INTO services (salon_id, name, price, duration_min) VALUES (?, ?, ?, ?)');
  const insPrd = db.prepare('INSERT INTO products (salon_id, name, price) VALUES (?, ?, ?)');
  const insCli = db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insTk = db.prepare(`INSERT INTO tickets (salon_id, client_id, employee_id, date, time_start, time_end, method, total, source, external_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insLine = db.prepare(`INSERT INTO ticket_lines (ticket_id, kind, item_id, name, qty, unit_price, total, employee_id, duration_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const employeeId = (name) => {
    const k = norm(name);
    if (!k) return null;
    if (!emps.has(k)) {
      emps.set(k, dryRun ? -1 : Number(insEmp.run(salonId, String(name).trim()).lastInsertRowid));
      res.employeesCreated++;
    }
    return emps.get(k) === -1 ? null : emps.get(k);
  };

  const clientId = (c, date) => {
    if (!c || !String(c.name ?? '').trim()) return null;
    const ph = digits(c.phone);
    const k = norm(c.name);
    // Con teléfono se identifica por teléfono; sin él, por nombre.
    let id = ph.length >= 6 ? clientsByPhone.get(ph) : clientsByName.get(k);
    if (!id) {
      id = dryRun ? -1 : Number(insCli.run(salonId, String(c.name).trim(), String(c.phone ?? '').trim(), String(c.email ?? '').trim(), normGender(c.gender), date).lastInsertRowid);
      res.clientsCreated++;
      if (ph.length >= 6) clientsByPhone.set(ph, id);
      clientsByName.set(k, id);
    }
    return id === -1 ? null : id;
  };

  const run = () => {
    tickets.forEach((t, i) => {
      const err = validate(t);
      if (err) {
        res.errors.push({ index: i, ref: t.ref ?? null, error: err });
        return;
      }
      const ref = t.ref != null && String(t.ref).trim() ? `${source}:${String(t.ref).trim()}` : null;
      if (ref && existsRef.get(salonId, ref)) {
        res.skipped++;
        return;
      }
      const lines = t.lines.map((l) => {
        const qty = l.qty != null ? num(l.qty) : 1;
        const total = l.total != null ? num(l.total) : num(l.price) * qty;
        const price = l.price != null ? num(l.price) : total / qty;
        const k = norm(l.name);
        let kind = l.type === 'product' || l.type === 'service' ? l.type : (products.has(k) ? 'product' : 'service');
        let item;
        if (kind === 'service') {
          item = services.get(k);
          if (!item) {
            const dur = Number(l.duration) > 0 ? Math.round(Number(l.duration)) : 30;
            item = { id: dryRun ? null : Number(insSrv.run(salonId, String(l.name).trim(), price, dur).lastInsertRowid), duration_min: dur };
            services.set(k, item);
            res.itemsCreated++;
          }
        } else {
          item = products.get(k);
          if (!item) {
            item = { id: dryRun ? null : Number(insPrd.run(salonId, String(l.name).trim(), price).lastInsertRowid) };
            products.set(k, item);
            res.itemsCreated++;
          }
        }
        const duration = kind === 'service' ? (Number(l.duration) > 0 ? Math.round(Number(l.duration)) : item.duration_min || 30) : 0;
        return { kind, itemId: item.id, name: String(l.name).trim(), qty, price, total, employee: l.employee, duration };
      });
      const total = t.total != null && Number.isFinite(num(t.total)) ? num(t.total) : lines.reduce((s, l) => s + l.total, 0);
      const mainEmp = employeeId(t.employee ?? lines.find((l) => l.employee)?.employee);
      const cid = clientId(t.client, t.date);
      res.created++;
      res.revenue += total;
      if (dryRun) return;
      const tid = Number(insTk.run(salonId, cid, mainEmp, t.date, normTime(t.time_start), normTime(t.time_end), normMethod(t.method), total, source, ref).lastInsertRowid);
      for (const l of lines) {
        insLine.run(tid, l.kind, l.itemId, l.name, l.qty, l.price, l.total, l.employee ? employeeId(l.employee) : mainEmp, l.duration);
      }
    });
  };

  if (dryRun) run();
  else tx(db, run);
  res.revenue = Math.round(res.revenue * 100) / 100;
  return res;
}

/* Horas trabajadas por empleado y día (fichajes). Sobrescribe el mismo día. */
export function importHours(db, salonId, entries) {
  const res = { saved: 0, errors: [] };
  const emps = new Map(db.prepare('SELECT id, name FROM employees WHERE salon_id = ?').all(salonId).map((e) => [norm(e.name), e.id]));
  const up = db.prepare(`INSERT INTO work_hours (salon_id, employee_id, date, hours) VALUES (?, ?, ?, ?)
      ON CONFLICT (employee_id, date) DO UPDATE SET hours = excluded.hours`);
  tx(db, () => entries.forEach((e, i) => {
    const id = e.employee_id ? Number(e.employee_id) : emps.get(norm(e.employee));
    const valid = id && [...emps.values()].includes(id);
    if (!valid) return res.errors.push({ index: i, error: 'empleado desconocido' });
    if (!isDate(e.date)) return res.errors.push({ index: i, error: 'fecha no válida' });
    const h = Number(e.hours);
    if (!(h >= 0 && h <= 400)) return res.errors.push({ index: i, error: 'horas no válidas' });
    up.run(salonId, id, e.date, h);
    res.saved++;
  }));
  return res;
}
