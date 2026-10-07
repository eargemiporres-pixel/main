/* Muttto · Plan de Crecimiento a 3 Meses
   Todo ocurre en el navegador: lee el formulario, calcula el diagnóstico con las
   reglas de oro de Muttto, construye el plan y lo maqueta en páginas A4. */

const RULES = {
  minRate: 0.85,        // €/min mínimo
  minTicket: 50,        // ticket medio mínimo (TMS)
  minHour: 51,          // facturación mínima de la hora
  clientsMin: 80,       // clientas/colaborador/mes
  clientsMax: 120,
  clientsTarget: 100,
  revProfitable: 4000,  // €/mes/empleado: a partir de aquí empieza a ser rentable
  revOptimal: 5000,     // €/mes/empleado
  productPct: 20,       // % de lo facturado
  lowShareMax: 20,      // % máx. de servicios que facturan <50 €/h
  ownerTolerance: 10,   // puntos de desviación aceptables en el reparto del tiempo
};

const $ = id => document.getElementById(id);
const NUM_IDS = ['staff','payCost','pColor','tColor','pDry','tDry','pCut','tCut','lowShare','clients','revenue',
  'rent','utilities','product','equipment','ownerShare','peak','stations','sinks','m2','trainings'];

/* ------------------------------ Utilidades ------------------------------ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v, d = 0) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const eur = (v, d = 0) => fmt(v, d) + ' €';
const ceilTo = (v, step) => Math.ceil(v / step - 1e-9) * step;
const val = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };

function readInputs() {
  const d = { salon: $('salon').value.trim(), owner: $('owner').value.trim(),
    tenure: $('tenure').value, model: $('model').value, trainType: $('trainType').value,
    comfort70: $('comfort70').value, goal: $('goal').value.trim(), pain: $('pain').value.trim(),
    beliefs: [...document.querySelectorAll('#beliefs input:checked')].map(i => i.value) };
  NUM_IDS.forEach(id => { d[id] = val(id); });
  return d;
}

/* ------------------------------- Cálculos ------------------------------- */
function analyze(d) {
  const N = d.staff;
  const m = { N };
  m.tms = d.pColor + d.pDry;
  m.rateColor = d.pColor / d.tColor;
  m.rateDry = d.pDry / d.tDry;
  m.rateCut = (d.pCut && d.tCut) ? d.pCut / d.tCut : null;
  m.cpc = d.clients / N;                       // clientas por colaborador
  m.rpe = d.revenue / N;                       // facturación por empleado
  m.payroll = N * (d.payCost ?? 0);
  m.fixed = m.payroll + (d.rent ?? 0) + (d.utilities ?? 0) + (d.equipment ?? 0);
  m.productPct = d.product != null && d.revenue > 0 ? d.product / d.revenue * 100 : null;
  m.costs = m.fixed + (d.product ?? 0);
  m.margin = d.revenue - m.costs;
  m.health = d.clients * m.tms - m.payroll;    // SS = nº clientas × TMS − cobro de colaboradores
  m.breakeven = m.fixed / (1 - RULES.productPct / 100);
  m.idealShare = 100 / N;
  m.ownerGap = (N > 1 && d.ownerShare != null) ? d.ownerShare - m.idealShare : null;
  if (d.peak) { m.stationsIdeal = 2 * d.peak; m.sinksIdeal = Math.ceil(d.peak / 2); }
  if (d.m2) {
    m.maxIntim = Math.max(1, Math.round(d.m2 / 60 * 5));
    m.maxVol = Math.max(1, Math.round(d.m2 / 60 * 8));
    m.maxStations = d.model === 'volumen' ? m.maxVol : m.maxIntim;
  }

  /* Precios mínimos a 0,85 €/min */
  const minPrice = (p, t) => Math.max(p, ceilTo(t * RULES.minRate, 1));
  m.target = {
    color: minPrice(d.pColor, d.tColor),
    dry: minPrice(d.pDry, d.tDry),
    cut: (d.pCut && d.tCut) ? minPrice(d.pCut, d.tCut) : null,
  };
  m.tmsTarget = Math.max(RULES.minTicket, m.target.color + m.target.dry);

  /* Flags que gobiernan diagnóstico y plan */
  const f = m.flags = {};
  f.lowPrice = m.rateColor < RULES.minRate || m.rateDry < RULES.minRate || (m.rateCut != null && m.rateCut < RULES.minRate);
  f.lowTicket = m.tms < RULES.minTicket;
  f.fewClients = m.cpc < RULES.clientsMin;
  f.saturated = m.cpc > RULES.clientsMax;
  f.lowRevenue = m.rpe < RULES.revProfitable;
  f.midRevenue = m.rpe >= RULES.revProfitable && m.rpe < RULES.revOptimal;
  f.loss = m.margin < 0;
  f.owner = m.ownerGap != null && Math.abs(m.ownerGap) > RULES.ownerTolerance;
  f.product = m.productPct != null && m.productPct > RULES.productPct + 2;
  f.lowShare = d.lowShare != null && d.lowShare > RULES.lowShareMax;
  f.furniture = !!d.peak && d.stations != null && d.sinks != null && (d.stations < m.stationsIdeal || d.sinks < m.sinksIdeal);
  f.overcrowded = !!d.m2 && d.stations != null && d.stations > m.maxStations;
  f.training = d.trainType !== 'mixta';
  f.mindset = d.comfort70 !== 'si' || d.beliefs.length > 0;

  /* Objetivos a 3 meses */
  const hire = f.saturated;
  m.hire = hire;
  m.nTarget = hire ? N + 1 : N;
  m.clientsPerTarget = hire ? d.clients / m.nTarget
    : f.fewClients ? RULES.clientsMin + 10
    : m.cpc;
  m.clientsTotalTarget = Math.round(m.clientsPerTarget * m.nTarget);
  m.ticketTarget = Math.max(m.tmsTarget, m.tms);
  m.revTargetTotal = m.clientsTotalTarget * m.ticketTarget;
  m.rpeTarget = m.revTargetTotal / m.nTarget;
  // espacio para meter una persona más
  m.roomForHire = !d.m2 || d.stations == null || d.stations + 2 <= m.maxStations + 1;
  return m;
}

/* ------------------------------ Indicadores ----------------------------- */
function indicators(d, m) {
  const rows = [];
  const add = (label, value, rule, status) => rows.push({ label, value, rule, status });
  const st = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'crit');
  add('Ticket medio (color de raíz + secado)', eur(m.tms), `≥ ${RULES.minTicket} €`, st(m.tms >= RULES.minTicket));
  add('Ticket real cobrado (facturación ÷ clientas)', eur(d.revenue / d.clients, 1), `≥ ${RULES.minTicket} €`, st(d.revenue / d.clients >= RULES.minTicket, d.revenue / d.clients >= 40));
  add('Precio por minuto · color de raíz', `${fmt(m.rateColor, 2)} €/min`, `≥ ${fmt(RULES.minRate, 2)} €/min`, st(m.rateColor >= RULES.minRate));
  add('Precio por minuto · secado', `${fmt(m.rateDry, 2)} €/min`, `≥ ${fmt(RULES.minRate, 2)} €/min`, st(m.rateDry >= RULES.minRate));
  add('Clientas por colaborador al mes', fmt(m.cpc), `${RULES.clientsMin}-${RULES.clientsMax}`, st(!m.flags.fewClients && !m.flags.saturated, m.flags.saturated));
  add('Facturación por empleado al mes', eur(m.rpe), `≥ ${fmt(RULES.revOptimal)} € (rentable desde ${fmt(RULES.revProfitable)})`, st(m.rpe >= RULES.revOptimal, m.flags.midRevenue));
  add('Margen mensual tras todos los gastos', eur(m.margin), '> 0 €', st(m.margin >= 0));
  if (m.productPct != null) add('Consumo de producto sobre lo facturado', `${fmt(m.productPct, 1)} %`, `≈ ${RULES.productPct} %`, st(m.productPct <= RULES.productPct + 2, m.productPct <= RULES.productPct + 6));
  if (d.lowShare != null) add('Facturación de servicios < 50 €/hora', `${fmt(d.lowShare)} %`, `≤ ${RULES.lowShareMax} %`, st(d.lowShare <= RULES.lowShareMax, d.lowShare <= RULES.lowShareMax + 10));
  if (m.ownerGap != null) add('Tiempo de la dueña en el salón', `${fmt(d.ownerShare)} %`, `${fmt(m.idealShare)} %`, st(Math.abs(m.ownerGap) <= RULES.ownerTolerance, Math.abs(m.ownerGap) <= 25));
  if (m.stationsIdeal) {
    if (d.stations != null) add('Tocadores por estilista (turno fuerte)', `${d.stations} para ${d.peak}`, `2 por estilista (${m.stationsIdeal})`, st(d.stations >= m.stationsIdeal, d.stations >= d.peak));
    if (d.sinks != null) add('Lavacabezas', `${d.sinks} para ${d.peak} estilistas`, `1 por cada 2 (${m.sinksIdeal})`, st(d.sinks >= m.sinksIdeal, d.sinks >= m.sinksIdeal - 1));
  }
  add('Formación', d.trainType === 'mixta' ? 'Técnica + negocio' : d.trainType === 'tecnica' ? 'Solo técnica' : 'Sin formación', 'Técnica + negocio, cada mes', st(d.trainType === 'mixta', d.trainType === 'tecnica'));
  return rows;
}

/* ------------------------------- Hallazgos ------------------------------ */
function findings(d, m) {
  const f = m.flags, out = [];
  const add = (sev, title, why) => out.push({ sev, title, why });

  if (f.loss) add('crit', `El salón pierde ${eur(Math.abs(m.margin))} al mes`,
    `Con ${eur(d.revenue)} de facturación y ${eur(m.costs)} de gastos (equipo, alquiler, consumos, material y producto) el negocio no se sostiene en el tiempo. Necesitas facturar al menos ${eur(m.breakeven)} al mes solo para llegar a cero.`);
  if (f.lowPrice) add('crit', 'Tus precios no pagan el tiempo que dedicas',
    `Color de raíz a ${fmt(m.rateColor, 2)} €/min y secado a ${fmt(m.rateDry, 2)} €/min, frente a un mínimo de ${fmt(RULES.minRate, 2)} €/min (51 € la hora). Cuando los precios se ponen mirando a la competencia y no lo que el salón necesita, trabajar más no es ganar más: es abaratar el servicio.`);
  if (f.lowTicket) add('crit', `Ticket medio de ${eur(m.tms)}, por debajo de 50 €`,
    `El ticket medio (color de raíz + secado medio) es la palanca más rápida: subirlo a ${eur(m.tmsTarget)} no exige una sola clienta nueva.`);
  if (f.lowRevenue) add('crit', `Facturas ${eur(m.rpe)} por empleado: aún no es rentable`,
    `A partir de ${fmt(RULES.revProfitable)} € por empleado el salón empieza a ser rentable y lo óptimo son ${fmt(RULES.revOptimal)} €. Hoy cada colaborador no llega a cubrir su parte de los gastos.`);
  else if (f.midRevenue) add('warn', `Facturas ${eur(m.rpe)} por empleado: rentable pero lejos del óptimo`,
    `El salón cubre gastos, pero el objetivo sano son ${fmt(RULES.revOptimal)} € por empleado y mes.`);
  if (f.fewClients) add('warn', `Te faltan clientas: ${fmt(m.cpc)} por colaborador`,
    `Por debajo de ${RULES.clientsMin} clientas al mes por colaborador el equipo no es rentable. El objetivo es llegar a ${RULES.clientsTarget}.`);
  if (f.saturated) add('warn', `Saturación: ${fmt(m.cpc)} clientas por colaborador`,
    `Por encima de ${RULES.clientsMax} se despacha a las clientas y el ticket medio baja. Toca repartir la carga: con una persona más serían ${fmt(d.clients / (m.N + 1))} clientas cada una.`);
  if (f.owner) add(Math.abs(m.ownerGap) > 25 ? 'crit' : 'warn', `La dueña carga con el ${fmt(d.ownerShare)} % del tiempo`,
    `Con ${m.N} personas el reparto sano es ${fmt(m.idealShare)} % cada una. Se contrata para quitarse tareas, la peluquera no da más de sí y cada nueva incorporación aumenta la carga en vez de repartirla.`);
  if (f.product) add('warn', `El producto se come el ${fmt(m.productPct, 1)} % de lo facturado`,
    `Lo saludable es en torno al ${RULES.productPct} %. Un consumo por encima suele indicar precios bajos, malas dosificaciones o falta de control.`);
  if (f.lowShare) add('warn', `El ${fmt(d.lowShare)} % de tu facturación viene de servicios de poco valor/hora`,
    `Los servicios que no facturan 50 € la hora no deberían superar el ${RULES.lowShareMax} % de la facturación de cada colaborador. Los más rentables son color, aclaración y tratamientos.`);
  if (f.furniture) add('warn', 'Faltan puestos para trabajar con calidad',
    `La regla es 2 tocadores por estilista y 1 lavacabezas por cada 2. Si una estilista abarca demasiado, la clienta en espera durante el tiempo de exposición se siente abandonada y baja la calidad percibida.`);
  if (f.overcrowded) add('warn', `${d.stations} puestos son demasiados para ${d.m2} m² en modelo ${d.model === 'volumen' ? 'volumen' : 'intimidad'}`,
    `Para tu superficie, el máximo orientativo es ${m.maxStations} puestos. Meter un tocador más a la fuerza no arregla la facturación: hay que decidir qué experiencia se quiere vender.`);
  if (f.training) add('warn', 'La formación no está aterrizada al negocio',
    `Aprender técnicas nuevas sin saber ponerles precio, definir tiempos y ofrecerlas bien deja el problema de base intacto. La formación debe convertir una técnica en un servicio rentable.`);
  if (f.mindset) add('warn', 'Las creencias están frenando al salón',
    `${d.comfort70 === 'si' ? '' : 'Cobrar 70 € por un color todavía no se siente cómodo. '}Quien no sabe dónde está no puede decidir adónde ir: el primer paso es hacer consciente el punto de partida.`);

  const order = { crit: 0, warn: 1, ok: 2 };
  out.sort((a, b) => order[a.sev] - order[b.sev]);
  return out;
}

/* ---------------------------- Plan a 3 meses ---------------------------- */
function buildPlan(d, m) {
  const f = m.flags, t = m.target;
  const pr = (label, cur, tgt) => tgt != null && tgt > cur ? `${label} de ${eur(cur)} a ${eur(tgt)}` : null;
  const priceList = [pr('color de raíz', d.pColor, t.color), pr('secado', d.pDry, t.dry), pr('corte', d.pCut, t.cut)].filter(Boolean).join(' · ');
  const A = (month, week, title, detail, when = true) => ({ month, week, title, detail, when });

  const actions = [
    // ---- MES 1 · Medir y poner precio a tu tiempo
    A(1, 'Sem. 1', 'Haz los números reales del salón',
      'Completa el cuadrante de lista de precios con el tiempo real de cada servicio y apunta por colaborador: cobro, parte del alquiler, consumos, producto y amortización de material. Sin punto de partida no hay dirección.'),
    A(1, 'Sem. 1-2', 'Recalcula tus precios a 0,85 €/min mínimo',
      `${priceList || 'Tus precios ya cumplen el mínimo: revísalos servicio a servicio'}. Usa el Constructor de Menú de Muttto para ver el menú completo y no pongas precios por la competencia de al lado, sino por lo que el salón necesita.`, f.lowPrice || f.lowTicket),
    A(1, 'Sem. 2', 'Trabaja la frase “¿70 € por un color?”',
      'Escríbela, díla en voz alta y anota qué sientes y de dónde viene esa creencia. Prepara con tu equipo cómo explicar el valor del color antes de hablar de precio.', f.mindset),
    A(1, 'Sem. 3', 'Haz el mapa de tareas dueña / equipo',
      `Lista quién hace qué. Objetivo: que cada persona atienda su propia cartera y facture. Reparto meta con ${m.N} personas: ${fmt(m.idealShare)} % cada una (hoy la dueña está en ${fmt(d.ownerShare ?? 0)} %).`, f.owner),
    A(1, 'Sem. 3', 'Audita los servicios que no llegan a 50 €/hora',
      `Haz la operación € ÷ tiempo de secado y corte (normalmente 22 € en 30-45 min y 20-25 € en 30 min) y fija el tope: menos del ${RULES.lowShareMax} % de la facturación de cada colaborador.`, f.lowShare || f.lowPrice),
    A(1, 'Sem. 4', 'Mide el espacio y la agenda',
      `Cuenta tocadores y lavacabezas del turno fuerte (regla 2:1 y 1:2). Identifica cuándo una estilista atiende a demasiadas clientas a la vez y marca esos huecos en la agenda.`, f.furniture),
    A(1, 'Sem. 4', 'Pon control al consumo de producto',
      `Registra cuánto producto se gasta por servicio y colaborador. Meta: ≈ ${RULES.productPct} % de lo facturado (hoy ${fmt(m.productPct ?? 0, 1)} %).`, f.product),
    A(1, 'Sem. 4', 'Reserva tu primera formación con Muttto',
      'Elige el servicio que más valor aporta (color, aclaración o tratamiento) y agenda la parte 1 en tu salón y la parte 2 en Muttto: técnica y negocio.', f.training),
    A(1, 'Sem. 4', 'Define tu salón ideal y confírmalo con números',
      `Elige: ${d.model === 'volumen' ? 'modelo volumen con mesa técnica central' : 'modelo intimidad, ticket alto'}. Con ${d.m2 ? d.m2 + ' m²' : 'tu superficie'} el máximo orientativo es ${m.maxStations ?? '—'} puestos de trabajo.`, f.overcrowded),

    A(1, 'Sem. 4', 'Crea tu cuadro de mando mensual',
      'Apunta cada mes cinco números: ticket medio, clientas por colaborador, facturación por empleado, consumo de producto y reparto de horas. Lo que no se mide no se puede mejorar.', true),

    // ---- MES 2 · Implantar y repartir
    A(2, 'Sem. 1', 'Lanza los nuevos precios',
      `Aplica la lista nueva a todas las reservas desde una fecha fija y prepara un guion de 3 frases para el equipo. Sin descuentos de “por si acaso”. Ticket medio objetivo: ${eur(m.ticketTarget)}.`, f.lowPrice || f.lowTicket),
    A(2, 'Sem. 1-2', 'Reestructura la agenda para dar lujo, no prisa',
      'Reduce las clientas simultáneas por estilista y respeta los tiempos de exposición con la clienta cómoda en su puesto. Menos volumen simultáneo = más percepción de valor = más ticket.', f.furniture),
    A(2, 'Sem. 2', 'Reparte la cartera y las horas',
      `Cada colaboradora lleva su agenda y su facturación. La dueña baja del ${fmt(d.ownerShare ?? 0)} % hacia el ${fmt(m.idealShare)} % y deja de “quitarse tareas” para que el resto no se convierta en ayudante.`, f.owner),
    A(2, 'Sem. 2-3', `Incorpora a una persona más (${fmt(d.clients / (m.N + 1))} clientas cada una)`,
      'Repartid la carga entre todas. La nueva persona entra formándose para hacer todos los servicios, no solo cortes. Hazlo solo si el local lo permite.', f.saturated && m.roomForHire),
    A(2, 'Sem. 2-3', 'Estudia un espacio mayor',
      d.tenure === 'alquiler'
        ? 'Con el local de alquiler y la carga al límite, valora con Muttto la búsqueda de un nuevo espacio antes de meter más mobiliario.'
        : 'Con el local en propiedad, pide el diseño de plano 2D para redistribuir el espacio según el modelo elegido.',
      f.saturated && !m.roomForHire),
    A(2, 'Sem. 2-4', `Plan de captación: de ${fmt(m.cpc)} a ${fmt(m.clientsPerTarget)} clientas por colaborador`,
      'Reactiva clientas que no vuelven desde hace 3 meses, pide recomendaciones a las mejores clientas y reserva la siguiente cita antes de que se vayan. Sube el volumen sin bajar el precio.', f.fewClients),
    A(2, 'Sem. 3', 'Formación 1 en tu salón y convierte la técnica en servicio',
      'Para cada técnica nueva define nombre, tiempo (aplicación + exposición + lavado) y precio por minuto. Una habilidad sin precio no es una herramienta de venta.', true),
    A(2, 'Sem. 4', 'Control de producto semanal',
      `Revisa cada viernes el consumo vs. facturación. Si sigue por encima del ${RULES.productPct} %, ajusta dosificaciones o precio del servicio afectado.`, f.product),
    A(2, 'Sem. 4', 'Primera revisión de números',
      'Compara con el mes 1: ticket medio, clientas por colaborador y facturación por empleado. Anota qué ha costado más y de qué creencia viene.', true),

    // ---- MES 3 · Consolidar y crecer
    A(3, 'Sem. 1', 'Revisión completa del trimestre',
      `Vuelve a pasar el diagnóstico con datos del mes. Objetivos: ticket ≥ ${eur(m.ticketTarget)}, ${fmt(m.clientsPerTarget)} clientas por colaborador y ${eur(m.rpeTarget)} por empleado.`, true),
    A(3, 'Sem. 2', 'Segunda vuelta de precios: secado y corte',
      'Aplica la operación € ÷ tiempo a los servicios menos rentables y decide cuáles se mantienen por prestigio y cuáles se reajustan. Prioriza el color, la aclaración y los tratamientos.', f.lowPrice || f.lowShare || f.lowTicket),
    A(3, 'Sem. 3', 'Formación 2 en Muttto: técnica y negocio',
      'Trae a todo el equipo. Cada técnica sale con servicio, tiempo y precio definidos y con un guion de venta para el salón.', true),
    A(3, 'Sem. 3', `Llega a ${RULES.clientsTarget} clientas por colaborador`,
      'Consolida la agenda: fideliza, pre-reserva y reduce los huecos. Ese es el punto donde cada puesto trabaja con calidad y rentabilidad.', f.fewClients),
    A(3, 'Sem. 3', 'Prepara la siguiente incorporación',
      `Cuando el equipo vuelva a llegar a ${RULES.clientsMax} clientas cada uno y el local lo permita, repetid el reparto con una persona más (80-80-80 con tres).`, !f.fewClients),
    A(3, 'Sem. 4', 'Cierra el trimestre y define los próximos 12 meses',
      'Con los resultados reales, fija objetivos de ticket, facturación por empleado y reparto de horas, y agenda las formaciones del año.', true),
  ];

  const months = [
    { n: 1, name: 'Medir y poner precio a tu tiempo',
      goal: 'Saber con exactitud dónde estás y tener una lista de precios que paga tu tiempo.',
      kpis: [
        ['Ticket medio objetivo', eur(m.tmsTarget), `hoy ${eur(m.tms)}`],
        ['Precio mínimo', '0,85 €/min', `color ${fmt(m.rateColor, 2)} · secado ${fmt(m.rateDry, 2)}`],
        ['Lista de precios', '100 %', 'recalculada'] ] },
    { n: 2, name: 'Implantar y repartir',
      goal: 'Aplicar los precios nuevos, ordenar la agenda y repartir la carga entre todo el equipo.',
      kpis: [
        ['Ticket medio real', eur(m.ticketTarget), 'en reservas nuevas'],
        ['Clientas / colaborador', fmt(m.hire ? m.clientsPerTarget : m.cpc), `hoy ${fmt(m.cpc)}`],
        ['Tiempo de la dueña', m.N > 1 ? fmt(m.idealShare) + ' %' : '—', m.ownerGap != null ? `hoy ${fmt(d.ownerShare)} %` : 'reparto equitativo'] ] },
    { n: 3, name: 'Consolidar y crecer',
      goal: 'Comprobar el cambio con números, afinar y dejar preparado el siguiente paso de crecimiento.',
      kpis: [
        ['Facturación / empleado', eur(m.rpeTarget), `hoy ${eur(m.rpe)}`],
        ['Clientas / colaborador', fmt(m.clientsPerTarget), RULES.clientsMin + '-' + RULES.clientsMax + ' ideal'],
        ['Facturación del salón', eur(m.revTargetTotal), `hoy ${eur(d.revenue)}`] ] },
  ];
  months.forEach(mo => {
    mo.actions = actions.filter(a => a.month === mo.n && a.when).slice(0, 6);
  });
  return months;
}

/* ------------------------------ Maquetación ----------------------------- */
const BELIEF_TEXT = {
  trabajo: 'Si trabajo más, consigo facturar más',
  producto: 'Si encuentro un producto mejor, lo cambio',
  ticket: 'Mi ticket medio es el correcto',
  equipo: 'Es que no recogen, no lavan las toallas…',
  valgo: 'No soy capaz · ¿cómo voy a cobrar esos precios?',
  competencia: 'Pongo mis precios mirando a la competencia',
};
const STATUS_LABEL = { ok: 'Bien', warn: 'Atención', crit: 'Crítico' };
const FOOT = '961 077 195 &nbsp;_&nbsp; Info@muttto.com';

function page(n, inner, cls = '') {
  return `<article class="rp ${cls}">
    <img class="rp-logo" src="assets/logo-muttto.png" alt="Muttto">
    <div class="rp-body">${inner}</div>
    <div class="rp-foot"><span>${FOOT}</span><span>${n}</span></div>
  </article>`;
}

function renderReport(d, m) {
  const salon = d.salon || 'Tu salón';
  const rows = indicators(d, m);
  const finds = findings(d, m);
  const months = buildPlan(d, m);
  const today = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const pages = [];

  // 1 · Portada
  pages.push(`<article class="rp rp-cover">
    <img class="rp-cover-logo" src="assets/logo-muttto-blanco.png" alt="Muttto">
    <div class="rp-cover-text">
      <p class="rp-eyebrow-light">Plan de acción · ${esc(today)}</p>
      <h1>Plan de crecimiento a 3 meses</h1>
      <p class="rp-cover-sub">${esc(salon)}${d.owner ? ' · ' + esc(d.owner) : ''}</p>
    </div></article>`);

  // 2 · Punto de partida
  const big = [
    [eur(m.tms), 'ticket medio de tu salón', `mínimo ${RULES.minTicket} €`],
    [eur(m.rpe), 'facturación por empleado al mes', `óptimo ${fmt(RULES.revOptimal)} €`],
    [fmt(m.cpc), 'clientas por colaborador al mes', `${RULES.clientsMin}-${RULES.clientsMax}`],
    [eur(m.margin), 'margen mensual tras todos los gastos', m.margin >= 0 ? 'el salón cubre gastos' : 'el salón pierde dinero'],
  ];
  pages.push(page(2, `
    <h2>Punto de partida: ${esc(today)}</h2>
    <div class="rp-bigs">${big.map(b => `<div class="rp-big"><b>${b[0]}</b><span>${b[1]}</span><em>${b[2]}</em></div>`).join('')}</div>
    <p class="rp-label">Tus indicadores frente a las reglas de oro</p>
    <table class="rp-table rp-ind">
      <thead><tr><th>Indicador</th><th>Tu salón</th><th>Regla de oro</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td><strong>${esc(r.value)}</strong></td><td>${esc(r.rule)}</td>
        <td><span class="pill pill-${r.status}">${STATUS_LABEL[r.status]}</span></td></tr>`).join('')}</tbody>
    </table>`));

  // 3 · Diagnóstico
  const shown = finds.slice(0, 6);
  pages.push(page(3, `
    <h2>Lo que hoy frena a tu salón</h2>
    ${shown.length ? `<div class="rp-finds">${shown.map((x, i) => `
      <div class="rp-find rp-find-${x.sev}"><span class="rp-find-n">${i + 1}</span>
        <div><h4>${esc(x.title)}</h4><p>${esc(x.why)}</p></div></div>`).join('')}</div>`
      : `<div class="rp-note">Tus indicadores cumplen las reglas de oro. El plan se centra en consolidar y preparar el siguiente paso de crecimiento.</div>`}
    ${finds.length > shown.length ? `<p class="rp-small">Hay ${finds.length - shown.length} aspectos más de menor prioridad que se irán trabajando en el plan.</p>` : ''}
    <div class="rp-note">Más formación técnica rara vez es la solución. Un salón crece cuando conoce sus números: precio por minuto, ticket medio, clientas por colaborador y reparto del tiempo.</div>`));

  // 4 · Números
  const priceRows = [['Color de raíz', d.pColor, d.tColor, m.target.color], ['Secado medio', d.pDry, d.tDry, m.target.dry]];
  if (m.target.cut != null) priceRows.push(['Corte mujer', d.pCut, d.tCut, m.target.cut]);
  const tmsGain = (m.tmsTarget - m.tms) * d.clients;
  pages.push(page(4, `
    <h2>Tus números y adónde llegar</h2>
    <p class="rp-label">Precios mínimos para que el tiempo se pague (0,85 €/min)</p>
    <table class="rp-table">
      <thead><tr><th>Servicio</th><th>Tiempo</th><th>Hoy</th><th>€/min hoy</th><th>Mínimo recomendado</th></tr></thead>
      <tbody>${priceRows.map(r => `<tr><td>${r[0]}</td><td>${fmt(r[2])} min</td><td>${eur(r[1], 2)}</td>
        <td>${fmt(r[1] / r[2], 2)}</td><td><strong>${eur(r[3], 2)}</strong></td></tr>`).join('')}
      <tr class="rp-total"><td colspan="2">Ticket medio (color + secado)</td><td>${eur(m.tms, 2)}</td><td></td><td><strong>${eur(m.tmsTarget, 2)}</strong></td></tr></tbody>
    </table>
    ${tmsGain > 0 ? `<div class="rp-note">Solo con subir el ticket medio, y manteniendo tus ${fmt(d.clients)} clientas, la facturación aumentaría unos <strong>${eur(tmsGain)} al mes</strong>.</div>` : ''}
    <p class="rp-label">Cuentas mensuales del salón</p>
    <div class="rp-cols">
      <table class="rp-table rp-compact"><tbody>
        <tr><td>Facturación</td><td class="r">${eur(d.revenue)}</td></tr>
        <tr><td>Equipo (${m.N} × ${eur(d.payCost ?? 0)})</td><td class="r">− ${eur(m.payroll)}</td></tr>
        <tr><td>Alquiler</td><td class="r">− ${eur(d.rent ?? 0)}</td></tr>
        <tr><td>Luz, agua y consumos</td><td class="r">− ${eur(d.utilities ?? 0)}</td></tr>
        <tr><td>Material y mobiliario</td><td class="r">− ${eur(d.equipment ?? 0)}</td></tr>
        <tr><td>Producto</td><td class="r">− ${eur(d.product ?? 0)}</td></tr>
        <tr class="rp-total"><td>Margen</td><td class="r"><strong>${eur(m.margin)}</strong></td></tr>
      </tbody></table>
      <div class="rp-mini">
        <div><b>${eur(m.breakeven)}</b><span>facturación mínima al mes para no perder dinero</span></div>
        <div><b>${eur(m.health)}</b><span>salud del salón: clientas × ticket medio − coste del equipo</span></div>
      </div>
    </div>
    <p class="rp-small">Salud del salón = nº de clientas × ticket medio − cobro de los colaboradores. Cálculo orientativo con los datos que has introducido.</p>`));

  // 5-7 · Meses
  months.forEach((mo, i) => {
    pages.push(page(5 + i, `
      <p class="rp-eyebrow">Mes ${mo.n}</p>
      <h2>${esc(mo.name)}</h2>
      <p class="rp-lead">${esc(mo.goal)}</p>
      <div class="rp-kpis">${mo.kpis.map(k => `<div><span>${esc(k[0])}</span><b>${esc(k[1])}</b><em>${esc(k[2])}</em></div>`).join('')}</div>
      <p class="rp-label">Acciones</p>
      <div class="rp-actions">${mo.actions.map(a => `
        <div class="rp-action"><span class="rp-week">${a.week}</span>
          <div><h4>${esc(a.title)}</h4><p>${esc(a.detail)}</p></div></div>`).join('')}</div>`));
  });

  // 8 · Mentalidad, visión y siguiente paso
  const beliefs = d.beliefs.map(b => BELIEF_TEXT[b]);
  pages.push(page(8, `
    <h2>Del punto de partida al siguiente nivel</h2>
    <p class="rp-label">En 3 meses, si ejecutas el plan</p>
    <table class="rp-table rp-compact">
      <thead><tr><th></th><th>Hoy</th><th>Objetivo mes 3</th></tr></thead>
      <tbody>
        <tr><td>Ticket medio</td><td>${eur(m.tms)}</td><td><strong>${eur(m.ticketTarget)}</strong></td></tr>
        <tr><td>Clientas por colaborador</td><td>${fmt(m.cpc)}</td><td><strong>${fmt(m.clientsPerTarget)}</strong></td></tr>
        <tr><td>Colaboradores</td><td>${m.N}</td><td><strong>${m.nTarget}</strong></td></tr>
        <tr><td>Facturación por empleado</td><td>${eur(m.rpe)}</td><td><strong>${eur(m.rpeTarget)}</strong></td></tr>
        <tr><td>Facturación mensual</td><td>${eur(d.revenue)}</td><td><strong>${eur(m.revTargetTotal)}</strong></td></tr>
      </tbody>
    </table>
    <p class="rp-small">Objetivos de referencia calculados con las reglas de oro; el resultado real depende de la ejecución.</p>
    <p class="rp-label">Más allá del trimestre</p>
    <div class="rp-cols3">
      <div><b>1 mes</b><p>Precios recalculados y números reales sobre la mesa.</p></div>
      <div><b>3 meses</b><p>Precios aplicados, carga repartida y ticket medio en ${eur(m.ticketTarget)}.</p></div>
      <div><b>1 año</b><p>${eur(m.revTargetTotal * 12)} de facturación anual a este ritmo y el equipo formándose cada mes.</p></div>
    </div>
    <div class="rp-mind">
      <p class="rp-label">Lo que nos has contado</p>
      ${beliefs.length ? `<ul>${beliefs.map(b => `<li>“${esc(b)}”</li>`).join('')}</ul>` : ''}
      ${d.pain ? `<p><strong>Lo que menos te gusta hoy:</strong> ${esc(d.pain)}</p>` : ''}
      ${d.goal ? `<p><strong>Lo que quieres conseguir:</strong> ${esc(d.goal)}</p>` : ''}
      <p class="rp-quote">Todos los problemas de un negocio vienen, en el fondo, de la gestión emocional de la dueña y de su equipo. Cuando eso se resuelve, el salón funciona. ¿Qué supondría para ti sentirte cómoda cobrando 70 € por un color?</p>
    </div>
    <p class="rp-small"><strong>Siguiente paso:</strong> formarte cada mes con Muttto (parte 1 en tu salón, parte 2 en Muttto), en técnica y en negocio.</p>`));

  // 9 · Cierre
  pages.push(`<article class="rp rp-cover rp-close">
    <img class="rp-cover-logo" src="assets/logo-muttto-blanco.png" alt="Muttto">
    <div class="rp-cover-text">
      <h1>Construimos la estructura antes que el crecimiento</h1>
      <p class="rp-cover-sub">${FOOT}</p>
    </div></article>`);

  return pages.join('');
}

/* -------------------------------- Interfaz ------------------------------- */
function validate(d) {
  const missing = [...document.querySelectorAll('[data-req]')].filter(el => val(el.id) === null || val(el.id) <= 0);
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  missing.forEach(el => el.classList.add('invalid'));
  if (missing.length) { missing[0].focus(); return 'Faltan datos imprescindibles: nº de colaboradores, precios y tiempos de color y secado, clientas al mes y facturación.'; }
  if (d.staff % 1 !== 0) return 'El número de colaboradores debe ser un número entero.';
  return null;
}

function fitReport() {
  const wrap = $('reportPages');
  const w = Math.min(window.innerWidth - 24, 794);
  wrap.style.setProperty('--zoom', Math.min(1, w / 794));
}

function showReport(on) {
  $('formView').hidden = on;
  $('reportView').hidden = !on;
  window.scrollTo(0, 0);
}

$('planForm').addEventListener('submit', e => {
  e.preventDefault();
  const d = readInputs();
  const err = validate(d);
  const box = $('formError');
  box.hidden = !err; box.textContent = err || '';
  if (err) return;
  const m = analyze(d);
  $('reportPages').innerHTML = renderReport(d, m);
  document.title = 'Plan de crecimiento · ' + (d.salon || 'Muttto');
  fitReport(); showReport(true);
});

$('editBtn').addEventListener('click', () => showReport(false));
$('printBtn').addEventListener('click', downloadPdf);

/* PDF: dentro de una página publicada (sin diálogo de impresión) se genera el
   archivo con html2canvas + jsPDF y se ofrece para guardar; si no están esas
   librerías, se usa el diálogo de impresión del navegador. */
async function downloadPdf() {
  const btn = $('printBtn');
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (!dl || !window.html2canvas || !window.jspdf) { window.print(); return; }
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Generando PDF…';
  const host = document.createElement('div');
  host.className = 'report-pages';
  host.style.cssText = 'position:fixed;left:-10000px;top:0;padding:0;';
  host.style.setProperty('--zoom', 1);
  host.innerHTML = $('reportPages').innerHTML;
  document.body.appendChild(host);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pages = host.querySelectorAll('.rp');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    }
    const name = (readInputs().salon || 'salon').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';
    await dl.save({ filename: `plan-crecimiento-${name}.pdf`, data: pdf.output('blob') });
  } catch (err) {
    if (window.console) console.error('PDF', err && (err.stack || err.message || err.code || err)); if (!err || err.code !== 'declined') alert_('No se pudo generar el PDF. Inténtalo de nuevo.');
  } finally {
    host.remove(); btn.disabled = false; btn.textContent = label;
  }
}
function alert_(msg) {
  const bar = document.querySelector('.report-bar-text');
  bar.style.display = 'inline'; bar.style.color = '#a8452f'; bar.textContent = msg;
}
window.addEventListener('resize', fitReport);
$('staff').addEventListener('input', () => {
  const n = val('staff');
  $('ownerShareHint').textContent = n >= 2 ? `(reparto sano: ${fmt(100 / n)} %)` : '';
});

$('demoBtn').addEventListener('click', () => {
  const demo = { salon: 'Peluquería Aurora', owner: 'Laura', staff: 3, payCost: 2100, pColor: 38, tColor: 95, pDry: 18, tDry: 40,
    pCut: 20, tCut: 30, lowShare: 35, clients: 330, revenue: 9800, rent: 950, utilities: 280, product: 2650, equipment: 300,
    ownerShare: 65, peak: 3, stations: 4, sinks: 1, m2: 60, trainings: 1 };
  Object.entries(demo).forEach(([k, v]) => { $(k).value = v; });
  $('trainType').value = 'tecnica'; $('comfort70').value = 'no';
  $('goal').value = 'Trabajar menos horas y ganar más'; $('pain').value = 'Siempre estoy yo en todo';
  document.querySelectorAll('#beliefs input').forEach((c, i) => { c.checked = i === 0 || i === 4 || i === 5; });
  $('staff').dispatchEvent(new Event('input'));
});
