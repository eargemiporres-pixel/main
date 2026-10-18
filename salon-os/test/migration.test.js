import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { detectKind, guessMapping, migrate } from '../src/migration.js';

process.env.SALON_TODAY = '2026-10-17';

function fresh() {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO salons (id, name) VALUES (1, 'Mi salón')").run();
  return { db, salon: db.prepare('SELECT * FROM salons WHERE id = 1').get() };
}

// Columnas al estilo de las exportaciones de programas en inglés (Fresha, Booksy…).
const CLIENTS_EN = [
  ['First Name', 'Last Name', 'Mobile Number', 'Email', 'Gender', 'Date of Birth', 'Client Notes', 'Added'],
  ['Ana', 'García López', '+34 600 111 222', 'ana@x.com', 'Female', '1990-04-12', 'Alergia a PPD', '2023-02-01'],
  ['Pedro', 'Ruiz', '611222333', '', 'Male', '', '', '2024-05-10'],
  ['', '', '', '', '', '', '', '']
];
// Columnas al estilo de programas en español (Koibox, Flowww, Excel propio).
const CLIENTS_ES = [
  ['Nombre', 'Apellidos', 'Teléfono móvil', 'Correo electrónico', 'Observaciones'],
  ['Ana', 'García López', '600111222', 'ANA@x.com', 'Prefiere los sábados'],
  ['Lucía', 'Pérez', '622333444', '', '']
];
const SERVICES = [
  ['Service name', 'Category', 'Duration', 'Retail price'],
  ['Corte señora', 'Corte', '45min', '32,00 €'],
  ['Mechas', 'Color', '2h 30min', '95'],
  ['Barba', 'Caballero', '0:20', '12']
];
const APPOINTMENTS = [
  ['Ref #', 'Client', 'Mobile', 'Service', 'Team member', 'Scheduled date', 'Time', 'Duration', 'Price', 'Status'],
  ['1001', 'Ana García López', '600111222', 'Corte señora', 'Laura', '20/10/2026', '10:00', '45', '32', 'Booked'],
  ['1002', 'Marta Nueva', '633444555', 'Mechas', 'Sonia', '21/10/2026', '16:30', '150', '95', 'Confirmed'],
  ['1003', 'Pedro Ruiz', '611222333', 'Barba', 'Laura', '02/10/2026', '12:00', '20', '12', 'Completed']
];
const SALES = [
  ['Nº ticket', 'Fecha', 'Cliente', 'Concepto', 'Tipo', 'Importe', 'Forma de pago', 'Empleado'],
  ['T1', '01/09/2026', 'Ana García López', 'Corte señora', 'Servicio', '32', 'Tarjeta', 'Laura'],
  ['T1', '01/09/2026', 'Ana García López', 'Champú', 'Producto', '18', 'Tarjeta', 'Laura']
];

test('reconoce el tipo de cada archivo por sus columnas', () => {
  assert.equal(detectKind(CLIENTS_EN[0]), 'clients');
  assert.equal(detectKind(CLIENTS_ES[0]), 'clients');
  assert.equal(detectKind(SERVICES[0]), 'services');
  assert.equal(detectKind(APPOINTMENTS[0]), 'appointments');
  assert.equal(detectKind(SALES[0]), 'sales');
  assert.equal(detectKind(['Producto', 'PVP', 'Coste', 'EAN']), 'products');
  assert.equal(detectKind(['Columna A', 'Columna B']), null);
  const m = guessMapping('clients', CLIENTS_ES[0]);
  assert.deepEqual({ first: m.first_name, last: m.last_name, phone: m.phone, email: m.email }, { first: 0, last: 1, phone: 2, email: 3 });
});

test('clientas: vista previa sin guardar, importación y sin duplicados al cruzar dos programas', () => {
  const { db, salon } = fresh();
  const preview = migrate(db, salon, { kind: 'auto', rows: CLIENTS_EN, source: 'fresha' });
  assert.equal(preview.kind, 'clients');
  assert.equal(preview.result.created, 2);
  assert.equal(preview.skipped, 1, 'la fila vacía se ignora');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clients').get().n, 0, 'la vista previa no guarda nada');

  const r = migrate(db, salon, { kind: 'clients', rows: CLIENTS_EN, source: 'fresha', dryRun: false });
  assert.equal(r.result.created, 2);
  const ana = db.prepare("SELECT * FROM clients WHERE name = 'Ana García López'").get();
  assert.equal(ana.gender, 'M');
  assert.equal(ana.birthdate, '1990-04-12');
  assert.equal(ana.created_at, '2023-02-01');
  assert.equal(ana.import_source, 'fresha');

  // Segundo archivo de otro programa: Ana se reconoce por el teléfono y solo se completa.
  const r2 = migrate(db, salon, { kind: 'clients', rows: CLIENTS_ES, source: 'koibox', dryRun: false });
  assert.deepEqual({ c: r2.result.created, u: r2.result.updated }, { c: 1, u: 1 });
  const ana2 = db.prepare('SELECT * FROM clients WHERE id = ?').get(ana.id);
  assert.match(ana2.notes, /Alergia a PPD\nPrefiere los sábados/);
  assert.equal(ana2.email, 'ana@x.com', 'no se pisa lo que ya había');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clients').get().n, 3);
  // Repetir la misma importación no cambia nada.
  const r3 = migrate(db, salon, { kind: 'clients', rows: CLIENTS_ES, source: 'koibox', dryRun: false });
  assert.deepEqual({ c: r3.result.created, u: r3.result.updated }, { c: 0, u: 0 });
});

test('servicios con duraciones escritas de varias formas', () => {
  const { db, salon } = fresh();
  migrate(db, salon, { kind: 'auto', rows: SERVICES, dryRun: false });
  const rows = db.prepare('SELECT name, price, duration_min FROM services ORDER BY id').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [
    { name: 'Corte señora', price: 32, duration_min: 45 },
    { name: 'Mechas', price: 95, duration_min: 150 },
    { name: 'Barba', price: 12, duration_min: 20 }
  ]);
  const again = migrate(db, salon, { kind: 'services', rows: [SERVICES[0], ['Corte señora', 'Corte', '50', '34']], dryRun: false });
  assert.equal(again.result.updated, 1);
  assert.equal(db.prepare("SELECT price FROM services WHERE name = 'Corte señora'").get().price, 34);
});

test('citas: crea profesionales, enlaza clientas y no duplica al reimportar', () => {
  const { db, salon } = fresh();
  migrate(db, salon, { kind: 'clients', rows: CLIENTS_EN, dryRun: false });
  migrate(db, salon, { kind: 'services', rows: SERVICES, dryRun: false });
  const pre = migrate(db, salon, { kind: 'auto', rows: APPOINTMENTS, source: 'fresha' });
  assert.equal(pre.kind, 'appointments');
  assert.deepEqual({ c: pre.result.created, e: pre.result.employeesCreated, up: pre.result.upcoming }, { c: 3, e: 2, up: 2 });
  const r = migrate(db, salon, { kind: 'appointments', rows: APPOINTMENTS, source: 'fresha', dryRun: false });
  assert.equal(r.result.created, 3);
  const a = db.prepare("SELECT a.*, c.name AS cname, e.name AS ename FROM appointments a LEFT JOIN clients c ON c.id = a.client_id LEFT JOIN employees e ON e.id = a.employee_id WHERE a.date = '2026-10-21'").get();
  assert.deepEqual({ start: a.start, end: a.end, c: a.cname, e: a.ename }, { start: '16:30', end: '19:00', c: 'Marta Nueva', e: 'Sonia' });
  assert.equal(db.prepare("SELECT client_id FROM appointments WHERE date = '2026-10-20'").get().client_id,
    db.prepare("SELECT id FROM clients WHERE name = 'Ana García López'").get().id, 'enlaza por teléfono');
  const svc = db.prepare('SELECT * FROM appointment_services WHERE appointment_id = ?').get(a.id);
  assert.equal(svc.name, 'Mechas');
  assert.ok(svc.service_id, 'enlaza con el servicio del menú');
  const again = migrate(db, salon, { kind: 'appointments', rows: APPOINTMENTS, source: 'fresha', dryRun: false });
  assert.deepEqual({ c: again.result.created, u: again.result.updated }, { c: 0, u: 3 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM appointments').get().n, 3);
});

test('ventas: agrupa líneas por ticket y no duplica', () => {
  const { db, salon } = fresh();
  const r = migrate(db, salon, { kind: 'auto', rows: SALES, source: 'koibox', dryRun: false });
  assert.equal(r.kind, 'sales');
  assert.equal(r.result.created, 1);
  assert.equal(db.prepare('SELECT total FROM tickets').get().total, 50);
  assert.equal(migrate(db, salon, { kind: 'sales', rows: SALES, source: 'koibox', dryRun: false }).result.created, 0);
});

test('columnas elegidas a mano y avisos claros', () => {
  const { db, salon } = fresh();
  const rows = [['Col1', 'Col2'], ['Ana', '600111222']];
  const bad = migrate(db, salon, { kind: 'clients', rows });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Nombre completo o Nombre/);
  const ok = migrate(db, salon, { kind: 'clients', rows, mapping: { name: 0, phone: 1 }, dryRun: false });
  assert.equal(ok.result.created, 1);
  const unknown = migrate(db, salon, { kind: 'auto', rows: [['Col1', 'Col2'], ['x', 'y']] });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /No reconozco/);
});

// Histórico de caja, facturas, cobros y bonos, con columnas como las de los programas en español.
const CASH = [
  ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Importe', 'Forma de pago'],
  ['01/09/2026', 'Salida', 'Compra de toallas', 'Material', '24,50', 'Efectivo'],
  ['01/09/2026', 'Entrada', 'Ventas del día', 'Ventas', '310', 'Efectivo'],
  ['02/09/2026', 'Salida', 'Café', 'Varios', '-3,20', 'Efectivo'],
  ['02/09/2026', 'Salida', 'Café', 'Varios', '-3,20', 'Efectivo']
];
const CASH_DEBE_HABER = [['Fecha', 'Concepto', 'Debe', 'Haber'], ['03/09/2026', 'Fondo de caja', '150', ''], ['03/09/2026', 'Pago proveedor', '', '80']];
const CLOSINGS = [['Fecha cierre', 'Fondo inicial', 'Saldo teórico', 'Arqueo', 'Descuadre'], ['01/09/2026', '150', '435,50', '430', '-5,50']];
const INVOICES = [
  ['Serie', 'Nº factura', 'Fecha emisión', 'Cliente', 'NIF', 'Base imponible', 'Cuota IVA', 'Total', 'Estado'],
  ['A', '2026-0001', '05/09/2026', 'Ana García López', '12345678Z', '41,32', '8,68', '50,00', 'Cobrada'],
  ['A', '2026-0002', '06/09/2026', 'Eventos Norte SL', 'B12345678', '200', '42', '242', 'Pendiente'],
  ['A', '2026-0003', '07/09/2026', 'Pedro Ruiz', '', '', '', '18,15', 'Anulada']
];
const PAYMENTS = [
  ['Fecha', 'Cliente', 'Concepto', 'Importe', 'Entregado', 'Pendiente', 'Forma de pago'],
  ['10/09/2026', 'Ana García López', 'Mechas + tratamiento', '120', '60', '60', 'Tarjeta'],
  ['11/09/2026', 'Pedro Ruiz', 'Corte', '18', '18', '0', 'Efectivo']
];
const VOUCHERS = [
  ['Código', 'Cliente', 'Bono', 'Sesiones', 'Sesiones restantes', 'Importe', 'Fecha compra', 'Caducidad'],
  ['B-001', 'Ana García López', 'Bono 5 tratamientos', '5', '3', '150', '01/06/2026', '31/12/2026'],
  ['B-002', 'Pedro Ruiz', 'Bono 10 cortes', '10', '0', '160', '01/01/2026', '31/12/2026'],
  ['TR-77', 'Lucía Pérez', 'Tarjeta regalo', '', '', '50', '01/09/2026', '01/03/2027']
];

test('reconoce caja, cierres, facturas, cobros y bonos', () => {
  assert.equal(detectKind(CASH[0]), 'cash');
  assert.equal(detectKind(CASH_DEBE_HABER[0]), 'cash');
  assert.equal(detectKind(CLOSINGS[0]), 'closings');
  assert.equal(detectKind(INVOICES[0]), 'invoices');
  assert.equal(detectKind(PAYMENTS[0]), 'payments');
  assert.equal(detectKind(VOUCHERS[0]), 'vouchers');
  // Los tipos de antes se siguen reconociendo igual.
  assert.equal(detectKind(SALES[0]), 'sales');
  assert.equal(detectKind(APPOINTMENTS[0]), 'appointments');
  assert.equal(detectKind(CLIENTS_ES[0]), 'clients');
});

test('caja: entradas y salidas, sin duplicar ni contar dos veces las ventas', () => {
  const { db, salon } = fresh();
  migrate(db, salon, { kind: 'sales', rows: SALES, dryRun: false }); // hay ventas el 01/09
  const r = migrate(db, salon, { kind: 'auto', rows: CASH, source: 'koibox', dryRun: false });
  assert.equal(r.kind, 'cash');
  assert.equal(r.result.created, 3, 'dos cafés iguales son dos movimientos');
  assert.equal(r.result.salesSkipped, 1, 'las ventas del día ya están en Ventas');
  const rows = db.prepare("SELECT date, direction, amount, category, method FROM cash_movements ORDER BY id").all().map((x) => ({ ...x }));
  assert.deepEqual(rows[0], { date: '2026-09-01', direction: 'out', amount: 24.5, category: 'Material', method: 'efectivo' });
  assert.equal(rows[1].amount, 3.2);
  assert.equal(migrate(db, salon, { kind: 'cash', rows: CASH, source: 'koibox', dryRun: false }).result.created, 0, 'reimportar no duplica');
  const dh = migrate(db, salon, { kind: 'cash', rows: CASH_DEBE_HABER, dryRun: false });
  assert.deepEqual({ in: dh.result.in, out: dh.result.out }, { in: 150, out: 80 });
  // Cierres de caja
  const c = migrate(db, salon, { kind: 'auto', rows: CLOSINGS, dryRun: false });
  assert.equal(c.kind, 'closings');
  assert.deepEqual({ ...db.prepare('SELECT opening, expected, counted, diff FROM cash_closings').get() }, { opening: 150, expected: 435.5, counted: 430, diff: -5.5 });
});

test('facturas: importes, estados, NIF y enlace con la clienta', () => {
  const { db, salon } = fresh();
  migrate(db, salon, { kind: 'clients', rows: CLIENTS_EN, dryRun: false });
  const pre = migrate(db, salon, { kind: 'auto', rows: INVOICES, source: 'flowww' });
  assert.equal(pre.kind, 'invoices');
  assert.deepEqual({ c: pre.result.created, total: pre.result.total, pending: pre.result.pending }, { c: 3, total: 292, pending: 242 });
  migrate(db, salon, { kind: 'invoices', rows: INVOICES, source: 'flowww', dryRun: false });
  const inv = db.prepare("SELECT * FROM invoices WHERE number = '2026-0001'").get();
  assert.deepEqual({ base: inv.base, tax: inv.tax, rate: inv.tax_rate, total: inv.total, status: inv.status, paid: inv.paid }, { base: 41.32, tax: 8.68, rate: 21, total: 50, status: 'pagada', paid: 50 });
  assert.equal(inv.client_id, db.prepare("SELECT id FROM clients WHERE name = 'Ana García López'").get().id);
  assert.equal(db.prepare('SELECT tax_id FROM clients WHERE id = ?').get(inv.client_id).tax_id, '12345678Z');
  const company = db.prepare("SELECT * FROM invoices WHERE number = '2026-0002'").get();
  assert.deepEqual({ status: company.status, paid: company.paid, client: company.client_id }, { status: 'pendiente', paid: 0, client: null }, 'las empresas no se convierten en clientas');
  assert.equal(db.prepare("SELECT status FROM invoices WHERE number = '2026-0003'").get().status, 'anulada');
  // Al reimportar con la factura ya cobrada, se actualiza.
  const later = [INVOICES[0], INVOICES[1], ['A', '2026-0002', '06/09/2026', 'Eventos Norte SL', 'B12345678', '200', '42', '242', 'Cobrada']];
  const r = migrate(db, salon, { kind: 'invoices', rows: later, source: 'flowww', dryRun: false });
  assert.equal(r.result.updated, 2);
  assert.equal(db.prepare("SELECT status FROM invoices WHERE number = '2026-0002'").get().status, 'pagada');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 3);
});

test('cobros y deudas, y bonos con sesiones restantes', () => {
  const { db, salon } = fresh();
  migrate(db, salon, { kind: 'clients', rows: CLIENTS_EN, dryRun: false });
  migrate(db, salon, { kind: 'clients', rows: CLIENTS_ES, dryRun: false });
  const p = migrate(db, salon, { kind: 'auto', rows: PAYMENTS, dryRun: false });
  assert.equal(p.kind, 'payments');
  assert.deepEqual({ collected: p.result.collected, pending: p.result.pending }, { collected: 78, pending: 60 });
  assert.equal(db.prepare("SELECT status FROM payments WHERE client_name = 'Ana García López'").get().status, 'parcial');
  const v = migrate(db, salon, { kind: 'auto', rows: VOUCHERS, dryRun: false });
  assert.equal(v.kind, 'vouchers');
  assert.equal(v.result.active, 2);
  const ana = { ...db.prepare("SELECT kind, sessions_total, sessions_used, status, client_id FROM vouchers WHERE code = 'B-001'").get() };
  assert.deepEqual({ ...ana, client_id: !!ana.client_id }, { kind: 'bono', sessions_total: 5, sessions_used: 2, status: 'activo', client_id: true });
  assert.equal(db.prepare("SELECT status FROM vouchers WHERE code = 'B-002'").get().status, 'agotado');
  const card = db.prepare("SELECT kind, balance, status FROM vouchers WHERE code = 'TR-77'").get();
  assert.deepEqual({ ...card }, { kind: 'tarjeta', balance: 50, status: 'activo' });
});
