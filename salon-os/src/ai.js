/* Resumen de cliente con Claude (opcional). Se activa solo si el servidor
   tiene credenciales de la API de Anthropic (ANTHROPIC_API_KEY) y el paquete
   @anthropic-ai/sdk instalado; si no, SalonPro usa el análisis por reglas. */

let clientPromise = null;

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

async function getClient() {
  if (!hasCredentials()) return null;
  if (!clientPromise) {
    clientPromise = import('@anthropic-ai/sdk')
      .then(({ default: Anthropic }) => ({ Anthropic, client: new Anthropic() }))
      .catch(() => null);
  }
  return clientPromise;
}

/* Cliente compartido con el asistente de WhatsApp. */
export const getAiClient = getClient;

export async function aiAvailable() {
  return Boolean(await getClient());
}

const SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: 'Dos o tres frases sobre quién es esta clienta para el salón.' },
    emocionalidad: { type: 'string', description: 'Cómo se siente con el salón y cómo prefiere que se le hable.' },
    intereses: { type: 'array', items: { type: 'string' } },
    preferencias: { type: 'array', items: { type: 'string' } },
    alertas: { type: 'array', items: { type: 'string' }, description: 'Alergias, quejas o riesgos a tener en cuenta.' },
    oportunidades: { type: 'array', items: { type: 'string' }, description: 'Servicios o productos que encajan con ella.' },
    siguiente_paso: { type: 'string', description: 'La próxima acción concreta que recomiendas al salón.' }
  },
  required: ['resumen', 'emocionalidad', 'intereses', 'preferencias', 'alertas', 'oportunidades', 'siguiente_paso'],
  additionalProperties: false
};

const SYSTEM = `Eres el asistente de un salón de peluquería y belleza en España. Lees la conversación de WhatsApp o email entre el salón y una clienta y su historial de visitas, y devuelves una ficha breve y práctica para el equipo: quién es, cómo se siente, qué le interesa, qué prefiere, qué hay que vigilar y qué conviene ofrecerle. Escribe en español de España, en un tono cercano y profesional. No inventes datos que no estén en la conversación o en el historial; si algo no se sabe, no lo menciones.`;

/* client: {name}, history: [{date, services}], messages: [{direction, body, created_at}] */
export async function aiClientSummary({ salonName, client, history, messages }) {
  const ai = await getClient();
  if (!ai) return { error: 'La IA no está configurada en el servidor.' };
  const transcript = messages.map((m) => `[${m.created_at}] ${m.direction === 'in' ? client.name : salonName}: ${m.body}`).join('\n');
  const visits = history.map((h) => `${h.date}: ${h.services}`).join('\n') || 'Sin visitas registradas.';
  try {
    const response = await ai.client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Salón: ${salonName}\nClienta: ${client.name}\n\nÚltimas visitas:\n${visits}\n\nConversación:\n${transcript}`
      }]
    });
    if (response.stop_reason === 'refusal') return { error: 'La IA no ha podido analizar esta conversación.' };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { data: JSON.parse(text) };
  } catch (err) {
    const { Anthropic } = ai;
    if (err instanceof Anthropic.APIConnectionError) return { error: 'No se pudo conectar con la IA. Revisa la conexión del servidor.' };
    if (err instanceof Anthropic.AuthenticationError) return { error: 'La clave de la API de Claude no es válida.' };
    if (err instanceof Anthropic.RateLimitError) return { error: 'Demasiadas peticiones a la IA; prueba en un minuto.' };
    if (err instanceof Anthropic.APIError) return { error: `La IA respondió con un error (${err.status}).` };
    if (err instanceof SyntaxError) return { error: 'La respuesta de la IA no tenía el formato esperado.' };
    throw err;
  }
}
