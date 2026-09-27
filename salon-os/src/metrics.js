/* Motor de métricas del salón. Todo se calcula a partir de los cobros
   (tickets + líneas), las horas registradas, los pedidos de compra y la
   configuración del salón. Nada se teclea dos veces. */
import { periodRange, addMonths, monthStart, elapsedMonths, comparable, today, addDays, daysBetween } from './dates.js';

const round = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const pct = (a, b) => (b ? round(((a - b) / b) * 100, 1) : null);
const div = (a, b) => (b ? a / b : null);
const int = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function revenue(db, salonId, from, to) {
  return db.prepare('SELECT COALESCE(SUM(total), 0) AS r FROM tickets WHERE salon_id = ? AND date >= ? AND date < ?')
    .get(salonId, from, to).r;
}

/* Métricas base de un rango. Se reutiliza para el periodo actual, el
   anterior y para la consola del distribuidor. */
export function rangeMetrics(db, salon, from, to, months) {
  const sid = salon.id;
  const t = db.prepare(`SELECT COUNT(*) AS visits, COALESCE(SUM(total), 0) AS revenue,
      COUNT(DISTINCT client_id) AS clients FROM tickets WHERE salon_id = ? AND date >= ? AND date < ?`).get(sid, from, to);

  const byKind = { service: { units: 0, amount: 0, minutes: 0 }, product: { units: 0, amount: 0, minutes: 0 } };
  for (const r of db.prepare(`SELECT l.kind, SUM(l.qty) AS units, SUM(l.total) AS amount,
      SUM(COALESCE(l.duration_min, 0) * l.qty) AS minutes
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE t.salon_id = ? AND t.date >= ? AND t.date < ? GROUP BY l.kind`).all(sid, from, to)) {
    byKind[r.kind] = { units: r.units || 0, amount: r.amount || 0, minutes: r.minutes || 0 };
  }

  const gender = { M: 0, H: 0, U: 0 };
  for (const r of db.prepare(`SELECT COALESCE(NULLIF(c.gender, 'U'), NULLIF(s.gender, 'U'), 'U') AS g, SUM(l.qty) AS n
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      LEFT JOIN services s ON s.id = l.item_id LEFT JOIN clients c ON c.id = t.client_id
      WHERE l.kind = 'service' AND t.salon_id = ? AND t.date >= ? AND t.date < ? GROUP BY g`).all(sid, from, to)) {
    gender[r.g] = r.n;
  }

  const newClients = db.prepare(`SELECT COUNT(*) AS n FROM (
      SELECT client_id, MIN(date) AS first FROM tickets WHERE salon_id = ? AND client_id IS NOT NULL GROUP BY client_id)
      WHERE first >= ? AND first < ?`).get(sid, from, to).n;

  const employees = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE salon_id = ? AND active = 1').get(sid).n;
  const hoursLogged = db.prepare('SELECT COALESCE(SUM(hours), 0) AS h FROM work_hours WHERE salon_id = ? AND date >= ? AND date < ?')
    .get(sid, from, to).h;

  // Horas trabajadas: las registradas (fichajes). Si no hay registro, se
  // estiman como empleados activos × horas/mes configuradas, prorrateado si
  // el periodo todavía está en curso. La capacidad del salón son esas horas.
  const effMonths = elapsedMonths(from, to) ?? months;
  const hoursEstimated = hoursLogged === 0;
  const hours = hoursEstimated ? employees * salon.hours_per_employee * effMonths : hoursLogged;
  const availableHours = hours;
  const bookedHours = byKind.service.minutes / 60;
  const revPerBookedHour = div(byKind.service.amount, bookedHours);

  const orders = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount,
      COALESCE(SUM(CASE WHEN kind IN ('tecnico', 'mixto') THEN amount ELSE 0 END), 0) AS tech
      FROM purchase_orders WHERE salon_id = ? AND date >= ? AND date < ?`).get(sid, from, to);

  const measured = db.prepare(`SELECT AVG((strftime('%s', '2000-01-01 ' || time_end) - strftime('%s', '2000-01-01 ' || time_start)) / 60.0) AS m
      FROM tickets WHERE salon_id = ? AND date >= ? AND date < ? AND time_start IS NOT NULL AND time_end IS NOT NULL AND time_end > time_start`)
    .get(sid, from, to).m;

  return {
    revenue: t.revenue,
    serviceRevenue: byKind.service.amount,
    productRevenue: byKind.product.amount,
    visits: t.visits,
    clients: t.clients,
    newClients,
    servicesSold: byKind.service.units,
    retailUnits: byKind.product.units,
    servicesWomen: gender.M,
    servicesMen: gender.H,
    servicesUnknown: gender.U,
    avgTicket: div(t.revenue, t.visits),
    employees,
    revenuePerEmployee: div(t.revenue, employees),
    clientsPerEmployee: div(t.clients, employees),
    hours,
    hoursEstimated,
    hourlyRate: div(t.revenue, hours),
    availableHours,
    bookedHours,
    occupancy: availableHours ? Math.min(1, bookedHours / availableHours) : null,
    potentialRevenue: revPerBookedHour != null ? availableHours * revPerBookedHour : null,
    avgMinutesPerClient: measured ?? div(byKind.service.minutes, t.visits),
    minutesMeasured: measured != null,
    purchaseOrders: orders.n,
    productPurchased: orders.amount,
    consumptionPct: byKind.service.amount ? (orders.tech / byKind.service.amount) * 100 : null
  };
}

export function employeeMetrics(db, salon, from, to, months) {
  const sid = salon.id;
  const emps = db.prepare('SELECT id, name, role, active FROM employees WHERE salon_id = ? ORDER BY active DESC, name').all(sid);
  const lines = new Map(db.prepare(`SELECT COALESCE(l.employee_id, t.employee_id) AS eid,
      COUNT(DISTINCT t.id) AS visits, COUNT(DISTINCT t.client_id) AS clients,
      SUM(CASE WHEN l.kind = 'service' THEN l.qty ELSE 0 END) AS services,
      SUM(CASE WHEN l.kind = 'service' THEN l.total ELSE 0 END) AS serviceAmount,
      SUM(CASE WHEN l.kind = 'product' THEN l.qty ELSE 0 END) AS retailUnits,
      SUM(CASE WHEN l.kind = 'product' THEN l.total ELSE 0 END) AS retailAmount,
      SUM(CASE WHEN l.kind = 'service' THEN COALESCE(l.duration_min, 0) * l.qty ELSE 0 END) AS minutes
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE t.salon_id = ? AND t.date >= ? AND t.date < ? GROUP BY eid`).all(sid, from, to).map((r) => [r.eid, r]));
  const hours = new Map(db.prepare('SELECT employee_id AS eid, SUM(hours) AS h FROM work_hours WHERE salon_id = ? AND date >= ? AND date < ? GROUP BY employee_id')
    .all(sid, from, to).map((r) => [r.eid, r.h]));
  const measured = new Map(db.prepare(`SELECT employee_id AS eid,
      AVG((strftime('%s', '2000-01-01 ' || time_end) - strftime('%s', '2000-01-01 ' || time_start)) / 60.0) AS m
      FROM tickets WHERE salon_id = ? AND date >= ? AND date < ? AND time_start IS NOT NULL AND time_end IS NOT NULL AND time_end > time_start
      GROUP BY employee_id`).all(sid, from, to).map((r) => [r.eid, r.m]));
  const effMonths = elapsedMonths(from, to) ?? months;

  return emps.map((e) => {
    const l = lines.get(e.id) || { visits: 0, clients: 0, services: 0, serviceAmount: 0, retailUnits: 0, retailAmount: 0, minutes: 0 };
    const logged = hours.get(e.id) || 0;
    const h = logged || (e.active ? salon.hours_per_employee * effMonths : 0);
    const revenue = (l.serviceAmount || 0) + (l.retailAmount || 0);
    return {
      id: e.id, name: e.name, role: e.role, active: !!e.active,
      clients: l.clients, visits: l.visits, services: l.services || 0,
      hours: h, hoursEstimated: !logged,
      minutesPerClient: measured.get(e.id) ?? div(l.minutes, l.visits),
      avgTicket: div(revenue, l.visits),
      hourlyRate: div(revenue, h),
      revenue,
      retailUnits: l.retailUnits || 0,
      retailAmount: l.retailAmount || 0,
      retailPerVisit: div(l.retailUnits, l.visits)
    };
  }).filter((e) => e.active || e.visits > 0);
}

export function topServices(db, salonId, from, to, limit = 8) {
  return db.prepare(`SELECT l.name, SUM(l.qty) AS units, SUM(l.total) AS amount
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE l.kind = 'service' AND t.salon_id = ? AND t.date >= ? AND t.date < ?
      GROUP BY l.name ORDER BY units DESC LIMIT ?`).all(salonId, from, to, limit);
}

export function monthlySeries(db, salonId, ref, n = 12) {
  const first = addMonths(ref, -(n - 1));
  const rows = new Map(db.prepare(`SELECT substr(t.date, 1, 7) AS ym,
      SUM(CASE WHEN l.kind = 'service' THEN l.total ELSE 0 END) AS services,
      SUM(CASE WHEN l.kind = 'product' THEN l.total ELSE 0 END) AS products
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE t.salon_id = ? AND t.date >= ? AND t.date < ? GROUP BY ym`)
    .all(salonId, monthStart(first), monthStart(addMonths(ref, 1))).map((r) => [r.ym, r]));
  return Array.from({ length: n }, (_, i) => {
    const ym = addMonths(first, i);
    const r = rows.get(ym);
    return { month: ym, services: r ? r.services : 0, products: r ? r.products : 0 };
  });
}

/* Crecimientos siempre anclados al mes de referencia:
   mensual = mes vs mes anterior; trimestral = últimos 3 meses vs los 3
   anteriores; anual = enero→mes de este año vs el mismo tramo del anterior. */
export function growth(db, salonId, ref) {
  const cmp = (a, b, pa, pb) => {
    const c = comparable(monthStart(a), monthStart(b), monthStart(pa), monthStart(pb));
    return pct(revenue(db, salonId, c.from, c.to), revenue(db, salonId, c.prevFrom, c.prevTo));
  };
  const y = Number(ref.slice(0, 4));
  const m = ref.slice(5, 7);
  const next = addMonths(ref, 1);
  return {
    monthly: cmp(ref, next, addMonths(ref, -1), ref),
    quarterly: cmp(addMonths(ref, -2), next, addMonths(ref, -5), addMonths(ref, -2)),
    yearly: cmp(`${y}-01`, next, `${y - 1}-01`, addMonths(`${y - 1}-${m}`, 1))
  };
}

/* Recomendaciones automáticas: reglas sencillas y explicables. */
export function recommendations(db, salon, m, team) {
  const out = [];
  if (m.occupancy != null && m.occupancy < 0.75 && m.availableHours > 0) {
    const free = m.availableHours - m.bookedHours;
    const perHour = div(m.serviceRevenue, m.bookedHours);
    out.push({
      tag: 'Ocupación',
      title: `Tienes ${int(free)} h de equipo sin reservar`,
      text: `Ocupación del ${Math.round(m.occupancy * 100)} %.${perHour ? ` Cada hora llena vale ≈ ${Math.round(perHour)} €: llenar la mitad supondría ≈ ${int((free / 2) * perHour)} € más.` : ''} Lanza una campaña para las franjas flojas.`
    });
  }
  if (m.consumptionPct != null && m.consumptionPct > salon.product_target_pct) {
    out.push({
      tag: 'Consumo',
      title: 'Producto técnico por encima del objetivo',
      text: `${m.consumptionPct.toFixed(1).replace('.', ',')} % sobre la facturación de servicios (objetivo ${salon.product_target_pct} %). Revisa dosificación y precios de los servicios técnicos.`
    });
  }
  const sellers = team.filter((e) => e.visits >= 10 && e.retailPerVisit != null).sort((a, b) => b.retailPerVisit - a.retailPerVisit);
  if (sellers.length >= 2) {
    const best = sellers[0];
    const worst = sellers[sellers.length - 1];
    if (best.retailPerVisit > worst.retailPerVisit * 1.5) {
      out.push({
        tag: 'Retail',
        title: `Oportunidad de venta con ${worst.name}`,
        text: `Vende ${worst.retailPerVisit.toFixed(2).replace('.', ',')} productos por visita (${best.name}: ${best.retailPerVisit.toFixed(2).replace('.', ',')}). Una recomendación por servicio sube la media.`
      });
    }
  }
  const t = today();
  const cohort = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN visits > 1 THEN 1 ELSE 0 END) AS back FROM (
      SELECT client_id, MIN(date) AS first, COUNT(*) AS visits FROM tickets WHERE salon_id = ? AND client_id IS NOT NULL GROUP BY client_id)
      WHERE first >= ? AND first < ?`).get(salon.id, addDays(t, -150), addDays(t, -60));
  if (cohort.total >= 5) {
    const rate = cohort.back / cohort.total;
    if (rate < 0.6) {
      out.push({
        tag: 'Fidelización',
        title: `Solo vuelve el ${Math.round(rate * 100)} % de los clientes nuevos`,
        text: 'Agenda la segunda cita antes de que se vayan y envía un recordatorio a las 3–4 semanas.'
      });
    }
  }
  const risk = atRiskCount(db, salon.id);
  if (risk > 0) {
    out.push({
      tag: 'Clientes',
      title: `${risk} clientes habituales llevan tiempo sin venir`,
      text: 'Están en la lista "En riesgo" de Clientes. Un mensaje personal recupera a muchos de ellos.'
    });
  }
  return out;
}

export function atRiskCount(db, salonId) {
  const t = today();
  // Mismo criterio que la ficha de cliente: habituales (2+ visitas) que llevan
  // más del doble de su frecuencia sin venir, pero menos de 180 días (después
  // se consideran perdidos).
  return db.prepare(`SELECT COUNT(*) AS n FROM (
      SELECT client_id, COUNT(*) AS visits, MIN(date) AS first, MAX(date) AS last FROM tickets
      WHERE salon_id = ? AND client_id IS NOT NULL GROUP BY client_id HAVING visits >= 2)
      WHERE julianday(?) - julianday(last) > MAX(60, 2 * (julianday(last) - julianday(first)) / (visits - 1))
        AND julianday(?) - julianday(last) <= 180`)
    .get(salonId, t, t).n;
}

export function dashboard(db, salon, period, ref) {
  const range = periodRange(period, ref);
  const m = rangeMetrics(db, salon, range.from, range.to, range.months);
  const c = comparable(range.from, range.to, range.prev.from, range.prev.to);
  const prev = rangeMetrics(db, salon, c.prevFrom, c.prevTo, range.months);
  const team = employeeMetrics(db, salon, range.from, range.to, range.months);
  return {
    period, ref, label: range.label, from: range.from, to: range.to, partial: c.partial,
    metrics: m,
    previous: { revenue: prev.revenue, avgTicket: prev.avgTicket, clients: prev.clients, visits: prev.visits, hourlyRate: prev.hourlyRate },
    growth: growth(db, salon.id, ref),
    series: monthlySeries(db, salon.id, ref),
    team,
    topServices: topServices(db, salon.id, range.from, range.to),
    recommendations: recommendations(db, salon, m, team),
    productTargetPct: salon.product_target_pct
  };
}

export { round, pct, daysBetween };
