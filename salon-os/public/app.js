/* Salon OS · interfaz (sin frameworks). Rutas por hash: #/panel, #/clientes… */

/* ---------- Utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(n, d = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const neg = n < 0;
  const [i, dec] = Math.abs(Number(n)).toFixed(d).split('.');
  return `${neg ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec ? `,${dec}` : ''}`;
}
const eur = (n, d = 0) => (n == null ? '—' : `${fmt(n, d)} €`);
const pct = (n, d = 1) => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmt(n, d)} %`);
const toneOf = (n) => (n == null ? '' : n >= 0 ? 'up' : 'down');
const parseNum = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fdate = (d) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '—');
const fdateShort = (d) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}` : '—');
const METHOD = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', bizum: 'Bizum', transferencia: 'Transferencia', otro: 'Otro' };
const GENDER = { M: 'Mujer', H: 'Hombre', U: 'Sin indicar' };
const STATE_TAG = { 'Fiel': 'green', 'VIP': 'plum', 'En riesgo': 'red', 'Nueva': 'amber', 'Ocasional': '', 'Perdida': '', 'Sin visitas': '' };
const SIGNAL_TAG = { 'Alta': 'solid', 'Media': 'amber', 'Baja': '', 'Sin datos': '' };

const ICONS = {
  panel: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
  cobro: 'M3 6h18v12H3zM3 10h18M7 15h4',
  caja: 'M4 7h16v13H4zM8 7V4h8v3M4 12h16',
  clientes: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  equipo: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  catalogo: 'M4 5h16M4 12h16M4 19h10',
  pedidos: 'M4 7h13l3 4v6h-2M4 7v10h2M4 7l1-3h10l2 3M9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M11 17h4',
  importar: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  consola: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"></path></svg>`;

/* ---------- Estado y API ---------- */
const S = {
  me: null,
  salonId: null,
  period: 'month',
  ref: null,
  clientFilter: 'todos',
  clientQ: '',
  cashDate: null,
  consoleFilter: 'todos',
  consoleRef: null
};
const isAdmin = () => S.me?.user.role === 'admin';

async function api(path, { method = 'GET', body, salon = true } = {}) {
  let url = path;
  if (salon && isAdmin() && S.salonId && !path.startsWith('/api/admin')) url += `${url.includes('?') ? '&' : '?'}salon=${S.salonId}`;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    S.me = null;
    render();
    throw new Error(data.error || 'Inicia sesión');
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function toast(msg, err = false) {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = `toast${err ? ' err' : ''}`;
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* Diálogo de formulario genérico. fields: [{name, label, type, value, options, required, hint, step}] */
function openForm({ title, intro = '', fields, submit = 'Guardar', onSubmit }) {
  const dlg = document.createElement('dialog');
  const input = (f) => {
    const id = `f_${f.name}`;
    const req = f.required ? 'required' : '';
    let control;
    if (f.type === 'select') {
      control = `<select id="${id}" name="${f.name}" ${req}>${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea id="${id}" name="${f.name}" ${req}>${esc(f.value ?? '')}</textarea>`;
    } else if (f.type === 'checkbox') {
      return `<label class="field" style="flex-direction:row;align-items:center;gap:10px"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''} style="width:20px;height:20px"> ${esc(f.label)}</label>`;
    } else {
      const type = f.type === 'money' ? 'text' : f.type || 'text';
      const mode = f.type === 'money' || f.type === 'number' ? 'inputmode="decimal"' : '';
      control = `<input id="${id}" name="${f.name}" type="${type}" ${mode} value="${esc(f.value ?? '')}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''}>`;
    }
    return `<label class="field" for="${id}" ${f.full ? 'style="grid-column:1/-1"' : ''}>${esc(f.label)}${control}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</label>`;
  };
  dlg.innerHTML = `<form method="dialog">
    <h2>${esc(title)}</h2>
    ${intro ? `<p class="muted" style="margin:0">${esc(intro)}</p>` : ''}
    <div class="form-grid">${fields.map(input).join('')}</div>
    <p class="err down hidden" role="alert" style="margin:0;font-weight:600"></p>
    <div class="form-actions"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn primary" type="submit">${esc(submit)}</button></div>
  </form>`;
  document.body.appendChild(dlg);
  const form = $('form', dlg);
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      values[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'money' || f.type === 'number' ? (el.value === '' ? '' : parseNum(el.value)) : el.value;
    }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await onSubmit(values);
      dlg.close();
    } catch (err) {
      const p = $('.err', form);
      p.textContent = err.message;
      p.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
  dlg.showModal();
  return dlg;
}

function confirmAction(message) {
  return window.confirm(message);
}

/* ---------- Router ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { page: parts[0] || '', id: parts[1] || null, query: new URLSearchParams(qs || '') };
}
const go = (hash) => { location.hash = hash; };

const SALON_NAV = [
  ['panel', 'Panel'], ['cobro', 'Nuevo cobro'], ['caja', 'Caja'], ['clientes', 'Clientes'],
  ['equipo', 'Equipo y horas'], ['catalogo', 'Servicios y productos'], ['pedidos', 'Pedidos de producto'],
  ['importar', 'Conectar TPV / importar'], ['ajustes', 'Ajustes']
];
const VIEWS = {};

async function render() {
  const app = $('#app');
  if (!S.me) {
    try { S.me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)); } catch { S.me = null; }
  }
  if (!S.me) return renderLogin(app);
  if (!S.ref) S.ref = S.me.today.slice(0, 7);
  if (!S.consoleRef) S.consoleRef = S.ref;
  if (!S.cashDate) S.cashDate = S.me.today;

  let { page, id, query } = parseHash();
  if (isAdmin()) {
    if (!S.salonId) S.salonId = Number(sessionStorage.getItem('salonId')) || null;
    if (!page) page = 'consola';
    if (page !== 'consola' && !S.salonId) {
      S.salonId = S.me.salons[0]?.id || null;
      if (!S.salonId) page = 'consola';
    }
  } else if (!page || page === 'consola') page = 'panel';
  if (!VIEWS[page]) page = isAdmin() ? 'consola' : 'panel';

  document.body.classList.toggle('console', page === 'consola');
  const salonName = isAdmin() ? S.me.salons.find((s) => s.id === S.salonId)?.name : S.me.salon?.name;
  app.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><b>Salon OS</b><span>${esc(isAdmin() ? 'Consola del distribuidor' : salonName || '')}</span></div>
      ${isAdmin() ? `<nav class="nav" aria-label="Distribuidor">
          <a href="#/consola" ${page === 'consola' ? 'aria-current="page"' : ''}>${icon('consola')}Red de salones</a>
        </nav>
        <div class="nav-label">Ver salón</div>
        <select id="salonPick" aria-label="Salón">${S.me.salons.map((s) => `<option value="${s.id}" ${s.id === S.salonId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}
      <nav class="nav" aria-label="Salón">
        ${SALON_NAV.map(([p, label]) => `<a href="#/${p}" ${page === p ? 'aria-current="page"' : ''}>${icon(p)}${label}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div class="side-card"><strong><span class="dot"></span> Datos al día</strong>Cada cobro actualiza métricas, clientes y caja al momento.</div>
        <button type="button" class="link-btn" id="logout">Cerrar sesión</button>
      </div>
    </aside>
    <main class="main" id="main"><div class="loading">Cargando…</div></main>
  </div>`;
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST', body: {} }).catch(() => {}); S.me = null; sessionStorage.clear(); go('#/'); render(); };
  const pick = $('#salonPick');
  if (pick) pick.onchange = () => {
    S.salonId = Number(pick.value);
    sessionStorage.setItem('salonId', S.salonId);
    if (page === 'consola') go('#/panel'); else render();
  };
  const main = $('#main');
  try {
    await VIEWS[page](main, { id, query });
  } catch (err) {
    main.innerHTML = `<div class="notice warn">${esc(err.message)}</div>`;
  }
  main.focus?.();
}

window.addEventListener('hashchange', () => render());

/* ---------- Login ---------- */
function renderLogin(app) {
  document.body.classList.remove('console');
  app.innerHTML = `<div class="login">
    <section class="login-art">
      <b>Salon OS</b>
      <div style="display:flex;flex-direction:column;gap:16px">
        <h1>Los números de tu salón, al día y sin teclear dos veces.</h1>
        <p>Facturación, clientes, equipo, caja y producto en un solo panel. Conectado a tu TPV.</p>
      </div>
      <span style="font-size:13px;color:#B8AEA4">CRM · caja · métricas · distribución</span>
    </section>
    <section class="login-form">
      <form id="loginForm">
        <h2>Entrar</h2>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required></label>
        <label class="field">Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="down hidden" id="loginErr" role="alert" style="margin:0;font-weight:600"></p>
        <button class="btn primary" type="submit">Entrar</button>
        <div class="demo-box">¿Probando la demo?<br>Salón: <code>norte@demo.com</code><br>Distribuidor: <code>admin@demo.com</code><br>Contraseña: <code>demo1234</code></div>
      </form>
    </section>
  </div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/login', { method: 'POST', body: { email: f.email.value, password: f.password.value }, salon: false });
      S.me = null;
      go('#/');
      render();
    } catch (err) {
      const p = $('#loginErr');
      p.textContent = err.message;
      p.classList.remove('hidden');
    }
  });
}

/* ---------- Panel del salón ---------- */
VIEWS.panel = async (main) => {
  const d = await api(`/api/dashboard?period=${S.period}&ref=${S.ref}`);
  const m = d.metrics;
  const p = d.previous;
  const delta = (cur, prev, unit = '%') => {
    if (cur == null || !prev) return '';
    const g = ((cur - prev) / prev) * 100;
    return `<span class="${toneOf(g)}">${pct(g)}</span> vs periodo anterior${d.partial ? ' (mismos días)' : ''}`;
  };
  const maxBar = Math.max(1, ...d.series.map((x) => x.services + x.products));
  const fromYm = d.from.slice(0, 7);
  const toYm = d.to.slice(0, 7);
  const bars = d.series.map((x) => {
    const on = x.month >= fromYm && (x.month < toYm || (d.partial && x.month === d.ref));
    const hs = Math.round((x.services / maxBar) * 190);
    const hp = Math.round((x.products / maxBar) * 190);
    return { m: MONTHS[Number(x.month.slice(5, 7)) - 1], on, hs, hp, tot: `${fmt((x.services + x.products) / 1000, 1)}k` };
  });
  const mixS = m.revenue ? Math.round((m.serviceRevenue / m.revenue) * 100) : 0;
  const maxEmp = Math.max(1, ...d.team.map((e) => e.revenue));
  const maxTop = Math.max(1, ...d.topServices.map((s) => s.units));
  const sig = d.signal;
  const hoursNote = m.hoursEstimated ? ' (estimadas)' : '';
  const block = (title, rows) => `<div class="card"><div class="block-title">${title}</div>${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;

  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow">${esc(d.label)}${d.partial ? ' · en curso' : ''}</div><h1>Panel del salón</h1></div>
    <div class="head-actions">
      <div class="seg" role="group" aria-label="Periodo">
        ${[['month', 'Mes'], ['quarter', 'Trimestre'], ['year', 'Año']].map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${S.period === k}">${l}</button>`).join('')}
      </div>
      <input class="input" type="month" id="refMonth" value="${S.ref}" max="${S.me.today.slice(0, 7)}" aria-label="Mes de referencia" style="width:170px">
    </div>
  </header>

  <section class="grid g4" aria-label="Indicadores clave">
    <div class="kpi"><span class="k">Facturación</span><span class="v num">${eur(m.revenue)}</span><span class="d">${delta(m.revenue, p.revenue)}</span></div>
    <div class="kpi"><span class="k">Ticket medio del salón</span><span class="v num">${eur(m.avgTicket, 2)}</span><span class="d">${delta(m.avgTicket, p.avgTicket)}</span></div>
    <div class="kpi"><span class="k">Precio hora del salón</span><span class="v num">${m.hourlyRate == null ? '—' : `${fmt(m.hourlyRate, 2)} €/h`}</span><span class="d">${fmt(m.hours)} h trabajadas${hoursNote}</span></div>
    <div class="kpi"><span class="k">Clientes atendidos</span><span class="v num">${fmt(m.clients)}</span><span class="d">${fmt(m.newClients)} nuevos · ${fmt(m.visits)} visitas</span></div>
  </section>

  <section class="grid g-2-1">
    <div class="card">
      <div class="card-head"><h2>Facturación mensual · últimos 12 meses</h2>
        <div class="legend"><span><i style="background:var(--plum)"></i>Servicios</span><span><i style="background:var(--ochre)"></i>Producto</span></div></div>
      <div class="chart" role="img" aria-label="Facturación de los últimos 12 meses">
        ${bars.map((b) => `<div class="col"><span class="val num">${b.tot}</span><div class="stack ${b.on ? '' : 'dim'}"><div class="p" style="height:${b.hp}px"></div><div class="s" style="height:${b.hs}px"></div></div></div>`).join('')}
      </div>
      <div class="chart-labels">${bars.map((b) => `<span>${b.m}</span>`).join('')}</div>
    </div>
    <div class="card">
      <h2>Crecimiento</h2>
      ${[['Mensual', 'mes vs mes anterior', d.growth.monthly], ['Trimestral', 'últimos 3 meses vs 3 anteriores', d.growth.quarterly], ['Anual', 'en lo que va de año vs anterior', d.growth.yearly]]
        .map(([k, sub, v]) => `<div class="growth-row"><div><b>${k}</b><small>${sub}</small></div><span class="big ${toneOf(v)}">${pct(v)}</span></div>`).join('')}
      <div style="display:flex;flex-direction:column;gap:8px">
        <b style="font-size:14px">Servicios vs producto</b>
        <div class="split"><div style="width:${mixS}%;background:var(--plum)"></div><div style="width:${100 - mixS}%;background:var(--ochre)"></div></div>
        <div class="mix-legend muted"><span>Servicios ${eur(m.serviceRevenue)} · ${mixS} %</span><span>Producto ${eur(m.productRevenue)} · ${100 - mixS} %</span></div>
      </div>
    </div>
  </section>

  <section class="grid g4" aria-label="Controles">
    ${block('Control financiero', [
      ['Facturación del periodo', eur(m.revenue)],
      ['Crecimiento mensual', `<span class="${toneOf(d.growth.monthly)}">${pct(d.growth.monthly)}</span>`],
      ['Crecimiento trimestral', `<span class="${toneOf(d.growth.quarterly)}">${pct(d.growth.quarterly)}</span>`],
      ['Crecimiento anual', `<span class="${toneOf(d.growth.yearly)}">${pct(d.growth.yearly)}</span>`],
      ['Facturación por empleado', eur(m.revenuePerEmployee)],
      ['Precio hora del salón', m.hourlyRate == null ? '—' : `${fmt(m.hourlyRate, 2)} €/h`],
      ['Facturación en servicios', eur(m.serviceRevenue)],
      ['Facturación en producto', eur(m.productRevenue)]
    ])}
    ${block('Menú de servicios', [
      ['Servicios vendidos', `${fmt(m.servicesSold)} und`],
      ['Producto retail vendido', `${fmt(m.retailUnits)} und`],
      ['Ticket medio del salón', eur(m.avgTicket, 2)],
      ['Nº servicios mujer', fmt(m.servicesWomen)],
      ['Nº servicios hombre', fmt(m.servicesMen)],
      ['Capacidad de facturación potencial', eur(m.potentialRevenue)],
      ['Ocupación de la agenda', m.occupancy == null ? '—' : `${fmt(m.occupancy * 100)} %`]
    ])}
    ${block('Control estructural', [
      ['Nº de empleados', fmt(m.employees)],
      ['Nº de clientes atendidos', fmt(m.clients)],
      ['Clientes por colaborador', fmt(m.clientsPerEmployee)],
      ['Nº clientes nuevos', fmt(m.newClients)],
      ['Nº visitas totales', fmt(m.visits)],
      ['Horas trabajadas totales', `${fmt(m.hours)} h${hoursNote ? ' <small>est.</small>' : ''}`],
      ['Tiempo medio por cliente', m.avgMinutesPerClient == null ? '—' : `${fmt(m.avgMinutesPerClient)} min${m.minutesMeasured ? '' : ' <small>est.</small>'}`]
    ])}
    ${block('Ventas y distribución', [
      ['Nº pedidos de compra', fmt(m.purchaseOrders)],
      ['Producto comprado', eur(m.productPurchased)],
      ['Consumo de producto', m.consumptionPct == null ? '—' : `<span class="${m.consumptionPct > d.productTargetPct ? 'down' : 'up'}">${fmt(m.consumptionPct, 1)} %</span> <small>obj. ${fmt(d.productTargetPct)} %</small>`],
      ['Stock técnico estimado', sig.daysLeft == null ? '—' : `${sig.daysLeft} días`],
      ['Próximo pedido', sig.level === 'Sin datos' ? '—' : `<span class="tag ${SIGNAL_TAG[sig.level]}">${sig.level === 'Alta' ? 'Pedir ya' : sig.level === 'Media' ? 'Pronto' : 'Sin prisa'}</span>`]
    ])}
  </section>

  <section class="card">
    <div class="card-head"><h2>Rendimiento por empleado</h2><span class="muted">Horas de los registros de Equipo · tiempo por cliente desde la hora de inicio hasta el fin del cobro</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Empleado</th><th class="r">Clientes</th><th class="r">Servicios</th><th class="r">Horas</th><th class="r">Min/cliente</th><th class="r">Ticket medio</th><th class="r">€/hora</th><th>Facturación</th><th class="r">Retail uds</th><th class="r">Retail €</th></tr></thead>
      <tbody>${d.team.length ? d.team.map((e) => `<tr>
        <td><div class="person"><span class="avatar">${esc(initials(e.name))}</span><div><b>${esc(e.name)}</b><small>${esc(e.role || '')}</small></div></div></td>
        <td class="r num">${fmt(e.clients)}</td><td class="r num">${fmt(e.services)}</td>
        <td class="r num">${fmt(e.hours)}${e.hoursEstimated ? '<small class="muted"> est.</small>' : ''}</td>
        <td class="r num">${e.minutesPerClient == null ? '—' : fmt(e.minutesPerClient)}</td>
        <td class="r num">${eur(e.avgTicket, 2)}</td><td class="r num">${eur(e.hourlyRate, 2)}</td>
        <td style="min-width:140px"><b class="num">${eur(e.revenue)}</b><div class="bar thin" style="margin-top:4px"><div style="width:${Math.round((e.revenue / maxEmp) * 100)}%"></div></div></td>
        <td class="r num">${fmt(e.retailUnits)}</td><td class="r num">${eur(e.retailAmount)}</td></tr>`).join('') : '<tr><td colspan="10" class="empty">Añade tu equipo en «Equipo y horas».</td></tr>'}
      </tbody></table></div>
  </section>

  <section class="grid g-1-2">
    <div class="card">
      <h2>Servicios más contratados</h2>
      ${d.topServices.length ? d.topServices.map((s) => `<div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(s.name)}</span><b class="num">${fmt(s.units)} <small class="muted">· ${eur(s.amount)}</small></b></div>
        <div class="bar"><div style="width:${Math.round((s.units / maxTop) * 100)}%"></div></div></div>`).join('') : '<div class="empty">Sin servicios en este periodo.</div>'}
    </div>
    <div class="card dark">
      <div class="card-head"><h2>Qué haría este periodo</h2><span style="font-size:13px;color:#B8AEA4">Recomendaciones automáticas</span></div>
      ${d.recommendations.length ? `<div class="tips">${d.recommendations.map((r) => `<div class="tip"><span class="t">${esc(r.tag)}</span><b>${esc(r.title)}</b><p>${esc(r.text)}</p></div>`).join('')}</div>` : '<p style="color:#D6CDC3">Todo en orden: no hay alertas para este periodo.</p>'}
    </div>
  </section>`;

  $$('[data-period]', main).forEach((b) => (b.onclick = () => { S.period = b.dataset.period; render(); }));
  $('#refMonth', main).onchange = (e) => { if (e.target.value) { S.ref = e.target.value; render(); } };
};

/* ---------- Clientes ---------- */
VIEWS.clientes = async (main, { id }) => {
  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow" id="clientsEyebrow">&nbsp;</div><h1>Clientes</h1></div>
    <div class="head-actions"><button type="button" class="btn primary" id="newClient">Nuevo cliente</button></div>
  </header>
  <div class="clients-layout">
    <section class="card" aria-label="Listado">
      <label class="field">Buscar cliente<input type="search" id="clientQ" class="input" placeholder="Nombre, teléfono o email" value="${esc(S.clientQ)}"></label>
      <div class="chips" role="group" aria-label="Filtro" id="clientFilters"></div>
      <div class="client-list" id="clientList"><div class="empty">Cargando…</div></div>
    </section>
    <section id="clientDetail" aria-label="Ficha de cliente" style="display:flex;flex-direction:column;gap:16px;min-width:0"></section>
  </div>`;

  const loadList = async () => {
    const data = await api(`/api/clients?filter=${S.clientFilter}&q=${encodeURIComponent(S.clientQ)}`);
    $('#clientsEyebrow').textContent = `${fmt(data.counts.todos)} clientes · ${fmt(data.counts.fieles)} fieles · ${fmt(data.counts.riesgo)} en riesgo · ${fmt(data.counts.nuevos)} nuevos`;
    $('#clientFilters').innerHTML = [['todos', 'Todos'], ['fieles', 'Fieles'], ['riesgo', 'En riesgo'], ['nuevos', 'Nuevos'], ['perdidos', 'Perdidos']]
      .map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${S.clientFilter === k}">${l} · ${fmt(data.counts[k])}</button>`).join('');
    $$('#clientFilters [data-f]').forEach((b) => (b.onclick = () => { S.clientFilter = b.dataset.f; loadList(); }));
    $('#clientList').innerHTML = data.clients.length ? data.clients.map((c) => `<button type="button" class="client-row" data-id="${c.id}" aria-pressed="${String(c.id) === String(id)}">
        <span class="avatar">${esc(initials(c.name))}</span>
        <span class="meta"><b>${esc(c.name)}</b><small>${c.last_visit ? `Última visita ${fdate(c.last_visit)}` : 'Sin visitas'} · ${fmt(c.visits)} visitas</small></span>
        <span class="tag ${STATE_TAG[c.state] || ''}">${esc(c.state)}</span></button>`).join('')
      + (data.total > data.clients.length ? `<div class="empty">Mostrando ${data.clients.length} de ${fmt(data.total)}. Usa el buscador para encontrar al resto.</div>` : '')
      : '<div class="empty">Ningún cliente coincide.</div>';
    $$('#clientList [data-id]').forEach((b) => (b.onclick = () => go(`#/clientes/${b.dataset.id}`)));
    if (!id && data.clients[0]) loadDetail(data.clients[0].id);
  };

  let timer;
  $('#clientQ').oninput = (e) => { S.clientQ = e.target.value; clearTimeout(timer); timer = setTimeout(loadList, 250); };
  $('#newClient').onclick = () => clientForm();

  const loadDetail = async (cid) => {
    const box = $('#clientDetail');
    const d = await api(`/api/clients/${cid}`);
    const c = d.client;
    const s = d.stats;
    const phone = String(c.phone || '').replace(/\D/g, '');
    const wa = phone.length >= 9 ? `https://wa.me/${phone.length === 9 ? `34${phone}` : phone}?text=${encodeURIComponent(`Hola ${c.name.split(' ')[0]}, ¡te echamos de menos en ${S.me.salon?.name || 'el salón'}! ¿Te reservamos cita?`)}` : null;
    box.innerHTML = `
      <div class="card" style="flex-direction:row;align-items:center;gap:18px;flex-wrap:wrap">
        <span class="avatar lg">${esc(initials(c.name))}</span>
        <div style="flex-grow:1;display:flex;flex-direction:column;gap:4px;min-width:200px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="font-family:var(--display);font-size:28px;font-weight:500">${esc(c.name)}</h2><span class="tag ${STATE_TAG[d.state] || ''}">${esc(d.state)}</span></div>
          <div class="muted" style="font-size:14px">${GENDER[c.gender]} · Cliente desde ${fdate(s.firstVisit || c.created_at)}</div>
          <div class="muted" style="font-size:14px">${esc(c.phone || 'Sin teléfono')}${c.email ? ` · ${esc(c.email)}` : ''}</div>
        </div>
        <div class="head-actions">
          ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">Enviar WhatsApp</a>` : ''}
          <button type="button" class="btn" id="editClient">Editar</button>
          <a class="btn dark" href="#/cobro?cliente=${c.id}">Nuevo cobro</a>
        </div>
      </div>
      <div class="grid g5">
        <div class="kpi small"><span class="k">Visitas al mes</span><span class="v">${s.visitsPerMonth == null ? '—' : fmt(s.visitsPerMonth, 1)}</span><span class="d">${fmt(s.visits)} visitas en total</span></div>
        <div class="kpi small"><span class="k">Recurrencia</span><span class="v">${s.recurrenceDays == null ? '—' : `${fmt(s.recurrenceDays)} días`}</span><span class="d">${s.daysSinceLast == null ? '' : `última hace ${fmt(s.daysSinceLast)} días`}</span></div>
        <div class="kpi small"><span class="k">Ticket medio</span><span class="v">${eur(s.avgTicket, 2)}</span><span class="d">servicios + producto</span></div>
        <div class="kpi small"><span class="k">Gasto 12 meses</span><span class="v">${eur(s.spent12m)}</span><span class="d">total ${eur(s.spent)}</span></div>
        <div class="kpi small"><span class="k">Retail comprado</span><span class="v">${eur(s.retailAmount)}</span><span class="d">${fmt(s.retailUnits)} unidades</span></div>
      </div>
      ${s.nextVisit ? `<div class="notice ${s.nextVisitOverdue ? 'warn' : ''}">Próxima visita estimada: ${fdate(s.nextVisit)}${s.nextVisitOverdue ? ' · ya ha pasado: buen momento para escribirle' : ''}</div>` : ''}
      <div class="grid g2">
        <div class="card"><h2>Top 3 servicios</h2>${d.topServices.length ? d.topServices.map((t, i) => `<div class="kv"><span>${i + 1}. ${esc(t.name)}</span><span>${fmt(t.units)} veces</span></div>`).join('') : '<div class="empty">Sin servicios todavía.</div>'}</div>
        <div class="card"><h2>Producto retail comprado</h2>${d.retail.length ? d.retail.map((r) => `<div class="kv"><span>${esc(r.name)} <small>· ${fmt(r.units)} uds</small></span><span>${eur(r.amount, 2)}</span></div>`).join('') : '<div class="muted" style="font-size:14px">Aún no ha comprado producto. Recomiéndale su rutina de mantenimiento en la próxima visita.</div>'}</div>
      </div>
      <div class="card"><h2>Servicios recibidos</h2>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Servicios y productos</th><th>Empleado</th><th>Pago</th><th class="r">Importe</th></tr></thead>
        <tbody>${d.history.length ? d.history.map((h) => `<tr><td class="muted" style="white-space:nowrap">${fdate(h.date)}</td><td>${h.lines.map((l) => esc(l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(' + ')}</td><td>${esc(h.employee || '—')}</td><td>${METHOD[h.method] || esc(h.method)}</td><td class="r num"><b>${eur(h.total, 2)}</b></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Sin visitas registradas.</td></tr>'}</tbody></table></div>
      </div>
      <div class="notes"><h3>Notas técnicas</h3><div style="white-space:pre-line;font-size:14px">${c.notes ? esc(c.notes) : '<span class="muted">Sin notas. Usa «Editar» para guardar fórmulas de color, alergias o preferencias.</span>'}</div></div>`;
    $('#editClient').onclick = () => clientForm(c, () => loadDetail(cid));
  };

  await loadList();
  if (id) await loadDetail(id).catch((e) => { $('#clientDetail').innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; });
};

function clientForm(c = null, after) {
  openForm({
    title: c ? 'Editar cliente' : 'Nuevo cliente',
    fields: [
      { name: 'name', label: 'Nombre y apellidos', value: c?.name, required: true, full: true },
      { name: 'phone', label: 'Teléfono', value: c?.phone, type: 'tel' },
      { name: 'email', label: 'Email', value: c?.email, type: 'email' },
      { name: 'gender', label: 'Género', type: 'select', value: c?.gender || 'M', options: [['M', 'Mujer'], ['H', 'Hombre'], ['U', 'Sin indicar']] },
      { name: 'notes', label: 'Notas técnicas', type: 'textarea', value: c?.notes, full: true, hint: 'Fórmulas de color, alergias, preferencias…' }
    ],
    onSubmit: async (v) => {
      if (c) await api(`/api/clients/${c.id}`, { method: 'PUT', body: v });
      else {
        const r = await api('/api/clients', { method: 'POST', body: v });
        toast('Cliente creado');
        return go(`#/clientes/${r.id}`);
      }
      toast('Cambios guardados');
      after?.();
    }
  });
}

/* ---------- Nuevo cobro ---------- */
VIEWS.cobro = async (main, { query }) => {
  const cat = await api('/api/catalog');
  const services = cat.services.filter((s) => s.active);
  const products = cat.products.filter((p) => p.active && p.kind === 'retail');
  const employees = cat.employees.filter((e) => e.active);
  const st = { tab: 'service', lines: [], method: 'tarjeta', client: null, newClient: null, employee: employees[0]?.id || '' };
  const pre = query.get('cliente');
  if (pre) {
    try { st.client = (await api(`/api/clients/${pre}`)).client; } catch { /* ignorar */ }
  }
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Para salones sin TPV conectado, o para cobros sueltos</div><h1>Nuevo cobro</h1></div>
    <div class="head-actions"><a class="btn" href="#/caja">Ver caja de hoy</a></div></header>
  ${employees.length && services.length ? '' : '<div class="notice info">Antes de cobrar, añade tu equipo en «Equipo y horas» y tus servicios en «Servicios y productos».</div>'}
  <div class="pos">
    <section class="card">
      <div class="card-head"><div class="seg" role="group" aria-label="Tipo"><button type="button" data-tab="service" aria-pressed="true">Servicios</button><button type="button" data-tab="product" aria-pressed="false">Productos</button></div>
        <input type="search" class="input" id="itemQ" placeholder="Buscar…" style="max-width:240px" aria-label="Buscar servicio o producto"></div>
      <div class="items" id="items"></div>
    </section>
    <section class="card" aria-label="Ticket">
      <h2>Ticket</h2>
      <label class="field">Atendido por<select id="emp">${employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
      <div class="field">Cliente
        <div id="clientBox"></div>
      </div>
      <div id="cart"></div>
      <div class="methods" role="group" aria-label="Método de pago">${['tarjeta', 'efectivo', 'bizum'].map((mth) => `<button type="button" data-method="${mth}" aria-pressed="${mth === 'tarjeta'}">${METHOD[mth]}</button>`).join('')}</div>
      <div class="form-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <label class="field">Fecha<input type="date" id="tDate" value="${S.me.today}" max="${S.me.today}"></label>
        <label class="field">Inicio<input type="time" id="tStart"></label>
        <label class="field">Fin<input type="time" id="tEnd" value="${hhmm}"></label>
      </div>
      <span class="muted" style="font-size:12px">La hora de inicio y fin permite medir el tiempo real por cliente.</span>
      <button type="button" class="btn primary" id="charge" style="min-height:52px;font-size:16px">Cobrar</button>
    </section>
  </div>`;

  const renderItems = () => {
    const q = ($('#itemQ').value || '').toLowerCase();
    const list = (st.tab === 'service' ? services : products).filter((i) => i.name.toLowerCase().includes(q));
    $('#items').innerHTML = list.length ? list.map((i) => `<button type="button" class="item" data-id="${i.id}"><b>${esc(i.name)}</b><small>${eur(i.price, 2)}${i.duration_min ? ` · ${i.duration_min} min` : ''}</small></button>`).join('') : '<div class="empty">Nada que mostrar.</div>';
    $$('#items [data-id]').forEach((b) => (b.onclick = () => {
      const item = list.find((i) => String(i.id) === b.dataset.id);
      const ex = st.lines.find((l) => l.kind === st.tab && l.item_id === item.id);
      if (ex) ex.qty++;
      else st.lines.push({ kind: st.tab, item_id: item.id, name: item.name, qty: 1, price: item.price, duration: item.duration_min || 0 });
      renderCart();
    }));
  };

  const renderCart = () => {
    const total = st.lines.reduce((s, l) => s + l.qty * l.price, 0);
    $('#cart').innerHTML = (st.lines.length ? st.lines.map((l, i) => `<div class="cart-line"><span>${esc(l.name)}</span>
        <input class="input" type="number" min="1" max="99" value="${l.qty}" data-qty="${i}" aria-label="Cantidad de ${esc(l.name)}">
        <input class="input" inputmode="decimal" value="${fmt(l.price, 2)}" data-price="${i}" aria-label="Precio de ${esc(l.name)}">
        <button type="button" class="icon-btn" data-del="${i}" aria-label="Quitar ${esc(l.name)}">${icon('trash', 16)}</button></div>`).join('')
      : '<div class="empty">Toca un servicio o producto para añadirlo.</div>')
      + `<div class="cart-total"><span>Total</span><span class="big num">${eur(total, 2)}</span></div>`;
    $$('[data-qty]').forEach((el) => (el.onchange = () => { st.lines[el.dataset.qty].qty = Math.max(1, Number(el.value) || 1); renderCart(); }));
    $$('[data-price]').forEach((el) => (el.onchange = () => { const v = parseNum(el.value); if (v >= 0) st.lines[el.dataset.price].price = v; renderCart(); }));
    $$('[data-del]').forEach((el) => (el.onclick = () => { st.lines.splice(Number(el.dataset.del), 1); renderCart(); }));
    const mins = st.lines.filter((l) => l.kind === 'service').reduce((s, l) => s + l.duration * l.qty, 0);
    if (mins && !$('#tStart').dataset.touched) {
      const [h, m] = $('#tEnd').value.split(':').map(Number);
      const start = h * 60 + m - mins;
      if (start > 0) $('#tStart').value = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    }
  };

  const renderClient = () => {
    const box = $('#clientBox');
    if (st.client) {
      box.innerHTML = `<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--soft);font-weight:400;color:var(--ink)"><span><b>${esc(st.client.name)}</b> <small class="muted">${esc(st.client.phone || '')}</small></span><button type="button" class="btn small ghost" id="clearClient">Cambiar</button></div>`;
      $('#clearClient').onclick = () => { st.client = null; renderClient(); };
      return;
    }
    if (st.newClient) {
      box.innerHTML = `<div class="form-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.8fr)">
        <input class="input" id="ncName" placeholder="Nombre" value="${esc(st.newClient.name)}" aria-label="Nombre del cliente nuevo">
        <input class="input" id="ncPhone" placeholder="Teléfono" type="tel" value="${esc(st.newClient.phone)}" aria-label="Teléfono">
        <select class="input" id="ncGender" aria-label="Género"><option value="M">Mujer</option><option value="H">Hombre</option><option value="U">—</option></select></div>
        <button type="button" class="btn small ghost" id="cancelNew" style="align-self:flex-start">Buscar cliente existente</button>`;
      $('#ncGender').value = st.newClient.gender;
      $('#ncName').oninput = (e) => (st.newClient.name = e.target.value);
      $('#ncPhone').oninput = (e) => (st.newClient.phone = e.target.value);
      $('#ncGender').onchange = (e) => (st.newClient.gender = e.target.value);
      $('#cancelNew').onclick = () => { st.newClient = null; renderClient(); };
      return;
    }
    box.innerHTML = `<div class="suggest"><input class="input" id="cSearch" placeholder="Buscar por nombre o teléfono (opcional)" autocomplete="off" aria-label="Buscar cliente"><div class="suggest-list hidden" id="cSuggest"></div></div>
      <button type="button" class="btn small ghost" id="newC" style="align-self:flex-start">+ Cliente nuevo</button>`;
    let t;
    $('#cSearch').oninput = (e) => {
      clearTimeout(t);
      const q = e.target.value.trim();
      const list = $('#cSuggest');
      if (q.length < 2) return list.classList.add('hidden');
      t = setTimeout(async () => {
        const r = await api(`/api/clients?q=${encodeURIComponent(q)}`);
        list.innerHTML = r.clients.slice(0, 8).map((c) => `<button type="button" data-cid="${c.id}">${esc(c.name)} <small class="muted">${esc(c.phone || '')}</small></button>`).join('') || '<div class="empty">Sin resultados</div>';
        list.classList.remove('hidden');
        $$('[data-cid]', list).forEach((b) => (b.onclick = () => { st.client = r.clients.find((c) => String(c.id) === b.dataset.cid); renderClient(); }));
      }, 200);
    };
    $('#newC').onclick = () => { st.newClient = { name: $('#cSearch').value, phone: '', gender: 'M' }; renderClient(); };
  };

  $$('[data-tab]', main).forEach((b) => (b.onclick = () => {
    st.tab = b.dataset.tab;
    $$('[data-tab]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderItems();
  }));
  $$('[data-method]', main).forEach((b) => (b.onclick = () => {
    st.method = b.dataset.method;
    $$('[data-method]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#itemQ').oninput = renderItems;
  $('#tStart').oninput = (e) => (e.target.dataset.touched = '1');
  $('#charge').onclick = async () => {
    if (!st.lines.length) return toast('Añade al menos un servicio o producto', true);
    const body = {
      employee_id: Number($('#emp').value) || null,
      method: st.method,
      date: $('#tDate').value,
      time_start: $('#tStart').value || null,
      time_end: $('#tEnd').value || null,
      lines: st.lines.map((l) => ({ kind: l.kind, item_id: l.item_id, qty: l.qty, price: l.price }))
    };
    if (st.client) body.client_id = st.client.id;
    else if (st.newClient?.name?.trim()) body.new_client = st.newClient;
    try {
      const r = await api('/api/tickets', { method: 'POST', body });
      toast(`Cobro registrado · ${eur(r.total, 2)}`);
      st.lines = [];
      st.client = null;
      st.newClient = null;
      $('#tStart').value = '';
      delete $('#tStart').dataset.touched;
      renderCart();
      renderClient();
    } catch (err) { toast(err.message, true); }
  };
  renderItems();
  renderCart();
  renderClient();
};

/* ---------- Caja ---------- */
VIEWS.caja = async (main) => {
  const d = await api(`/api/cash?date=${S.cashDate}`);
  const closed = !!d.closing;
  const rows = [
    ...d.tickets.map((t) => ({ time: t.time_end || t.time_start || '', concept: t.concept || 'Cobro', client: t.client || '—', emp: t.employee || '—', method: METHOD[t.method] || t.method, origin: t.source === 'manual' ? ['Manual', 'amber'] : t.source === 'csv' ? ['Importado', 'blue'] : ['TPV', 'plum'], amount: t.total, del: `t${t.id}` })),
    ...d.movements.map((m) => ({ time: '', concept: [m.category, m.note].filter(Boolean).join(' · ') || (m.direction === 'in' ? 'Ingreso' : 'Gasto'), client: '—', emp: '—', method: METHOD[m.method] || m.method, origin: m.source === 'banco' || m.source === 'api' ? ['Banco', 'blue'] : ['Manual', 'amber'], amount: m.direction === 'in' ? m.amount : -m.amount, del: `m${m.id}` }))
  ];
  const methodsTxt = Object.entries(d.byMethod).map(([k, v]) => `${METHOD[k] || k} ${eur(v)}`).join(' · ') || 'Sin cobros';
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">${fdate(d.date)} · ${closed ? 'caja cerrada' : 'caja abierta'}</div><h1>Caja</h1></div>
    <div class="head-actions">
      <input class="input" type="date" id="cashDate" value="${d.date}" max="${S.me.today}" aria-label="Día" style="width:170px">
      <button type="button" class="btn" id="addMove" ${closed ? 'disabled' : ''}>Añadir gasto o ingreso</button>
      <a class="btn primary" href="#/cobro">Nuevo cobro</a>
    </div></header>
  <section class="grid g3">
    <div class="kpi"><span class="k">Dinero entrante</span><span class="v up num">+${eur(d.inTotal, 2)}</span><span class="d">${esc(methodsTxt)}</span></div>
    <div class="kpi"><span class="k">Dinero saliente</span><span class="v down num">${d.outTotal ? '−' : ''}${eur(d.outTotal, 2)}</span><span class="d">${d.movements.filter((m) => m.direction === 'out').length} gastos</span></div>
    <div class="kpi dark"><span class="k">Resultado del día</span><span class="v num">${d.net >= 0 ? '+' : ''}${eur(d.net, 2)}</span><span class="d">${d.tickets.length} cobros</span></div>
  </section>
  <section class="grid g-cash">
    <div class="card">
      <h2>Arqueo de efectivo</h2>
      <div class="kv"><span>Fondo inicial</span><span>${eur(d.cash.opening, 2)}</span></div>
      <div class="kv"><span>+ Cobros en efectivo</span><span>${eur(d.cash.cashIn, 2)}</span></div>
      <div class="kv"><span>− Salidas en efectivo</span><span>${eur(d.cash.cashOut, 2)}</span></div>
      <div class="kv" style="border:none"><span><b>Efectivo esperado</b></span><span>${eur(d.cash.expected, 2)}</span></div>
      ${closed
        ? `<div class="notice ${d.closing.diff === 0 ? '' : 'warn'}">Cerrada: contado ${eur(d.closing.counted, 2)} · ${d.closing.diff === 0 ? 'cuadra' : `descuadre ${d.closing.diff > 0 ? '+' : ''}${eur(d.closing.diff, 2)}`}</div>`
        : `<label class="field">Efectivo contado<input class="input" id="counted" inputmode="decimal" placeholder="0,00"></label>
           <div class="notice" id="diffBox">Escribe lo que hay en caja para ver si cuadra.</div>
           <button type="button" class="btn dark" id="closeCash">Cerrar caja del día</button>`}
      ${d.recentClosings.length ? `<div style="margin-top:6px"><div class="block-title">Últimos cierres</div>${d.recentClosings.map((c) => `<div class="kv"><span>${fdate(c.date)}</span><span class="${c.diff === 0 ? 'up' : 'down'}">${c.diff === 0 ? 'Cuadra' : `${c.diff > 0 ? '+' : ''}${eur(c.diff, 2)}`}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card">
      <h2>Movimientos del día</h2>
      <div class="table-wrap"><table><thead><tr><th>Hora</th><th>Concepto</th><th>Cliente</th><th>Empleado</th><th>Método</th><th>Origen</th><th class="r">Importe</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr><td class="muted num">${esc(r.time)}</td><td style="min-width:200px">${esc(r.concept)}</td><td>${esc(r.client)}</td><td>${esc(r.emp)}</td><td>${esc(r.method)}</td><td><span class="tag ${r.origin[1]}">${r.origin[0]}</span></td>
        <td class="r num ${r.amount >= 0 ? 'up' : 'down'}"><b>${r.amount >= 0 ? '+' : ''}${eur(r.amount, 2)}</b></td>
        <td>${closed ? '' : `<button type="button" class="icon-btn" data-del="${r.del}" aria-label="Anular">${icon('trash', 16)}</button>`}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">Sin movimientos este día.</td></tr>'}</tbody></table></div>
    </div>
  </section>`;

  $('#cashDate').onchange = (e) => { if (e.target.value) { S.cashDate = e.target.value; render(); } };
  $('#addMove').onclick = () => openForm({
    title: 'Añadir gasto o ingreso',
    fields: [
      { name: 'direction', label: 'Tipo', type: 'select', value: 'out', options: [['out', 'Gasto (sale dinero)'], ['in', 'Ingreso extra (entra dinero)']] },
      { name: 'amount', label: 'Importe (€)', type: 'money', required: true },
      { name: 'method', label: 'Método', type: 'select', value: 'efectivo', options: [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia'], ['bizum', 'Bizum']] },
      { name: 'category', label: 'Categoría', type: 'select', value: 'Gastos menores', options: ['Gastos menores', 'Proveedor de producto', 'Alquiler', 'Suministros', 'Nóminas', 'Limpieza', 'Marketing', 'Otros'].map((x) => [x, x]) },
      { name: 'note', label: 'Nota', full: true }
    ],
    onSubmit: async (v) => { await api('/api/cash/movements', { method: 'POST', body: { ...v, date: d.date } }); toast('Movimiento guardado'); render(); }
  });
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
    const [kind, id] = [b.dataset.del[0], b.dataset.del.slice(1)];
    if (!confirmAction(kind === 't' ? '¿Anular este cobro?' : '¿Borrar este movimiento?')) return;
    try {
      await api(kind === 't' ? `/api/tickets/${id}` : `/api/cash/movements/${id}`, { method: 'DELETE', body: {} });
      toast('Anulado');
      render();
    } catch (err) { toast(err.message, true); }
  }));
  const counted = $('#counted');
  if (counted) {
    counted.oninput = () => {
      const v = parseNum(counted.value);
      const box = $('#diffBox');
      if (!counted.value || !Number.isFinite(v)) { box.className = 'notice'; box.textContent = 'Escribe lo que hay en caja para ver si cuadra.'; return; }
      const diff = Math.round((v - d.cash.expected) * 100) / 100;
      box.className = `notice ${diff === 0 ? '' : 'warn'}`;
      box.textContent = diff === 0 ? 'La caja cuadra' : `${diff < 0 ? 'Falta' : 'Sobra'} efectivo: ${diff > 0 ? '+' : ''}${eur(diff, 2)}`;
    };
    $('#closeCash').onclick = async () => {
      const v = parseNum(counted.value);
      if (!counted.value || !Number.isFinite(v)) return toast('Escribe el efectivo contado', true);
      if (!confirmAction('¿Cerrar la caja? Después no se podrán anular cobros de este día.')) return;
      try { await api('/api/cash/close', { method: 'POST', body: { date: d.date, counted: v } }); toast('Caja cerrada'); render(); }
      catch (err) { toast(err.message, true); }
    };
  }
};

/* ---------- Equipo y horas ---------- */
VIEWS.equipo = async (main, { query }) => {
  const month = query.get('mes') || S.me.today.slice(0, 7);
  const [cat, hours] = await Promise.all([api('/api/catalog'), api(`/api/hours?month=${month}`)]);
  const hmap = new Map(hours.rows.map((r) => [r.employee_id, r.hours]));
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">${cat.employees.filter((e) => e.active).length} personas activas</div><h1>Equipo y horas</h1></div>
    <div class="head-actions"><button type="button" class="btn primary" id="addEmp">Añadir empleado</button></div></header>
  <section class="grid g2">
    <div class="card"><h2>Equipo</h2>
      <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Puesto</th><th>Estado</th><th></th></tr></thead>
      <tbody>${cat.employees.map((e) => `<tr><td><div class="person"><span class="avatar">${esc(initials(e.name))}</span><b>${esc(e.name)}</b></div></td><td>${esc(e.role || '—')}</td><td><span class="tag ${e.active ? 'green' : ''}">${e.active ? 'Activo' : 'Baja'}</span></td><td class="r"><button type="button" class="btn small" data-edit="${e.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Añade a las personas de tu equipo.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card"><div class="card-head"><h2>Horas trabajadas</h2><input class="input" type="month" id="hMonth" value="${month}" max="${S.me.today.slice(0, 7)}" style="width:170px" aria-label="Mes"></div>
      <p class="muted" style="margin:0;font-size:14px">Total de horas del mes por persona (de tu fichaje o cuadrante). Si lo dejas vacío, se estiman ${fmt(hours.hoursPerEmployee)} h/mes (se cambia en Ajustes). También pueden llegar solas desde la API.</p>
      ${cat.employees.filter((e) => e.active).map((e) => `<label class="kv" style="align-items:center"><span>${esc(e.name)}</span><span style="display:flex;align-items:center;gap:8px"><input class="input" style="width:110px;text-align:right" inputmode="decimal" data-hours="${e.id}" value="${hmap.has(e.id) ? fmt(hmap.get(e.id), 1).replace(',0', '') : ''}" placeholder="${fmt(hours.hoursPerEmployee)}" aria-label="Horas de ${esc(e.name)}"> h</span></label>`).join('')}
      <div class="form-actions"><button type="button" class="btn dark" id="saveHours">Guardar horas</button></div>
    </div>
  </section>`;
  const empForm = (e = null) => openForm({
    title: e ? 'Editar empleado' : 'Añadir empleado',
    fields: [
      { name: 'name', label: 'Nombre', value: e?.name, required: true },
      { name: 'role', label: 'Puesto', value: e?.role, hint: 'Estilista, colorista, barbero…' },
      { name: 'active', label: 'Activo (sigue trabajando en el salón)', type: 'checkbox', value: e ? !!e.active : true }
    ],
    onSubmit: async (v) => {
      await api(e ? `/api/employees/${e.id}` : '/api/employees', { method: e ? 'PUT' : 'POST', body: v });
      toast('Guardado');
      render();
    }
  });
  $('#addEmp').onclick = () => empForm();
  $$('[data-edit]', main).forEach((b) => (b.onclick = () => empForm(cat.employees.find((e) => String(e.id) === b.dataset.edit))));
  $('#hMonth').onchange = (e) => go(`#/equipo?mes=${e.target.value}`);
  $('#saveHours').onclick = async () => {
    const entries = $$('[data-hours]', main).map((el) => ({ employee_id: Number(el.dataset.hours), hours: el.value === '' ? '' : parseNum(el.value) }));
    try { await api('/api/hours/month', { method: 'POST', body: { month, entries } }); toast('Horas guardadas'); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Servicios y productos ---------- */
VIEWS.catalogo = async (main) => {
  const cat = await api('/api/catalog');
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">${cat.services.filter((s) => s.active).length} servicios · ${cat.products.filter((p) => p.active).length} productos activos</div><h1>Servicios y productos</h1></div>
    <div class="head-actions"><button type="button" class="btn" id="addPrd">Añadir producto</button><button type="button" class="btn primary" id="addSrv">Añadir servicio</button></div></header>
  <section class="card"><h2>Menú de servicios</h2>
    <div class="table-wrap"><table><thead><tr><th>Servicio</th><th>Categoría</th><th>Para</th><th class="r">Precio</th><th class="r">Duración</th><th class="r">€/hora</th><th>Estado</th><th></th></tr></thead>
    <tbody>${cat.services.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.category || '—')}</td><td>${GENDER[s.gender]}</td><td class="r num">${eur(s.price, 2)}</td><td class="r num">${s.duration_min} min</td><td class="r num">${s.duration_min ? eur((s.price / s.duration_min) * 60, 2) : '—'}</td><td><span class="tag ${s.active ? 'green' : ''}">${s.active ? 'Activo' : 'Oculto'}</span></td><td class="r"><button type="button" class="btn small" data-srv="${s.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Añade tus servicios (o se crearán solos al importar la caja).</td></tr>'}</tbody></table></div>
    <span class="muted" style="font-size:13px">La duración se usa para calcular la ocupación de la agenda y el tiempo estimado por cliente.</span>
  </section>
  <section class="card"><h2>Productos</h2>
    <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Tipo</th><th class="r">PVP</th><th class="r">Coste</th><th class="r">Margen</th><th>Estado</th><th></th></tr></thead>
    <tbody>${cat.products.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${p.kind === 'tecnico' ? 'Técnico (uso en servicios)' : 'Retail (venta)'}</td><td class="r num">${p.kind === 'retail' ? eur(p.price, 2) : '—'}</td><td class="r num">${eur(p.cost, 2)}</td><td class="r num">${p.kind === 'retail' && p.price ? `${fmt(((p.price - p.cost) / p.price) * 100)} %` : '—'}</td><td><span class="tag ${p.active ? 'green' : ''}">${p.active ? 'Activo' : 'Oculto'}</span></td><td class="r"><button type="button" class="btn small" data-prd="${p.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin productos.</td></tr>'}</tbody></table></div>
  </section>`;
  const srvForm = (s = null) => openForm({
    title: s ? 'Editar servicio' : 'Añadir servicio',
    fields: [
      { name: 'name', label: 'Nombre', value: s?.name, required: true, full: true },
      { name: 'category', label: 'Categoría', value: s?.category, hint: 'Corte, Color, Tratamiento…' },
      { name: 'gender', label: 'Para', type: 'select', value: s?.gender || 'U', options: [['U', 'Todos'], ['M', 'Mujer'], ['H', 'Hombre']] },
      { name: 'price', label: 'Precio (€)', type: 'money', value: s ? fmt(s.price, 2) : '', required: true },
      { name: 'duration_min', label: 'Duración (min)', type: 'number', value: s?.duration_min ?? 30, required: true },
      { name: 'active', label: 'Activo', type: 'checkbox', value: s ? !!s.active : true }
    ],
    onSubmit: async (v) => { await api(s ? `/api/services/${s.id}` : '/api/services', { method: s ? 'PUT' : 'POST', body: v }); toast('Guardado'); render(); }
  });
  const prdForm = (p = null) => openForm({
    title: p ? 'Editar producto' : 'Añadir producto',
    fields: [
      { name: 'name', label: 'Nombre', value: p?.name, required: true, full: true },
      { name: 'kind', label: 'Tipo', type: 'select', value: p?.kind || 'retail', options: [['retail', 'Retail (se vende al cliente)'], ['tecnico', 'Técnico (se usa en servicios)']] },
      { name: 'price', label: 'PVP (€)', type: 'money', value: p ? fmt(p.price, 2) : '' },
      { name: 'cost', label: 'Coste (€)', type: 'money', value: p ? fmt(p.cost, 2) : '' },
      { name: 'active', label: 'Activo', type: 'checkbox', value: p ? !!p.active : true }
    ],
    onSubmit: async (v) => { await api(p ? `/api/products/${p.id}` : '/api/products', { method: p ? 'PUT' : 'POST', body: { ...v, price: v.price || 0, cost: v.cost || 0 } }); toast('Guardado'); render(); }
  });
  $('#addSrv').onclick = () => srvForm();
  $('#addPrd').onclick = () => prdForm();
  $$('[data-srv]', main).forEach((b) => (b.onclick = () => srvForm(cat.services.find((s) => String(s.id) === b.dataset.srv))));
  $$('[data-prd]', main).forEach((b) => (b.onclick = () => prdForm(cat.products.find((p) => String(p.id) === b.dataset.prd))));
};

/* ---------- Pedidos de producto ---------- */
VIEWS.pedidos = async (main) => {
  const d = await api('/api/orders');
  const s = d.signal;
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Compras de producto técnico y retail</div><h1>Pedidos de producto</h1></div>
    <div class="head-actions"><button type="button" class="btn primary" id="addOrder">Registrar pedido</button></div></header>
  ${s.level === 'Sin datos' ? `<div class="notice info">${esc(s.reason)}</div>` : `<div class="notice ${s.level === 'Alta' ? 'warn' : s.level === 'Media' ? 'info' : ''}">
    ${s.level === 'Alta' ? 'Toca pedir producto técnico' : s.level === 'Media' ? 'Pronto tocará pedir' : 'Stock técnico suficiente'} · stock estimado ${s.daysLeft} días · pedido sugerido ${eur(s.suggested)}. ${esc(s.reason)}</div>`}
  <section class="card"><h2>Historial</h2>
    <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Tipo</th><th>Notas</th><th class="r">Importe</th><th></th></tr></thead>
    <tbody>${d.orders.map((o) => `<tr><td>${fdate(o.date)}</td><td>${esc(o.supplier || '—')}</td><td><span class="tag ${o.kind === 'tecnico' ? 'plum' : o.kind === 'retail' ? 'amber' : ''}">${o.kind === 'tecnico' ? 'Técnico' : o.kind === 'retail' ? 'Retail' : 'Mixto'}</span></td><td class="muted">${esc(o.notes || '')}</td><td class="r num"><b>${eur(o.amount, 2)}</b></td><td class="r"><button type="button" class="icon-btn" data-del="${o.id}" aria-label="Borrar pedido">${icon('trash', 16)}</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin pedidos registrados.</td></tr>'}</tbody></table></div>
  </section>`;
  $('#addOrder').onclick = () => openForm({
    title: 'Registrar pedido',
    fields: [
      { name: 'date', label: 'Fecha', type: 'date', value: S.me.today, required: true },
      { name: 'supplier', label: 'Proveedor', value: 'Distribuidor' },
      { name: 'amount', label: 'Importe (€)', type: 'money', required: true },
      { name: 'kind', label: 'Tipo', type: 'select', value: 'tecnico', options: [['tecnico', 'Técnico (color, oxidantes…)'], ['retail', 'Retail (para vender)'], ['mixto', 'Mixto']] },
      { name: 'notes', label: 'Notas', full: true }
    ],
    onSubmit: async (v) => { await api('/api/orders', { method: 'POST', body: v }); toast('Pedido registrado'); render(); }
  });
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
    if (!confirmAction('¿Borrar este pedido?')) return;
    await api(`/api/orders/${b.dataset.del}`, { method: 'DELETE', body: {} }).then(() => render()).catch((e) => toast(e.message, true));
  }));
};

/* ---------- Conectar TPV / importar ---------- */
const CSV_TEMPLATE = `fecha;hora_inicio;hora_fin;ticket;cliente;telefono;genero;empleado;tipo;concepto;cantidad;importe;metodo_pago
26/09/2026;10:00;10:50;T-1001;Marta Gil;600111222;Mujer;Laura M.;servicio;Color raíz;1;45,00;tarjeta
26/09/2026;10:00;10:50;T-1001;Marta Gil;600111222;Mujer;Laura M.;producto;Mascarilla hidratante 250 ml;1;24,00;tarjeta
26/09/2026;11:15;11:40;T-1002;Jorge Santos;600333444;Hombre;Carlos R.;servicio;Corte hombre;1;18,00;efectivo
`;

VIEWS.importar = async (main) => {
  const settings = await api('/api/settings');
  const origin = location.origin;
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Que los datos entren solos: sin teclear dos veces</div><h1>Conectar TPV / importar</h1></div></header>
  <section class="grid g2">
    <div class="card">
      <h2>1 · Importar desde tu TPV o programa de caja</h2>
      <p class="muted" style="margin:0;font-size:14px">Casi todos los TPV y programas de peluquería exportan las ventas a Excel o CSV. Expórtalas (en Excel: «Guardar como → CSV») y súbelas aquí. Reconozco las columnas automáticamente; lo ya importado no se duplica.</p>
      <label class="field">Archivo CSV<input type="file" id="csvFile" accept=".csv,.txt,text/csv" class="input" style="padding:9px 12px"></label>
      <details><summary style="cursor:pointer;font-size:14px;font-weight:600">…o pega el contenido</summary><textarea id="csvText" class="input" style="min-height:140px;padding:10px;margin-top:8px;font-family:monospace;font-size:12px"></textarea></details>
      <div class="form-actions" style="justify-content:space-between"><a class="btn small ghost" id="tplLink" download="plantilla-salon-os.csv">Descargar plantilla</a><button type="button" class="btn dark" id="analyze">Revisar antes de importar</button></div>
      <div id="importResult"></div>
    </div>
    <div class="card">
      <h2>2 · Conexión automática (API)</h2>
      <p class="muted" style="margin:0;font-size:14px">Para que cada cobro llegue en tiempo real: tu TPV, un integrador o una automatización (Zapier, Make…) envía los tickets a esta dirección con la clave del salón.</p>
      <div class="kv"><span>Clave del salón</span><span><code class="key" id="apiKey">${settings.api_key ? esc(settings.api_key) : 'sin generar'}</code></span></div>
      <div class="form-actions"><button type="button" class="btn small" id="newKey">${settings.api_key ? 'Generar clave nueva' : 'Generar clave'}</button></div>
      <pre class="code">POST ${esc(origin)}/api/ingest/tickets
Authorization: Bearer &lt;clave del salón&gt;
Content-Type: application/json

{ "tickets": [{
    "ref": "T-1001",
    "date": "2026-09-26",
    "time_start": "10:00", "time_end": "10:50",
    "method": "tarjeta",
    "employee": "Laura M.",
    "client": { "name": "Marta Gil", "phone": "600111222", "gender": "M" },
    "lines": [
      { "type": "service", "name": "Color raíz", "price": 45 },
      { "type": "product", "name": "Mascarilla hidratante", "qty": 1, "price": 24 }
    ]
}] }</pre>
      <p class="muted" style="margin:0;font-size:13px">También: <code>/api/ingest/hours</code> (fichajes: <code>{"entries":[{"employee","date","hours"}]}</code>) y <code>/api/ingest/expenses</code> (gastos del banco: <code>{"expenses":[{"date","amount","category"}]}</code>). La referencia <code>ref</code> evita duplicados si se reenvía un ticket.</p>
    </div>
  </section>`;

  $('#tplLink').href = URL.createObjectURL(new Blob([`﻿${CSV_TEMPLATE}`], { type: 'text/csv' }));
  $('#newKey').onclick = async () => {
    if (settings.api_key && !confirmAction('La clave anterior dejará de funcionar. ¿Continuar?')) return;
    const r = await api('/api/settings/apikey', { method: 'POST', body: {} });
    $('#apiKey').textContent = r.api_key;
    settings.api_key = r.api_key;
    toast('Clave generada');
  };
  const readCsv = async () => {
    const f = $('#csvFile').files[0];
    if (f) {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf); // exportaciones de Excel en Windows
      return text;
    }
    return $('#csvText').value;
  };
  const show = (r) => {
    const box = $('#importResult');
    if (!r.ok) { box.innerHTML = `<div class="notice warn">${esc(r.error)}</div>${r.headers ? `<p class="muted" style="font-size:13px">Columnas encontradas: ${r.headers.map(esc).join(', ')}</p>` : ''}`; return; }
    const res = r.result;
    box.innerHTML = `
      <div class="notice ${r.dryRun ? 'info' : ''}">${r.dryRun ? 'Revisión' : 'Importado'}: ${fmt(res.created)} tickets nuevos (${eur(res.revenue, 2)}), ${fmt(res.skipped)} ya existían${res.errors.length ? `, ${res.errors.length} con errores` : ''}. ${fmt(res.clientsCreated)} clientes nuevos, ${fmt(res.employeesCreated)} empleados y ${fmt(res.itemsCreated)} servicios/productos nuevos.</div>
      <div class="block-title" style="margin-top:6px">Columnas reconocidas</div>
      <div class="chips">${Object.entries(r.mapping).map(([k, v]) => `<span class="tag">${esc(k)} ← ${esc(v)}</span>`).join('')}</div>
      ${r.warnings.length ? `<div class="muted" style="font-size:13px">${r.warnings.map(esc).join('<br>')}</div>` : ''}
      ${res.errors.length ? `<div class="down" style="font-size:13px">${res.errors.slice(0, 10).map((e) => `Ticket ${esc(e.ref ?? e.index + 1)}: ${esc(e.error)}`).join('<br>')}</div>` : ''}
      ${r.dryRun && res.created ? '<div class="form-actions"><button type="button" class="btn primary" id="doImport">Importar ahora</button></div>' : ''}`;
    const btn = $('#doImport');
    if (btn) btn.onclick = () => run(false);
  };
  const run = async (dryRun) => {
    const csv = await readCsv();
    if (!csv.trim()) return toast('Elige un archivo o pega el contenido', true);
    try { show(await api('/api/import/csv', { method: 'POST', body: { csv, dryRun } })); if (!dryRun) toast('Datos importados'); }
    catch (err) { toast(err.message, true); }
  };
  $('#analyze').onclick = () => run(true);
};

/* ---------- Ajustes ---------- */
VIEWS.ajustes = async (main) => {
  const s = await api('/api/settings');
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Datos del salón y de tu cuenta</div><h1>Ajustes</h1></div></header>
  <section class="grid g2">
    <form class="card" id="salonForm">
      <h2>Salón</h2>
      <div class="form-grid">
        <label class="field">Nombre<input name="name" value="${esc(s.name)}" required></label>
        <label class="field">Ciudad<input name="city" value="${esc(s.city || '')}"></label>
        <label class="field">Horas al mes por empleado<input name="hours_per_employee" inputmode="decimal" value="${fmt(s.hours_per_employee)}"><span class="hint">Se usan si no registras horas reales.</span></label>
        <label class="field">Objetivo de consumo de producto (%)<input name="product_target_pct" inputmode="decimal" value="${fmt(s.product_target_pct, 1)}"><span class="hint">Producto técnico sobre facturación de servicios.</span></label>
        <label class="field">Fondo de caja (€)<input name="opening_float" inputmode="decimal" value="${fmt(s.opening_float, 2)}"><span class="hint">Efectivo con el que abre la caja cada día.</span></label>
      </div>
      <div class="form-actions"><button class="btn primary" type="submit">Guardar</button></div>
    </form>
    <form class="card" id="pwForm">
      <h2>Contraseña</h2>
      <label class="field">Contraseña actual<input name="current" type="password" autocomplete="current-password" required></label>
      <label class="field">Nueva contraseña<input name="next" type="password" autocomplete="new-password" minlength="8" required><span class="hint">Mínimo 8 caracteres.</span></label>
      <div class="form-actions"><button class="btn" type="submit">Cambiar contraseña</button></div>
      <p class="muted" style="font-size:13px;margin:0">Plan: ${esc(s.plan)} · sesión de ${esc(S.me.user.email)}</p>
    </form>
  </section>`;
  $('#salonForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/settings', { method: 'PUT', body: { name: f.name.value, city: f.city.value, hours_per_employee: parseNum(f.hours_per_employee.value), product_target_pct: parseNum(f.product_target_pct.value), opening_float: parseNum(f.opening_float.value) } });
      toast('Ajustes guardados');
      S.me = null;
      render();
    } catch (err) { toast(err.message, true); }
  };
  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api('/api/password', { method: 'POST', body: { current: f.current.value, next: f.next.value }, salon: false }); toast('Contraseña cambiada'); f.reset(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Consola del distribuidor ---------- */
VIEWS.consola = async (main) => {
  if (!isAdmin()) return go('#/panel');
  const d = await api(`/api/admin/overview?ref=${S.consoleRef}`);
  const k = d.kpis;
  const netG = k.networkPrevRevenue ? ((k.networkRevenue - k.networkPrevRevenue) / k.networkPrevRevenue) * 100 : null;
  const signals = d.salons.filter((s) => s.active && (s.signal.level === 'Alta' || s.signal.level === 'Media')).sort((a, b) => a.signal.daysLeft - b.signal.daysLeft);
  const advice = [
    ...d.salons.filter((s) => s.risk).map((s) => ({ s, text: s.alerts.join(' '), tone: 'risk' })),
    ...d.salons.filter((s) => !s.risk && s.opportunity).map((s) => ({ s, text: s.opportunity, tone: 'opp' }))
  ];
  const f = S.consoleFilter;
  const rows = d.salons.filter((s) => f === 'todos' || (f === 'alta' && s.signal.level === 'Alta') || (f === 'media' && s.signal.level === 'Media') || (f === 'riesgo' && s.risk));
  const b = d.benchmark;

  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">${esc(d.label)} · datos sincronizados de ${k.activeSalons} salones</div><h1>Tu red de salones</h1></div>
    <div class="head-actions"><input class="input" type="month" id="cRef" value="${S.consoleRef}" max="${S.me.today.slice(0, 7)}" style="width:170px" aria-label="Mes"><button type="button" class="btn dark" id="addSalon">Dar de alta un salón</button></div></header>
  <section class="grid g5">
    <div class="kpi small"><span class="k">Salones activos</span><span class="v">${k.activeSalons}</span><span class="d">${k.newSalons90d ? `+${k.newSalons90d} en 90 días` : 'sin altas recientes'}</span></div>
    <div class="kpi small"><span class="k">Ingresos SaaS (MRR)</span><span class="v">${eur(k.mrr)}</span><span class="d">${eur(k.mrr * 12)} al año</span></div>
    <div class="kpi small"><span class="k">Facturación de la red</span><span class="v">${eur(k.networkRevenue)}</span><span class="d ${toneOf(netG)}">${pct(netG)} vs mes anterior</span></div>
    <div class="kpi small"><span class="k">Producto vendido a salones</span><span class="v">${eur(k.productSold)}</span><span class="d">${k.orders} pedidos este mes</span></div>
    <div class="kpi small"><span class="k">Salones en riesgo</span><span class="v ${k.atRisk ? 'down' : ''}">${k.atRisk}</span><span class="d">necesitan asesoría</span></div>
  </section>
  <section class="grid g-2-1">
    <div class="card"><div class="card-head"><h2>Señales de compra · abastecer pronto</h2><span class="muted">Según su ciclo de pedidos y su actividad en caja</span></div>
      ${signals.length ? `<div class="grid g3">${signals.slice(0, 6).map((s) => `<div class="signal">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(s.name)}</b><span class="tag ${SIGNAL_TAG[s.signal.level]}">${s.signal.level}</span></div>
        <div style="display:flex;align-items:baseline;gap:6px"><span class="days">${s.signal.daysLeft}</span><span class="muted" style="font-size:13px">días de stock técnico${s.signal.overdue ? ' (pedido atrasado)' : ''}</span></div>
        <span class="muted" style="font-size:13px;line-height:1.45">${esc(s.signal.reason)}</span>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line-2);padding-top:10px;gap:8px"><span class="muted" style="font-size:13px">Pedido sugerido <b style="color:var(--ink);font-size:15px">${eur(s.signal.suggested)}</b></span><button type="button" class="btn small primary" data-view="${s.id}">Ver salón</button></div>
      </div>`).join('')}</div>` : '<div class="empty">Ningún salón necesita producto en los próximos 14 días.</div>'}
    </div>
    <div class="card dark"><h2>Asesorías a priorizar</h2>
      ${advice.length ? advice.slice(0, 6).map((a) => `<div class="advice"><b>${esc(a.s.name)}${a.s.city ? ` · ${esc(a.s.city)}` : ''} <span class="tag ${a.tone === 'risk' ? 'red' : 'green'}" style="margin-left:6px">${a.tone === 'risk' ? 'Riesgo' : 'Oportunidad'}</span></b><p>${esc(a.text)}</p></div>`).join('') : '<p style="color:#C7D0CB">Toda la red va bien este mes.</p>'}
    </div>
  </section>
  <section class="bench" aria-label="Media de la red"><b>Media de la red</b>
    <span>Ticket medio ${eur(b.avgTicket, 2)}</span><span>Ocupación ${b.occupancy == null ? '—' : `${fmt(b.occupancy * 100)} %`}</span><span>Consumo de producto ${b.consumptionPct == null ? '—' : `${fmt(b.consumptionPct, 1)} %`}</span><span>Retail ${b.retailShare == null ? '—' : `${fmt(b.retailShare)} %`} de la facturación</span><span>Precio hora ${b.hourlyRate == null ? '—' : `${fmt(b.hourlyRate, 2)} €/h`}</span>
  </section>
  <section class="card"><div class="card-head"><h2>Salones clientes</h2>
    <div class="seg" role="group" aria-label="Filtro">${[['todos', 'Todos'], ['alta', 'Señal alta'], ['media', 'Señal media'], ['riesgo', 'En riesgo']].map(([key, l]) => `<button type="button" data-cf="${key}" aria-pressed="${f === key}">${l}</button>`).join('')}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Salón</th><th>Plan</th><th class="r">Facturación</th><th class="r">Crec. mes</th><th class="r">Ticket</th><th class="r">Ocupación</th><th class="r">Consumo 90 d</th><th class="r">Stock</th><th>Señal</th><th></th></tr></thead>
    <tbody>${rows.map((s) => `<tr>
      <td><b>${esc(s.name)}</b>${s.risk ? ' <span class="tag red">En riesgo</span>' : ''}${s.active ? '' : ' <span class="tag">Inactivo</span>'}<br><small class="muted">${esc(s.city || '')}${s.signal.lastOrder ? ` · último pedido ${fdateShort(s.signal.lastOrder)}` : ''}${s.owner ? ` · ${esc(s.owner.email)}` : ''}</small></td>
      <td style="white-space:nowrap">${esc(s.plan)} <small class="muted">${eur(s.monthlyFee)}</small></td>
      <td class="r num">${eur(s.revenue)}</td><td class="r num ${toneOf(s.growth)}"><b>${pct(s.growth)}</b></td><td class="r num">${eur(s.avgTicket, 2)}</td>
      <td class="r num">${s.occupancy == null ? '—' : `${fmt(s.occupancy * 100)} %`}</td><td class="r num">${s.consumptionPct == null ? '—' : `${fmt(s.consumptionPct, 1)} %`}</td>
      <td class="r num">${s.signal.daysLeft == null ? '—' : `${s.signal.daysLeft} d`}</td><td><span class="tag ${SIGNAL_TAG[s.signal.level]}">${s.signal.level}</span></td>
      <td class="r" style="white-space:nowrap"><button type="button" class="btn small" data-edit="${s.id}">Plan</button> <button type="button" class="btn small primary" data-view="${s.id}">Ver panel</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">Ningún salón con este filtro.</td></tr>'}</tbody></table></div>
  </section>`;

  $('#cRef').onchange = (e) => { if (e.target.value) { S.consoleRef = e.target.value; render(); } };
  $$('[data-cf]', main).forEach((btn) => (btn.onclick = () => { S.consoleFilter = btn.dataset.cf; render(); }));
  $$('[data-view]', main).forEach((btn) => (btn.onclick = () => { S.salonId = Number(btn.dataset.view); sessionStorage.setItem('salonId', S.salonId); go('#/panel'); }));
  $$('[data-edit]', main).forEach((btn) => (btn.onclick = () => {
    const s = d.salons.find((x) => String(x.id) === btn.dataset.edit);
    openForm({
      title: `Plan de ${s.name}`,
      fields: [
        { name: 'plan', label: 'Plan', value: s.plan },
        { name: 'monthly_fee', label: 'Cuota mensual (€)', type: 'money', value: fmt(s.monthlyFee, 2) },
        { name: 'active', label: 'Suscripción activa', type: 'checkbox', value: s.active }
      ],
      onSubmit: async (v) => { await api(`/api/admin/salons/${s.id}`, { method: 'PUT', body: v }); toast('Guardado'); render(); }
    });
  }));
  $('#addSalon').onclick = () => openForm({
    title: 'Dar de alta un salón',
    intro: 'Se crea el salón y el acceso del dueño. Envíale su email y contraseña: podrá cambiarla en Ajustes.',
    fields: [
      { name: 'name', label: 'Nombre del salón', required: true },
      { name: 'city', label: 'Ciudad' },
      { name: 'plan', label: 'Plan', value: 'Base' },
      { name: 'monthly_fee', label: 'Cuota mensual (€)', type: 'money', value: '49' },
      { name: 'owner_name', label: 'Nombre del dueño' },
      { name: 'owner_email', label: 'Email del dueño', type: 'email', required: true, autocomplete: 'off' },
      { name: 'owner_password', label: 'Contraseña inicial', type: 'text', required: true, hint: 'Mínimo 8 caracteres', autocomplete: 'off' }
    ],
    submit: 'Crear salón',
    onSubmit: async (v) => {
      const r = await api('/api/admin/salons', { method: 'POST', body: v });
      S.me = null;
      toast('Salón creado');
      S.salonId = r.id;
      render();
    }
  });
};

render();
