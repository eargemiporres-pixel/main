/* Lo que se aprende de cada cliente por sus conversaciones. Análisis por
   reglas (palabras clave en español), sin servicios externos: temas por los
   que pregunta, servicios que le interesan, tono emocional, preferencias de
   día y franja, estilista de confianza y etiquetas útiles para el salón.
   Si hay clave de la API de Claude, ai.js añade un resumen más rico. */

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const TOPICS = [
  ['Precios y presupuestos', ['precio', 'cuanto', 'cuesta', 'vale ', 'presupuesto', 'tarifa', 'descuento', 'oferta', 'promo', 'caro']],
  ['Citas y disponibilidad', ['cita', 'hueco', 'disponib', 'reservar', 'reserva', 'teneis hora', 'tienes hora', 'a que hora', 'para el ', 'esta semana']],
  ['Cambios y cancelaciones', ['cancelar', 'anular', 'cambiar la cita', 'mover la cita', 'no puedo ir', 'no voy a poder', 'retras', 'llego tarde', 'aplazar']],
  ['Color', ['color', 'tinte', 'mechas', 'balayage', 'rubio', 'canas', 'raiz', 'matiz', 'tono', 'castano', 'cobrizo']],
  ['Corte y peinado', ['corte', 'cortar', 'flequillo', 'puntas', 'peinado', 'peinar', 'ondas', 'capas', 'degradado']],
  ['Tratamientos', ['tratamiento', 'keratina', 'alisado', 'hidrat', 'botox', 'olaplex', 'reparar', 'encrespa', 'frizz', 'seco']],
  ['Productos', ['champu', 'mascarilla', 'producto', 'serum', 'aceite', 'acondicionador', 'laca', 'cera', 'protector']],
  ['Eventos', ['boda', 'me caso', 'nos casamos', 'novia', 'evento', 'comunion', 'bautizo', 'fiesta', 'recogido', 'graduacion', 'cena de empresa']],
  ['Cuero cabelludo y alergias', ['alergi', 'picor', 'pica', 'irrita', 'sensible', 'caida', 'se me cae', 'caspa', 'reaccion']],
  ['Quejas', ['queja', 'reclam', 'no me ha gustado', 'no me gusto', 'no me gusta', 'mal hecho', 'disgust', 'decepcion', 'fatal']]
];

const POSITIVE = ['gracias', 'genial', 'encanta', 'encantad', 'perfect', 'maravill', 'precios', 'guapisim', 'feliz', 'content', 'increible', 'ideal', 'estupend', 'fenomenal', 'buenisim', 'recomend', 'me gusta mucho', 'chulisim', 'top', 'amor', 'un exito'];
const NEGATIVE = ['fatal', 'horrible', 'enfad', 'molest', 'decepcion', 'queja', 'reclam', 'no me ha gustado', 'no me gusto', 'no me gusta', 'triste', 'preocup', 'desastre', 'carisim', 'nadie contesta', 'nadie me contesta', 'problema', 'mal ', 'quemad', 'picor', 'harta', 'harto'];
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábados', domingo: 'Domingos' };

const count = (text, words) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

/* messages: [{direction, body, created_at}] · ctx: {services: [names], employees: [names]} */
export function analyzeConversation(messages, { services = [], employees = [] } = {}) {
  const inbound = messages.filter((m) => m.direction === 'in');
  const texts = inbound.map((m) => ` ${norm(m.body)} `);
  const all = texts.join(' ');

  const topics = TOPICS.map(([name, words]) => ({ name, count: texts.filter((t) => count(t, words) > 0).length }))
    .filter((t) => t.count > 0).sort((a, b) => b.count - a.count);

  // Un servicio cuenta si aparecen todas sus palabras o una palabra propia y
  // distintiva (p. ej. "balayage" en "Mechas / balayage").
  const GENERIC = ['tratamiento', 'servicio', 'completo', 'hombre', 'mujer', 'peinado'];
  const serviceHits = services.map((s) => {
    const key = norm(s).split(/[\s/+]+/).filter((w) => w.length > 3);
    if (!key.length) return null;
    const strong = key.filter((w) => w.length >= 6 && !GENERIC.includes(w));
    const n = texts.filter((t) => key.every((w) => t.includes(w)) || strong.some((w) => t.includes(w))).length;
    return n ? { name: s, count: n } : null;
  }).filter(Boolean).sort((a, b) => b.count - a.count).slice(0, 5);

  let pos = 0;
  let neg = 0;
  for (const t of texts) { pos += count(t, POSITIVE); neg += count(t, NEGATIVE); }
  const sentiment = pos + neg ? (pos - neg) / (pos + neg) : 0;
  const recent = texts.slice(-3).join(' ');
  const recentNeg = count(recent, NEGATIVE) > count(recent, POSITIVE);
  const mood = !inbound.length ? 'Sin conversaciones'
    : recentNeg && neg > 0 ? 'Molesta o preocupada'
      : sentiment >= 0.5 ? 'Muy satisfecha'
        : sentiment > 0.1 ? 'Satisfecha'
          : sentiment < -0.2 ? 'Molesta o preocupada' : 'Neutral';

  const days = DAYS.filter((d) => all.includes(d)).map((d) => DAY_LABEL[d]);
  const slots = [];
  if (/por la manana|a primera hora|antes de las (diez|once|10|11)/.test(all)) slots.push('Mañanas');
  if (/por la tarde|a ultima hora|despues del trabajo|salgo a las/.test(all)) slots.push('Tardes');
  const stylists = employees.filter((e) => {
    const first = norm(e).split(' ')[0];
    return first.length > 2 && new RegExp(`\\b${first}\\b`).test(all);
  });

  const has = (name) => topics.find((t) => t.name === name)?.count || 0;
  const tags = [];
  if (has('Precios y presupuestos') >= 2 || /descuento|oferta|promo|caro/.test(all)) tags.push('Sensible al precio');
  if (has('Eventos')) tags.push('Prepara eventos');
  if (has('Cuero cabelludo y alergias')) tags.push('Cuero cabelludo sensible o alergias');
  if (has('Cambios y cancelaciones') >= 1 || /se me olvid/.test(all)) tags.push('Agradece recordatorios');
  if (has('Color') >= 2) tags.push('Le interesa el color');
  if (has('Tratamientos')) tags.push('Interesada en tratamientos');
  if (has('Productos')) tags.push('Abierta a comprar producto');
  if (stylists.length) tags.push(`Confía en ${stylists[0]}`);
  if (has('Quejas')) tags.push('Ha tenido alguna queja');
  if (inbound.length >= 8) tags.push('Muy comunicativa');

  // Tiempo medio de respuesta del salón a sus mensajes.
  const waits = [];
  messages.forEach((m, i) => {
    if (m.direction !== 'in') return;
    const reply = messages.slice(i + 1).find((x) => x.direction === 'out');
    if (reply) waits.push((Date.parse(reply.created_at.replace(' ', 'T')) - Date.parse(m.created_at.replace(' ', 'T'))) / 60000);
  });
  const responseMinutes = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;

  const parts = [];
  if (inbound.length) {
    parts.push(`${mood}.`);
    if (topics.length) parts.push(`Escribe sobre todo por ${topics.slice(0, 2).map((t) => t.name.toLowerCase()).join(' y ')}.`);
    if (serviceHits.length) parts.push(`Ha preguntado por ${serviceHits.slice(0, 3).map((s) => s.name).join(', ')}.`);
    if (days.length || slots.length) parts.push(`Menciona ${[...days, ...slots.map((s) => s.toLowerCase())].join(', ')}.`);
    if (tags.includes('Cuero cabelludo sensible o alergias')) parts.push('Tenlo en cuenta antes de cualquier servicio técnico.');
  }

  return {
    summary: parts.join(' ') || 'Aún no hay conversaciones con este cliente.',
    mood,
    sentiment: Math.round(sentiment * 100) / 100,
    topics,
    services: serviceHits,
    preferences: [...days, ...slots],
    stylists,
    tags,
    inboundCount: inbound.length,
    outboundCount: messages.length - inbound.length,
    responseMinutes,
    lastContact: messages.length ? messages[messages.length - 1].created_at : null
  };
}

/* Recalcula y guarda lo que se sabe de un cliente con todos sus mensajes. */
export function refreshClientInsights(db, salonId, clientId) {
  if (!clientId) return null;
  const messages = db.prepare(`SELECT m.direction, m.body, m.created_at FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.salon_id = ? AND c.client_id = ? ORDER BY m.created_at, m.id`).all(salonId, clientId);
  const services = db.prepare('SELECT name FROM services WHERE salon_id = ? AND active = 1').all(salonId).map((r) => r.name);
  const employees = db.prepare('SELECT name FROM employees WHERE salon_id = ? AND active = 1').all(salonId).map((r) => r.name);
  const data = analyzeConversation(messages, { services, employees });
  const prev = getInsights(db, clientId);
  if (prev?.ai) data.ai = prev.ai; // conserva el último resumen de IA
  db.prepare(`INSERT INTO client_insights (client_id, salon_id, data, updated_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT (client_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(clientId, salonId, JSON.stringify(data));
  return data;
}

export function getInsights(db, clientId) {
  const row = db.prepare('SELECT data FROM client_insights WHERE client_id = ?').get(clientId);
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}
