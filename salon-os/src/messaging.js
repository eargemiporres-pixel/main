/* Comunicación con clientes: bandeja de conversaciones (WhatsApp, email,
   SMS…), envío de mensajes, mensajes entrantes por webhook, plantillas y
   recordatorios automáticos.

   Envío:
   - WhatsApp: si el salón conectó WhatsApp Business (Cloud API de Meta), el
     mensaje sale por la API. Si no, queda registrado y se devuelve un enlace
     wa.me para enviarlo desde el móvil o WhatsApp Web (modo manual).
   - Email: con una clave de Resend sale por su API; si no, enlace mailto.
   - SMS: siempre manual (enlace sms:). */
import { today, addDays, daysBetween } from './dates.js';
import { listClients, clientDetail } from './clients.js';
import { refreshClientInsights } from './insights.js';
import { tomorrowAppointments } from './agenda.js';

export const digits = (s) => String(s ?? '').replace(/\D/g, '');
/* Teléfono comparable: últimos 9 dígitos (formato español sin prefijo). */
export const phoneKey = (s) => digits(s).slice(-9);
const intlPhone = (s) => { const d = digits(s); return d.length === 9 ? `34${d}` : d; };
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export const DEFAULT_TEMPLATES = [
  ['recordatorio', 'Le toca volver', 'Hola {nombre}, ¡somos {salon}! Ya han pasado {dias} días desde tu último {servicio}. ¿Te reservamos cita esta semana? Contesta a este mensaje y te buscamos hueco.'],
  ['reactivacion', 'Te echamos de menos', 'Hola {nombre}, te echamos de menos en {salon}. ¿Te apetece volver a vernos? Esta semana tenemos huecos y nos encantaría cuidarte.'],
  ['segunda_visita', 'Segunda visita', 'Hola {nombre}, gracias por confiar en {salon}. ¿Qué tal estás con tu {servicio}? Si quieres, te guardamos ya tu próxima cita.'],
  ['postservicio', 'Gracias por venir', 'Hola {nombre}, gracias por venir hoy a {salon}. ¿Qué tal te ha quedado? Tu opinión nos ayuda mucho.'],
  ['confirmacion', 'Confirmar cita', 'Hola {nombre}, te recordamos tu cita en {salon} {fecha}. ¿Nos confirmas que vienes? Si no puedes venir, avísanos y te buscamos otro hueco.']
];

export function ensureTemplates(db, salonId) {
  if (db.prepare('SELECT 1 FROM message_templates WHERE salon_id = ? LIMIT 1').get(salonId)) return;
  const ins = db.prepare('INSERT INTO message_templates (salon_id, kind, name, body) VALUES (?, ?, ?, ?)');
  for (const [kind, name, body] of DEFAULT_TEMPLATES) ins.run(salonId, kind, name, body);
}

export function renderTemplate(body, vars) {
  return String(body).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
}

export function channelsFor(db, salonId) {
  return db.prepare('SELECT * FROM salon_channels WHERE salon_id = ?').get(salonId)
    || { salon_id: salonId, wa_phone_number_id: '', wa_token: '', wa_number: '', email_api_key: '', email_from: '' };
}

export function channelStatus(ch) {
  return {
    whatsapp: ch.wa_phone_number_id && ch.wa_token ? 'api' : 'manual',
    email: ch.email_api_key && ch.email_from ? 'api' : 'manual',
    sms: 'manual'
  };
}

/* Busca el cliente por teléfono o email; si no existe y se pide, lo crea. */
function matchClient(db, salonId, channel, contact, name, create) {
  if (channel === 'email') {
    const c = db.prepare('SELECT id FROM clients WHERE salon_id = ? AND lower(email) = lower(?)').get(salonId, contact);
    if (c) return c.id;
  } else {
    const key = phoneKey(contact);
    if (key.length >= 9) {
      for (const c of db.prepare("SELECT id, phone FROM clients WHERE salon_id = ? AND phone <> ''").all(salonId)) {
        if (phoneKey(c.phone) === key) return c.id;
      }
    }
  }
  if (!create) return null;
  const r = db.prepare('INSERT INTO clients (salon_id, name, phone, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(salonId, name || contact, channel === 'email' ? '' : contact, channel === 'email' ? contact : '', `Creada desde ${channel === 'email' ? 'email' : 'WhatsApp'}`, today());
  return Number(r.lastInsertRowid);
}

export function getOrCreateConversation(db, salonId, { channel, contact, name = '', clientId = null, createClient = true }) {
  const key = channel === 'email' ? String(contact).trim().toLowerCase() : intlPhone(contact);
  if (!key) throw new Error('Falta el teléfono o el email');
  let conv = db.prepare('SELECT * FROM conversations WHERE salon_id = ? AND channel = ? AND contact = ?').get(salonId, channel, key);
  if (conv) {
    if (!conv.client_id && (clientId || createClient)) {
      const cid = clientId || matchClient(db, salonId, channel, key, name || conv.contact_name, createClient);
      if (cid) {
        db.prepare('UPDATE conversations SET client_id = ? WHERE id = ?').run(cid, conv.id);
        conv.client_id = cid;
      }
    }
    return conv;
  }
  const cid = clientId || matchClient(db, salonId, channel, key, name, createClient);
  const r = db.prepare('INSERT INTO conversations (salon_id, client_id, channel, contact, contact_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(salonId, cid, channel, key, name, now());
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(r.lastInsertRowid));
}

/* Mensaje entrante (webhook de WhatsApp, API de integración o importación). */
export function recordInbound(db, salonId, { channel = 'whatsapp', from, name = '', body, externalId = null, at = null }) {
  const text = String(body ?? '').trim();
  if (!text) return { skipped: true };
  if (externalId && db.prepare('SELECT 1 FROM messages WHERE salon_id = ? AND external_id = ?').get(salonId, externalId)) return { duplicate: true };
  const conv = getOrCreateConversation(db, salonId, { channel, contact: from, name });
  const when = at || now();
  db.prepare("INSERT INTO messages (conversation_id, salon_id, direction, body, status, external_id, created_at) VALUES (?, ?, 'in', ?, 'recibido', ?, ?)")
    .run(conv.id, salonId, text, externalId, when);
  db.prepare(`UPDATE conversations SET unread = unread + 1, status = 'abierta', last_message_at = ?, last_inbound_at = ?, last_preview = ?,
      contact_name = CASE WHEN contact_name = '' THEN ? ELSE contact_name END WHERE id = ?`).run(when, when, text.slice(0, 140), name, conv.id);
  if (conv.client_id) refreshClientInsights(db, salonId, conv.client_id);
  return { conversationId: conv.id, clientId: conv.client_id };
}

async function sendWhatsApp(ch, to, text) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(ch.wa_phone_number_id)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ch.wa_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `WhatsApp respondió ${res.status}`);
  return data.messages?.[0]?.id || null;
}

async function sendEmail(ch, to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ch.email_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: ch.email_from, to: [to], subject, text })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `El servicio de email respondió ${res.status}`);
  return data.id || null;
}

export function manualLink(channel, contact, text, subject = '') {
  if (channel === 'whatsapp') return `https://wa.me/${contact}?text=${encodeURIComponent(text)}`;
  if (channel === 'email') return `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return `sms:+${contact}?body=${encodeURIComponent(text)}`;
}

/* Envía un mensaje en una conversación. Devuelve {status, link?, error?}. */
export async function sendMessage(db, salon, conv, text, { author = '', template = null } = {}) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('Escribe el mensaje');
  const ch = channelsFor(db, salon.id);
  const mode = channelStatus(ch)[conv.channel] || 'manual';
  let status = 'manual';
  let externalId = null;
  let error = null;
  let link = null;
  if (mode === 'api') {
    try {
      externalId = conv.channel === 'whatsapp' ? await sendWhatsApp(ch, conv.contact, body) : await sendEmail(ch, conv.contact, `Mensaje de ${salon.name}`, body);
      status = 'enviado';
    } catch (err) {
      status = 'error';
      error = err.message;
      // Fuera de la ventana de 24 h, WhatsApp solo admite plantillas aprobadas:
      // se ofrece el envío manual como alternativa.
      link = manualLink(conv.channel, conv.contact, body, `Mensaje de ${salon.name}`);
    }
  } else {
    link = manualLink(conv.channel, conv.contact, body, `Mensaje de ${salon.name}`);
  }
  const when = now();
  db.prepare("INSERT INTO messages (conversation_id, salon_id, direction, body, status, external_id, template, author, error, created_at) VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?)")
    .run(conv.id, salon.id, body, status, externalId, template, author, error, when);
  db.prepare("UPDATE conversations SET last_message_at = ?, last_preview = ?, unread = 0, status = CASE WHEN status = 'cerrada' THEN 'abierta' ELSE status END WHERE id = ?")
    .run(when, body.slice(0, 140), conv.id);
  return { status, link, error, mode };
}

export function listConversations(db, salonId, { filter = 'abiertas', q = '' } = {}) {
  const where = {
    abiertas: "c.status = 'abierta'",
    sin_leer: 'c.unread > 0',
    pendientes: "c.status = 'pendiente'",
    cerradas: "c.status = 'cerrada'",
    todas: '1 = 1'
  }[filter] || "c.status = 'abierta'";
  const rows = db.prepare(`SELECT c.*, cl.name AS client_name, e.name AS assigned_name FROM conversations c
      LEFT JOIN clients cl ON cl.id = c.client_id LEFT JOIN employees e ON e.id = c.assigned_to
      WHERE c.salon_id = ? AND ${where} ORDER BY c.last_message_at DESC LIMIT 300`).all(salonId);
  const ql = String(q).trim().toLowerCase();
  const list = ql ? rows.filter((r) => `${r.client_name || ''} ${r.contact_name} ${r.contact} ${r.last_preview}`.toLowerCase().includes(ql)) : rows;
  const counts = db.prepare(`SELECT SUM(status = 'abierta') AS abiertas, SUM(unread > 0) AS sin_leer, SUM(status = 'pendiente') AS pendientes,
      SUM(status = 'cerrada') AS cerradas, COUNT(*) AS todas, COALESCE(SUM(unread), 0) AS unread FROM conversations WHERE salon_id = ?`).get(salonId);
  return { conversations: list, counts };
}

export function conversationDetail(db, salonId, id) {
  const conv = db.prepare(`SELECT c.*, cl.name AS client_name FROM conversations c LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE c.id = ? AND c.salon_id = ?`).get(id, salonId);
  if (!conv) return null;
  const messages = db.prepare('SELECT id, direction, body, status, template, author, error, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, id').all(id);
  db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').run(id);
  const client = conv.client_id ? clientDetail(db, salonId, conv.client_id) : null;
  const lastIn = conv.last_inbound_at;
  const windowOpen = lastIn ? (Date.now() - Date.parse(lastIn.replace(' ', 'T') + 'Z')) / 3600000 < 24 : false;
  return { conversation: { ...conv, unread: 0 }, messages, client, windowOpen };
}

/* Recordatorios sugeridos: a quién conviene escribir hoy y con qué mensaje. */
export function reminderSuggestions(db, salon) {
  ensureTemplates(db, salon.id);
  const t = today();
  const templates = new Map(db.prepare('SELECT kind, body FROM message_templates WHERE salon_id = ?').all(salon.id).map((r) => [r.kind, r.body]));
  const lastSent = new Map(db.prepare(`SELECT c.client_id, m.template, MAX(m.created_at) AS at FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.salon_id = ? AND m.direction = 'out' AND m.template IS NOT NULL GROUP BY c.client_id, m.template`).all(salon.id).map((r) => [`${r.client_id}|${r.template}`, r.at]));
  const recentlySent = (cid, kind, days) => {
    const at = lastSent.get(`${cid}|${kind}`);
    return at && at.slice(0, 10) >= addDays(t, -days);
  };
  const { clients } = listClients(db, salon.id, { limit: 5000 });
  const topService = db.prepare(`SELECT l.name FROM ticket_lines l JOIN tickets tk ON tk.id = l.ticket_id
      WHERE tk.client_id = ? AND l.kind = 'service' GROUP BY l.name ORDER BY COUNT(*) DESC LIMIT 1`);
  const groups = {
    confirmacion: { kind: 'confirmacion', title: 'Citas de mañana', description: 'Recuérdales la cita y pide que la confirmen: reduce los plantones.', items: [] },
    recordatorio: { kind: 'recordatorio', title: 'Le toca volver', description: 'Clientes habituales cuya próxima visita estimada es esta semana.', items: [] },
    reactivacion: { kind: 'reactivacion', title: 'Te echamos de menos', description: 'Clientes que llevan más del doble de su frecuencia sin venir.', items: [] },
    segunda_visita: { kind: 'segunda_visita', title: 'Segunda visita', description: 'Clientes nuevos de hace 3 a 6 semanas que aún no han vuelto.', items: [] },
    postservicio: { kind: 'postservicio', title: 'Gracias por venir', description: 'Clientes atendidos ayer: pide su opinión.', items: [] }
  };
  for (const c of clients) {
    if (phoneKey(c.phone).length < 9 || !c.last_visit) continue;
    const since = daysBetween(c.last_visit, t);
    const interval = c.visits >= 2 ? daysBetween(c.first_visit, c.last_visit) / (c.visits - 1) : null;
    let kind = null;
    let reason = '';
    if (since === 1) { kind = 'postservicio'; reason = 'Vino ayer'; }
    else if (c.state === 'En riesgo' && c.visits >= 2) { kind = 'reactivacion'; reason = `${since} días sin venir (suele venir cada ${Math.round(interval)})`; }
    else if (c.state === 'Nueva' && since >= 21 && since <= 45) { kind = 'segunda_visita'; reason = `Primera visita hace ${since} días`; }
    else if (interval && c.state !== 'Perdida' && since >= interval - 3 && since <= interval + 7 && since >= 14) { kind = 'recordatorio'; reason = `Suele venir cada ${Math.round(interval)} días; hace ${since}`; }
    if (!kind || recentlySent(c.id, kind, kind === 'postservicio' ? 2 : 21)) continue;
    const servicio = (topService.get(c.id)?.name || 'servicio').toLowerCase();
    const text = renderTemplate(templates.get(kind) || '', { nombre: c.name.split(' ')[0], salon: salon.name, dias: since, servicio, fecha: '' });
    groups[kind].items.push({ client_id: c.id, name: c.name, phone: c.phone, reason, text });
  }
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (const a of tomorrowAppointments(db, salon.id)) {
    if (!a.client_id || phoneKey(a.client_phone).length < 9 || recentlySent(a.client_id, 'confirmacion', 2)) continue;
    const d = new Date(`${a.date}T12:00:00Z`);
    const fecha = `mañana, ${DAYS[d.getUTCDay()]} ${d.getUTCDate()}, a las ${a.start}`;
    const text = renderTemplate(templates.get('confirmacion') || '', { nombre: (a.client_name || '').split(' ')[0], salon: salon.name, fecha, servicio: a.services.map((x) => x.name.toLowerCase()).join(' y '), dias: '' });
    groups.confirmacion.items.push({ client_id: a.client_id, name: a.client_name, phone: a.client_phone, reason: `${a.start} · ${a.services.map((x) => x.name).join(' + ')}`, text });
  }
  for (const g of Object.values(groups)) g.items = g.items.slice(0, 60);
  return Object.values(groups);
}

/* Extrae los mensajes de una notificación del webhook de WhatsApp Cloud API. */
export function parseWhatsAppWebhook(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = new Map((v.contacts || []).map((c) => [c.wa_id, c.profile?.name || '']));
      for (const m of v.messages || []) {
        let body = '';
        if (m.type === 'text') body = m.text?.body || '';
        else if (m.type === 'button') body = m.button?.text || '';
        else if (m.type === 'interactive') body = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
        else body = { image: '[Imagen recibida]', audio: '[Audio recibido]', document: '[Documento recibido]', video: '[Vídeo recibido]', sticker: '[Sticker recibido]', location: '[Ubicación recibida]' }[m.type] || '[Mensaje recibido]';
        out.push({
          phoneNumberId: v.metadata?.phone_number_id || '',
          from: m.from,
          name: names.get(m.from) || '',
          body,
          externalId: m.id,
          at: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString().replace('T', ' ').slice(0, 19) : null
        });
      }
      for (const s of v.statuses || []) out.push({ phoneNumberId: v.metadata?.phone_number_id || '', status: s.status, externalId: s.id });
    }
  }
  return out;
}
