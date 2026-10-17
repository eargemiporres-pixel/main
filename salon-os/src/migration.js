/* Migración desde otros programas (Fresha, Booksy, Treatwell, Koibox, Flowww,
   Bewe, Excel propio…). Cada programa exporta sus datos con columnas distintas:
   aquí se reconoce qué tipo de archivo es (clientas, servicios, productos,
   citas o ventas), qué columna es cada dato y se importa sin duplicar.
   Las filas llegan ya leídas (la interfaz lee CSV y Excel en el navegador). */
import { tx } from './db.js';
import { key, parseNumber, parseDate, rowsToTickets, FIELDS as SALE_FIELDS } from './csv.js';
import { importTickets, normGender, normTime } from './importer.js';
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
export const IMPORT_ORDER = ['services', 'products', 'clients', 'appointments', 'sales'];

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
  const fn = { clients: normalizeClient, services: normalizeService, products: normalizeProduct, appointments: normalizeAppointment }[kind];
  const items = [];
  const warnings = [];
  let skipped = 0;
  for (const r of rowsOf(kind, table, map)) {
    const out = fn(r);
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

