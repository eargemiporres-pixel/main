import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { parseCsv, parseNumber, parseDate, csvToTickets } from '../src/csv.js';
import { importTickets, importHours } from '../src/importer.js';
import { rangeMetrics, growth, dashboard } from '../src/metrics.js';
import { classify, clientDetail } from '../src/clients.js';
import { periodRange, comparable } from '../src/dates.js';
import { purchaseSignal } from '../src/network.js';

process.env.SALON_TODAY = '2026-09-15';

function fixture() {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO salons (id, name, hours_per_employee, product_target_pct) VALUES (1, 'Test', 160, 8)").run();
  db.prepare("INSERT INTO salons (id, name) VALUES (2, 'Otro')").run();
  return db;
}

test('números y fechas en formato español', () => {
  assert.equal(parseNumber('1.234,56 €'), 1234.56);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('12.50'), 12.5);
  assert.equal(parseNumber('1.200'), 1200);
  assert.equal(parseNumber(''), null);
  assert.deepEqual(parseDate('26/09/2026'), { date: '2026-09-26', time: null });
  assert.deepEqual(parseDate('2026-09-26 10:30'), { date: '2026-09-26', time: '10:30' });
  assert.deepEqual(parseDate('5-3-26'), { date: '2026-03-05', time: null });
});

test('CSV con comillas, punto y coma y agrupación por ticket', () => {
  const { rows, delimiter } = parseCsv('a;b\n"x;1";"di ""hola"""\n');
  assert.equal(delimiter, ';');
  assert.deepEqual(rows[1], ['x;1', 'di "hola"']);
  const csv = 'Fecha;Nº Ticket;Cliente;Teléfono;Empleado;Tipo;Concepto;Cantidad;Importe;Forma de pago\n'
    + '01/09/2026;T1;Ana Ruiz;600111222;Laura;Servicio;Corte;1;30,00;Tarjeta\n'
    + '01/09/2026;T1;Ana Ruiz;600111222;Laura;Producto;Champú;2;30,00;Tarjeta\n'
    + '02/09/2026;T2;Luis Gil;;Carlos;Servicio;Corte hombre;1;18;Efectivo\n';
  const r = csvToTickets(csv);
  assert.equal(r.tickets.length, 2);
  assert.equal(r.tickets[0].lines.length, 2);
  assert.equal(r.mapping.ref, 'Nº Ticket');
  assert.equal(r.mapping.method, 'Forma de pago');
});

test('CSV sin columnas obligatorias devuelve un error claro', () => {
  const r = csvToTickets('nombre;precio\nx;1\n');
  assert.match(r.error, /fecha/);
});

test('importación idempotente: reimportar no duplica', () => {
  const db = fixture();
  const csv = 'fecha;ticket;cliente;telefono;empleado;tipo;concepto;cantidad;importe;metodo\n'
    + '01/09/2026;T1;Ana Ruiz;600111222;Laura;servicio;Corte;1;30;tarjeta\n'
    + '01/09/2026;T1;Ana Ruiz;600111222;Laura;producto;Champú;2;30;tarjeta\n';
  const { tickets } = csvToTickets(csv);
  const dry = importTickets(db, 1, tickets, 'csv', { dryRun: true });
  assert.equal(dry.created, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 0, 'la revisión no guarda nada');
  const a = importTickets(db, 1, tickets, 'csv');
  assert.equal(a.created, 1);
  assert.equal(a.clientsCreated, 1);
  assert.equal(a.employeesCreated, 1);
  assert.equal(a.revenue, 60);
  const b = importTickets(db, 1, tickets, 'csv');
  assert.equal(b.created, 0);
  assert.equal(b.skipped, 1);
  const line = db.prepare("SELECT * FROM ticket_lines WHERE kind = 'product'").get();
  assert.equal(line.qty, 2);
  assert.equal(line.unit_price, 15);
});

test('importación rechaza tickets inválidos sin romper el resto', () => {
  const db = fixture();
  const r = importTickets(db, 1, [
    { ref: 'ok', date: '2026-09-01', lines: [{ name: 'Corte', price: 20 }] },
    { ref: 'mal', date: '01-09-2026', lines: [{ name: 'Corte', price: 20 }] },
    { ref: 'vacío', date: '2026-09-01', lines: [] }
  ], 'api');
  assert.equal(r.created, 1);
  assert.equal(r.errors.length, 2);
});

test('métricas del periodo: ticket medio, clientes, género, horas y consumo', () => {
  const db = fixture();
  importTickets(db, 1, [
    { ref: '1', date: '2026-08-10', employee: 'Laura', client: { name: 'Ana', phone: '600000001', gender: 'M' }, lines: [{ type: 'service', name: 'Color', price: 50, duration: 60 }] },
    { ref: '2', date: '2026-09-02', time_start: '10:00', time_end: '11:00', employee: 'Laura', client: { name: 'Ana', phone: '600000001', gender: 'M' }, lines: [{ type: 'service', name: 'Color', price: 50 }, { type: 'product', name: 'Champú', price: 20 }] },
    { ref: '3', date: '2026-09-03', time_start: '12:00', time_end: '12:30', employee: 'Carlos', client: { name: 'Luis', phone: '600000002', gender: 'H' }, lines: [{ type: 'service', name: 'Corte hombre', price: 30, duration: 30 }] }
  ], 'api');
  importHours(db, 1, [{ employee: 'Laura', date: '2026-09-01', hours: 10 }, { employee: 'Carlos', date: '2026-09-01', hours: 10 }]);
  db.prepare("INSERT INTO purchase_orders (salon_id, date, amount, kind) VALUES (1, '2026-09-05', 8, 'tecnico')").run();
  const salon = db.prepare('SELECT * FROM salons WHERE id = 1').get();
  const m = rangeMetrics(db, salon, '2026-09-01', '2026-10-01', 1);
  assert.equal(m.revenue, 100);
  assert.equal(m.visits, 2);
  assert.equal(m.clients, 2);
  assert.equal(m.newClients, 1, 'Ana ya vino en agosto');
  assert.equal(m.avgTicket, 50);
  assert.equal(m.servicesWomen, 1);
  assert.equal(m.servicesMen, 1);
  assert.equal(m.retailUnits, 1);
  assert.equal(m.productRevenue, 20);
  assert.equal(m.hours, 20);
  assert.equal(m.hourlyRate, 5);
  assert.equal(m.avgMinutesPerClient, 45, 'medido con hora de inicio y fin');
  assert.equal(m.consumptionPct, 10);
  assert.equal(m.bookedHours, 1.5);
  const d = dashboard(db, salon, 'month', '2026-09');
  assert.equal(d.team.length, 2);
  assert.ok(d.recommendations.some((r) => r.tag === 'Consumo'));
});

test('periodos y comparación de meses en curso', () => {
  assert.deepEqual(periodRange('quarter', '2026-08').from, '2026-07-01');
  assert.deepEqual(periodRange('year', '2026-09').to, '2026-10-01');
  const c = comparable('2026-09-01', '2026-10-01', '2026-08-01', '2026-09-01');
  assert.equal(c.partial, true);
  assert.equal(c.to, '2026-09-16');
  assert.equal(c.prevTo, '2026-08-16');
  const done = comparable('2026-07-01', '2026-08-01', '2026-06-01', '2026-07-01');
  assert.equal(done.partial, false);
});

test('crecimiento mensual compara los mismos días', () => {
  const db = fixture();
  importTickets(db, 1, [
    { ref: 'a', date: '2026-08-10', lines: [{ name: 'X', price: 100 }] },
    { ref: 'b', date: '2026-08-25', lines: [{ name: 'X', price: 500 }] },
    { ref: 'c', date: '2026-09-10', lines: [{ name: 'X', price: 150 }] }
  ], 'api');
  assert.equal(growth(db, 1, '2026-09').monthly, 50);
});

test('estado del cliente', () => {
  const t = '2026-09-15';
  assert.equal(classify({ visits: 1, first_visit: '2026-09-01', last_visit: '2026-09-01', spent_12m: 10 }, null, t), 'Nueva');
  assert.equal(classify({ visits: 5, first_visit: '2026-01-01', last_visit: '2026-04-01', spent_12m: 10 }, null, t), 'En riesgo');
  assert.equal(classify({ visits: 5, first_visit: '2025-01-01', last_visit: '2025-12-01', spent_12m: 10 }, null, t), 'Perdida');
  assert.equal(classify({ visits: 5, first_visit: '2026-05-01', last_visit: '2026-09-01', spent_12m: 500 }, 400, t), 'VIP');
  assert.equal(classify({ visits: 5, first_visit: '2026-05-01', last_visit: '2026-09-01', spent_12m: 100 }, 400, t), 'Fiel');
});

test('ficha de cliente: recurrencia, top servicios y retail', () => {
  const db = fixture();
  const client = { name: 'Ana', phone: '600000001' };
  importTickets(db, 1, [
    { ref: '1', date: '2026-07-01', client, lines: [{ type: 'service', name: 'Color', price: 50 }] },
    { ref: '2', date: '2026-07-31', client, lines: [{ type: 'service', name: 'Color', price: 50 }, { type: 'product', name: 'Mascarilla', price: 24 }] },
    { ref: '3', date: '2026-08-30', client, lines: [{ type: 'service', name: 'Corte', price: 30 }] }
  ], 'api');
  const id = db.prepare('SELECT id FROM clients').get().id;
  const d = clientDetail(db, 1, id);
  assert.equal(d.stats.visits, 3);
  assert.equal(d.stats.recurrenceDays, 30);
  assert.equal(d.stats.nextVisit, '2026-09-29');
  assert.equal(d.topServices[0].name, 'Color');
  assert.equal(d.stats.retailAmount, 24);
  assert.equal(clientDetail(db, 2, id), null, 'otro salón no ve la ficha');
});

test('señal de compra según ciclo de pedidos', () => {
  const db = fixture();
  for (const d of ['2026-06-15', '2026-07-15', '2026-08-14']) {
    db.prepare("INSERT INTO purchase_orders (salon_id, date, amount, kind) VALUES (1, ?, 300, 'tecnico')").run(d);
  }
  const s = purchaseSignal(db, 1);
  assert.equal(s.lastOrder, '2026-08-14');
  assert.equal(s.level, 'Alta');
  assert.equal(s.suggested, 300);
});
