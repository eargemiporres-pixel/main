/* Consola del distribuidor: visión de toda la red de salones, señales de
   compra de producto y salones que necesitan asesoría. */
import { rangeMetrics, growth } from './metrics.js';
import { addDays, addMonths, monthStart, today, daysBetween, periodRange, comparable } from './dates.js';

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function serviceRevenue(db, salonId, from, to) {
  return db.prepare(`SELECT COALESCE(SUM(l.total), 0) AS r FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
      WHERE l.kind = 'service' AND t.salon_id = ? AND t.date >= ? AND t.date < ?`).get(salonId, from, to).r;
}

/* Señal de compra: cada salón pide cada X días de media. Si la actividad de
   los últimos 30 días es mayor que la habitual, el stock se acaba antes.
   días restantes = (intervalo medio − días desde el último pedido) / ritmo */
export function purchaseSignal(db, salonId, t = today()) {
  const orders = db.prepare("SELECT date, amount FROM purchase_orders WHERE salon_id = ? AND date <= ? AND kind IN ('tecnico', 'mixto') ORDER BY date DESC LIMIT 7").all(salonId, t);
  if (!orders.length) return { level: 'Sin datos', daysLeft: null, lastOrder: null, suggested: null, pace: null, reason: 'Aún no hay pedidos registrados.' };
  const gaps = [];
  for (let i = 0; i < orders.length - 1; i++) gaps.push(daysBetween(orders[i + 1].date, orders[i].date));
  const interval = mean(gaps.filter((g) => g > 0)) ?? 30;
  const recent = serviceRevenue(db, salonId, addDays(t, -30), addDays(t, 1));
  const base = serviceRevenue(db, salonId, addDays(t, -120), addDays(t, -30)) / 3;
  const pace = base > 0 ? Math.min(1.6, Math.max(0.5, recent / base)) : 1;
  const since = daysBetween(orders[0].date, t);
  const daysLeft = Math.round((interval - since) / pace);
  const level = daysLeft <= 7 ? 'Alta' : daysLeft <= 14 ? 'Media' : 'Baja';
  const avgOrder = mean(orders.slice(0, 3).map((o) => o.amount));
  const suggested = Math.round((avgOrder * pace) / 10) * 10;
  const reasons = [`Pide cada ${Math.round(interval)} días de media y el último pedido fue hace ${since} días.`];
  if (pace >= 1.1) reasons.push(`Actividad un ${Math.round((pace - 1) * 100)} % por encima de lo habitual.`);
  if (pace <= 0.9) reasons.push(`Actividad un ${Math.round((1 - pace) * 100)} % por debajo de lo habitual.`);
  return { level, daysLeft: Math.max(daysLeft, 0), overdue: daysLeft < 0, lastOrder: orders[0].date, interval, pace, suggested, reason: reasons.join(' ') };
}

export function networkOverview(db, ref) {
  const salons = db.prepare('SELECT * FROM salons ORDER BY name').all();
  const range = periodRange('month', ref);
  const prevRef = addMonths(ref, -1);
  const rows = salons.map((s) => {
    const m = rangeMetrics(db, s, range.from, range.to, 1);
    const c = comparable(range.from, range.to, monthStart(prevRef), monthStart(ref));
    const prev = rangeMetrics(db, s, c.prevFrom, c.prevTo, 1);
    const g = growth(db, s.id, ref);
    const gPrev = growth(db, s.id, prevRef);
    const signal = purchaseSignal(db, s.id);
    const owner = db.prepare("SELECT email, name FROM users WHERE salon_id = ? AND role = 'owner' ORDER BY id LIMIT 1").get(s.id);
    // El consumo mensual oscila con los pedidos: para comparar salones se usa
    // el de los 90 días que terminan en el mes consultado.
    const end = addDays(range.to, -1) < today() ? addDays(range.to, -1) : today();
    const tech90 = db.prepare("SELECT COALESCE(SUM(amount), 0) AS a FROM purchase_orders WHERE salon_id = ? AND kind IN ('tecnico', 'mixto') AND date > ? AND date <= ?")
      .get(s.id, addDays(end, -90), end).a;
    const srv90 = serviceRevenue(db, s.id, addDays(end, -89), addDays(end, 1));
    const consumption90 = srv90 ? (tech90 / srv90) * 100 : null;
    const alerts = [];
    const f = (n) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;
    if (g.quarterly != null && g.quarterly <= -8) alerts.push(`Facturación de los últimos 3 meses ${f(g.quarterly)} frente a los 3 anteriores.`);
    else if (g.monthly != null && g.monthly < 0 && gPrev.monthly != null && gPrev.monthly < 0) alerts.push(`Dos meses seguidos a la baja (${f(g.monthly)} este mes).`);
    if (g.yearly != null && g.yearly <= -5) alerts.push(`En lo que va de año factura ${f(g.yearly)} que el anterior.`);
    if (m.occupancy != null && m.visits > 0 && m.occupancy < 0.5) alerts.push(`Ocupación baja (${Math.round(m.occupancy * 100)} %).`);
    if (consumption90 != null && consumption90 > s.product_target_pct + 2) alerts.push(`Consumo de producto alto (${consumption90.toFixed(1).replace('.', ',')} % en 90 días).`);
    const opportunity = m.occupancy != null && m.occupancy >= 0.8 && (g.monthly ?? 0) >= 0
      ? `Ocupación del ${Math.round(m.occupancy * 100)} %: margen para subir precios o ampliar equipo.` : null;
    return {
      id: s.id, name: s.name, city: s.city, plan: s.plan, monthlyFee: s.monthly_fee, active: !!s.active,
      owner,
      revenue: m.revenue, prevRevenue: prev.revenue, growth: g.monthly, avgTicket: m.avgTicket,
      occupancy: m.occupancy, consumptionPct: consumption90, hourlyRate: m.hourlyRate,
      retailShare: m.revenue ? (m.productRevenue / m.revenue) * 100 : null,
      productPurchased: m.productPurchased, purchaseOrders: m.purchaseOrders,
      signal, alerts, risk: alerts.length > 0, opportunity
    };
  });

  const active = rows.filter((r) => r.active);
  const avg = (f) => mean(active.map(f).filter((v) => v != null));
  return {
    ref,
    label: range.label,
    kpis: {
      activeSalons: active.length,
      newSalons90d: salons.filter((s) => s.active && s.created_at >= addDays(today(), -90)).length,
      mrr: active.reduce((a, r) => a + (r.monthlyFee || 0), 0),
      networkRevenue: active.reduce((a, r) => a + r.revenue, 0),
      networkPrevRevenue: active.reduce((a, r) => a + r.prevRevenue, 0),
      productSold: active.reduce((a, r) => a + r.productPurchased, 0),
      orders: active.reduce((a, r) => a + r.purchaseOrders, 0),
      atRisk: active.filter((r) => r.risk).length
    },
    benchmark: {
      avgTicket: avg((r) => r.avgTicket),
      occupancy: avg((r) => r.occupancy),
      consumptionPct: avg((r) => r.consumptionPct),
      retailShare: avg((r) => r.retailShare),
      hourlyRate: avg((r) => r.hourlyRate)
    },
    salons: rows
  };
}
