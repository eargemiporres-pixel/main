/* Clientes: listado con estado (nueva, fiel, VIP, en riesgo) y ficha completa. */
import { today, addDays, daysBetween } from './dates.js';

const div = (a, b) => (b ? a / b : null);

/* Clasificación automática a partir del historial de visitas. */
export function classify(c, vipThreshold, t = today()) {
  if (!c.visits) return 'Sin visitas';
  const since = daysBetween(c.last_visit, t);
  if (since > 180) return 'Perdida';
  if (c.visits === 1) return since <= 60 ? 'Nueva' : 'En riesgo';
  const interval = daysBetween(c.first_visit, c.last_visit) / (c.visits - 1);
  if (since > Math.max(60, 2 * interval)) return 'En riesgo';
  if (vipThreshold != null && c.spent_12m >= vipThreshold && c.spent_12m > 0) return 'VIP';
  return c.visits >= 3 ? 'Fiel' : 'Ocasional';
}

function baseRows(db, salonId) {
  const t = today();
  return db.prepare(`SELECT c.id, c.name, c.phone, c.email, c.gender,
      COUNT(tk.id) AS visits, MIN(tk.date) AS first_visit, MAX(tk.date) AS last_visit,
      COALESCE(SUM(tk.total), 0) AS spent,
      COALESCE(SUM(CASE WHEN tk.date >= ? THEN tk.total ELSE 0 END), 0) AS spent_12m
      FROM clients c LEFT JOIN tickets tk ON tk.client_id = c.id
      WHERE c.salon_id = ? GROUP BY c.id`).all(addDays(t, -365), salonId);
}

/* Umbral VIP: el 10 % de clientes que más gasta en los últimos 12 meses. */
function vipThreshold(rows) {
  const spends = rows.map((r) => r.spent_12m).filter((s) => s > 0).sort((a, b) => b - a);
  if (spends.length < 10) return null;
  return spends[Math.floor(spends.length * 0.1)];
}

export function listClients(db, salonId, { q = '', filter = 'todos', limit = 200 } = {}) {
  const rows = baseRows(db, salonId);
  const vip = vipThreshold(rows);
  const counts = { todos: rows.length, fieles: 0, riesgo: 0, nuevos: 0, perdidos: 0 };
  const groups = { fieles: ['Fiel', 'VIP'], riesgo: ['En riesgo'], nuevos: ['Nueva'], perdidos: ['Perdida'] };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ql = norm(q.trim());
  const all = rows.map((r) => ({ ...r, state: classify(r, vip) }));
  for (const r of all) {
    for (const [k, states] of Object.entries(groups)) if (states.includes(r.state)) counts[k]++;
  }
  const shown = all
    .filter((r) => !groups[filter] || groups[filter].includes(r.state))
    .filter((r) => !ql || norm(r.name).includes(ql) || norm(r.phone).includes(ql) || norm(r.email).includes(ql))
    .sort((a, b) => (b.last_visit || '').localeCompare(a.last_visit || '') || a.name.localeCompare(b.name));
  return { counts, total: shown.length, clients: shown.slice(0, limit) };
}

export function clientDetail(db, salonId, id) {
  const c = db.prepare('SELECT * FROM clients WHERE id = ? AND salon_id = ?').get(id, salonId);
  if (!c) return null;
  const rows = baseRows(db, salonId);
  const me = rows.find((r) => r.id === c.id);
  const state = classify(me, vipThreshold(rows));
  const t = today();

  const tickets = db.prepare(`SELECT tk.id, tk.date, tk.total, tk.method, e.name AS employee
      FROM tickets tk LEFT JOIN employees e ON e.id = tk.employee_id
      WHERE tk.client_id = ? ORDER BY tk.date DESC, tk.id DESC`).all(c.id);
  const lines = db.prepare(`SELECT l.ticket_id, l.kind, l.name, l.qty, l.total FROM ticket_lines l
      JOIN tickets tk ON tk.id = l.ticket_id WHERE tk.client_id = ?`).all(c.id);
  const byTicket = new Map();
  for (const l of lines) {
    if (!byTicket.has(l.ticket_id)) byTicket.set(l.ticket_id, []);
    byTicket.get(l.ticket_id).push(l);
  }

  const top = new Map();
  const retail = new Map();
  for (const l of lines) {
    const m = l.kind === 'service' ? top : retail;
    const cur = m.get(l.name) || { name: l.name, units: 0, amount: 0 };
    cur.units += l.qty;
    cur.amount += l.total;
    m.set(l.name, cur);
  }

  const interval = me.visits >= 2 ? daysBetween(me.first_visit, me.last_visit) / (me.visits - 1) : null;
  const last12 = tickets.filter((x) => x.date >= addDays(t, -365)).length;
  const monthsKnown = me.first_visit ? Math.min(12, Math.max(1, daysBetween(me.first_visit, t) / 30.4)) : null;
  const nextVisit = interval ? addDays(me.last_visit, Math.round(interval)) : null;
  const retailList = [...retail.values()].sort((a, b) => b.amount - a.amount);

  return {
    client: c,
    state,
    stats: {
      visits: me.visits,
      firstVisit: me.first_visit,
      lastVisit: me.last_visit,
      visitsPerMonth: monthsKnown ? last12 / monthsKnown : null,
      recurrenceDays: interval,
      daysSinceLast: me.last_visit ? daysBetween(me.last_visit, t) : null,
      avgTicket: div(me.spent, me.visits),
      spent: me.spent,
      spent12m: me.spent_12m,
      retailUnits: retailList.reduce((s, r) => s + r.units, 0),
      retailAmount: retailList.reduce((s, r) => s + r.amount, 0),
      nextVisit,
      nextVisitOverdue: nextVisit ? nextVisit < t : false
    },
    topServices: [...top.values()].sort((a, b) => b.units - a.units).slice(0, 3),
    retail: retailList,
    history: tickets.slice(0, 50).map((x) => ({ ...x, lines: byTicket.get(x.id) || [] }))
  };
}
