/* Primeros pasos de un salón nuevo: qué le falta para sacar partido a la
   herramienta desde la primera semana de prueba. */
import { channelsFor, channelStatus, ensureTemplates } from './messaging.js';

const one = (db, sql, id) => Boolean(db.prepare(sql).get(id));

export function onboardingSteps(db, salon) {
  const id = salon.id;
  const steps = [
    { key: 'servicios', label: 'Carga tu menú de servicios', hint: 'Con precio y duración: así se calculan ocupación y tiempos.', href: '#/catalogo', done: one(db, 'SELECT 1 FROM services WHERE salon_id = ? LIMIT 1', id), action: 'starter' },
    { key: 'equipo', label: 'Añade a tu equipo', hint: 'Para ver el rendimiento de cada persona.', href: '#/equipo', done: one(db, 'SELECT 1 FROM employees WHERE salon_id = ? LIMIT 1', id) },
    { key: 'caja', label: 'Conecta la caja', hint: 'Importa las ventas de tu TPV o registra el primer cobro.', href: '#/importar', done: one(db, 'SELECT 1 FROM tickets WHERE salon_id = ? LIMIT 1', id) },
    { key: 'agenda', label: 'Abre tu agenda y la reserva online', hint: 'Revisa el horario y comparte tu página de reservas con tus clientas.', href: '#/agenda', done: one(db, 'SELECT 1 FROM appointments WHERE salon_id = ? LIMIT 1', id) },
    { key: 'whatsapp', label: 'Conecta WhatsApp', hint: 'Para recibir aquí los mensajes de tus clientes.', href: '#/ajustes', done: channelStatus(channelsFor(db, id)).whatsapp === 'api' || one(db, "SELECT 1 FROM messages WHERE salon_id = ? AND direction = 'in' LIMIT 1", id) },
    { key: 'horas', label: 'Registra las horas del mes', hint: 'Así el precio hora y la ocupación son reales.', href: '#/equipo', done: one(db, 'SELECT 1 FROM work_hours WHERE salon_id = ? LIMIT 1', id) },
    { key: 'recordatorio', label: 'Envía tus primeros recordatorios', hint: 'Escribe a los clientes a los que les toca volver.', href: '#/mensajes?tab=recordatorios', done: one(db, "SELECT 1 FROM messages WHERE salon_id = ? AND direction = 'out' LIMIT 1", id) }
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

const STARTER_SERVICES = [
  ['Corte y peinado mujer', 'Corte', 'M', 38, 45], ['Corte hombre', 'Corte', 'H', 18, 25], ['Peinado', 'Peinado', 'M', 22, 30],
  ['Color raíz', 'Color', 'M', 45, 75], ['Color completo', 'Color', 'M', 58, 90], ['Mechas / balayage', 'Color', 'M', 95, 150],
  ['Matiz / tonalizante', 'Color', 'M', 20, 20], ['Tratamiento hidratación', 'Tratamiento', 'U', 25, 20], ['Tratamiento reparador', 'Tratamiento', 'U', 35, 30],
  ['Alisado de keratina', 'Tratamiento', 'M', 140, 150], ['Recogido', 'Peinado', 'M', 45, 60], ['Arreglo de barba', 'Barba', 'H', 12, 15]
];
const STARTER_PRODUCTS = [['Champú', 'retail', 19, 9.5], ['Mascarilla', 'retail', 24, 12], ['Aceite reparador', 'retail', 26, 13], ['Protector térmico', 'retail', 22, 11], ['Tinte profesional', 'tecnico', 0, 7.5], ['Oxidante', 'tecnico', 0, 6]];

/* Menú típico de peluquería para empezar (precios orientativos, editables). */
export function loadStarterCatalog(db, salonId) {
  if (db.prepare('SELECT 1 FROM services WHERE salon_id = ? LIMIT 1').get(salonId)) return { services: 0, products: 0, skipped: true };
  const s = db.prepare('INSERT INTO services (salon_id, name, category, gender, price, duration_min) VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of STARTER_SERVICES) s.run(salonId, ...row);
  let products = 0;
  if (!db.prepare('SELECT 1 FROM products WHERE salon_id = ? LIMIT 1').get(salonId)) {
    const p = db.prepare('INSERT INTO products (salon_id, name, kind, price, cost) VALUES (?, ?, ?, ?, ?)');
    for (const row of STARTER_PRODUCTS) { p.run(salonId, ...row); products++; }
  }
  ensureTemplates(db, salonId);
  return { services: STARTER_SERVICES.length, products };
}
