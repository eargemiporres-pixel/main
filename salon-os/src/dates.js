/* Utilidades de fechas. Todas las fechas se guardan como texto 'YYYY-MM-DD'
   (se comparan bien alfabéticamente) y los rangos son [desde, hasta). */

export function today() {
  return process.env.SALON_TODAY || new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return today().slice(0, 7);
}

const pad = (n) => String(n).padStart(2, '0');

export function monthStart(ym) {
  return `${ym}-01`;
}

/* Suma n meses a 'YYYY-MM'. */
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function isMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];

/* Rango de un periodo que termina en el mes `ref`:
   - month:   ese mes
   - quarter: el trimestre natural que contiene ese mes
   - year:    de enero hasta ese mes (año en curso a la fecha)
   `prev` es el rango comparable anterior. */
export function periodRange(period, ref) {
  const [y, m] = ref.split('-').map(Number);
  if (period === 'quarter') {
    const qStart = `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}`;
    const q = Math.floor((m - 1) / 3) + 1;
    return {
      from: monthStart(qStart), to: monthStart(addMonths(qStart, 3)), months: 3,
      prev: { from: monthStart(addMonths(qStart, -3)), to: monthStart(qStart) },
      label: `T${q} ${y}`
    };
  }
  if (period === 'year') {
    return {
      from: `${y}-01-01`, to: monthStart(addMonths(ref, 1)), months: m,
      prev: { from: `${y - 1}-01-01`, to: monthStart(addMonths(`${y - 1}-${pad(m)}`, 1)) },
      label: m === 12 ? `Año ${y}` : `Año ${y} · enero–${monthName(ref)}`
    };
  }
  return {
    from: monthStart(ref), to: monthStart(addMonths(ref, 1)), months: 1,
    prev: { from: monthStart(addMonths(ref, -1)), to: monthStart(ref) },
    label: `${monthName(ref)[0].toUpperCase()}${monthName(ref).slice(1)} ${y}`
  };
}

/* Fracción de mes transcurrida del rango (para no comparar un mes a medias
   contra horas teóricas de un mes completo). */
export function elapsedMonths(from, to) {
  const t = today();
  if (t >= to) return null;
  if (t < from) return 0;
  return daysBetween(from, addDays(t, 1)) / 30.4;
}

/* Si el rango actual aún no ha terminado, lo corta en hoy y recorta el
   rango anterior al mismo número de días: así un mes a medias se compara
   con el mismo tramo del mes anterior y no con el mes entero. */
export function comparable(from, to, prevFrom, prevTo) {
  const end = addDays(today(), 1);
  if (end >= to || end <= from) return { from, to, prevFrom, prevTo, partial: false };
  const days = daysBetween(from, end);
  const cut = addDays(prevFrom, days);
  return { from, to: end, prevFrom, prevTo: cut < prevTo ? cut : prevTo, partial: true };
}
