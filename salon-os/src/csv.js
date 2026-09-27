/* Lectura de exportaciones CSV de TPVs y programas de caja. Detecta el
   separador, reconoce las columnas por su nombre (en español o inglés) y
   agrupa las filas por ticket. Formato recomendado: una fila por línea de
   ticket (servicio o producto). */

const key = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const FIELDS = {
  date: ['fecha', 'date', 'dia', 'fecha_venta', 'fecha_cobro', 'fecha_ticket', 'fecha_hora'],
  time_start: ['hora_inicio', 'inicio', 'hora_entrada', 'entrada', 'hora', 'time', 'start', 'hora_cita'],
  time_end: ['hora_fin', 'fin', 'salida', 'hora_salida', 'end', 'hora_cobro'],
  ref: ['ticket', 'n_ticket', 'no_ticket', 'num_ticket', 'numero_ticket', 'n_factura', 'factura', 'id_ticket', 'referencia', 'ref', 'id_venta', 'recibo', 'n_recibo', 'operacion'],
  client: ['cliente', 'nombre_cliente', 'client', 'customer', 'nombre_y_apellidos'],
  phone: ['telefono', 'tel', 'movil', 'phone', 'telefono_cliente'],
  email: ['email', 'correo', 'e_mail', 'mail'],
  gender: ['genero', 'sexo', 'gender'],
  employee: ['empleado', 'profesional', 'estilista', 'trabajador', 'vendedor', 'employee', 'staff', 'atendido_por', 'peluquero', 'peluquera'],
  type: ['tipo', 'tipo_linea', 'clase', 'type', 'tipo_articulo'],
  name: ['concepto', 'servicio_producto', 'descripcion', 'articulo', 'item', 'producto_servicio', 'servicio', 'producto', 'nombre', 'description'],
  qty: ['cantidad', 'uds', 'unidades', 'qty', 'cant', 'quantity'],
  price: ['precio', 'precio_unitario', 'pvp', 'price', 'unit_price', 'precio_unidad'],
  total: ['importe', 'total', 'total_linea', 'amount', 'importe_total', 'importe_linea', 'subtotal'],
  method: ['metodo', 'metodo_pago', 'forma_pago', 'forma_de_pago', 'pago', 'payment', 'medio_pago', 'tipo_pago'],
  duration: ['duracion', 'minutos', 'duracion_min', 'duration', 'tiempo']
};

export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return { delimiter: delim, rows };
}

export function mapHeaders(headers) {
  const mapping = {};
  const keys = headers.map(key);
  for (const [field, syns] of Object.entries(FIELDS)) {
    const idx = keys.findIndex((k, i) => syns.includes(k) && !Object.values(mapping).includes(i));
    if (idx >= 0) mapping[field] = idx;
  }
  return mapping;
}

/* '1.234,56 €' → 1234.56 · '12,5' → 12.5 · '12.50' → 12.5 */
export function parseNumber(v) {
  let s = String(v ?? '').replace(/[€\s]/g, '');
  if (!s) return null;
  const neg = /^-|^\(.*\)$/.test(s);
  s = s.replace(/[()-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/* Devuelve { date: 'YYYY-MM-DD', time: 'HH:MM' | null } o null. */
export function parseDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}:\d{2}))?/);
  if (m) return { date: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, time: m[4] || null };
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}:\d{2}))?/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return { date: `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, time: m[4] || null };
  }
  return null;
}

function lineType(v) {
  const s = key(v);
  if (!s) return undefined;
  if (/producto|product|retail|venta|articulo/.test(s)) return 'product';
  if (/servicio|service|tratamiento/.test(s)) return 'service';
  return undefined;
}

export function csvToTickets(text) {
  const { rows, delimiter } = parseCsv(text);
  if (rows.length < 2) return { error: 'El archivo está vacío o solo tiene cabecera.' };
  const headers = rows[0];
  const mapping = mapHeaders(headers);
  const missing = ['date', 'name'].filter((f) => mapping[f] == null);
  if (mapping.price == null && mapping.total == null) missing.push('importe');
  if (missing.length) {
    return { error: `No encuentro las columnas: ${missing.map((m) => (m === 'date' ? 'fecha' : m === 'name' ? 'concepto' : m)).join(', ')}.`, headers, mapping };
  }
  const get = (r, f) => (mapping[f] != null ? (r[mapping[f]] ?? '').trim() : '');
  const tickets = new Map();
  const warnings = [];
  rows.slice(1).forEach((r, i) => {
    const d = parseDate(get(r, 'date'));
    if (!d) {
      warnings.push(`Fila ${i + 2}: fecha no reconocida ("${get(r, 'date')}")`);
      return;
    }
    const timeStart = get(r, 'time_start') || d.time || '';
    const ref = get(r, 'ref');
    const client = get(r, 'client');
    const employee = get(r, 'employee');
    const k = ref ? `ref:${ref}` : `${d.date}|${timeStart}|${client}|${employee}`;
    if (!tickets.has(k)) {
      tickets.set(k, {
        ref: ref || null,
        date: d.date,
        time_start: timeStart || null,
        time_end: get(r, 'time_end') || null,
        method: get(r, 'method'),
        employee,
        client: client ? { name: client, phone: get(r, 'phone'), email: get(r, 'email'), gender: get(r, 'gender') } : null,
        lines: []
      });
    }
    tickets.get(k).lines.push({
      type: lineType(get(r, 'type')),
      name: get(r, 'name'),
      qty: parseNumber(get(r, 'qty')) ?? 1,
      price: mapping.price != null ? parseNumber(get(r, 'price')) : null,
      total: mapping.total != null ? parseNumber(get(r, 'total')) : null,
      employee: employee || null,
      duration: parseNumber(get(r, 'duration'))
    });
  });
  // Sin referencia de ticket, las filas sin hora ni cliente se agruparían en
  // un solo ticket por día: se usa una referencia estable por fila para que
  // reimportar el mismo archivo no duplique nada.
  const list = [...tickets.values()];
  for (const t of list) {
    if (!t.ref) t.ref = `auto:${t.date}|${t.time_start ?? ''}|${t.client?.name ?? ''}|${t.employee}|${t.lines.map((l) => `${l.name}:${l.total ?? l.price}`).join(',')}`;
    for (const l of t.lines) {
      if (l.price == null && l.total == null) l.total = 0;
      if (l.price == null) delete l.price;
      if (l.total == null) delete l.total;
    }
  }
  return {
    delimiter,
    headers,
    mapping: Object.fromEntries(Object.entries(mapping).map(([f, i]) => [f, headers[i]])),
    rowCount: rows.length - 1,
    tickets: list,
    warnings
  };
}
