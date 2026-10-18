/* Migración desde otros programas (Fresha, Booksy, Treatwell, Koibox, Flowww,
   Bewe, Excel propio…). Cada programa exporta sus datos con columnas distintas:
   aquí se reconoce qué tipo de archivo es (clientas, servicios, productos,
   citas o ventas), qué columna es cada dato y se importa sin duplicar.
   Las filas llegan ya leídas (la interfaz lee CSV y Excel en el navegador). */
import { tx } from './db.js';
import { key, parseNumber, parseDate, rowsToTickets, FIELDS as SALE_FIELDS } from './csv.js';
import { importTickets, normGender, normTime, normMethod } from './importer.js';
import { upsertExternalAppointments } from './agenda.js';
import { today } from './dates.js';

const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const phoneKey = (s) => digits(s).slice(-9);
const MAX_ROWS = 50000;

/* Campos de cada tipo, con los nombres de columna que usan los programas
   (en español e inglés). label: lo que ve el salón al revisar las columnas. */
export const KINDS = {
  clients: {
    label: 'Clientas',
    fields: {
      name: { label: 'Nombre completo', syn: ['cliente', 'nombre_cliente', 'nombre_completo', 'nombre_y_apellidos', 'client', 'client_name', 'customer', 'customer_name', 'full_name', 'name', 'nombre'] },
      first_name: { label: 'Nombre', syn: ['first_name', 'firstname', 'nombre_de_pila', 'given_name', 'nombre'] },
      last_name: { label: 'Apellidos', syn: ['last_name', 'lastname', 'surname', 'apellidos', 'apellido', 'family_name'] },
      phone: { label: 'Teléfono', syn: ['telefono', 'movil', 'telefono_movil', 'tel', 'mobile', 'mobile_number', 'phone', 'phone_number', 'celular', 'whatsapp', 'telefono_1'] },
      email: { label: 'Email', syn: ['email', 'e_mail', 'correo', 'correo_electronico', 'mail', 'email_address'] },
      gender: { label: 'Género', syn: ['genero', 'sexo', 'gender', 'sex'] },
      birthdate: { label: 'Fecha de nacimiento', syn: ['fecha_nacimiento', 'fecha_de_nacimiento', 'cumpleanos', 'nacimiento', 'birthday', 'birth_date', 'date_of_birth', 'dob'] },
      notes: { label: 'Notas', syn: ['notas', 'nota', 'observaciones', 'comentarios', 'notes', 'note', 'client_notes', 'informacion_adicional'] },
      created: { label: 'Clienta desde', syn: ['fecha_alta', 'alta', 'cliente_desde', 'fecha_creacion', 'created', 'created_at', 'client_since', 'date_added', 'added', 'first_visit', 'primera_visita'] }
    },
    required: [['name', 'first_name'], ['phone', 'email', 'name', 'first_name']]
  },
  services: {
    label: 'Servicios',
    fields: {
      name: { label: 'Servicio', syn: ['servicio', 'nombre_servicio', 'nombre', 'service', 'service_name', 'name', 'tratamiento', 'treatment', 'descripcion'] },
      category: { label: 'Categoría', syn: ['categoria', 'familia', 'grupo', 'category', 'service_category', 'menu_section'] },
      price: { label: 'Precio', syn: ['precio', 'pvp', 'importe', 'tarifa', 'price', 'retail_price', 'full_price', 'precio_venta'] },
      duration: { label: 'Duración (min)', syn: ['duracion', 'duracion_min', 'minutos', 'tiempo', 'duration', 'duration_min', 'duration_minutes', 'length', 'time'] },
      gender: { label: 'Mujer / hombre', syn: ['genero', 'sexo', 'gender', 'para'] }
    },
    required: [['name'], ['price', 'duration']]
  },
  products: {
    label: 'Productos',
    fields: {
      name: { label: 'Producto', syn: ['producto', 'nombre_producto', 'articulo', 'nombre', 'product', 'product_name', 'name', 'item', 'descripcion'] },
      price: { label: 'Precio de venta', syn: ['pvp', 'precio_venta', 'precio', 'retail_price', 'price', 'sale_price', 'precio_de_venta'] },
      cost: { label: 'Coste', syn: ['coste', 'costo', 'precio_compra', 'precio_coste', 'cost', 'cost_price', 'supply_price', 'precio_de_compra'] },
      kind: { label: 'Uso (venta / técnico)', syn: ['tipo', 'uso', 'type', 'usage', 'product_type'] },
      stock: { label: 'Stock', syn: ['stock', 'existencias', 'unidades', 'stock_on_hand', 'quantity', 'cantidad'] },
      barcode: { label: 'Código', syn: ['codigo', 'codigo_barras', 'ean', 'sku', 'barcode', 'referencia'] }
    },
    required: [['name'], ['price', 'cost', 'stock', 'barcode']]
  },
  appointments: {
    label: 'Citas',
    fields: {
      date: { label: 'Fecha', syn: ['fecha', 'fecha_cita', 'dia', 'date', 'scheduled_date', 'appointment_date', 'booking_date', 'start_date', 'fecha_hora', 'start', 'inicio'] },
      start: { label: 'Hora', syn: ['hora', 'hora_inicio', 'hora_cita', 'time', 'start_time', 'scheduled_time', 'inicio'] },
      end: { label: 'Hora de fin', syn: ['hora_fin', 'fin', 'end_time', 'end', 'finish_time'] },
      duration: { label: 'Duración (min)', syn: ['duracion', 'minutos', 'duration', 'duration_min', 'duration_minutes'] },
      client: { label: 'Clienta', syn: ['cliente', 'nombre_cliente', 'client', 'client_name', 'customer', 'customer_name', 'nombre'] },
      phone: { label: 'Teléfono', syn: ['telefono', 'movil', 'phone', 'mobile', 'mobile_number', 'phone_number', 'client_phone'] },
      email: { label: 'Email', syn: ['email', 'correo', 'client_email', 'e_mail'] },
      service: { label: 'Servicio', syn: ['servicio', 'servicios', 'service', 'services', 'service_name', 'tratamiento', 'treatment', 'concepto'] },
      employee: { label: 'Profesional', syn: ['empleado', 'profesional', 'estilista', 'peluquero', 'peluquera', 'staff', 'staff_member', 'team_member', 'employee', 'stylist', 'trabajador'] },
      price: { label: 'Precio', syn: ['precio', 'importe', 'price', 'total', 'amount'] },
      status: { label: 'Estado', syn: ['estado', 'status', 'appointment_status', 'booking_status'] },
      ref: { label: 'Referencia', syn: ['ref', 'referencia', 'id', 'id_cita', 'appointment_id', 'booking_id', 'booking_ref', 'appointment_ref', 'ref_no', 'reference', 'localizador'] },
      notes: { label: 'Notas', syn: ['notas', 'observaciones', 'notes', 'comentarios', 'comments'] }
    },
    required: [['date'], ['start'], ['client', 'phone', 'service']]
  },
  sales: {
    label: 'Ventas (tickets)',
    fields: Object.fromEntries(Object.entries({
      date: 'Fecha', time_start: 'Hora de inicio', time_end: 'Hora de fin', ref: 'Nº de ticket', client: 'Clienta', phone: 'Teléfono', email: 'Email', gender: 'Género',
      employee: 'Profesional', type: 'Servicio o producto', name: 'Concepto', qty: 'Cantidad', price: 'Precio', total: 'Importe', method: 'Forma de pago', duration: 'Duración'
    }).map(([f, label]) => [f, { label, syn: SALE_FIELDS[f] }])),
    required: [['date'], ['name'], ['price', 'total']]
  }
};
Object.assign(KINDS, {
  cash: {
    label: 'Movimientos de caja',
    fields: {
      date: { label: 'Fecha', syn: ['fecha', 'date', 'dia', 'fecha_movimiento', 'fecha_hora', 'fecha_operacion'] },
      type: { label: 'Entrada o salida', syn: ['tipo', 'tipo_movimiento', 'movimiento', 'entrada_salida', 'sentido', 'direction', 'type', 'operacion'] },
      amount: { label: 'Importe', syn: ['importe', 'cantidad', 'amount', 'total', 'valor', 'importe_total'] },
      in: { label: 'Entrada', syn: ['entrada', 'entradas', 'ingreso', 'ingresos', 'debe', 'cash_in', 'money_in'] },
      out: { label: 'Salida', syn: ['salida', 'salidas', 'gasto', 'gastos', 'pago', 'pagos', 'haber', 'cash_out', 'money_out', 'retirada'] },
      concept: { label: 'Concepto', syn: ['concepto', 'descripcion', 'detalle', 'motivo', 'concept', 'description', 'note', 'notas', 'observaciones'] },
      category: { label: 'Categoría', syn: ['categoria', 'category', 'cuenta', 'partida', 'grupo'] },
      method: { label: 'Forma de pago', syn: ['forma_pago', 'forma_de_pago', 'metodo_pago', 'metodo', 'medio_pago', 'payment_method', 'medio'] },
      ref: { label: 'Referencia', syn: ['ref', 'referencia', 'id', 'n_movimiento', 'numero', 'asiento', 'id_movimiento'] }
    },
    required: [['date'], ['amount', 'in', 'out']]
  },
  closings: {
    label: 'Cierres de caja',
    fields: {
      date: { label: 'Fecha', syn: ['fecha', 'date', 'dia', 'fecha_cierre', 'fecha_arqueo'] },
      opening: { label: 'Fondo inicial', syn: ['apertura', 'fondo', 'fondo_inicial', 'saldo_inicial', 'fondo_de_caja', 'opening', 'opening_float'] },
      expected: { label: 'Esperado', syn: ['esperado', 'teorico', 'saldo_teorico', 'previsto', 'calculado', 'expected', 'efectivo_teorico', 'total_teorico'] },
      counted: { label: 'Contado', syn: ['contado', 'real', 'arqueo', 'saldo_real', 'efectivo_contado', 'counted', 'efectivo_real', 'total_real'] },
      diff: { label: 'Diferencia', syn: ['diferencia', 'descuadre', 'difference', 'desfase'] }
    },
    required: [['date'], ['counted', 'expected']]
  },
  invoices: {
    label: 'Facturas',
    fields: {
      number: { label: 'Nº de factura', syn: ['n_factura', 'numero_factura', 'num_factura', 'no_factura', 'n_de_factura', 'factura', 'numero', 'invoice', 'invoice_number', 'invoice_no', 'n'] },
      series: { label: 'Serie', syn: ['serie', 'series'] },
      date: { label: 'Fecha', syn: ['fecha', 'fecha_factura', 'fecha_emision', 'fecha_de_emision', 'date', 'invoice_date', 'issue_date'] },
      client: { label: 'Cliente', syn: ['cliente', 'nombre_cliente', 'razon_social', 'client', 'customer', 'customer_name', 'nombre', 'destinatario'] },
      tax_id: { label: 'NIF / CIF', syn: ['nif', 'cif', 'dni', 'nif_cif', 'cif_nif', 'nie', 'tax_id', 'vat_number', 'nif_cliente'] },
      concept: { label: 'Concepto', syn: ['concepto', 'descripcion', 'detalle', 'description', 'conceptos'] },
      base: { label: 'Base imponible', syn: ['base_imponible', 'base', 'subtotal', 'neto', 'importe_neto', 'net', 'net_amount', 'base_amount'] },
      tax_rate: { label: 'Tipo de IVA (%)', syn: ['tipo_iva', 'porcentaje_iva', 'iva_percent', 'iva_porcentaje', 'tax_rate', 'vat_rate', 'tipo_impositivo'] },
      tax: { label: 'Cuota de IVA', syn: ['iva', 'cuota_iva', 'importe_iva', 'cuota', 'impuesto', 'impuestos', 'tax', 'vat', 'tax_amount', 'vat_amount'] },
      total: { label: 'Total', syn: ['total', 'importe_total', 'total_factura', 'importe', 'amount', 'total_amount', 'total_con_iva'] },
      paid: { label: 'Cobrado', syn: ['cobrado', 'pagado', 'importe_cobrado', 'paid', 'amount_paid'] },
      pending: { label: 'Pendiente', syn: ['pendiente', 'por_cobrar', 'saldo', 'saldo_pendiente', 'pending', 'amount_due', 'due', 'balance'] },
      status: { label: 'Estado', syn: ['estado', 'status', 'situacion'] },
      method: { label: 'Forma de pago', syn: ['forma_pago', 'forma_de_pago', 'metodo_pago', 'payment_method', 'medio_pago', 'pago'] }
    },
    required: [['number'], ['date'], ['total', 'base']]
  },
  payments: {
    label: 'Cobros y deudas',
    fields: {
      date: { label: 'Fecha', syn: ['fecha', 'date', 'fecha_cobro', 'fecha_pago', 'payment_date', 'fecha_operacion'] },
      client: { label: 'Cliente', syn: ['cliente', 'nombre_cliente', 'client', 'customer', 'customer_name', 'nombre'] },
      concept: { label: 'Concepto', syn: ['concepto', 'descripcion', 'detalle', 'description', 'motivo'] },
      amount: { label: 'Importe', syn: ['importe', 'total', 'amount', 'cantidad', 'importe_total', 'deuda_total'] },
      paid: { label: 'Cobrado', syn: ['cobrado', 'pagado', 'importe_cobrado', 'paid', 'amount_paid', 'entregado', 'a_cuenta'] },
      pending: { label: 'Pendiente', syn: ['pendiente', 'deuda', 'por_cobrar', 'saldo', 'saldo_pendiente', 'pending', 'amount_due', 'due', 'debe'] },
      method: { label: 'Forma de pago', syn: ['forma_pago', 'forma_de_pago', 'metodo_pago', 'metodo', 'payment_method', 'medio_pago'] },
      status: { label: 'Estado', syn: ['estado', 'status', 'situacion'] },
      invoice: { label: 'Nº de factura', syn: ['n_factura', 'numero_factura', 'factura', 'invoice', 'invoice_number'] },
      ref: { label: 'Referencia', syn: ['ref', 'referencia', 'id', 'n_recibo', 'recibo', 'id_cobro', 'payment_id'] }
    },
    required: [['date'], ['amount', 'paid', 'pending']]
  },
  vouchers: {
    label: 'Bonos y tarjetas regalo',
    fields: {
      code: { label: 'Código', syn: ['codigo', 'n_bono', 'numero_bono', 'codigo_bono', 'code', 'voucher_code', 'gift_card_code', 'numero', 'referencia', 'id'] },
      kind: { label: 'Tipo', syn: ['tipo', 'type', 'clase', 'tipo_bono'] },
      client: { label: 'Cliente', syn: ['cliente', 'nombre_cliente', 'client', 'customer', 'titular', 'beneficiario', 'customer_name'] },
      description: { label: 'Bono / servicio', syn: ['bono', 'nombre_bono', 'descripcion', 'concepto', 'servicio', 'nombre', 'description', 'name', 'producto', 'paquete'] },
      sessions_total: { label: 'Sesiones totales', syn: ['sesiones', 'sesiones_totales', 'total_sesiones', 'n_sesiones', 'numero_sesiones', 'sessions', 'total_sessions', 'usos'] },
      sessions_used: { label: 'Sesiones usadas', syn: ['usadas', 'sesiones_usadas', 'consumidas', 'sesiones_consumidas', 'used', 'sessions_used', 'usos_realizados'] },
      sessions_left: { label: 'Sesiones restantes', syn: ['restantes', 'sesiones_restantes', 'sesiones_pendientes', 'pendientes', 'quedan', 'remaining', 'sessions_remaining', 'sessions_left'] },
      amount: { label: 'Importe pagado', syn: ['importe', 'precio', 'valor', 'importe_inicial', 'valor_inicial', 'amount', 'price', 'value', 'initial_value'] },
      balance: { label: 'Saldo disponible', syn: ['saldo', 'saldo_pendiente', 'saldo_restante', 'saldo_disponible', 'credito', 'balance', 'remaining_balance', 'remaining_value'] },
      purchased: { label: 'Fecha de compra', syn: ['fecha_compra', 'fecha_venta', 'fecha_alta', 'fecha', 'purchase_date', 'sold_on', 'date', 'issued'] },
      expires: { label: 'Caducidad', syn: ['caducidad', 'fecha_caducidad', 'vencimiento', 'fecha_vencimiento', 'valido_hasta', 'expiry', 'expires', 'expiry_date', 'expiration_date'] },
      status: { label: 'Estado', syn: ['estado', 'status', 'situacion'] }
    },
    required: [['code', 'client', 'description'], ['sessions_total', 'sessions_left', 'amount', 'balance']]
  }
});
export const IMPORT_ORDER = ['services', 'products', 'clients', 'appointments', 'sales', 'vouchers', 'invoices', 'payments', 'cash', 'closings'];

/* Qué columna es cada dato. Cada columna se usa una sola vez. */
export function guessMapping(kind, headers) {
  const keys = headers.map(key);
  const used = new Set();
  const mapping = {};
  const fields = Object.entries(KINDS[kind].fields);
  // Primero, coincidencias exactas de todos los campos; después, cabeceras que
  // contienen un sinónimo largo ("Teléfono móvil 1") en las columnas que quedan.
  for (const [field, def] of fields) {
    const idx = keys.findIndex((k, i) => !used.has(i) && def.syn.includes(k));
    if (idx >= 0) { mapping[field] = idx; used.add(idx); }
  }
  for (const [field, def] of fields) {
    if (mapping[field] != null) continue;
    const idx = keys.findIndex((k, i) => !used.has(i) && k && def.syn.some((sy) => sy.length >= 5 && k.includes(sy)));
    if (idx >= 0) { mapping[field] = idx; used.add(idx); }
  }
  // "Nombre" a secas con "Apellidos" al lado es nombre de pila, no nombre completo.
  if (kind === 'clients' && mapping.last_name != null && mapping.name != null && mapping.first_name == null && keys[mapping.name] === 'nombre') {
    mapping.first_name = mapping.name;
    delete mapping.name;
  }
  return mapping;
}

const satisfied = (kind, mapping) => KINDS[kind].required.every((alts) => alts.some((f) => mapping[f] != null));

/* Tipo de archivo más probable según sus columnas. */
export function detectKind(headers) {
  const keys = new Set(headers.map(key));
  const has = (...names) => names.some((n) => keys.has(n) || [...keys].some((k) => n.length >= 5 && k.includes(n)));
  const scores = {};
  for (const kind of Object.keys(KINDS)) {
    const m = guessMapping(kind, headers);
    scores[kind] = satisfied(kind, m) ? Object.keys(m).length : -1;
  }
  // Señales que distinguen tipos con columnas parecidas.
  if (has('ticket', 'n_ticket', 'factura', 'forma_pago', 'metodo_pago', 'payment', 'cantidad', 'qty', 'importe_linea')) scores.sales += 4;
  if (has('hora', 'time', 'start_time', 'scheduled_time', 'hora_inicio') && has('estado', 'status', 'team_member', 'profesional', 'staff', 'empleado')) scores.appointments += 3;
  if (has('duracion', 'duration') && !has('fecha', 'date', 'scheduled_date')) scores.services += 3;
  if (has('coste', 'cost', 'supply_price', 'stock', 'ean', 'sku', 'barcode', 'codigo_barras')) scores.products += 3;
  if (!has('fecha', 'date', 'scheduled_date', 'appointment_date') && has('email', 'correo', 'telefono', 'phone', 'mobile', 'movil')) scores.clients += 3;
  if (has('base_imponible', 'cuota_iva', 'tipo_iva', 'nif', 'cif', 'razon_social', 'n_factura', 'numero_factura', 'invoice_number', 'serie')) scores.invoices += 6;
  if (has('arqueo', 'descuadre', 'contado', 'fondo_inicial', 'saldo_teorico', 'teorico', 'apertura')) scores.closings += 6;
  if (has('entrada', 'entradas', 'salida', 'salidas', 'tipo_movimiento', 'debe', 'haber', 'ingreso', 'gasto') && !has('servicio', 'producto', 'cantidad')) scores.cash += 5;
  if (has('pendiente', 'deuda', 'por_cobrar', 'a_cuenta', 'cobrado') && !has('base_imponible', 'iva', 'nif')) scores.payments += 5;
  if (has('bono', 'sesiones', 'sesiones_restantes', 'tarjeta_regalo', 'gift_card', 'caducidad', 'saldo_disponible', 'voucher')) scores.vouchers += 6;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

/* ---- Normalización de filas ---- */
const cell = (row, mapping, f) => (mapping[f] != null ? String(row[mapping[f]] ?? '').trim() : '');

function minutes(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h || m) return Math.round((h ? parseNumber(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  const n = parseNumber(s);
  return n != null && n > 0 ? Math.round(n) : null;
}

function rowsOf(kind, rows, mapping) {
  return rows.slice(1).map((r, i) => ({ line: i + 2, get: (f) => cell(r, mapping, f) }));
}

function normalizeClient({ get }) {
  const full = get('name') || [get('first_name'), get('last_name')].filter(Boolean).join(' ');
  const name = full.replace(/\s+/g, ' ').trim();
  if (!name && !get('phone') && !get('email')) return { skip: true };
  const birth = parseDate(get('birthdate'));
  const created = parseDate(get('created'));
  return {
    name: name || get('email') || get('phone'),
    phone: get('phone'),
    email: get('email').toLowerCase(),
    gender: normGender(get('gender')),
    birthdate: birth?.date || '',
    notes: get('notes').slice(0, 2000),
    created: created && created.date <= today() ? created.date : null
  };
}

function normalizeService({ get }) {
  const name = get('name');
  if (!name) return { skip: true };
  const price = parseNumber(get('price'));
  const duration = minutes(get('duration'));
  const g = normGender(get('gender'));
  return { name: name.slice(0, 120), category: get('category').slice(0, 60), price: price != null && price >= 0 ? price : null, duration: duration && duration <= 720 ? duration : null, gender: g };
}

function normalizeProduct({ get }) {
  const name = get('name');
  if (!name) return { skip: true };
  const price = parseNumber(get('price'));
  const cost = parseNumber(get('cost'));
  const kind = /tecn|profes|backbar|uso_interno|interno|consumo/.test(key(get('kind'))) ? 'tecnico' : 'retail';
  return { name: name.slice(0, 120), price: price != null && price >= 0 ? price : null, cost: cost != null && cost >= 0 ? cost : null, kind };
}

function normalizeAppointment({ get, line }) {
  const d = parseDate(get('date'));
  if (!d) return { error: `Fila ${line}: fecha no reconocida ("${get('date')}")` };
  const start = normTime(get('start')) || normTime(d.time);
  if (!start) return { error: `Fila ${line}: hora no reconocida ("${get('start')}")` };
  const services = get('service').split(/\s*[+;|]\s*|\s*,\s*(?=[A-ZÁÉÍÓÚÑ])/).filter(Boolean).map((name) => ({ name: name.slice(0, 120) }));
  const price = parseNumber(get('price'));
  if (services.length === 1 && price != null) services[0].price = price;
  const client = get('client') || get('phone') || get('email');
  const ref = get('ref') || `auto:${d.date}|${start}|${norm(client)}|${norm(get('service'))}|${norm(get('employee'))}`;
  return {
    ref, date: d.date, start, end: normTime(get('end')) || undefined, duration: minutes(get('duration')) || undefined,
    status: get('status'), employee: get('employee'), services, notes: get('notes').slice(0, 1000),
    client: client ? { name: get('client') || client, phone: get('phone'), email: get('email') } : null
  };
}

const money = (v) => { const n = parseNumber(v); return n == null ? null : Math.round(n * 100) / 100; };
const r2 = (n) => Math.round(n * 100) / 100;
// Referencia estable para filas sin número: misma fila → misma referencia; filas
// idénticas dentro del archivo se distinguen por el orden en que aparecen.
function autoRef(seen, parts) {
  const k = parts.map((p) => norm(p)).join('|');
  const n = (seen.get(k) || 0) + 1;
  seen.set(k, n);
  return `auto:${k}#${n}`;
}

function normalizeCash({ get, line }, seen) {
  const d = parseDate(get('date'));
  if (!d) return { error: `Fila ${line}: fecha no reconocida ("${get('date')}")` };
  const inAmt = money(get('in'));
  const outAmt = money(get('out'));
  let amount = money(get('amount'));
  let direction = null;
  const t = key(get('type'));
  if (/entrada|ingreso|^in$|cobro|deposito|aportacion|^e$|^\+$/.test(t)) direction = 'in';
  else if (/salida|gasto|^out$|pago|retirada|compra|^s$|^-$/.test(t)) direction = 'out';
  if (inAmt && !outAmt) { direction = 'in'; amount = inAmt; } else if (outAmt && !inAmt) { direction = 'out'; amount = outAmt; }
  if (amount == null || amount === 0) return { skip: true };
  if (!direction) direction = amount < 0 ? 'out' : 'in';
  amount = Math.abs(amount);
  const concept = get('concept').slice(0, 200);
  return {
    date: d.date, direction, amount, concept, category: get('category').slice(0, 60) || concept.slice(0, 60), method: get('method'),
    ref: get('ref') || autoRef(seen, [d.date, direction, amount, concept])
  };
}

function normalizeClosing({ get, line }) {
  const d = parseDate(get('date'));
  if (!d) return { error: `Fila ${line}: fecha no reconocida ("${get('date')}")` };
  const counted = money(get('counted'));
  let expected = money(get('expected'));
  let diff = money(get('diff'));
  if (expected == null && counted != null) expected = diff != null ? r2(counted - diff) : counted;
  if (counted == null && expected == null) return { skip: true };
  const c = counted ?? r2(expected + (diff || 0));
  if (diff == null) diff = r2(c - expected);
  return { date: d.date, opening: money(get('opening')), expected, counted: c, diff };
}

function invoiceStatus(text, total, paid, pending) {
  const t = key(text);
  if (/anulad|rectificad|cancelad|void|abonad/.test(t)) return 'anulada';
  if (/parcial|partial/.test(t)) return 'parcial';
  if (/pendiente|impagad|unpaid|due|sin_cobrar|vencid/.test(t)) return 'pendiente';
  if (/pagad|cobrad|paid|liquidad/.test(t)) return 'pagada';
  if (pending != null && pending > 0.005) return pending >= total - 0.005 ? 'pendiente' : 'parcial';
  if (paid != null && paid < total - 0.005) return paid > 0 ? 'parcial' : 'pendiente';
  return 'pagada';
}

function normalizeInvoice({ get, line }) {
  const d = parseDate(get('date'));
  if (!d) return { error: `Fila ${line}: fecha no reconocida ("${get('date')}")` };
  const number = get('number');
  if (!number) return { error: `Fila ${line}: falta el número de factura` };
  let base = money(get('base'));
  let tax = money(get('tax'));
  let rate = parseNumber(String(get('tax_rate')).replace('%', ''));
  let total = money(get('total'));
  if (total == null && base != null) total = r2(base + (tax ?? (rate != null ? base * rate / 100 : 0)));
  if (total == null) return { error: `Fila ${line}: falta el importe de la factura ${number}` };
  if (base == null) base = tax != null ? r2(total - tax) : rate != null ? r2(total / (1 + rate / 100)) : total;
  if (tax == null) tax = r2(total - base);
  if (rate == null && base) rate = Math.round((tax / base) * 1000) / 10;
  const pending = money(get('pending'));
  let paid = money(get('paid'));
  const status = invoiceStatus(get('status'), total, paid, pending);
  if (paid == null) paid = status === 'pagada' ? total : status === 'anulada' ? 0 : pending != null ? r2(total - pending) : 0;
  return {
    number: number.slice(0, 40), series: get('series').slice(0, 20), date: d.date, client: get('client').slice(0, 160), tax_id: get('tax_id').toUpperCase().replace(/\s/g, '').slice(0, 20),
    concept: get('concept').slice(0, 300), base, tax_rate: rate, tax, total, paid, status, method: get('method').slice(0, 40)
  };
}

function normalizePayment({ get, line }, seen) {
  const d = parseDate(get('date'));
  if (!d) return { error: `Fila ${line}: fecha no reconocida ("${get('date')}")` };
  let amount = money(get('amount'));
  let paid = money(get('paid'));
  let pending = money(get('pending'));
  if (amount == null) amount = r2((paid || 0) + (pending || 0));
  if (!amount) return { skip: true };
  const t = key(get('status'));
  let status;
  if (/devuelt|reembols|refund|anulad/.test(t)) status = 'devuelto';
  else if (pending == null && paid == null) status = /pendiente|deuda|impagad|unpaid|due/.test(t) ? 'pendiente' : /parcial/.test(t) ? 'parcial' : 'cobrado';
  if (pending == null) pending = status === 'pendiente' ? amount : paid != null ? r2(Math.max(0, amount - paid)) : 0;
  if (paid == null) paid = r2(amount - pending);
  if (!status) status = pending > 0.005 ? (paid > 0.005 ? 'parcial' : 'pendiente') : 'cobrado';
  const client = get('client').slice(0, 160);
  return {
    date: d.date, client, concept: get('concept').slice(0, 300), amount, paid, pending, method: get('method').slice(0, 40), status,
    invoice: get('invoice').slice(0, 40), ref: get('ref') || autoRef(seen, [d.date, client, amount, get('concept'), get('invoice')])
  };
}

function normalizeVoucher({ get, line }, seen) {
  const client = get('client').slice(0, 160);
  const description = get('description').slice(0, 200);
  const code = get('code').slice(0, 60);
  if (!client && !description && !code) return { skip: true };
  const total = parseNumber(get('sessions_total'));
  const used = parseNumber(get('sessions_used'));
  const left = parseNumber(get('sessions_left'));
  const amount = money(get('amount'));
  const balance = money(get('balance'));
  const t = key(get('kind') + ' ' + description);
  const isCard = /tarjeta|regalo|gift|cheque|vale|monedero|saldo/.test(t) || (total == null && left == null);
  let sessionsTotal = total != null ? Math.round(total) : left != null ? Math.round(left + (used || 0)) : null;
  let sessionsUsed = used != null ? Math.round(used) : left != null && sessionsTotal != null ? Math.round(sessionsTotal - left) : 0;
  if (isCard && total == null && left == null) { sessionsTotal = null; sessionsUsed = 0; }
  const purchased = parseDate(get('purchased'))?.date || null;
  const expires = parseDate(get('expires'))?.date || null;
  const remaining = sessionsTotal != null ? sessionsTotal - sessionsUsed : (balance ?? amount ?? 0);
  const st = key(get('status'));
  let status;
  if (/anulad|cancelad|devuelt/.test(st)) status = 'anulado';
  else if (/caducad|vencid|expired/.test(st)) status = 'caducado';
  else if (/agotad|consumid|usado|finalizad|used_up|redeemed/.test(st)) status = 'agotado';
  else if (remaining <= 0.005) status = 'agotado';
  else if (expires && expires < today()) status = 'caducado';
  else status = 'activo';
  if (sessionsTotal == null && !isCard && amount == null && balance == null) return { error: `Fila ${line}: faltan las sesiones o el importe del bono` };
  return {
    code, kind: isCard ? 'tarjeta' : 'bono', client, description, sessions_total: sessionsTotal, sessions_used: sessionsUsed,
    amount: amount ?? balance ?? 0, balance: isCard ? (balance ?? amount ?? 0) : balance, purchased, expires, status,
    ref: code || autoRef(seen, [client, description, purchased, amount])
  };
}

/* Lee todas las filas de un archivo de un tipo y las deja listas para importar. */
export function parseRows(kind, rows, mapping) {
  if (!KINDS[kind]) return { error: 'Tipo de archivo no válido' };
  if (!Array.isArray(rows) || rows.length < 2) return { error: 'El archivo está vacío o solo tiene la fila de títulos.' };
  if (rows.length > MAX_ROWS + 1) return { error: `El archivo tiene más de ${MAX_ROWS} filas. Divídelo en varios.` };
  const table = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
  const headers = table[0];
  const map = mapping && Object.keys(mapping).length ? cleanMapping(kind, mapping, headers.length) : guessMapping(kind, headers);
  if (!satisfied(kind, map)) {
    const missing = KINDS[kind].required.filter((alts) => !alts.some((f) => map[f] != null)).map((alts) => alts.map((f) => KINDS[kind].fields[f].label).join(' o '));
    return { error: `Falta indicar qué columna es: ${missing.join('; ')}.`, headers, mapping: map };
  }
  if (kind === 'sales') {
    const parsed = rowsToTickets(table, map);
    if (parsed.error) return { error: parsed.error, headers, mapping: map };
    return { headers, mapping: map, items: parsed.tickets, warnings: parsed.warnings, total: table.length - 1 };
  }
  const fn = {
    clients: normalizeClient, services: normalizeService, products: normalizeProduct, appointments: normalizeAppointment,
    cash: normalizeCash, closings: normalizeClosing, invoices: normalizeInvoice, payments: normalizePayment, vouchers: normalizeVoucher
  }[kind];
  const items = [];
  const warnings = [];
  const seen = new Map();
  let skipped = 0;
  for (const r of rowsOf(kind, table, map)) {
    const out = fn(r, seen);
    if (out.skip) skipped++;
    else if (out.error) warnings.push(out.error);
    else items.push(out);
  }
  return { headers, mapping: map, items, warnings, skipped, total: table.length - 1 };
}

function cleanMapping(kind, mapping, width) {
  const out = {};
  for (const [f, v] of Object.entries(mapping)) {
    const i = Number(v);
    if (KINDS[kind].fields[f] && v !== '' && v != null && Number.isInteger(i) && i >= 0 && i < width) out[f] = i;
  }
  return out;
}

/* ---- Importación ---- */
function clientIndex(db, salonId) {
  const byPhone = new Map();
  const byEmail = new Map();
  const byName = new Map();
  for (const c of db.prepare('SELECT * FROM clients WHERE salon_id = ?').all(salonId)) {
    const p = phoneKey(c.phone);
    if (p.length === 9) byPhone.set(p, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    byName.set(norm(c.name), c);
  }
  const find = (it) => {
    const p = phoneKey(it.phone);
    if (p.length === 9 && byPhone.has(p)) return byPhone.get(p);
    if (it.email && byEmail.has(it.email)) return byEmail.get(it.email);
    // Por nombre solo si la fila no trae ni teléfono ni email (si no, son personas distintas con el mismo nombre).
    if (p.length !== 9 && !it.email && byName.has(norm(it.name))) return byName.get(norm(it.name));
    return null;
  };
  const add = (c) => {
    const p = phoneKey(c.phone);
    if (p.length === 9) byPhone.set(p, c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    byName.set(norm(c.name), c);
  };
  return { find, add };
}

function importClients(db, salonId, items, label, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0 };
  const idx = clientIndex(db, salonId);
  const ins = db.prepare('INSERT INTO clients (salon_id, name, phone, email, gender, notes, birthdate, created_at, import_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const it of items) {
    const ex = idx.find(it);
    if (!ex) {
      res.created++;
      const row = { id: null, name: it.name, phone: it.phone, email: it.email, gender: it.gender, notes: it.notes, birthdate: it.birthdate };
      if (!dryRun) row.id = Number(ins.run(salonId, it.name, it.phone, it.email, it.gender, it.notes, it.birthdate, it.created || today(), label).lastInsertRowid);
      idx.add(row);
      continue;
    }
    // Solo se rellenan los datos que faltan: lo que ya tenía el salón no se pisa.
    const patch = {};
    if (!ex.phone && it.phone) patch.phone = it.phone;
    if (!ex.email && it.email) patch.email = it.email;
    if ((!ex.gender || ex.gender === 'U') && it.gender !== 'U') patch.gender = it.gender;
    if (!ex.birthdate && it.birthdate) patch.birthdate = it.birthdate;
    if (it.notes && !String(ex.notes || '').includes(it.notes)) patch.notes = [ex.notes, it.notes].filter(Boolean).join('\n');
    if (it.created && ex.created_at && it.created < ex.created_at) patch.created_at = it.created;
    if (!Object.keys(patch).length) { res.unchanged++; continue; }
    res.updated++;
    Object.assign(ex, patch);
    if (!dryRun && ex.id) {
      const cols = Object.keys(patch);
      db.prepare(`UPDATE clients SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => patch[c]), ex.id);
    }
  }
  return res;
}

function importCatalog(db, salonId, kind, items, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0 };
  const table = kind === 'services' ? 'services' : 'products';
  const existing = new Map(db.prepare(`SELECT * FROM ${table} WHERE salon_id = ?`).all(salonId).map((r) => [norm(r.name), r]));
  for (const it of items) {
    const ex = existing.get(norm(it.name));
    if (!ex) {
      res.created++;
      existing.set(norm(it.name), { ...it });
      if (dryRun) continue;
      if (kind === 'services') {
        db.prepare('INSERT INTO services (salon_id, name, category, gender, price, duration_min) VALUES (?, ?, ?, ?, ?, ?)')
          .run(salonId, it.name, it.category, it.gender, it.price ?? 0, it.duration ?? 30);
      } else {
        db.prepare('INSERT INTO products (salon_id, name, kind, price, cost) VALUES (?, ?, ?, ?, ?)').run(salonId, it.name, it.kind, it.price ?? 0, it.cost ?? 0);
      }
      continue;
    }
    // El menú del programa de origen manda: se actualizan precio y duración.
    const patch = {};
    if (kind === 'services') {
      if (it.price != null && it.price !== ex.price) patch.price = it.price;
      if (it.duration != null && it.duration !== ex.duration_min) patch.duration_min = it.duration;
      if (it.category && !ex.category) patch.category = it.category;
    } else {
      if (it.price != null && it.price !== ex.price) patch.price = it.price;
      if (it.cost != null && it.cost !== ex.cost) patch.cost = it.cost;
    }
    if (!Object.keys(patch).length) { res.unchanged++; continue; }
    res.updated++;
    if (!dryRun && ex.id) {
      const cols = Object.keys(patch);
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => patch[c]), ex.id);
    }
  }
  return res;
}

function importAppointments(db, salon, items, source, dryRun) {
  // Profesionales que aún no existen: se crean para que cada cita tenga su columna en la agenda.
  const emps = new Set(db.prepare('SELECT name FROM employees WHERE salon_id = ?').all(salon.id).map((e) => norm(e.name)));
  const newEmps = [...new Set(items.map((a) => a.employee).filter((e) => e && !emps.has(norm(e))))];
  const known = new Set(db.prepare('SELECT external_ref FROM appointments WHERE salon_id = ? AND external_ref IS NOT NULL').all(salon.id).map((r) => r.external_ref));
  if (dryRun) {
    const updated = items.filter((a) => known.has(`${source}:${a.ref}`)).length;
    return { created: items.length - updated, updated, employeesCreated: newEmps.length, upcoming: items.filter((a) => a.date >= today()).length };
  }
  const seen = new Map();
  for (const name of newEmps) {
    if (seen.has(norm(name))) continue;
    db.prepare('INSERT INTO employees (salon_id, name, role) VALUES (?, ?, ?)').run(salon.id, name, 'Estilista');
    seen.set(norm(name), true);
  }
  const r = upsertExternalAppointments(db, salon, items, source);
  return { created: r.created, updated: r.updated + r.cancelled, employeesCreated: seen.size, upcoming: items.filter((a) => a.date >= today()).length, errors: r.errors.length };
}

/* Busca la clienta por nombre (o NIF en facturas) sin crearla: las facturas a
   empresas y los cobros sueltos no tienen por qué ser clientas del salón. */
function clientMatcher(db, salonId) {
  const byName = new Map();
  const byTax = new Map();
  for (const c of db.prepare('SELECT id, name, tax_id FROM clients WHERE salon_id = ?').all(salonId)) {
    byName.set(norm(c.name), c.id);
    if (c.tax_id) byTax.set(c.tax_id.toUpperCase(), c.id);
  }
  return (name, taxId) => (taxId && byTax.get(taxId)) || (name ? byName.get(norm(name)) : null) || null;
}

function upsert(db, table, salonId, ref, cols, values, dryRun, res) {
  const ex = db.prepare(`SELECT id FROM ${table} WHERE salon_id = ? AND external_ref = ?`).get(salonId, ref);
  if (ex) {
    res.updated++;
    if (!dryRun) db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...values, ex.id);
    return;
  }
  res.created++;
  if (!dryRun) db.prepare(`INSERT INTO ${table} (salon_id, external_ref, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`).run(salonId, ref, ...values);
}

function importCash(db, salonId, items, source, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0, salesSkipped: 0, in: 0, out: 0 };
  // Las entradas que son ventas del día ya están en Ventas si se importaron los tickets: no se cuentan dos veces.
  const salesDays = new Set(db.prepare('SELECT DISTINCT date FROM tickets WHERE salon_id = ?').all(salonId).map((r) => r.date));
  const looksSale = (c) => /venta|ticket|cobro|factura|servicio|tpv|tarjeta|datafono|caja_del_dia|recaudacion/.test(key(c));
  for (const it of items) {
    if (it.direction === 'in' && salesDays.has(it.date) && looksSale(`${it.concept} ${it.category}`)) { res.salesSkipped++; continue; }
    const ref = `${source}:${it.ref}`;
    if (db.prepare('SELECT 1 FROM cash_movements WHERE salon_id = ? AND external_ref = ?').get(salonId, ref)) { res.unchanged++; continue; }
    res.created++;
    res[it.direction] = r2(res[it.direction] + it.amount);
    if (!dryRun) {
      db.prepare('INSERT INTO cash_movements (salon_id, date, direction, amount, category, method, note, source, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(salonId, it.date, it.direction, it.amount, it.category, it.method ? normMethod(it.method) : 'efectivo', it.concept, source, ref);
    }
  }
  return res;
}

function importClosings(db, salon, items, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0 };
  for (const it of items) {
    if (db.prepare('SELECT 1 FROM cash_closings WHERE salon_id = ? AND date = ?').get(salon.id, it.date)) { res.unchanged++; continue; }
    res.created++;
    if (!dryRun) db.prepare('INSERT INTO cash_closings (salon_id, date, opening, expected, counted, diff) VALUES (?, ?, ?, ?, ?, ?)')
      .run(salon.id, it.date, it.opening ?? salon.opening_float ?? 0, it.expected, it.counted, it.diff);
  }
  return res;
}

function importInvoices(db, salonId, items, source, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0, total: 0, pending: 0 };
  const match = clientMatcher(db, salonId);
  for (const it of items) {
    const clientId = match(it.client, it.tax_id);
    if (!dryRun && clientId && it.tax_id) db.prepare("UPDATE clients SET tax_id = ? WHERE id = ? AND tax_id = ''").run(it.tax_id, clientId);
    if (it.status !== 'anulada') { res.total = r2(res.total + it.total); res.pending = r2(res.pending + Math.max(0, it.total - it.paid)); }
    upsert(db, 'invoices', salonId, `${source}:${it.series}|${it.number}`,
      ['number', 'series', 'date', 'client_id', 'client_name', 'client_tax_id', 'concept', 'base', 'tax_rate', 'tax', 'total', 'paid', 'status', 'method', 'source'],
      [it.number, it.series, it.date, clientId, it.client, it.tax_id, it.concept, it.base, it.tax_rate, it.tax, it.total, it.paid, it.status, it.method, source], dryRun, res);
  }
  return res;
}

function importPayments(db, salonId, items, source, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0, collected: 0, pending: 0 };
  const match = clientMatcher(db, salonId);
  for (const it of items) {
    if (it.status !== 'devuelto') { res.collected = r2(res.collected + it.paid); res.pending = r2(res.pending + it.pending); }
    upsert(db, 'payments', salonId, `${source}:${it.ref}`,
      ['date', 'client_id', 'client_name', 'concept', 'amount', 'paid', 'pending', 'method', 'status', 'invoice_number', 'source'],
      [it.date, match(it.client), it.client, it.concept, it.amount, it.paid, it.pending, it.method, it.status, it.invoice, source], dryRun, res);
  }
  return res;
}

function importVouchers(db, salonId, items, source, dryRun) {
  const res = { created: 0, updated: 0, unchanged: 0, active: 0 };
  const match = clientMatcher(db, salonId);
  for (const it of items) {
    if (it.status === 'activo') res.active++;
    upsert(db, 'vouchers', salonId, `${source}:${it.ref}`,
      ['code', 'kind', 'client_id', 'client_name', 'description', 'sessions_total', 'sessions_used', 'amount', 'balance', 'purchased', 'expires', 'status', 'source'],
      [it.code, it.kind, match(it.client), it.client, it.description, it.sessions_total, it.sessions_used, it.amount, it.balance, it.purchased, it.expires, it.status, source], dryRun, res);
  }
  return res;
}

export const SOURCES = {
  fresha: 'Fresha', booksy: 'Booksy', treatwell: 'Treatwell', koibox: 'Koibox', flowww: 'Flowww', bewe: 'Bewe',
  shore: 'Shore', salonized: 'Salonized', excel: 'Excel propio', otro: 'Otro programa'
};

/* Importa (o simula con dryRun) un archivo ya leído. */
export function migrate(db, salon, { kind, rows, mapping, source = 'otro', dryRun = true }) {
  if (!kind || kind === 'auto') {
    kind = Array.isArray(rows?.[0]) ? detectKind(rows[0].map((c) => String(c ?? ''))) : null;
    if (!kind) return { ok: false, error: 'No reconozco qué contiene este archivo. Elige el tipo (clientas, servicios, productos, citas o ventas) y revisa las columnas.', headers: rows?.[0] || [] };
  }
  const parsed = parseRows(kind, rows, mapping);
  if (parsed.error) return { ok: false, kind, ...parsed };
  const label = SOURCES[source] ? source : 'otro';
  const run = () => {
    if (kind === 'clients') return importClients(db, salon.id, parsed.items, label, dryRun);
    if (kind === 'services' || kind === 'products') return importCatalog(db, salon.id, kind, parsed.items, dryRun);
    if (kind === 'appointments') return importAppointments(db, salon, parsed.items, `migracion-${label}`, dryRun);
    if (kind === 'cash') return importCash(db, salon.id, parsed.items, `migracion-${label}`, dryRun);
    if (kind === 'closings') return importClosings(db, salon, parsed.items, dryRun);
    if (kind === 'invoices') return importInvoices(db, salon.id, parsed.items, `migracion-${label}`, dryRun);
    if (kind === 'payments') return importPayments(db, salon.id, parsed.items, `migracion-${label}`, dryRun);
    if (kind === 'vouchers') return importVouchers(db, salon.id, parsed.items, `migracion-${label}`, dryRun);
    const r = importTickets(db, salon.id, parsed.items, `migracion-${label}`, { dryRun });
    return { created: r.created, updated: 0, unchanged: r.skipped, clientsCreated: r.clientsCreated, employeesCreated: r.employeesCreated, itemsCreated: r.itemsCreated, revenue: r.revenue, errors: r.errors.length };
  };
  // Las ventas ya se guardan en su propia transacción (importTickets).
  const result = dryRun || kind === 'sales' ? run() : tx(db, run);
  return {
    ok: true, kind, dryRun, mapping: parsed.mapping, headers: parsed.headers, total: parsed.total,
    skipped: parsed.skipped || 0, warnings: parsed.warnings.slice(0, 20), warningCount: parsed.warnings.length,
    preview: parsed.items.slice(0, 6), result
  };
}

/* Descripción para la interfaz: tipos, campos y orden recomendado. */
export function migrationSchema() {
  return {
    order: IMPORT_ORDER,
    sources: SOURCES,
    kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { label: v.label, fields: Object.fromEntries(Object.entries(v.fields).map(([f, d]) => [f, d.label])), required: v.required }]))
  };
}

