/* Datos de demostración: 6 salones con 15 meses de actividad simulada
   (clientes que vuelven con su propia frecuencia, estacionalidad, altas y
   bajas, venta de producto, pedidos al distribuidor y gastos de caja).
   Es determinista: la misma fecha de hoy produce siempre los mismos datos. */
import { tx } from './db.js';
import { hashPassword, newApiKey } from './auth.js';
import { today, addDays, addMonths, monthStart, daysBetween } from './dates.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WOMEN = ['Marta', 'Elena', 'Lucía', 'Ana', 'Laura', 'Carmen', 'Sara', 'Paula', 'Irene', 'Rosa', 'Cristina', 'Nuria', 'Alba', 'Julia', 'Sofía', 'Marina', 'Beatriz', 'Eva', 'Raquel', 'Silvia', 'Noelia', 'Patricia', 'Inés', 'Claudia', 'Andrea', 'Teresa', 'Pilar', 'Lorena', 'Ainhoa', 'Maite'];
const MEN = ['Jorge', 'Carlos', 'Pablo', 'Diego', 'Álex', 'Javier', 'Sergio', 'David', 'Hugo', 'Mario', 'Adrián', 'Iker', 'Daniel', 'Rubén', 'Óscar', 'Raúl', 'Marcos', 'Unai', 'Víctor', 'Luis'];
const SURNAMES = ['Gil', 'Castro', 'Santos', 'Ruiz', 'Fernández', 'García', 'López', 'Martín', 'Sánchez', 'Pérez', 'Gómez', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Serrano', 'Molina', 'Ortega', 'Delgado', 'Morales', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Lozano'];

const SALON_SERVICES = [
  // nombre, categoría, género, precio, minutos, peso mujer, peso hombre
  ['Corte y peinado mujer', 'Corte', 'M', 38, 45, 30, 0],
  ['Corte hombre', 'Corte', 'H', 18, 25, 0, 70],
  ['Peinado', 'Peinado', 'M', 22, 30, 18, 0],
  ['Color raíz', 'Color', 'M', 45, 75, 22, 0],
  ['Color completo', 'Color', 'M', 58, 90, 7, 0],
  ['Mechas / balayage', 'Color', 'M', 95, 150, 9, 0],
  ['Alisado de keratina', 'Tratamiento', 'M', 140, 150, 2, 0],
  ['Recogido', 'Peinado', 'M', 45, 60, 3, 0],
  ['Arreglo de barba', 'Barba', 'H', 12, 15, 0, 22],
  ['Color canas hombre', 'Color', 'H', 22, 35, 0, 8]
];
const SALON_ADDONS = [['Tratamiento hidratación', 'Tratamiento', 'U', 25, 20], ['Matiz / tonalizante', 'Color', 'M', 20, 20], ['Tratamiento reparador', 'Tratamiento', 'U', 35, 30]];
const BARBER_SERVICES = [
  ['Corte hombre', 'Corte', 'H', 18, 30, 0, 45],
  ['Corte + barba', 'Corte', 'H', 26, 40, 0, 30],
  ['Arreglo de barba', 'Barba', 'H', 12, 20, 0, 12],
  ['Afeitado clásico', 'Barba', 'H', 18, 30, 0, 6],
  ['Corte niño', 'Corte', 'H', 14, 20, 0, 7],
  ['Corte mujer', 'Corte', 'M', 22, 30, 1, 0]
];
const BARBER_ADDONS = [['Tratamiento capilar', 'Tratamiento', 'U', 22, 20], ['Color canas hombre', 'Color', 'H', 22, 30]];
const SALON_RETAIL = [['Champú color 300 ml', 19], ['Mascarilla hidratante 250 ml', 24], ['Aceite reparador', 26], ['Sérum puntas', 29], ['Protector térmico', 22], ['Laca fijación fuerte', 15], ['Champú rubios', 19]];
const BARBER_RETAIL = [['Cera mate', 18], ['Aceite de barba', 16], ['Champú hombre', 15], ['Pomada brillo', 17]];

const SALONS = [
  { name: 'Estudio Norte', city: 'Bilbao', plan: 'Pro', fee: 79, email: 'norte@demo.com', owner: 'Estudio Norte', barber: false, clients: 270, trend: 0.016, lastOrder: 12, interval: 24, consumption: 0.084, staff: [['Laura M.', 'Estilista senior', 0.42], ['Iván S.', 'Colorista', 0.3], ['Nerea P.', 'Estilista', 0.38], ['Carlos R.', 'Barbero', 0.2]] },
  { name: 'Peluquería Alba', city: 'Valencia', plan: 'Pro', fee: 79, email: 'alba@demo.com', owner: 'Peluquería Alba', barber: false, clients: 400, trend: 0.006, lastOrder: 27, interval: 30, consumption: 0.097, staff: [['Rocío V.', 'Directora técnica', 0.4], ['Marta L.', 'Colorista', 0.33], ['Nerea G.', 'Estilista', 0.28], ['Sonia P.', 'Estilista', 0.35], ['Kevin A.', 'Estilista', 0.22]] },
  { name: 'Barbería Ondas', city: 'Madrid', plan: 'Base', fee: 49, email: 'ondas@demo.com', owner: 'Barbería Ondas', barber: true, clients: 380, trend: 0.012, lastOrder: 18, interval: 21, consumption: 0.07, staff: [['Toni B.', 'Barbero', 0.35], ['Rafa C.', 'Barbero', 0.25], ['Samuel O.', 'Barbero', 0.3]] },
  { name: 'Salón Lía', city: 'Sevilla', plan: 'Pro', fee: 79, email: 'lia@demo.com', owner: 'Salón Lía', barber: false, clients: 320, trend: -0.002, lastOrder: 19, interval: 30, consumption: 0.088, staff: [['Lía R.', 'Estilista senior', 0.36], ['Carmen D.', 'Estilista', 0.3], ['Alba F.', 'Colorista', 0.27], ['Iris M.', 'Auxiliar', 0.15]] },
  { name: 'Casa Rizo', city: 'Zaragoza', plan: 'Base', fee: 49, email: 'rizo@demo.com', owner: 'Casa Rizo', barber: false, clients: 190, trend: -0.028, lastOrder: 8, interval: 45, consumption: 0.106, staff: [['Pilar Z.', 'Estilista senior', 0.25], ['Óscar T.', 'Estilista', 0.18], ['Maite N.', 'Estilista', 0.2]] },
  { name: 'Atelier Sol', city: 'Málaga', plan: 'Pro', fee: 79, email: 'sol@demo.com', owner: 'Atelier Sol', barber: false, clients: 350, trend: 0.01, lastOrder: 9, interval: 26, consumption: 0.081, premium: 1.18, staff: [['Sol A.', 'Directora', 0.45], ['Nora B.', 'Colorista', 0.38], ['Hugo C.', 'Estilista', 0.3], ['Vera D.', 'Estilista', 0.33]] }
];

/* Más visitas en diciembre y primavera, menos en agosto y enero. */
const SEASON = [0.88, 0.92, 1.0, 1.02, 1.05, 1.1, 1.0, 0.82, 1.02, 1.0, 1.02, 1.28];

export function seedDemo(db, { password = 'demo1234' } = {}) {
  const t = today();
  const start = `${Number(t.slice(0, 4)) - 1}-01-01`;
  const pw = hashPassword(password);

  tx(db, () => {
    db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES ('admin@demo.com', 'Distribuidor', ?, 'admin')").run(pw);

    SALONS.forEach((cfg, si) => {
      const r = rng(1000 + si * 7919);
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const weighted = (arr, wIdx) => {
        const total = arr.reduce((s, a) => s + a[wIdx], 0);
        let x = r() * total;
        for (const a of arr) { x -= a[wIdx]; if (x <= 0) return a; }
        return arr[arr.length - 1];
      };
      const premium = cfg.premium || 1;

      const created = addDays(start, -200);
      const sid = Number(db.prepare(`INSERT INTO salons (name, city, plan, monthly_fee, hours_per_employee, product_target_pct, opening_float, api_key, created_at)
          VALUES (?, ?, ?, ?, 150, 8, 150, ?, ?)`).run(cfg.name, cfg.city, cfg.plan, cfg.fee, newApiKey(), si === 1 ? addDays(t, -60) : created).lastInsertRowid);
      db.prepare("INSERT INTO users (email, name, password_hash, role, salon_id) VALUES (?, ?, ?, 'owner', ?)").run(cfg.email, cfg.owner, pw, sid);

      const emps = cfg.staff.map(([name, role, retail]) => ({
        id: Number(db.prepare('INSERT INTO employees (salon_id, name, role) VALUES (?, ?, ?)').run(sid, name, role).lastInsertRowid), retail, barber: /barber/i.test(role)
      }));

      const mains = cfg.barber ? BARBER_SERVICES : SALON_SERVICES;
      const addons = cfg.barber ? BARBER_ADDONS : SALON_ADDONS;
      const insSrv = db.prepare('INSERT INTO services (salon_id, name, category, gender, price, duration_min) VALUES (?, ?, ?, ?, ?, ?)');
      const srv = new Map();
      for (const s of [...mains, ...addons]) {
        if (srv.has(s[0])) continue;
        const price = Math.round(s[3] * premium);
        srv.set(s[0], { id: Number(insSrv.run(sid, s[0], s[1], s[2], price, s[4]).lastInsertRowid), name: s[0], price, dur: s[4] });
      }
      const retail = (cfg.barber ? BARBER_RETAIL : SALON_RETAIL).map(([name, price]) => ({
        id: Number(db.prepare("INSERT INTO products (salon_id, name, kind, price, cost) VALUES (?, ?, 'retail', ?, ?)").run(sid, name, price, Math.round(price * 0.5 * 100) / 100).lastInsertRowid), name, price
      }));
      db.prepare("INSERT INTO products (salon_id, name, kind, price, cost) VALUES (?, 'Tinte profesional 60 ml', 'tecnico', 0, 7.5)").run(sid);
      db.prepare("INSERT INTO products (salon_id, name, kind, price, cost) VALUES (?, 'Oxidante 1 L', 'tecnico', 0, 6)").run(sid);

      const insCli = db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const insTk = db.prepare(`INSERT INTO tickets (salon_id, client_id, employee_id, date, time_start, time_end, method, total, source, external_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tpv', ?)`);
      const insLine = db.prepare('INSERT INTO ticket_lines (ticket_id, kind, item_id, name, qty, unit_price, total, employee_id, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

      // Clientes: una parte ya existía antes del periodo, el resto llega poco a poco.
      const totalDays = daysBetween(start, t);
      const nClients = Math.round(cfg.clients * 1.9);
      const trendAt = (d) => 1 + cfg.trend * (daysBetween(start, d) / 30.4 - 10);
      let ref = 0;
      for (let c = 0; c < nClients; c++) {
        const women = cfg.barber ? r() < 0.05 : r() < 0.74;
        const name = `${pick(women ? WOMEN : MEN)} ${pick(SURNAMES)}`;
        const existing = c < cfg.clients * 0.8;
        let first = existing ? addDays(start, -Math.floor(r() * 50)) : addDays(start, Math.floor(r() * totalDays));
        // Salones en declive captan menos clientes nuevos al final del periodo.
        if (!existing && cfg.trend < 0 && r() < (daysBetween(start, first) / totalDays) * 0.6) continue;
        if (!existing && cfg.trend > 0 && r() < 0.15 && daysBetween(start, first) < totalDays / 2) first = addDays(first, Math.floor(totalDays / 2));
        if (first > t) continue;
        const interval = women ? 24 + r() * 40 : 16 + r() * 22;
        const churnPerVisit = existing ? 0.022 : 0.07;
        const pref = pick(emps.filter((e) => (women ? !e.barber || cfg.barber : true)).length ? emps.filter((e) => (women ? !e.barber || cfg.barber : true)) : emps);
        const mainPref = weighted(mains.filter((m) => (women ? m[5] > 0 : m[6] > 0)), women ? 5 : 6);
        const phone = `6${String(Math.floor(r() * 1e8)).padStart(8, '0')}`;
        const cid = Number(insCli.run(sid, name, phone, '', women ? 'M' : 'H', '', existing ? addDays(start, -300) : first).lastInsertRowid);

        let d = first;
        while (d <= t) {
          // Los clientes que ya existían empiezan antes del periodo: sus
          // visitas previas no se guardan, solo marcan su ritmo.
          if (d < start) {
            d = addDays(d, Math.round(interval * (0.75 + r() * 0.5)));
            continue;
          }
          const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
          if (dow === 0) d = addDays(d, 1);
          if (dow === 1 && r() < 0.7) d = addDays(d, 1);
          if (d > t) break;
          const emp = r() < 0.82 ? pref : pick(emps);
          const lines = [];
          const main = r() < 0.7 ? mainPref : weighted(mains.filter((m) => (women ? m[5] > 0 : m[6] > 0)), women ? 5 : 6);
          lines.push(srv.get(main[0]));
          if (r() < (women ? 0.28 : 0.12)) lines.push(srv.get(pick(addons.filter((a) => a[2] === 'U' || a[2] === (women ? 'M' : 'H')))[0]));
          if (women && main[0].startsWith('Color') && r() < 0.5 && srv.has('Peinado')) lines.push(srv.get('Peinado'));
          const products = [];
          if (r() < emp.retail * 0.8) {
            products.push(pick(retail));
            if (r() < 0.2) products.push(pick(retail));
          }
          const minutes = lines.reduce((s, l) => s + l.dur, 0);
          const startMin = 9 * 60 + Math.floor(r() * 20) * 30;
          const endMin = startMin + minutes + Math.floor(r() * 14) - 3;
          const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          const total = lines.reduce((s, l) => s + l.price, 0) + products.reduce((s, p) => s + p.price, 0);
          const x = r();
          const method = x < 0.64 ? 'tarjeta' : x < 0.9 ? 'efectivo' : 'bizum';
          const tid = Number(insTk.run(sid, cid, emp.id, d, hhmm(startMin), hhmm(endMin), method, total, `demo-${++ref}`).lastInsertRowid);
          for (const l of lines) insLine.run(tid, 'service', l.id, l.name, 1, l.price, l.price, emp.id, l.dur);
          for (const p of products) insLine.run(tid, 'product', p.id, p.name, 1, p.price, p.price, emp.id, 0);

          if (r() < churnPerVisit) break;
          const gap = interval * (0.75 + r() * 0.5);
          const guess = addDays(d, Math.round(gap));
          const season = SEASON[Number(guess.slice(5, 7)) - 1] * trendAt(guess);
          d = addDays(d, Math.max(7, Math.round(gap / season)));
        }
      }

      // Horas trabajadas: un registro mensual por empleado.
      for (let ym = start.slice(0, 7); ym <= t.slice(0, 7); ym = addMonths(ym, 1)) {
        const isCurrent = ym === t.slice(0, 7);
        const frac = isCurrent ? Number(t.slice(8, 10)) / 30.4 : 1;
        for (const e of emps) {
          const vacation = ym.endsWith('-08') ? 0.7 : 1;
          const h = Math.round(150 * vacation * frac * (0.92 + r() * 0.1));
          db.prepare('INSERT INTO work_hours (salon_id, employee_id, date, hours) VALUES (?, ?, ?, ?)').run(sid, e.id, monthStart(ym), h);
        }
      }

      // Pedidos de producto técnico al distribuidor (hacia atrás desde el último)
      // y pedidos de reposición de retail.
      const serviceRev = db.prepare(`SELECT COALESCE(SUM(l.total), 0) AS r FROM ticket_lines l JOIN tickets tk ON tk.id = l.ticket_id
          WHERE tk.salon_id = ? AND l.kind = 'service' AND tk.date >= ? AND tk.date < ?`);
      const insOrder = db.prepare('INSERT INTO purchase_orders (salon_id, date, supplier, amount, kind, notes) VALUES (?, ?, ?, ?, ?, ?)');
      let od = addDays(t, -cfg.lastOrder);
      while (od > start) {
        const step = Math.round(cfg.interval * (0.9 + r() * 0.2));
        const rev = serviceRev.get(sid, addDays(od, -step), od).r;
        const amount = Math.round(rev * cfg.consumption * (0.92 + r() * 0.16) / 5) * 5;
        if (amount > 0) insOrder.run(sid, od, 'Distribuidor', amount, 'tecnico', 'Color, oxidantes y tratamiento');
        od = addDays(od, -step);
      }
      for (let ym = start.slice(0, 7); ym < t.slice(0, 7); ym = addMonths(ym, 1)) {
        const rev = db.prepare(`SELECT COALESCE(SUM(l.total), 0) AS r FROM ticket_lines l JOIN tickets tk ON tk.id = l.ticket_id
            WHERE tk.salon_id = ? AND l.kind = 'product' AND tk.date >= ? AND tk.date < ?`).get(sid, monthStart(ym), monthStart(addMonths(ym, 1))).r;
        if (rev > 0 && addDays(monthStart(addMonths(ym, 1)), 2) <= t) insOrder.run(sid, addDays(monthStart(addMonths(ym, 1)), 2), 'Distribuidor', Math.round(rev * 0.5 / 5) * 5, 'retail', 'Reposición de retail');
      }

      // Gastos: alquiler mensual, pagos a proveedor y pequeños gastos en efectivo.
      const insMov = db.prepare("INSERT INTO cash_movements (salon_id, date, direction, amount, category, method, note, source) VALUES (?, ?, 'out', ?, ?, ?, ?, ?)");
      for (let ym = start.slice(0, 7); ym <= t.slice(0, 7); ym = addMonths(ym, 1)) {
        const d0 = addDays(monthStart(ym), 4);
        if (d0 <= t) insMov.run(sid, d0, cfg.barber ? 950 : 1200, 'Alquiler', 'transferencia', 'Alquiler del local', 'banco');
      }
      for (const o of db.prepare('SELECT date, amount FROM purchase_orders WHERE salon_id = ?').all(sid)) {
        insMov.run(sid, o.date, o.amount, 'Proveedor de producto', 'transferencia', 'Pago pedido distribuidor', 'banco');
      }
      for (let d = addDays(t, -90); d <= t; d = addDays(d, 1)) {
        if (r() < 0.35) insMov.run(sid, d, Math.round((6 + r() * 30) * 100) / 100, pick(['Café y agua', 'Limpieza', 'Material de oficina', 'Lavandería']), 'efectivo', '', 'manual');
      }

      // Cierres de caja de los últimos 14 días (el de hoy queda abierto).
      for (let d = addDays(t, -14); d < t; d = addDays(d, 1)) {
        const cashIn = db.prepare("SELECT COALESCE(SUM(total), 0) AS s FROM tickets WHERE salon_id = ? AND date = ? AND method = 'efectivo'").get(sid, d).s;
        const cashOut = db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM cash_movements WHERE salon_id = ? AND date = ? AND direction = 'out' AND method = 'efectivo'").get(sid, d).s;
        if (!cashIn && !cashOut) continue;
        const expected = Math.round((150 + cashIn - cashOut) * 100) / 100;
        const diff = r() < 0.8 ? 0 : Math.round((r() * 10 - 6) * 100) / 100;
        db.prepare('INSERT INTO cash_closings (salon_id, date, opening, expected, counted, diff) VALUES (?, ?, 150, ?, ?, ?)').run(sid, d, expected, expected + diff, diff);
      }

      // Notas técnicas en algunas fichas.
      const notes = ['Fórmula color: 6.1 + 7.1 (1:1), oxidante 20 vol, 35 min.', 'Cuero cabelludo sensible: usar champú suave.', 'Prefiere citas los sábados por la mañana.', 'Degradado bajo, número 1 en laterales.', 'Alergia a PPD: usar coloración sin amoniaco.'];
      for (const row of db.prepare('SELECT id FROM clients WHERE salon_id = ? ORDER BY id LIMIT 40').all(sid)) {
        if (r() < 0.4) db.prepare('UPDATE clients SET notes = ? WHERE id = ?').run(pick(notes), row.id);
      }
    });
  });
}
