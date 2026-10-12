/* Tiempo real de cada servicio y su rentabilidad.

   El menú de servicios dice cuánto *debería* durar cada servicio. El tiempo
   real sale de cada ticket con hora de inicio y fin (cronómetro del cobro,
   TPV o importación). Si un ticket tiene varios servicios, su tiempo real se
   reparte entre ellos en proporción a la duración del menú de cada uno; un
   ticket con un solo servicio da su tiempo exacto.

   Precio por minuto real = lo cobrado por el servicio / sus minutos reales.
   Un servicio es rentable si su precio por minuto real llega al mínimo del
   salón (0,85 €/min por defecto). */
import { periodRange } from './dates.js';
import { rangeMetrics, employeeMetrics } from './metrics.js';
import { buildXlsx, STYLE } from './xlsx.js';

const minutesBetween = (a, b) => {
  const [h1, m1] = String(a).split(':').map(Number);
  const [h2, m2] = String(b).split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
};
const div = (a, b) => (b ? a / b : null);
const MIN_REAL = 5;
const MAX_REAL = 600;

export function serviceTimes(db, salon, from, to) {
  const threshold = salon.min_price_minute ?? 0.85;
  const tickets = new Map(db.prepare(`SELECT id, time_start, time_end, time_source, employee_id FROM tickets
      WHERE salon_id = ? AND date >= ? AND date < ?`).all(salon.id, from, to).map((t) => [t.id, t]));
  const lines = db.prepare(`SELECT l.ticket_id, l.item_id, l.name, l.qty, l.total, l.duration_min, COALESCE(l.employee_id, t.employee_id) AS employee_id
      FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE l.kind = 'service' AND t.salon_id = ? AND t.date >= ? AND t.date < ?`).all(salon.id, from, to);
  const menu = new Map(db.prepare('SELECT id, name, category, gender, price, duration_min, active FROM services WHERE salon_id = ?').all(salon.id).map((s) => [s.id, s]));
  const menuByName = new Map([...menu.values()].map((s) => [s.name.toLowerCase(), s]));
  const employees = new Map(db.prepare('SELECT id, name FROM employees WHERE salon_id = ?').all(salon.id).map((e) => [e.id, e.name]));

  const byTicket = new Map();
  for (const l of lines) {
    if (!byTicket.has(l.ticket_id)) byTicket.set(l.ticket_id, []);
    byTicket.get(l.ticket_id).push(l);
  }

  const rows = new Map();
  const emp = new Map();
  const sources = {};
  let measuredUnits = 0;
  let units = 0;
  for (const [tid, ls] of byTicket) {
    const t = tickets.get(tid);
    const real = t.time_start && t.time_end ? minutesBetween(t.time_start, t.time_end) : null;
    const measured = real != null && real >= MIN_REAL && real <= MAX_REAL;
    if (measured) sources[t.time_source || 'otro'] = (sources[t.time_source || 'otro'] || 0) + 1;
    const menuTotal = ls.reduce((s, l) => s + (l.duration_min || 0) * l.qty, 0);
    for (const l of ls) {
      const key = l.item_id && menu.has(l.item_id) ? `id:${l.item_id}` : `n:${l.name.toLowerCase()}`;
      const m = (l.item_id && menu.get(l.item_id)) || menuByName.get(l.name.toLowerCase()) || null;
      if (!rows.has(key)) {
        rows.set(key, {
          name: m?.name || l.name, category: m?.category || '', gender: m?.gender || 'U', active: m ? !!m.active : true,
          menuPrice: m?.price ?? null, menuMinutes: m?.duration_min || null,
          units: 0, revenue: 0, measuredUnits: 0, measuredRevenue: 0, realMinutes: 0, menuMinutesMeasured: 0
        });
      }
      const r = rows.get(key);
      r.units += l.qty;
      r.revenue += l.total;
      units += l.qty;
      if (!measured) continue;
      const share = menuTotal > 0 ? ((l.duration_min || 0) * l.qty) / menuTotal : 1 / ls.length;
      const lineReal = real * share;
      r.measuredUnits += l.qty;
      r.measuredRevenue += l.total;
      r.realMinutes += lineReal;
      r.menuMinutesMeasured += (l.duration_min || 0) * l.qty;
      measuredUnits += l.qty;
      const e = emp.get(l.employee_id) || { id: l.employee_id, name: employees.get(l.employee_id) || 'Sin asignar', units: 0, real: 0, menu: 0, revenue: 0 };
      e.units += l.qty;
      e.real += lineReal;
      e.menu += (l.duration_min || 0) * l.qty;
      e.revenue += l.total;
      emp.set(l.employee_id, e);
    }
  }

  const services = [...rows.values()].map((r) => {
    const avgPrice = div(r.revenue, r.units);
    const realAvg = div(r.realMinutes, r.measuredUnits);
    const perMinReal = div(r.measuredRevenue, r.realMinutes);
    const perMinMenu = r.menuPrice != null && r.menuMinutes ? r.menuPrice / r.menuMinutes : null;
    const minPrice = realAvg != null ? Math.ceil(threshold * realAvg) : (r.menuMinutes ? Math.ceil(threshold * r.menuMinutes) : null);
    const basis = perMinReal ?? perMinMenu;
    return {
      name: r.name, category: r.category, gender: r.gender, active: r.active,
      units: r.units, revenue: r.revenue, avgPrice,
      menuPrice: r.menuPrice, menuMinutes: r.menuMinutes,
      realMinutes: realAvg, measuredUnits: r.measuredUnits,
      deviationPct: realAvg != null && r.menuMinutes ? ((realAvg - r.menuMinutes) / r.menuMinutes) * 100 : null,
      perMinMenu, perMinReal,
      perHourReal: perMinReal != null ? perMinReal * 60 : null,
      // Se compara con dos decimales, igual que se muestra.
      profitable: basis == null ? null : Math.round(basis * 100) / 100 >= threshold,
      basedOn: perMinReal != null ? 'real' : perMinMenu != null ? 'menu' : null,
      minPrice,
      priceGap: minPrice != null && avgPrice != null ? minPrice - avgPrice : null
    };
  }).sort((a, b) => b.units - a.units);

  const team = [...emp.values()].map((e) => ({
    ...e,
    realPerService: div(e.real, e.units),
    deviationPct: e.menu ? ((e.real - e.menu) / e.menu) * 100 : null,
    perMinReal: div(e.revenue, e.real)
  })).sort((a, b) => b.units - a.units);

  const measuredRevenue = services.reduce((s, r) => s + (r.perMinReal != null ? r.revenue : 0), 0);
  const realTotal = [...rows.values()].reduce((s, r) => s + r.realMinutes, 0);
  const revenueMeasured = [...rows.values()].reduce((s, r) => s + r.measuredRevenue, 0);
  const menuMeasured = [...rows.values()].reduce((s, r) => s + r.menuMinutesMeasured, 0);
  const unprofitable = services.filter((s) => s.profitable === false);
  const totalRevenue = services.reduce((s, r) => s + r.revenue, 0);
  return {
    threshold,
    services,
    team,
    summary: {
      units,
      measuredUnits,
      measuredShare: units ? measuredUnits / units : 0,
      sources,
      perMinReal: div(revenueMeasured, realTotal),
      deviationPct: menuMeasured ? ((realTotal - menuMeasured) / menuMeasured) * 100 : null,
      profitableCount: services.filter((s) => s.profitable === true).length,
      unprofitableCount: unprofitable.length,
      unprofitableRevenueShare: totalRevenue ? unprofitable.reduce((s, r) => s + r.revenue, 0) / totalRevenue : 0,
      measuredRevenue
    }
  };
}

/* Ticket medio de mujer y de hombre: por el género de la clienta y, si no
   consta, por el de los servicios del ticket. */
function genderTickets(db, salonId, from, to) {
  const rows = db.prepare(`SELECT t.total, c.gender AS cg,
      (SELECT group_concat(DISTINCT s.gender) FROM ticket_lines l JOIN services s ON s.id = l.item_id WHERE l.ticket_id = t.id AND l.kind = 'service') AS sg
      FROM tickets t LEFT JOIN clients c ON c.id = t.client_id WHERE t.salon_id = ? AND t.date >= ? AND t.date < ?`).all(salonId, from, to);
  const acc = { M: { n: 0, sum: 0 }, H: { n: 0, sum: 0 }, U: { n: 0, sum: 0 } };
  for (const r of rows) {
    let g = r.cg === 'M' || r.cg === 'H' ? r.cg : 'U';
    if (g === 'U' && r.sg) {
      const set = r.sg.split(',').filter((x) => x !== 'U');
      if (set.length === 1) g = set[0];
    }
    acc[g].n++;
    acc[g].sum += r.total;
  }
  return {
    women: { tickets: acc.M.n, avgTicket: div(acc.M.sum, acc.M.n), revenue: acc.M.sum },
    men: { tickets: acc.H.n, avgTicket: div(acc.H.sum, acc.H.n), revenue: acc.H.sum },
    unknown: { tickets: acc.U.n, avgTicket: div(acc.U.sum, acc.U.n), revenue: acc.U.sum }
  };
}

export function reportData(db, salon, period, ref) {
  const range = periodRange(period, ref);
  const m = rangeMetrics(db, salon, range.from, range.to, range.months);
  const team = employeeMetrics(db, salon, range.from, range.to, range.months).filter((e) => e.active || e.visits > 0);
  const times = serviceTimes(db, salon, range.from, range.to);
  const realByEmp = new Map(times.team.map((e) => [e.id, e]));
  return {
    salon: { id: salon.id, name: salon.name, city: salon.city, plan: salon.plan },
    period, ref, label: range.label, from: range.from, to: range.to,
    generatedAt: new Date().toISOString(),
    summary: {
      revenue: m.revenue, serviceRevenue: m.serviceRevenue, productRevenue: m.productRevenue,
      visits: m.visits, clients: m.clients, newClients: m.newClients,
      employees: team.filter((e) => e.active).length,
      hours: m.hours, hoursEstimated: m.hoursEstimated,
      hourlyRate: m.hourlyRate, avgTicket: m.avgTicket,
      servicesSold: m.servicesSold, servicesWomen: m.servicesWomen, servicesMen: m.servicesMen, servicesUnknown: m.servicesUnknown,
      occupancy: m.occupancy
    },
    gender: genderTickets(db, salon.id, range.from, range.to),
    team: team.map((e) => ({
      name: e.name, role: e.role, active: e.active, hours: e.hours, hoursEstimated: e.hoursEstimated,
      visits: e.visits, clients: e.clients, services: e.services, avgTicket: e.avgTicket, revenue: e.revenue,
      hourlyRate: e.hourlyRate, retailUnits: e.retailUnits, retailAmount: e.retailAmount,
      realPerService: realByEmp.get(e.id)?.realPerService ?? null,
      timeDeviationPct: realByEmp.get(e.id)?.deviationPct ?? null
    })),
    times
  };
}

const n2 = (v) => (v == null || !Number.isFinite(v) ? '' : Math.round(v * 100) / 100);
const n0 = (v) => (v == null || !Number.isFinite(v) ? '' : Math.round(v));
const pctv = (v) => (v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 1000);

export function reportXlsx(r) {
  const H = (v) => ({ v, s: STYLE.header });
  const money = (v) => ({ v: n2(v), s: STYLE.money });
  const int = (v) => ({ v: n0(v), s: STYLE.int });
  const dec = (v) => ({ v: n2(v), s: STYLE.dec });
  const pct = (v) => ({ v: pctv(v), s: STYLE.pct });
  const s = r.summary;
  const t = r.times;
  const head = [[{ v: `Reporte de ${r.salon.name}`, s: STYLE.title }], [{ v: `${r.label} · ${r.from} a ${r.to} (sin incluir) · generado ${r.generatedAt.slice(0, 10)}`, s: STYLE.muted }], []];

  const resumen = {
    name: 'Resumen',
    widths: [38, 18, 50],
    rows: [
      ...head,
      [H('Indicador'), H('Valor'), H('Nota')],
      ['Facturación total (€)', money(s.revenue)],
      ['Facturación en servicios (€)', money(s.serviceRevenue)],
      ['Facturación en producto (€)', money(s.productRevenue)],
      ['Nº de empleados que trabajan', int(s.employees)],
      ['Horas trabajadas', int(s.hours), s.hoursEstimated ? 'Estimadas: no hay horas registradas' : 'Registradas en Equipo'],
      ['Precio hora del salón (€/h)', money(s.hourlyRate), 'Facturación / horas trabajadas'],
      ['Ticket medio general (€)', money(s.avgTicket)],
      ['Ticket medio mujer (€)', money(r.gender.women.avgTicket), `${r.gender.women.tickets} tickets`],
      ['Ticket medio hombre (€)', money(r.gender.men.avgTicket), `${r.gender.men.tickets} tickets`],
      ['Servicios realizados', int(s.servicesSold)],
      ['Servicios de mujer', int(s.servicesWomen)],
      ['Servicios de hombre', int(s.servicesMen)],
      ['Visitas', int(s.visits)],
      ['Clientes atendidos', int(s.clients)],
      ['Clientes nuevos', int(s.newClients)],
      ['Ocupación de la agenda', pct(s.occupancy == null ? null : s.occupancy * 100)],
      [],
      [H('Tiempos y rentabilidad'), H(''), H('')],
      ['Mínimo para ser rentable (€/min)', dec(t.threshold)],
      ['Precio por minuto real del salón (€/min)', dec(t.summary.perMinReal)],
      ['Desviación media frente al menú', pct(t.summary.deviationPct), 'Positivo = se tarda más de lo previsto'],
      ['Servicios con tiempo medido', pct(t.summary.measuredShare * 100)],
      ['Servicios rentables', int(t.summary.profitableCount)],
      ['Servicios no rentables', int(t.summary.unprofitableCount)],
      ['Peso de los no rentables en la facturación', pct(t.summary.unprofitableRevenueShare * 100)]
    ]
  };

  const equipo = {
    name: 'Equipo',
    widths: [24, 18, 12, 12, 12, 14, 16, 16, 14, 14, 14, 16],
    rows: [
      ...head,
      [H('Empleado'), H('Puesto'), H('Horas'), H('Visitas'), H('Servicios'), H('Ticket medio (€)'), H('Facturación (€)'), H('Precio hora (€/h)'), H('Retail uds'), H('Retail (€)'), H('Min. reales/serv.'), H('Desviación tiempo')],
      ...r.team.map((e) => [e.name, e.role, int(e.hours), int(e.visits), int(e.services), money(e.avgTicket), money(e.revenue), money(e.hourlyRate), int(e.retailUnits), money(e.retailAmount), int(e.realPerService), pct(e.timeDeviationPct)])
    ]
  };

  const servicios = {
    name: 'Servicios',
    widths: [30, 14, 10, 10, 14, 16, 12, 14, 12, 14, 14, 14, 14],
    rows: [
      ...head,
      [H('Servicio'), H('Categoría'), H('Para'), H('Veces'), H('Precio menú (€)'), H('Precio medio cobrado (€)'), H('Min. menú'), H('Min. reales (media)'), H('Medidos'), H('Desviación'), H('€/min menú'), H('€/min real'), H('€/hora real')],
      ...t.services.map((x) => [x.name, x.category, x.gender === 'M' ? 'Mujer' : x.gender === 'H' ? 'Hombre' : 'Todos', int(x.units), money(x.menuPrice), money(x.avgPrice), int(x.menuMinutes), dec(x.realMinutes), int(x.measuredUnits), pct(x.deviationPct), dec(x.perMinMenu), dec(x.perMinReal), money(x.perHourReal)])
    ]
  };

  const verdict = (x) => (x.profitable == null ? { v: 'Sin datos', s: STYLE.muted } : x.profitable ? { v: 'Rentable', s: STYLE.good } : { v: 'No rentable', s: STYLE.bad });
  const rentabilidad = {
    name: 'Rentabilidad',
    widths: [30, 14, 12, 14, 16, 18, 18, 30],
    rows: [
      ...head,
      [{ v: `Rentable = al menos ${String(t.threshold).replace('.', ',')} € por minuto real de trabajo`, s: STYLE.muted }],
      [],
      [H('Servicio'), H('Resultado'), H('€/min'), H('Min. reales'), H('Precio medio (€)'), H('Precio mínimo (€)'), H('Subir (€)'), H('Calculado con')],
      ...[...t.services].sort((a, b) => (a.perMinReal ?? a.perMinMenu ?? 0) - (b.perMinReal ?? b.perMinMenu ?? 0)).map((x) => [
        x.name, verdict(x), dec(x.perMinReal ?? x.perMinMenu), dec(x.realMinutes ?? x.menuMinutes), money(x.avgPrice), money(x.minPrice),
        x.priceGap > 0 ? money(x.priceGap) : '', x.basedOn === 'real' ? `Tiempo real (${x.measuredUnits} medidos)` : x.basedOn === 'menu' ? 'Tiempo del menú (sin medir)' : ''
      ])
    ]
  };
  return buildXlsx([resumen, equipo, servicios, rentabilidad]);
}
