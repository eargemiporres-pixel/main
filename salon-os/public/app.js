/* SalonPro · interfaz (sin frameworks). Rutas por hash: #/panel, #/clientes… */

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
  migrar: 'M4 4h7l2 3h7v13H4zM12 10v7M9 14l3 3 3-3',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  consola: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  mensajes: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  tiempos: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  agenda: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  reporte: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
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
const isStaff = () => S.me?.user.role === 'staff';
// Secciones que ve el equipo (rol «Equipo»): el día a día, sin números del negocio.
const STAFF_PAGES = ['agenda', 'cobro', 'caja', 'clientes', 'mensajes'];
const PUBLIC_PAGES = ['registro', 'recuperar', 'restablecer'];

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

/* Confirmación dentro de la página (no depende de window.confirm, que algunos
   navegadores o marcos incrustados bloquean). Devuelve una promesa. */
function confirmAction(message, ok = 'Confirmar') {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><h2 style="font-size:22px">${esc(message)}</h2>
      <div class="form-actions"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primary">${esc(ok)}</button></div></form>`;
    document.body.appendChild(dlg);
    let answer = false;
    $('[data-no]', dlg).onclick = () => dlg.close();
    $('form', dlg).addEventListener('submit', (e) => { e.preventDefault(); answer = true; dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
    dlg.showModal();
  });
}

/* Almacenamiento del navegador tolerante a fallos (modo privado, bloqueos). */
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  clear() { try { sessionStorage.clear(); } catch { /* sin almacenamiento */ } }
};

/* ---------- Router ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { page: parts[0] || '', id: parts[1] || null, query: new URLSearchParams(qs || '') };
}
const go = (hash) => { location.hash = hash; };

const SALON_NAV = [
  ['panel', 'Panel'], ['agenda', 'Agenda'], ['cobro', 'Nuevo cobro'], ['caja', 'Caja'], ['clientes', 'Clientes'], ['mensajes', 'Mensajes'],
  ['equipo', 'Equipo y horas'], ['catalogo', 'Servicios y productos'], ['tiempos', 'Tiempos y rentabilidad'], ['pedidos', 'Pedidos de producto'],
  ['migrar', 'Traer mis datos'], ['importar', 'Conectar TPV'], ['ajustes', 'Ajustes']
];
const VIEWS = {};

async function render() {
  const app = $('#app');
  if (!S.me) {
    try { S.me = await fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)); } catch { S.me = null; }
  }
  const hash = parseHash();
  if (hash.page === 'restablecer') return renderAuth(app, 'restablecer', hash.query);
  if (!S.me) return renderAuth(app, PUBLIC_PAGES.includes(hash.page) ? hash.page : 'entrar', hash.query);
  if (!S.config) S.config = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  if (!S.ref) {
    // Los primeros días de un mes casi no tienen datos: se abre el mes anterior.
    const [y, m, d] = S.me.today.split('-').map(Number);
    S.ref = d <= 5 ? (m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`) : S.me.today.slice(0, 7);
  }
  if (!S.consoleRef) S.consoleRef = S.ref;
  if (!S.cashDate) S.cashDate = S.me.today;

  let { page, id, query } = parseHash();
  if (isAdmin()) {
    if (!S.salonId) S.salonId = Number(store.get('salonId')) || null;
    if (!page) page = 'consola';
    if (page !== 'consola' && !S.salonId) {
      S.salonId = S.me.salons[0]?.id || null;
      if (!S.salonId) page = 'consola';
    }
  } else if (!page || page === 'consola' || PUBLIC_PAGES.includes(page)) page = isStaff() ? 'agenda' : 'panel';
  if (!VIEWS[page]) page = isAdmin() ? 'consola' : isStaff() ? 'agenda' : 'panel';
  if (isStaff() && !STAFF_PAGES.includes(page)) page = 'agenda';
  const nav = isStaff() ? SALON_NAV.filter(([p]) => STAFF_PAGES.includes(p)) : SALON_NAV;

  document.body.classList.toggle('console', page === 'consola');
  const salonName = isAdmin() ? S.me.salons.find((s) => s.id === S.salonId)?.name : S.me.salon?.name;
  app.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><b>SalonPro</b><span>${esc(isAdmin() ? 'Consola del distribuidor' : salonName || '')}${isStaff() ? ` · ${esc(S.me.user.name || S.me.user.email)}` : ''}</span></div>
      ${isAdmin() ? `<nav class="nav" aria-label="Distribuidor">
          <a href="#/consola" ${page === 'consola' ? 'aria-current="page"' : ''}>${icon('consola')}Red de salones</a>
        </nav>
        <div class="nav-label">Ver salón</div>
        <select id="salonPick" aria-label="Salón">${S.me.salons.map((s) => `<option value="${s.id}" ${s.id === S.salonId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <nav class="nav" aria-label="Reporte"><a href="#/reporte" ${page === 'reporte' ? 'aria-current="page"' : ''}>${icon('reporte')}Reporte del salón</a></nav>` : ''}
      <nav class="nav" aria-label="Salón">
        ${nav.map(([p, label]) => `<a href="#/${p}" ${page === p ? 'aria-current="page"' : ''}>${icon(p)}${label}${p === 'mensajes' ? '<span class="nav-badge hidden" id="unreadBadge"></span>' : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div class="side-card"><strong><span class="dot"></span> Datos al día</strong>Cada cobro actualiza métricas, clientes y caja al momento.</div>
        ${isStaff() ? '<button type="button" class="link-btn" id="myPassword">Cambiar mi contraseña</button>' : ''}
        <button type="button" class="link-btn" id="logout">Cerrar sesión</button>
      </div>
    </aside>
    <div class="main-col">${trialBar()}<main class="main" id="main"><div class="loading">Cargando…</div></main></div>
  </div>`;
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST', body: {} }).catch(() => {}); S.me = null; store.clear(); go('#/'); render(); };
  const myPw = $('#myPassword');
  if (myPw) myPw.onclick = () => openForm({
    title: 'Cambiar mi contraseña',
    fields: [
      { name: 'current', label: 'Contraseña actual', type: 'password', required: true, autocomplete: 'current-password' },
      { name: 'next', label: 'Nueva contraseña', type: 'password', required: true, hint: 'Mínimo 8 caracteres.', autocomplete: 'new-password' }
    ],
    onSubmit: async (v) => { await api('/api/password', { method: 'POST', body: v, salon: false }); toast('Contraseña cambiada'); }
  });
  const pick = $('#salonPick');
  if (pick) pick.onchange = () => {
    S.salonId = Number(pick.value);
    store.set('salonId', S.salonId);
    if (page === 'consola') go('#/panel'); else render();
  };
  const main = $('#main');
  refreshUnread();
  try {
    await VIEWS[page](main, { id, query });
  } catch (err) {
    main.innerHTML = `<div class="notice warn">${esc(err.message)}</div>`;
  }
  main.focus?.();
}

window.addEventListener('hashchange', () => render());

/* Número de mensajes sin leer en el menú lateral. */
async function refreshUnread() {
  if (isAdmin() && !S.salonId) return;
  try {
    const r = await api('/api/messages/summary');
    const b = $('#unreadBadge');
    if (!b) return;
    b.textContent = r.unread > 99 ? '99+' : String(r.unread);
    b.classList.toggle('hidden', !r.unread);
    b.setAttribute('aria-label', `${r.unread} sin leer`);
  } catch { /* sin conexión */ }
}

/* Aviso de la prueba gratuita: días que quedan o prueba terminada. */
function trialBar() {
  const t = S.me?.trial;
  if (!t || isAdmin()) return '';
  const sup = S.me.support || {};
  const contact = sup.phone
    ? `https://wa.me/${sup.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero elegir un plan de SalonPro para ${S.me.salon?.name || 'mi salón'}.`)}`
    : sup.email ? `mailto:${sup.email}?subject=${encodeURIComponent('Plan de SalonPro')}` : '';
  const cta = contact && !isStaff() ? `<a class="btn small ${t.expired ? 'primary' : ''}" href="${esc(contact)}" target="_blank" rel="noopener">Elegir plan</a>` : '';
  if (t.expired) {
    return `<div class="trial-bar expired" role="status"><span><b>Tu prueba gratuita ha terminado.</b> Puedes consultar todo, pero para seguir cobrando y apuntando citas ${isStaff() ? 'el salón tiene que elegir un plan' : 'elige un plan'}. Tus datos siguen guardados.</span>${cta}</div>`;
  }
  const days = t.days_left === 0 ? 'Hoy es el último día' : t.days_left === 1 ? 'Te queda 1 día' : `Te quedan ${t.days_left} días`;
  return `<div class="trial-bar" role="status"><span><b>Prueba gratuita.</b> ${days} (hasta el ${fdate(t.ends)}).</span>${cta}</div>`;
}

/* ---------- Entrar, crear cuenta y recuperar la contraseña ---------- */
function renderAuth(app, mode, query) {
  document.body.classList.remove('console');
  const art = `<section class="login-art">
      <b>SalonPro</b>
      <div style="display:flex;flex-direction:column;gap:16px">
        <h1>${mode === 'registro' ? 'Empieza hoy. Tus números claros desde la primera semana.' : 'Los números de tu salón, al día y sin teclear dos veces.'}</h1>
        <p>${mode === 'registro' ? 'Agenda, caja, clientas, WhatsApp y rentabilidad por servicio. Trae tus datos de tu programa actual en unos minutos.' : 'Facturación, clientes, equipo, caja y producto en un solo panel. Conectado a tu TPV.'}</p>
      </div>
      <span style="font-size:13px;color:#B8AEA4">Agenda · caja · clientas · métricas</span>
    </section>`;
  const forms = {
    entrar: `<form id="authForm" data-mode="entrar">
        <h2>Entrar</h2>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required></label>
        <label class="field">Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="down hidden" id="authErr" role="alert" style="margin:0;font-weight:600"></p>
        <button class="btn primary" type="submit">Entrar</button>
        <div class="auth-links"><a href="#/recuperar">¿Has olvidado la contraseña?</a><a href="#/registro" id="signupLink" class="hidden"><b>Crear cuenta gratis</b></a></div>
        <a href="/" id="landingLink" class="muted hidden" style="font-size:14px">¿Aún no tienes cuenta? Solicita una prueba gratis</a>
        <div class="demo-box hidden" id="demoBox">
          <b style="color:var(--ink)">Demo con datos de ejemplo</b><br>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
            <button type="button" class="btn small" data-demo="norte@demo.com">Entrar como salón</button>
            <button type="button" class="btn small" data-demo="equipo@demo.com">Como equipo</button>
            <button type="button" class="btn small" data-demo="admin@demo.com">Como distribuidor</button>
          </div>
          Salón: <code>norte@demo.com</code> · Equipo: <code>equipo@demo.com</code> · Distribuidor: <code>admin@demo.com</code> · Contraseña: <code>demo1234</code>
        </div>
      </form>`,
    registro: `<form id="authForm" data-mode="registro">
        <h2>Crea tu cuenta</h2>
        <p class="muted" style="margin:0" id="trialNote">Prueba gratis, sin tarjeta.</p>
        <label class="field">Nombre del salón<input name="salon_name" autocomplete="organization" required></label>
        <div class="form-grid">
          <label class="field">Tu nombre<input name="name" autocomplete="name" required></label>
          <label class="field">Ciudad<input name="city" autocomplete="address-level2"></label>
        </div>
        <label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
        <label class="field">Teléfono (opcional)<input name="phone" type="tel" autocomplete="tel"></label>
        <label class="field">Contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" required><span class="hint">Mínimo 8 caracteres.</span></label>
        <label class="hp" aria-hidden="true">No rellenar<input name="website" tabindex="-1" autocomplete="off"></label>
        <label class="check"><input type="checkbox" name="accept" required> <span id="acceptText">Acepto las condiciones del servicio y la política de privacidad.</span></label>
        <p class="down hidden" id="authErr" role="alert" style="margin:0;font-weight:600"></p>
        <button class="btn primary" type="submit">Crear cuenta y empezar</button>
        <div class="auth-links"><span class="muted">¿Ya tienes cuenta?</span><a href="#/entrar">Entrar</a></div>
      </form>`,
    recuperar: `<form id="authForm" data-mode="recuperar">
        <h2>Recuperar la contraseña</h2>
        <p class="muted" style="margin:0">Escribe el email con el que entras y te enviaremos un enlace para elegir una contraseña nueva.</p>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required></label>
        <p class="down hidden" id="authErr" role="alert" style="margin:0;font-weight:600"></p>
        <div class="notice hidden" id="authOk"></div>
        <button class="btn primary" type="submit">Enviar enlace</button>
        <div class="auth-links"><a href="#/entrar">Volver a entrar</a></div>
      </form>`,
    restablecer: `<form id="authForm" data-mode="restablecer">
        <h2>Elige una contraseña nueva</h2>
        <label class="field">Contraseña nueva<input name="password" type="password" autocomplete="new-password" minlength="8" required><span class="hint">Mínimo 8 caracteres.</span></label>
        <label class="field">Repite la contraseña<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="down hidden" id="authErr" role="alert" style="margin:0;font-weight:600"></p>
        <button class="btn primary" type="submit">Guardar y entrar</button>
        <div class="auth-links"><a href="#/recuperar">Pedir otro enlace</a></div>
      </form>`
  };
  app.innerHTML = `<div class="login">${art}<section class="login-form">${forms[mode] || forms.entrar}</section></div>`;
  const form = $('#authForm');
  const showErr = (msg) => { const p = $('#authErr'); p.textContent = msg; p.classList.remove('hidden'); };
  fetch('/api/config').then((r) => r.json()).then((c) => {
    if (mode === 'entrar') {
      if (c.signup) $('#signupLink').classList.remove('hidden');
      else if (c.landing) $('#landingLink').classList.remove('hidden');
      if (c.demo) {
        $('#demoBox').classList.remove('hidden');
        $$('[data-demo]').forEach((b) => (b.onclick = () => {
          form.email.value = b.dataset.demo;
          form.password.value = 'demo1234';
          form.requestSubmit();
        }));
      }
    }
    if (mode === 'registro') {
      if (!c.signup) {
        form.innerHTML = `<h2>Crea tu cuenta</h2><p class="muted" style="margin:0">Ahora mismo las cuentas nuevas se abren con nosotros. Déjanos tus datos y te damos acceso en 24 horas.</p><a class="btn primary" href="/#prueba">Pedir mi prueba gratis</a><div class="auth-links"><a href="#/entrar">Entrar</a></div>`;
        return;
      }
      $('#trialNote').textContent = `${c.trial_days} días gratis, sin tarjeta. Al terminar eliges si sigues.`;
      const link = (url, label) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : label);
      $('#acceptText').innerHTML = `Acepto las ${link(c.terms_url, 'condiciones del servicio')} y la ${link(c.privacy_url, 'política de privacidad')}.`;
    }
  }).catch(() => {});
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      if (mode === 'entrar') {
        await api('/api/login', { method: 'POST', body: { email: form.email.value, password: form.password.value }, salon: false });
      } else if (mode === 'registro') {
        if (!form.accept.checked) throw new Error('Para crear la cuenta tienes que aceptar las condiciones.');
        await api('/api/signup', { method: 'POST', salon: false, body: {
          salon_name: form.salon_name.value, name: form.name.value, city: form.city.value, email: form.email.value,
          phone: form.phone.value, password: form.password.value, website: form.website.value, accept: true
        } });
        store.set('welcome', '1');
      } else if (mode === 'recuperar') {
        const r = await api('/api/password/forgot', { method: 'POST', body: { email: form.email.value }, salon: false });
        const ok = $('#authOk');
        ok.textContent = r.message;
        ok.className = `notice ${r.mail ? '' : 'info'}`;
        $('#authErr').classList.add('hidden');
        return;
      } else {
        if (form.password.value !== form.password2.value) throw new Error('Las dos contraseñas no coinciden.');
        await api('/api/password/reset', { method: 'POST', body: { token: query.get('codigo') || '', password: form.password.value }, salon: false });
        toast('Contraseña cambiada');
      }
      S.me = null;
      go('#/');
      render();
    } catch (err) {
      showErr(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Panel del salón ---------- */
VIEWS.panel = async (main) => {
  const [d, onboarding] = await Promise.all([api(`/api/dashboard?period=${S.period}&ref=${S.ref}`), api('/api/onboarding').catch(() => null)]);
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

  ${onboardingCard(onboarding)}
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
  const starter = $('[data-starter]', main);
  if (starter) starter.onclick = async () => {
    const r = await api('/api/onboarding/starter-catalog', { method: 'POST', body: {} });
    toast(r.skipped ? 'Ya tienes servicios cargados' : `Cargados ${r.services} servicios y ${r.products} productos: ajusta precios en «Servicios y productos»`);
    render();
  };
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
    box.innerHTML = `
      <div class="card" style="flex-direction:row;align-items:center;gap:18px;flex-wrap:wrap">
        <span class="avatar lg">${esc(initials(c.name))}</span>
        <div style="flex-grow:1;display:flex;flex-direction:column;gap:4px;min-width:200px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="font-family:var(--display);font-size:28px;font-weight:500">${esc(c.name)}</h2><span class="tag ${STATE_TAG[d.state] || ''}">${esc(d.state)}</span></div>
          <div class="muted" style="font-size:14px">${GENDER[c.gender]} · Cliente desde ${fdate(s.firstVisit || c.created_at)}</div>
          <div class="muted" style="font-size:14px">${esc(c.phone || 'Sin teléfono')}${c.email ? ` · ${esc(c.email)}` : ''}</div>
        </div>
        <div class="head-actions">
          <button type="button" class="btn" id="writeClient">Escribir</button>
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
      <div class="card">
        <div class="card-head"><h2>Citas</h2><button type="button" class="btn small primary" id="clientAppt">Nueva cita</button></div>
        ${d.appointments.length ? d.appointments.map((a) => `<div class="kv"><span>${dayLabel(a.date)} · ${a.start} <small>${esc(a.services.map((x) => x.name).join(' + '))}${a.employee_name ? ` · ${esc(a.employee_name)}` : ''}</small></span><span class="tag ${APPT_STATUS[a.status][1]}">${APPT_STATUS[a.status][0]}</span></div>`).join('') : '<div class="muted" style="font-size:14px">No tiene citas próximas.</div>'}
      </div>
      <div class="card" id="insightsCard">
        <div class="card-head"><h2>Lo que sabemos por sus mensajes</h2>
          <div class="head-actions">
            ${d.conversations.length ? `<a class="btn small" href="#/mensajes/${d.conversations[0].id}">Ver conversación${d.conversations[0].unread ? ` · ${d.conversations[0].unread} sin leer` : ''}</a>` : ''}
            ${S.config?.ai && d.conversations.length ? '<button type="button" class="btn small" id="aiInsights">Analizar con IA</button>' : ''}
          </div></div>
        ${insightsBlock(d.insights)}
      </div>
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
    $('#writeClient').onclick = () => newMessageDialog(c);
    $('#clientAppt').onclick = () => appointmentForm({ date: S.me.today, client: c });
    const aiBtn = $('#aiInsights');
    if (aiBtn) aiBtn.onclick = async () => {
      aiBtn.disabled = true;
      aiBtn.textContent = 'Analizando…';
      try { await api(`/api/clients/${cid}/insights/ai`, { method: 'POST', body: {} }); toast('Ficha actualizada con IA'); loadDetail(cid); }
      catch (err) { toast(err.message, true); aiBtn.disabled = false; aiBtn.textContent = 'Analizar con IA'; }
    };
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
  // Cobrar una cita de la agenda: servicios, clienta y profesional ya puestos.
  const citaId = query.get('cita');
  if (citaId) {
    try {
      const a = await api(`/api/appointments/${citaId}`);
      st.appointment = a;
      st.lines = a.services.filter((x) => x.service_id).map((x) => ({ kind: 'service', item_id: x.service_id, name: x.name, qty: 1, price: x.price, duration: x.duration_min }));
      if (a.client_id) st.client = { id: a.client_id, name: a.client_name, phone: a.client_phone };
      st.employee = a.employee_id || st.employee;
    } catch { /* ignorar */ }
  }
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Para salones sin TPV conectado, o para cobros sueltos</div><h1>Nuevo cobro</h1></div>
    <div class="head-actions"><a class="btn" href="#/caja">Ver caja de hoy</a></div></header>
  ${employees.length && services.length ? '' : '<div class="notice info">Antes de cobrar, añade tu equipo en «Equipo y horas» y tus servicios en «Servicios y productos».</div>'}
  <section class="card running hidden" id="running" aria-label="Servicios en curso"></section>
  <div class="pos">
    <section class="card">
      <div class="card-head"><div class="seg" role="group" aria-label="Tipo"><button type="button" data-tab="service" aria-pressed="true">Servicios</button><button type="button" data-tab="product" aria-pressed="false">Productos</button></div>
        <input type="search" class="input" id="itemQ" placeholder="Buscar…" style="max-width:240px" aria-label="Buscar servicio o producto"></div>
      <div class="items" id="items"></div>
    </section>
    <section class="card" aria-label="Ticket">
      <h2>Ticket</h2>
      ${st.appointment ? `<div class="notice">Cobrando la cita de las ${esc(st.appointment.start)}</div>` : ''}
      <label class="field">Atendido por<select id="emp">${employees.map((e) => `<option value="${e.id}" ${String(e.id) === String(st.employee) ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <div class="field">Cliente
        <div id="clientBox"></div>
      </div>
      <div id="cart"></div>
      <div class="methods" role="group" aria-label="Método de pago">${['tarjeta', 'efectivo', 'bizum'].map((mth) => `<button type="button" data-method="${mth}" aria-pressed="${mth === 'tarjeta'}">${METHOD[mth]}</button>`).join('')}</div>
      <div id="timerNote"></div>
      <div class="form-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <label class="field">Fecha<input type="date" id="tDate" value="${S.me.today}" max="${S.me.today}"></label>
        <label class="field">Inicio<input type="time" id="tStart"></label>
        <label class="field">Fin<input type="time" id="tEnd"></label>
      </div>
      <span class="muted" style="font-size:12px">Para medir el tiempo real, pulsa «Empezar servicio» cuando la clienta se sienta y cobra al terminar. Si no, puedes escribir la hora de inicio y fin.</span>
      <div class="pos-actions">
        <button type="button" class="btn" id="startTimer">Empezar servicio</button>
        <button type="button" class="btn primary" id="charge">Cobrar</button>
      </div>
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
  };

  /* Servicios en curso (cronómetro). */
  const renderTimerNote = () => {
    const v = st.openVisit;
    $('#timerNote').innerHTML = v ? `<div class="notice">Cronómetro en marcha desde las ${hm(new Date(v.started_at))} · ${Math.max(0, Math.round((Date.now() - Date.parse(v.started_at)) / 60000))} min. Al cobrar se guarda el tiempo real.</div>` : '';
    $('#tStart').disabled = !!v;
    $('#tEnd').disabled = !!v;
    if (v) { $('#tStart').value = hm(new Date(v.started_at)); $('#tEnd').value = hm(new Date()); }
    $('#startTimer').classList.toggle('hidden', !!v);
  };
  const renderRunning = async () => {
    const box = $('#running');
    if (!box) return;
    const { visits } = await api('/api/visits/open');
    box.classList.toggle('hidden', !visits.length);
    box.innerHTML = `<div class="card-head"><h2>En curso · ${visits.length}</h2><span class="muted">Midiendo el tiempo real de cada servicio</span></div>
      <div class="running-list">${visits.map((v) => `<div class="running-item">
        <span class="clock" data-since="${esc(v.started_at)}">${Math.max(0, Math.round((Date.now() - Date.parse(v.started_at)) / 60000))} min</span>
        <span class="txt"><b>${esc(v.client_name || 'Sin cliente')}</b><small>${esc(v.lines.filter((l) => l.kind === 'service').map((l) => l.name).join(' + '))}${v.employee_name ? ` · ${esc(v.employee_name)}` : ''} · desde las ${hm(new Date(v.started_at))}</small></span>
        <button type="button" class="btn small primary" data-load="${v.id}">Cobrar</button>
        <button type="button" class="icon-btn" data-drop="${v.id}" aria-label="Descartar servicio en curso">${icon('trash', 16)}</button>
      </div>`).join('')}</div>`;
    $$('[data-load]', box).forEach((b) => (b.onclick = () => {
      const v = visits.find((x) => String(x.id) === b.dataset.load);
      st.openVisit = v;
      st.lines = v.lines.map((l) => ({ ...l }));
      if (v.employee_id) $('#emp').value = v.employee_id;
      st.client = v.client_id ? { id: v.client_id, name: v.client_name, phone: '' } : null;
      st.newClient = !v.client_id && v.client_name ? { name: v.client_name, phone: '', gender: 'M' } : null;
      renderCart();
      renderClient();
      renderTimerNote();
      $('#charge').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
    $$('[data-drop]', box).forEach((b) => (b.onclick = async () => {
      if (!(await confirmAction('¿Descartar este servicio en curso? No se cobra ni se guarda su tiempo.', 'Descartar'))) return;
      await api(`/api/visits/open/${b.dataset.drop}`, { method: 'DELETE', body: {} });
      if (st.openVisit && String(st.openVisit.id) === b.dataset.drop) { st.openVisit = null; renderTimerNote(); }
      renderRunning();
    }));
  };
  const tick = setInterval(() => {
    if (!document.body.contains(main) || !$('#running')) return clearInterval(tick);
    $$('#running .clock').forEach((c) => { c.textContent = `${Math.max(0, Math.round((Date.now() - Date.parse(c.dataset.since)) / 60000))} min`; });
    if (st.openVisit) renderTimerNote();
  }, 30000);

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
  $('#startTimer').onclick = async () => {
    if (!st.lines.some((l) => l.kind === 'service')) return toast('Añade el servicio que vas a empezar', true);
    try {
      await api('/api/visits/open', { method: 'POST', body: {
        employee_id: Number($('#emp').value) || null,
        client_id: st.client?.id || null,
        client_name: st.newClient?.name || '',
        lines: st.lines.map((l) => ({ kind: l.kind, item_id: l.item_id, qty: l.qty, price: l.price }))
      } });
      toast('Cronómetro en marcha. Cobra cuando termine el servicio.');
      st.lines = [];
      st.client = null;
      st.newClient = null;
      renderCart();
      renderClient();
      renderRunning();
    } catch (err) { toast(err.message, true); }
  };
  $('#charge').onclick = async () => {
    if (!st.lines.length) return toast('Añade al menos un servicio o producto', true);
    const v = st.openVisit;
    const body = {
      employee_id: Number($('#emp').value) || null,
      method: st.method,
      date: $('#tDate').value,
      time_start: v ? hm(new Date(v.started_at)) : $('#tStart').value || null,
      time_end: v ? hm(new Date()) : $('#tEnd').value || null,
      open_visit_id: v?.id || null,
      appointment_id: !v && st.appointment ? st.appointment.id : null,
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
      st.openVisit = null;
      st.appointment = null;
      $('#tStart').value = '';
      $('#tEnd').value = '';
      renderCart();
      renderClient();
      renderTimerNote();
      renderRunning();
    } catch (err) { toast(err.message, true); }
  };
  renderItems();
  renderCart();
  renderClient();
  renderTimerNote();
  renderRunning();
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
    if (!(await confirmAction(kind === 't' ? '¿Anular este cobro?' : '¿Borrar este movimiento?', 'Anular'))) return;
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
      if (!(await confirmAction('¿Cerrar la caja? Después no se podrán anular cobros de este día.', 'Cerrar caja'))) return;
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
    if (!(await confirmAction('¿Borrar este pedido?', 'Borrar'))) return;
    await api(`/api/orders/${b.dataset.del}`, { method: 'DELETE', body: {} }).then(() => render()).catch((e) => toast(e.message, true));
  }));
};

/* ---------- Conectar TPV / importar ---------- */
/* ---------- Traer los datos de otro programa ---------- */

/* Lee un CSV/TXT o un Excel (.xlsx) y devuelve sus filas (la primera, títulos).
   El Excel se descomprime en el navegador: no hace falta ninguna librería. */
async function readSpreadsheet(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls')) throw new Error('Los archivos .xls antiguos no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o .csv.');
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf);
    return parseCsvText(text);
  }
  return readXlsx(buf);
}

function parseCsvText(text) {
  const src = String(text).replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

async function unzipEntries(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El archivo Excel está dañado o no es un .xlsx.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extra = dv.getUint16(p + 30, true);
    const comment = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    entries.set(dec.decode(buf.subarray(p + 46, p + 46 + nameLen)), { method, size, local });
    p += 46 + nameLen + extra + comment;
  }
  return async (path) => {
    const e = entries.get(path);
    if (!e) return null;
    const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
    const data = buf.subarray(start, start + e.size);
    if (e.method === 0) return dec.decode(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('Tu navegador no puede abrir Excel. Guarda el archivo como .csv y súbelo de nuevo.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
}

async function readXlsx(buf) {
  const get = await unzipEntries(buf);
  const xml = (s) => (s ? new DOMParser().parseFromString(s, 'application/xml') : null);
  const tags = (doc, t) => (doc ? [...doc.getElementsByTagName(t)] : []);
  const wb = xml(await get('xl/workbook.xml'));
  const rels = xml(await get('xl/_rels/workbook.xml.rels'));
  const sheet = tags(wb, 'sheet')[0];
  if (!sheet) throw new Error('El Excel no tiene ninguna hoja.');
  const rid = sheet.getAttribute('r:id');
  const rel = tags(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid);
  let target = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml';
  target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const strings = tags(xml(await get('xl/sharedStrings.xml')), 'si').map((si) => tags(si, 't').map((t) => t.textContent).join(''));
  // Formatos de fecha: los números con formato de fecha se convierten a AAAA-MM-DD o HH:MM.
  const styles = xml(await get('xl/styles.xml'));
  const custom = new Map(tags(styles, 'numFmt').map((f) => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') || '']));
  const xfs = styles ? tags(styles.getElementsByTagName('cellXfs')[0], 'xf').map((x) => Number(x.getAttribute('numFmtId') || 0)) : [];
  const isDateFmt = (id) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dmyh]/i.test(String(custom.get(id) || '').replace(/"[^"]*"|\[[^\]]*\]/g, ''));
  const serial = (n) => {
    const ms = Math.round((n - 25569) * 86400000);
    const d = new Date(ms);
    const ymd = d.toISOString().slice(0, 10);
    const hm = d.toISOString().slice(11, 16);
    if (n < 1) return hm;
    return n % 1 ? `${ymd} ${hm}` : ymd;
  };
  const colIndex = (ref) => {
    let n = 0;
    for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const doc = xml(await get(target));
  const rows = [];
  for (const r of tags(doc, 'row')) {
    const out = [];
    for (const c of tags(r, 'c')) {
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let val;
      if (t === 's') val = strings[Number(v)] ?? '';
      else if (t === 'inlineStr') val = tags(c, 't').map((x) => x.textContent).join('');
      else if (t === 'b') val = v === '1' ? 'Sí' : 'No';
      else if (t === 'str' || t === 'e') val = v;
      else if (v !== '' && isDateFmt(xfs[Number(c.getAttribute('s') || 0)] ?? 0)) val = serial(Number(v));
      else val = v.includes('.') ? v.replace('.', ',') : v;
      out[colIndex(c.getAttribute('r') || '')] = val;
    }
    const filled = Array.from(out, (x) => x ?? '');
    if (filled.some((x) => String(x).trim() !== '')) rows.push(filled);
  }
  if (!rows.length) throw new Error('La primera hoja del Excel está vacía.');
  return rows;
}

const SOURCE_HELP = {
  fresha: { name: 'Fresha', steps: ['Clientas: Clientes → Opciones → Exportar (CSV).', 'Servicios: Catálogo → Opciones → Descargar CSV.', 'Citas (también las pasadas): Informes → Lista de citas → todas las fechas → Exportar CSV.', 'Productos: Informes → Inventario o Lista de productos → Exportar.'] },
  booksy: { name: 'Booksy', steps: ['Clientas: en Booksy Biz (versión web) → Clientes → Exportar a CSV.', 'Citas y servicios: el panel no deja exportarlos. Pide a soporte de Booksy un archivo con tus citas y súbelo aquí.', 'Mientras sigas usando Booksy, las citas nuevas pueden entrar solas: Ajustes → Agenda → calendario externo.'] },
  treatwell: { name: 'Treatwell', steps: ['Treatwell no publica cómo exportar los datos. Pide a su soporte la exportación de clientas, servicios y citas en Excel o CSV.', 'Si tu cuenta ofrece un enlace de calendario (iCal), conéctalo en Ajustes → Agenda para que las citas nuevas entren solas.'] },
  koibox: { name: 'Koibox', steps: ['Busca en Clientes e Informes la opción «Exportar a Excel».', 'Si no la encuentras, pide a su soporte la exportación de clientas, servicios, citas y ventas.'] },
  flowww: { name: 'Flowww', steps: ['Busca en Clientes e Informes la opción «Exportar» (Excel o CSV).', 'Si no la encuentras, pide a su soporte la exportación de clientas, servicios, citas y ventas.'] },
  bewe: { name: 'Bewe', steps: ['Busca en Clientes e Informes la opción «Exportar».', 'Si no la encuentras, pide a su soporte la exportación de clientas, servicios, citas y ventas.'] },
  shore: { name: 'Shore', steps: ['Busca en Clientes la opción «Exportar» (CSV o Excel).', 'Para el resto de datos, pide la exportación a su soporte.'] },
  excel: { name: 'Excel propio', steps: ['Si llevas tus clientas o tu menú en una hoja de cálculo, súbela tal cual: reconozco las columnas.', 'Si empiezas de cero, descarga una plantilla, rellénala y súbela.'] },
  otro: { name: 'Otro programa', steps: ['Casi todos los programas tienen «Exportar a Excel o CSV» en Clientes, Servicios, Agenda e Informes.', 'Si no lo encuentras, pide la exportación a su soporte.'] }
};

const KIND_PREVIEW = {
  clients: [['name', 'Nombre'], ['phone', 'Teléfono'], ['email', 'Email'], ['birthdate', 'Nacimiento'], ['notes', 'Notas']],
  services: [['name', 'Servicio'], ['category', 'Categoría'], ['duration', 'Min'], ['price', 'Precio']],
  products: [['name', 'Producto'], ['kind', 'Uso'], ['price', 'PVP'], ['cost', 'Coste']],
  appointments: [['date', 'Fecha'], ['start', 'Hora'], ['client', 'Clienta'], ['services', 'Servicio'], ['employee', 'Profesional'], ['status', 'Estado']],
  sales: [['date', 'Fecha'], ['ref', 'Ticket'], ['client', 'Clienta'], ['lines', 'Conceptos'], ['employee', 'Profesional']]
};
const previewCell = (kind, item, f) => {
  const v = item[f];
  if (f === 'services') return (v || []).map((s) => s.name).join(', ');
  if (f === 'client') return v?.name || '';
  if (f === 'lines') return (v || []).map((l) => `${l.name} ${l.total ?? l.price ?? ''}`).join(' · ');
  if (f === 'ref' && String(v).startsWith('auto:')) return '';
  if (f === 'kind') return v === 'tecnico' ? 'Técnico' : 'Venta';
  if ((f === 'price' || f === 'cost') && v != null) return eur(v, 2);
  if (f === 'birthdate' || f === 'date') return v ? fdate(v) : '';
  return v ?? '';
};
const TEMPLATES = {
  clients: 'Nombre;Apellidos;Teléfono;Email;Género;Fecha de nacimiento;Notas\nAna;García López;600111222;ana@email.com;Mujer;12/04/1990;Alergia a PPD',
  services: 'Servicio;Categoría;Duración;Precio\nCorte y peinado;Corte;45;32\nColor raíz;Color;75;45',
  products: 'Producto;Uso;PVP;Coste\nChampú hidratante;Venta;18;9\nTinte 7.1;Técnico;0;6,5',
  appointments: 'Fecha;Hora;Duración;Cliente;Teléfono;Servicio;Profesional;Estado;Referencia\n20/10/2026;10:00;45;Ana García López;600111222;Corte y peinado;Laura;Confirmada;C-1001'
};

function resultLine(r) {
  const res = r.result;
  const what = { clients: 'clientas', services: 'servicios', products: 'productos', appointments: 'citas', sales: 'tickets' }[r.kind];
  const parts = [`${fmt(res.created)} ${what} nuevas`.replace('servicios nuevas', 'servicios nuevos').replace('productos nuevas', 'productos nuevos').replace('tickets nuevas', 'tickets nuevos')];
  if (res.updated) parts.push(`${fmt(res.updated)} se completan o actualizan`);
  if (res.unchanged) parts.push(`${fmt(res.unchanged)} ya estaban`);
  if (r.kind === 'appointments') {
    if (res.upcoming) parts.push(`${fmt(res.upcoming)} son próximas`);
    if (res.employeesCreated) parts.push(`se añaden ${fmt(res.employeesCreated)} profesionales`);
  }
  if (r.kind === 'sales' && res.revenue) parts.push(`${eur(res.revenue, 2)} en ventas`);
  if (r.skipped) parts.push(`${fmt(r.skipped)} filas vacías`);
  return parts.join(' · ');
}

VIEWS.migrar = async (main, { query }) => {
  const schema = await api('/api/migrate/schema');
  let source = query.get('desde') && SOURCE_HELP[query.get('desde')] ? query.get('desde') : store.get('migrSource') || '';
  const files = [];
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Desde Fresha, Booksy, Treatwell, Koibox, Flowww, Bewe o tu Excel</div><h1>Traer mis datos</h1></div></header>
  <section class="card">
    <h2>1 · ¿Qué programa usas ahora?</h2>
    <div class="source-grid" role="group" aria-label="Programa de origen">${Object.entries(SOURCE_HELP).map(([k, v]) => `<button type="button" class="source-btn" data-src="${k}" aria-pressed="${source === k}">${esc(v.name)}</button>`).join('')}</div>
    <div id="srcHelp"></div>
  </section>
  <section class="card">
    <div class="card-head"><h2>2 · Sube los archivos</h2><button type="button" class="btn primary hidden" id="importAll">Importar todo</button></div>
    <p class="muted" style="margin:0;font-size:14px">Clientas, servicios, productos, citas o ventas, en Excel (.xlsx) o CSV. Puedes subir varios a la vez: reconozco qué es cada uno y te enseño lo que va a entrar antes de guardar nada. Si una clienta ya existe (mismo teléfono o email) solo se completan sus datos.</p>
    <label class="dropzone" id="drop"><input type="file" id="migFiles" multiple accept=".csv,.txt,.xlsx,.xls"><b>Elige los archivos</b><span>o arrástralos aquí</span></label>
    <div id="fileCards" style="display:flex;flex-direction:column;gap:14px"></div>
  </section>`;

  const renderHelp = () => {
    $$('[data-src]', main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.src === source)));
    const h = SOURCE_HELP[source];
    $('#srcHelp').innerHTML = !h ? '<p class="muted" style="margin:0;font-size:14px">Elige tu programa y te digo dónde descargar tus datos.</p>' : `
      <div class="help-box"><b>Cómo sacar tus datos de ${esc(h.name)}</b><ol>${h.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="muted" style="margin:0;font-size:13px">Los nombres de los menús cambian según la versión. Si no encuentras la opción, pide la exportación a su soporte: por ley (RGPD) tienen que darte tus datos en un formato que se pueda usar.</p>
      <div class="chips" style="margin-top:4px"><span class="muted" style="font-size:13px">Plantillas:</span>${Object.keys(TEMPLATES).map((k) => `<button type="button" class="btn small ghost" data-tpl="${k}">${esc(schema.kinds[k].label)}</button>`).join('')}</div></div>`;
    $$('[data-tpl]', main).forEach((b) => (b.onclick = () => saveFile(new Blob([`﻿${TEMPLATES[b.dataset.tpl]}\n`], { type: 'text/csv;charset=utf-8' }), `plantilla-${b.dataset.tpl}.csv`)));
  };
  $$('[data-src]', main).forEach((b) => (b.onclick = () => { source = b.dataset.src; store.set('migrSource', source); renderHelp(); }));
  renderHelp();

  const run = async (f, dryRun) => api('/api/migrate', { method: 'POST', body: { kind: f.kind || 'auto', rows: f.rows, mapping: f.mapping || undefined, source: source || 'otro', dryRun } });

  const renderCard = (f) => {
    const r = f.result;
    const kinds = schema.kinds;
    const headers = f.rows[0] || [];
    const sample = f.rows[1] || [];
    const fieldsOf = f.kind ? Object.entries(kinds[f.kind].fields) : [];
    const mapping = r?.mapping || {};
    f.el.innerHTML = `
      <div class="card-head" style="align-items:flex-start"><div><b>${esc(f.file.name)}</b><br><small class="muted">${fmt(f.rows.length - 1)} filas · ${headers.length} columnas</small></div>
        <label class="field" style="min-width:180px">Contiene<select data-kind>${[['', 'Elige…'], ...schema.order.map((k) => [k, kinds[k].label])].map(([k, l]) => `<option value="${k}" ${k === (f.kind || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      ${f.error ? `<div class="notice warn">${esc(f.error)}</div>` : ''}
      ${r && r.ok ? `<div class="notice ${f.done ? '' : 'info'}">${f.done ? 'Importado' : 'Al importar'}: ${esc(resultLine(r))}.</div>
        ${r.warningCount ? `<details><summary class="muted" style="cursor:pointer;font-size:13px">${fmt(r.warningCount)} filas con avisos (no se importan)</summary><div class="muted" style="font-size:13px">${r.warnings.map(esc).join('<br>')}</div></details>` : ''}
        <div class="table-wrap"><table><thead><tr>${KIND_PREVIEW[f.kind].map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${r.preview.map((it) => `<tr>${KIND_PREVIEW[f.kind].map(([k]) => `<td>${esc(previewCell(f.kind, it, k))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${f.kind ? `<details ${r && !r.ok ? 'open' : ''}><summary style="cursor:pointer;font-size:14px;font-weight:600">Revisar columnas</summary>
        <div class="map-grid">${fieldsOf.map(([field, label]) => `<label class="field">${esc(label)}<select data-map="${field}"><option value="">— No está —</option>${headers.map((h, i) => `<option value="${i}" ${mapping[field] === i ? 'selected' : ''}>${esc(h || `Columna ${i + 1}`)}${sample[i] ? ` · ${esc(String(sample[i]).slice(0, 24))}` : ''}</option>`).join('')}</select></label>`).join('')}</div></details>` : ''}
      <div class="form-actions">${f.done ? '<span class="tag green">Hecho</span>' : `<button type="button" class="btn" data-remove>Quitar</button><button type="button" class="btn primary" data-import ${r && r.ok ? '' : 'disabled'}>Importar este archivo</button>`}</div>`;
    const kindSel = $('[data-kind]', f.el);
    kindSel.onchange = async () => { f.kind = kindSel.value || null; f.mapping = null; await analyze(f); };
    $$('[data-map]', f.el).forEach((s) => (s.onchange = async () => {
      f.mapping = Object.fromEntries($$('[data-map]', f.el).filter((x) => x.value !== '').map((x) => [x.dataset.map, Number(x.value)]));
      await analyze(f);
    }));
    const rm = $('[data-remove]', f.el);
    if (rm) rm.onclick = () => { files.splice(files.indexOf(f), 1); f.el.remove(); syncAll(); };
    const imp = $('[data-import]', f.el);
    if (imp) imp.onclick = () => importOne(f);
  };

  const analyze = async (f) => {
    f.error = null;
    try {
      const r = await run(f, true);
      f.result = r;
      if (r.kind) f.kind = r.kind;
      if (!r.ok) f.error = r.error;
    } catch (err) { f.error = err.message; f.result = null; }
    renderCard(f);
    syncAll();
  };

  const importOne = async (f) => {
    const btn = $('[data-import]', f.el);
    if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }
    try {
      const r = await run(f, false);
      f.result = r;
      if (!r.ok) f.error = r.error; else f.done = true;
    } catch (err) { f.error = err.message; }
    renderCard(f);
    syncAll();
    return f.done;
  };

  const syncAll = () => {
    const ready = files.filter((f) => !f.done && f.result?.ok);
    const all = $('#importAll');
    all.classList.toggle('hidden', ready.length < 2);
    all.textContent = `Importar todo (${ready.length} archivos)`;
  };
  // Orden recomendado: primero el menú y las clientas, después citas y ventas.
  $('#importAll').onclick = async () => {
    const ready = files.filter((f) => !f.done && f.result?.ok).sort((a, b) => schema.order.indexOf(a.kind) - schema.order.indexOf(b.kind));
    let ok = 0;
    for (const f of ready) if (await importOne(f)) ok++;
    toast(`${ok} de ${ready.length} archivos importados`);
  };

  const addFiles = async (list) => {
    for (const file of list) {
      const el = document.createElement('div');
      el.className = 'file-card';
      el.innerHTML = `<b>${esc(file.name)}</b> <span class="muted">· leyendo…</span>`;
      $('#fileCards').appendChild(el);
      const f = { file, el, rows: [], kind: null, mapping: null, result: null, done: false, error: null };
      try {
        f.rows = await readSpreadsheet(file);
        files.push(f);
        await analyze(f);
      } catch (err) {
        el.innerHTML = `<div class="notice warn">${esc(file.name)}: ${esc(err.message)}</div>`;
      }
    }
  };
  $('#migFiles').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  const drop = $('#drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
};

const CSV_TEMPLATE = `fecha;hora_inicio;hora_fin;ticket;cliente;telefono;genero;empleado;tipo;concepto;cantidad;importe;metodo_pago
26/09/2026;10:00;10:50;T-1001;Marta Gil;600111222;Mujer;Laura M.;servicio;Color raíz;1;45,00;tarjeta
26/09/2026;10:00;10:50;T-1001;Marta Gil;600111222;Mujer;Laura M.;producto;Mascarilla hidratante 250 ml;1;24,00;tarjeta
26/09/2026;11:15;11:40;T-1002;Jorge Santos;600333444;Hombre;Carlos R.;servicio;Corte hombre;1;18,00;efectivo
`;

VIEWS.importar = async (main) => {
  const settings = await api('/api/settings');
  const origin = location.origin;
  main.innerHTML = `
  <header class="page-head"><div><div class="eyebrow">Que los datos entren solos: sin teclear dos veces</div><h1>Conectar TPV</h1></div></header>
  <section class="grid g2">
    <div class="card">
      <h2>1 · Importar desde tu TPV o programa de caja</h2>
      <p class="muted" style="margin:0;font-size:14px">Casi todos los TPV y programas de peluquería exportan las ventas a Excel o CSV. Expórtalas (en Excel: «Guardar como → CSV») y súbelas aquí. Reconozco las columnas automáticamente; lo ya importado no se duplica.</p>
      <label class="field">Archivo CSV<input type="file" id="csvFile" accept=".csv,.txt,text/csv" class="input" style="padding:9px 12px"></label>
      <details><summary style="cursor:pointer;font-size:14px;font-weight:600">…o pega el contenido</summary><textarea id="csvText" class="input" style="min-height:140px;padding:10px;margin-top:8px;font-family:monospace;font-size:12px"></textarea></details>
      <div class="form-actions" style="justify-content:space-between"><button type="button" class="btn small ghost" id="tplFill">Probar con un ejemplo</button><button type="button" class="btn dark" id="analyze">Revisar antes de importar</button></div>
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

  $('#tplFill').onclick = () => {
    $('details', main).open = true;
    $('#csvText').value = CSV_TEMPLATE;
    $('#csvFile').value = '';
  };
  $('#newKey').onclick = async () => {
    if (settings.api_key && !(await confirmAction('La clave anterior dejará de funcionar. ¿Generar una nueva?', 'Generar clave'))) return;
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
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf); // exportaciones de Excel en Windows
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
  </section>
  <section class="card" id="teamUsers"><div class="loading">Cargando usuarios…</div></section>
  <section class="card" id="booking"><div class="loading">Cargando agenda…</div></section>
  <section class="card" id="channels"><div class="loading">Cargando canales…</div></section>`;
  renderTeamUsers($('#teamUsers'));
  renderBookingSettings($('#booking'));
  renderChannels($('#channels'));
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

/* Usuarios del salón: el dueño da acceso a su equipo. */
const ROLE_LABEL = { owner: 'Dueño/a · ve todo', staff: 'Equipo · agenda, cobros, caja, clientes y mensajes' };
async function renderTeamUsers(el) {
  const [{ users }, cat] = await Promise.all([api('/api/team/users'), api('/api/catalog')]);
  const empOptions = [['', 'Sin vincular'], ...cat.employees.filter((e) => e.active).map((e) => [e.id, e.name])];
  el.innerHTML = `<div class="card-head"><div><h2>Usuarios y accesos</h2><p class="muted" style="margin:4px 0 0;font-size:14px">Cada persona entra con su email. El equipo solo ve agenda, cobros, caja, clientes y mensajes: no ve facturación ni ajustes.</p></div>
      <button type="button" class="btn primary" id="addUser">Dar acceso a alguien</button></div>
    <div class="table-wrap"><table><thead><tr><th>Persona</th><th>Acceso</th><th>Ficha en Equipo</th><th>Estado</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr>
      <td><b>${esc(u.name || '—')}</b><br><small class="muted">${esc(u.email)}</small></td>
      <td>${u.role === 'owner' ? '<span class="tag plum">Dueño/a</span>' : '<span class="tag">Equipo</span>'}</td>
      <td>${esc(u.employee_name || '—')}</td>
      <td>${u.active ? '<span class="tag green">Activo</span>' : '<span class="tag">Sin acceso</span>'}</td>
      <td class="r" style="white-space:nowrap">${u.id === S.me.user.id ? '<small class="muted">Tú</small>' : `<button type="button" class="btn small" data-uedit="${u.id}">Editar</button> <button type="button" class="btn small" data-ulink="${u.id}">Enlace de contraseña</button>`}</td>
    </tr>`).join('')}</tbody></table></div>`;
  const reload = () => renderTeamUsers(el);
  $('#addUser', el).onclick = () => openForm({
    title: 'Dar acceso a alguien',
    intro: 'Elige una contraseña provisional y pásasela. Podrá cambiarla en Ajustes.',
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'off' },
      { name: 'password', label: 'Contraseña provisional', type: 'text', required: true, hint: 'Mínimo 8 caracteres.', autocomplete: 'off' },
      { name: 'role', label: 'Acceso', type: 'select', value: 'staff', options: Object.entries(ROLE_LABEL) },
      { name: 'employee_id', label: 'Su ficha en Equipo', type: 'select', options: empOptions, hint: 'Para saber de quién es cada cobro y cita.' }
    ],
    submit: 'Dar acceso',
    onSubmit: async (v) => { await api('/api/team/users', { method: 'POST', body: v }); toast(`Acceso creado para ${v.name}`); reload(); }
  });
  $$('[data-uedit]', el).forEach((b) => (b.onclick = () => {
    const u = users.find((x) => String(x.id) === b.dataset.uedit);
    const dlg = openForm({
      title: `Acceso de ${u.name || u.email}`,
      fields: [
        { name: 'name', label: 'Nombre', value: u.name, required: true },
        { name: 'email', label: 'Email', type: 'email', value: u.email, required: true },
        { name: 'role', label: 'Acceso', type: 'select', value: u.role, options: Object.entries(ROLE_LABEL) },
        { name: 'employee_id', label: 'Su ficha en Equipo', type: 'select', value: u.employee_id ?? '', options: empOptions },
        { name: 'password', label: 'Nueva contraseña (opcional)', type: 'text', hint: 'Déjalo vacío para no cambiarla.', autocomplete: 'off' },
        { name: 'active', label: 'Puede entrar', type: 'checkbox', value: !!u.active }
      ],
      onSubmit: async (v) => {
        if (!v.password) delete v.password;
        await api(`/api/team/users/${u.id}`, { method: 'PUT', body: v });
        toast('Acceso guardado');
        reload();
      }
    });
    const actions = $('.form-actions', dlg);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn';
    del.style.marginRight = 'auto';
    del.textContent = 'Quitar acceso';
    del.onclick = async () => {
      if (!(await confirmAction(`¿Quitar el acceso de ${u.name || u.email}? Sus cobros y citas se conservan.`, 'Quitar acceso'))) return;
      try { await api(`/api/team/users/${u.id}`, { method: 'DELETE', body: {} }); dlg.close(); toast('Acceso eliminado'); reload(); } catch (err) { toast(err.message, true); }
    };
    actions.prepend(del);
  }));
  $$('[data-ulink]', el).forEach((b) => (b.onclick = async () => {
    try {
      const { link } = await api(`/api/team/users/${b.dataset.ulink}/reset-link`, { method: 'POST', body: {} });
      showLinkDialog('Enlace para elegir contraseña', 'Envíaselo por WhatsApp o email. Sirve una vez y caduca en 24 horas.', link);
    } catch (err) { toast(err.message, true); }
  }));
}

/* Muestra un enlace para copiarlo o compartirlo. */
function showLinkDialog(title, intro, link) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2><p class="muted" style="margin:0">${esc(intro)}</p>
    <input class="input" readonly value="${esc(link)}" aria-label="Enlace" style="width:100%">
    <div class="form-actions"><a class="btn" href="https://wa.me/?text=${encodeURIComponent(link)}" target="_blank" rel="noopener">Enviar por WhatsApp</a><button type="button" class="btn" data-copy>Copiar</button><button class="btn primary" type="submit">Hecho</button></div></form>`;
  document.body.appendChild(dlg);
  $('[data-copy]', dlg).onclick = async () => {
    const input = $('input', dlg);
    input.select();
    try { await navigator.clipboard.writeText(link); toast('Enlace copiado'); } catch { toast('Selecciona el enlace y cópialo'); }
  };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

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
      <td style="white-space:nowrap">${esc(s.plan)} <small class="muted">${eur(s.monthlyFee)}</small>${s.plan === 'Prueba' && s.trialEnds ? `<br><small class="${s.trialEnds < S.me.today ? 'down' : 'muted'}">${s.trialEnds < S.me.today ? 'terminó' : 'hasta'} el ${fdateShort(s.trialEnds)}</small>` : ''}${s.signupSource === 'registro' ? ' <span class="tag amber">Alta web</span>' : ''}</td>
      <td class="r num">${eur(s.revenue)}</td><td class="r num ${toneOf(s.growth)}"><b>${pct(s.growth)}</b></td><td class="r num">${eur(s.avgTicket, 2)}</td>
      <td class="r num">${s.occupancy == null ? '—' : `${fmt(s.occupancy * 100)} %`}</td><td class="r num">${s.consumptionPct == null ? '—' : `${fmt(s.consumptionPct, 1)} %`}</td>
      <td class="r num">${s.signal.daysLeft == null ? '—' : `${s.signal.daysLeft} d`}</td><td><span class="tag ${SIGNAL_TAG[s.signal.level]}">${s.signal.level}</span></td>
      <td class="r" style="white-space:nowrap"><button type="button" class="btn small" data-edit="${s.id}">Plan</button> <button type="button" class="btn small" data-report="${s.id}">Reporte</button> <button type="button" class="btn small primary" data-view="${s.id}">Ver panel</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">Ningún salón con este filtro.</td></tr>'}</tbody></table></div>
  </section>
  <section class="card" id="leads" aria-label="Solicitudes de prueba"><div class="loading">Cargando solicitudes…</div></section>`;

  $('#cRef').onchange = (e) => { if (e.target.value) { S.consoleRef = e.target.value; render(); } };
  $$('[data-cf]', main).forEach((btn) => (btn.onclick = () => { S.consoleFilter = btn.dataset.cf; render(); }));
  $$('[data-view]', main).forEach((btn) => (btn.onclick = () => { S.salonId = Number(btn.dataset.view); store.set('salonId', S.salonId); go('#/panel'); }));
  $$('[data-report]', main).forEach((btn) => (btn.onclick = () => { S.salonId = Number(btn.dataset.report); store.set('salonId', S.salonId); go('#/reporte'); }));
  $$('[data-edit]', main).forEach((btn) => (btn.onclick = () => {
    const s = d.salons.find((x) => String(x.id) === btn.dataset.edit);
    openForm({
      title: `Plan de ${s.name}`,
      intro: s.owner ? `Dueño: ${s.owner.name || ''} ${s.owner.email}${s.phone ? ` · ${s.phone}` : ''}` : '',
      fields: [
        { name: 'plan', label: 'Plan', type: 'select', value: s.plan, options: [...new Set(['Prueba', 'Base', 'Pro', s.plan])].map((p) => [p, p]) },
        { name: 'monthly_fee', label: 'Cuota mensual (€)', type: 'money', value: fmt(s.monthlyFee, 2) },
        { name: 'trial_ends', label: 'Fin de la prueba', type: 'date', value: s.trialEnds || '', hint: 'Solo cuenta con el plan Prueba. Vacío: sin fecha de fin.' },
        { name: 'active', label: 'Suscripción activa', type: 'checkbox', value: s.active }
      ],
      onSubmit: async (v) => { await api(`/api/admin/salons/${s.id}`, { method: 'PUT', body: v }); toast('Guardado'); render(); }
    });
    if (s.owner) {
      const dlg = $$('dialog').at(-1);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.style.marginRight = 'auto';
      b.textContent = 'Enlace de contraseña del dueño';
      b.onclick = async () => {
        try {
          const { link } = await api(`/api/admin/users/${s.owner.id}/reset-link`, { method: 'POST', body: {} });
          showLinkDialog('Enlace para el dueño', 'Para que elija una contraseña nueva. Sirve una vez y caduca en 24 horas.', link);
        } catch (err) { toast(err.message, true); }
      };
      $('.form-actions', dlg).prepend(b);
    }
  }));
  $('#addSalon').onclick = () => salonForm();
  renderLeads($('#leads'));
};

/* ---------- Comunicación con clientes ---------- */
const CHANNEL = { whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', instagram: 'Instagram', web: 'Web' };
const CHANNEL_TAG = { whatsapp: 'green', email: 'blue', sms: 'amber', instagram: 'plum', web: '' };
const MOOD_TAG = { 'Muy satisfecha': 'green', 'Satisfecha': 'green', 'Neutral': '', 'Molesta o preocupada': 'red' };
const TEMPLATE_KINDS = [['recordatorio', 'Le toca volver'], ['reactivacion', 'Reactivación'], ['segunda_visita', 'Segunda visita'], ['postservicio', 'Después del servicio'], ['confirmacion', 'Confirmar cita'], ['promo', 'Promoción'], ['otro', 'Otro']];
const MSG_STATUS = { manual: 'Para enviar desde el móvil', enviado: 'Enviado', entregado: 'Entregado', 'leído': 'Leído', error: 'No se pudo enviar', recibido: '' };

const toDate = (at) => new Date(`${String(at).replace(' ', 'T')}Z`);
function fmtWhen(at) {
  if (!at) return '';
  const d = toDate(at);
  const nowD = new Date();
  const hm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === nowD.toDateString()) return hm;
  const y = new Date(nowD);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `ayer ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
const fillTemplate = (body, vars) => String(body).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));

/* Bloque "Lo que sabemos": tono, etiquetas, temas, preferencias e IA. */
function insightsBlock(ins) {
  if (!ins || !ins.inboundCount) {
    return '<p class="muted" style="margin:0;font-size:14px">Aún no nos ha escrito. Cuando escriba por WhatsApp o email, aquí verás su tono, qué servicios le interesan y sus preferencias.</p>';
  }
  const ai = ins.ai;
  return `<div class="insights">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span class="tag ${MOOD_TAG[ins.mood] || ''}">${esc(ins.mood)}</span>
      ${ins.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
    </div>
    <p style="margin:0;font-size:14px;line-height:1.5">${esc(ins.summary)}</p>
    <div class="insight-grid">
      ${ins.topics.length ? `<div><div class="block-title">Por qué escribe</div>${ins.topics.slice(0, 4).map((t) => `<div class="kv"><span>${esc(t.name)}</span><span>${t.count}</span></div>`).join('')}</div>` : ''}
      ${ins.services.length ? `<div><div class="block-title">Servicios que le interesan</div>${ins.services.map((t) => `<div class="kv"><span>${esc(t.name)}</span><span>${t.count}</span></div>`).join('')}</div>` : ''}
      <div><div class="block-title">Datos de contacto</div>
        <div class="kv"><span>Mensajes suyos</span><span>${ins.inboundCount}</span></div>
        ${ins.preferences.length ? `<div class="kv"><span>Días y franjas que menciona</span><span>${esc(ins.preferences.join(', '))}</span></div>` : ''}
        ${ins.responseMinutes != null ? `<div class="kv"><span>Le respondemos en</span><span>${ins.responseMinutes < 60 ? `${ins.responseMinutes} min` : `${fmt(ins.responseMinutes / 60, 1)} h`}</span></div>` : ''}
        ${ins.lastContact ? `<div class="kv"><span>Último mensaje</span><span>${fmtWhen(ins.lastContact)}</span></div>` : ''}
      </div>
    </div>
    ${ai ? `<div class="ai-box">
      <div class="block-title">Resumen con IA · ${esc(ai.at || '')}</div>
      <p style="margin:0">${esc(ai.resumen)}</p>
      <p style="margin:0"><b>Cómo se siente:</b> ${esc(ai.emocionalidad)}</p>
      ${ai.oportunidades?.length ? `<p style="margin:0"><b>Qué ofrecerle:</b> ${ai.oportunidades.map(esc).join(' · ')}</p>` : ''}
      ${ai.alertas?.length ? `<p style="margin:0" class="down"><b>Ojo:</b> ${ai.alertas.map(esc).join(' · ')}</p>` : ''}
      ${ai.siguiente_paso ? `<p style="margin:0"><b>Siguiente paso:</b> ${esc(ai.siguiente_paso)}</p>` : ''}
    </div>` : ''}
  </div>`;
}

/* Aviso con enlace para enviar a mano cuando el canal no está conectado. */
function manualSendNotice(link, channel) {
  const label = channel === 'email' ? 'Abrir el email y enviar' : channel === 'sms' ? 'Abrir SMS y enviar' : 'Abrir WhatsApp y enviar';
  return `<div class="notice info" style="justify-content:space-between;flex-wrap:wrap">
    <span>Mensaje guardado. Como ${CHANNEL[channel] || 'este canal'} aún no está conectado, envíalo tú desde el móvil o WhatsApp Web.</span>
    <a class="btn small primary" href="${esc(link)}" target="_blank" rel="noopener">${label}</a></div>`;
}

/* Escribir a un cliente (desde la ficha) o a cualquier teléfono/email. */
function newMessageDialog(client = null) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog">
    <h2>Nuevo mensaje</h2>
    <div class="form-grid" style="grid-template-columns:minmax(0,1fr) 160px">
      ${client ? `<div class="field">Para<div class="input" style="display:flex;align-items:center">${esc(client.name)} <small class="muted" style="margin-left:8px">${esc(client.phone || client.email || '')}</small></div></div>`
        : `<label class="field">Para<div class="suggest"><input class="input" id="nmTo" placeholder="Nombre del cliente o teléfono" autocomplete="off"><div class="suggest-list hidden" id="nmSuggest"></div></div></label>`}
      <label class="field">Canal<select id="nmChannel"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></label>
    </div>
    <label class="field">Plantilla<select id="nmTpl"><option value="">Escribir desde cero</option></select></label>
    <label class="field">Mensaje<textarea id="nmText" required style="min-height:120px"></textarea></label>
    <div id="nmResult"></div>
    <p class="err down hidden" role="alert" style="margin:0;font-weight:600"></p>
    <div class="form-actions"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn primary" type="submit">Enviar</button></div>
  </form>`;
  document.body.appendChild(dlg);
  let target = client ? { client_id: client.id, name: client.name } : null;
  const err = (m) => { const p = $('.err', dlg); p.textContent = m; p.classList.toggle('hidden', !m); };
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  api('/api/templates').then((r) => {
    const sel = $('#nmTpl', dlg);
    sel.innerHTML += r.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    sel.onchange = () => {
      const t = r.templates.find((x) => String(x.id) === sel.value);
      if (!t) return;
      const name = (target?.name || '').split(' ')[0];
      $('#nmText', dlg).value = fillTemplate(t.body, { nombre: name, salon: S.me.salon?.name || S.me.salons.find((x) => x.id === S.salonId)?.name || '' });
      $('#nmText', dlg).dataset.kind = t.kind;
    };
  }).catch(() => {});
  if (!client) {
    let timer;
    $('#nmTo', dlg).oninput = (e) => {
      target = null;
      const q = e.target.value.trim();
      const list = $('#nmSuggest', dlg);
      clearTimeout(timer);
      if (q.replace(/\D/g, '').length >= 9) { target = { contact: q }; list.classList.add('hidden'); return; }
      if (q.length < 2) return list.classList.add('hidden');
      timer = setTimeout(async () => {
        const r = await api(`/api/clients?q=${encodeURIComponent(q)}`);
        list.innerHTML = r.clients.slice(0, 8).map((c) => `<button type="button" data-cid="${c.id}">${esc(c.name)} <small class="muted">${esc(c.phone || c.email || '')}</small></button>`).join('') || '<div class="empty">Sin resultados. Escribe un teléfono para enviar a un número nuevo.</div>';
        list.classList.remove('hidden');
        $$('[data-cid]', list).forEach((b) => (b.onclick = () => {
          const c = r.clients.find((x) => String(x.id) === b.dataset.cid);
          target = { client_id: c.id, name: c.name };
          $('#nmTo', dlg).value = c.name;
          list.classList.add('hidden');
        }));
      }, 200);
    };
  }
  $('form', dlg).addEventListener('submit', async (e) => {
    e.preventDefault();
    err('');
    if (!target) return err('Elige un cliente de la lista o escribe un teléfono.');
    const channel = $('#nmChannel', dlg).value;
    try {
      const r = await api('/api/conversations', { method: 'POST', body: { ...target, channel, text: $('#nmText', dlg).value, template: $('#nmText', dlg).dataset.kind || null } });
      if (r.link) {
        $('#nmResult', dlg).innerHTML = manualSendNotice(r.link, channel);
        $('button[type=submit]', dlg).remove();
        $('[data-cancel]', dlg).textContent = 'Ir a la conversación';
        $('[data-cancel]', dlg).onclick = () => { dlg.close(); go(`#/mensajes/${r.id}`); };
      } else {
        toast(r.status === 'error' ? `No se pudo enviar: ${r.error}` : 'Mensaje enviado', r.status === 'error');
        dlg.close();
        go(`#/mensajes/${r.id}`);
      }
    } catch (ex) { err(ex.message); }
  });
  dlg.showModal();
}

VIEWS.mensajes = async (main, { id, query }) => {
  const tab = query.get('tab') || 'chats';
  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow" id="msgEyebrow">&nbsp;</div><h1>Mensajes</h1></div>
    <div class="head-actions">
      <div class="seg" role="group" aria-label="Sección">
        ${[['chats', 'Conversaciones'], ['recordatorios', 'Recordatorios'], ['plantillas', 'Plantillas']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}
      </div>
      <button type="button" class="btn primary" id="newMsg">Nuevo mensaje</button>
    </div>
  </header>
  <div id="msgBody"><div class="loading">Cargando…</div></div>`;
  $$('[data-tab]', main).forEach((b) => (b.onclick = () => go(b.dataset.tab === 'chats' ? '#/mensajes' : `#/mensajes?tab=${b.dataset.tab}`)));
  $('#newMsg').onclick = () => newMessageDialog();
  const body = $('#msgBody');
  if (tab === 'recordatorios') return renderReminders(body);
  if (tab === 'plantillas') return renderTemplates(body);
  return renderInbox(body, id);
};

async function renderInbox(box, id) {
  S.convFilter = S.convFilter || 'abiertas';
  S.convQ = S.convQ || '';
  box.innerHTML = `<div class="inbox">
    <section class="card inbox-list" aria-label="Conversaciones">
      <input type="search" class="input" id="convQ" placeholder="Buscar por nombre, teléfono o texto" value="${esc(S.convQ)}" aria-label="Buscar conversación">
      <div class="chips" role="group" aria-label="Filtro" id="convFilters"></div>
      <div class="conv-list" id="convList"><div class="empty">Cargando…</div></div>
    </section>
    <section class="card inbox-thread" id="thread" aria-label="Conversación"><div class="empty">Elige una conversación.</div></section>
    <aside class="card inbox-side" id="side" aria-label="Cliente"></aside>
  </div>`;

  const loadList = async () => {
    const d = await api(`/api/conversations?filter=${S.convFilter}&q=${encodeURIComponent(S.convQ)}`);
    $('#msgEyebrow').textContent = `${fmt(d.counts.abiertas || 0)} abiertas · ${fmt(d.counts.unread || 0)} mensajes sin leer · WhatsApp ${d.channels.whatsapp === 'api' ? 'conectado' : 'en modo manual'}`;
    $('#convFilters').innerHTML = CONV_FILTERS.map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${S.convFilter === k}">${l}${d.counts[k] ? ` · ${d.counts[k]}` : ''}</button>`).join('');
    $$('#convFilters [data-f]').forEach((b) => (b.onclick = () => { S.convFilter = b.dataset.f; loadList(); }));
    $('#convList').innerHTML = d.conversations.length ? d.conversations.map((c) => {
      const name = c.client_name || c.contact_name || `+${c.contact}`;
      return `<button type="button" class="conv-row ${c.unread ? 'unread' : ''}" data-id="${c.id}" aria-pressed="${String(c.id) === String(id)}">
        <span class="avatar">${esc(initials(name))}</span>
        <span class="meta"><span class="top"><b>${esc(name)}</b><small>${fmtWhen(c.last_message_at)}</small></span>
          <span class="preview">${esc(c.last_preview)}</span>
          <span class="bottom"><span class="tag ${CHANNEL_TAG[c.channel]}">${CHANNEL[c.channel]}</span>${c.assigned_name ? `<small class="muted">${esc(c.assigned_name)}</small>` : ''}${c.unread ? `<span class="nav-badge">${c.unread}</span>` : ''}</span>
        </span></button>`;
    }).join('') : `<div class="empty">${S.convFilter === 'abiertas' ? 'No hay conversaciones abiertas. Los mensajes que te escriban por WhatsApp aparecerán aquí.' : 'Nada con este filtro.'}</div>`;
    $$('#convList [data-id]').forEach((b) => (b.onclick = () => go(`#/mensajes/${b.dataset.id}`)));
    if (!current && d.conversations[0]) loadThread(d.conversations[0].id);
  };

  let current = id ? Number(id) : null;
  let timer;
  $('#convQ').oninput = (e) => { S.convQ = e.target.value; clearTimeout(timer); timer = setTimeout(loadList, 250); };

  async function loadThread(cid, notice = '') {
    current = cid;
    const d = await api(`/api/conversations/${cid}`);
    const conv = d.conversation;
    const name = conv.client_name || conv.contact_name || `+${conv.contact}`;
    const mode = d.channels[conv.channel] || 'manual';
    const client = d.client;
    const vars = {
      nombre: name.split(' ')[0],
      salon: d.salonName,
      servicio: client?.topServices[0]?.name.toLowerCase() || 'servicio',
      dias: client?.stats.daysSinceLast ?? ''
    };
    let lastDay = '';
    const bubbles = d.messages.map((m) => {
      const day = toDate(m.created_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const sep = day !== lastDay ? `<div class="day-sep"><span>${esc(day)}</span></div>` : '';
      lastDay = day;
      const meta = [toDate(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), m.direction === 'out' ? MSG_STATUS[m.status] || m.status : '', m.author && m.direction === 'out' ? m.author : ''].filter(Boolean).join(' · ');
      return `${sep}<div class="bubble ${m.direction} ${m.status === 'error' ? 'failed' : ''}"><div>${esc(m.body)}</div><small>${esc(meta)}${m.error ? ` · ${esc(m.error)}` : ''}</small></div>`;
    }).join('');
    $('#thread').innerHTML = `
      <div class="thread-head">
        <div class="person"><span class="avatar">${esc(initials(name))}</span><div><b>${esc(name)}</b><small>${CHANNEL[conv.channel]} · ${conv.channel === 'email' ? esc(conv.contact) : `+${esc(conv.contact)}`}</small></div></div>
        <div class="head-actions">
          <select class="input small-select" id="convStatus" aria-label="Estado">${[['abierta', 'Abierta'], ['pendiente', 'Pendiente'], ['cerrada', 'Cerrada']].map(([v, l]) => `<option value="${v}" ${conv.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select class="input small-select" id="convAssign" aria-label="Asignada a"><option value="">Sin asignar</option>${d.employees.map((e) => `<option value="${e.id}" ${e.id === conv.assigned_to ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="messages" id="msgs">${bubbles || '<div class="empty">Sin mensajes todavía.</div>'}</div>
      <form class="composer" id="composer">
        ${notice}
        ${mode === 'api' && conv.channel === 'whatsapp' && !d.windowOpen ? '<div class="notice info">Han pasado más de 24 h desde su último mensaje: WhatsApp solo deja enviar plantillas aprobadas por Meta. Si falla, te daremos un enlace para enviarlo desde el móvil.</div>' : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select class="input small-select" id="tplPick" aria-label="Plantilla"><option value="">Plantillas…</option>${d.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
          <span class="muted" style="font-size:12px;align-self:center">${mode === 'api' ? `Se envía por ${CHANNEL[conv.channel]} al momento.` : `Modo manual: se guarda aquí y te damos un enlace para enviarlo.`}</span>
        </div>
        <div class="composer-row">
          <textarea class="input" id="msgText" placeholder="Escribe una respuesta…" aria-label="Mensaje" rows="2"></textarea>
          <button class="btn primary" type="submit">Enviar</button>
        </div>
      </form>`;
    const msgs = $('#msgs');
    msgs.scrollTop = msgs.scrollHeight;
    $('#convStatus').onchange = async (e) => { await api(`/api/conversations/${cid}`, { method: 'PUT', body: { status: e.target.value } }); toast('Estado actualizado'); loadList(); };
    $('#convAssign').onchange = async (e) => { await api(`/api/conversations/${cid}`, { method: 'PUT', body: { assigned_to: e.target.value || null } }); toast('Conversación asignada'); };
    let kind = null;
    $('#tplPick').onchange = (e) => {
      const t = d.templates.find((x) => String(x.id) === e.target.value);
      if (!t) return;
      $('#msgText').value = fillTemplate(t.body, vars);
      kind = t.kind;
      $('#msgText').focus();
    };
    $('#msgText').onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#composer').requestSubmit(); };
    $('#composer').onsubmit = async (e) => {
      e.preventDefault();
      const text = $('#msgText').value.trim();
      if (!text) return;
      try {
        const r = await api(`/api/conversations/${cid}/messages`, { method: 'POST', body: { text, template: kind } });
        if (r.status === 'error' && !r.link) toast(`No se pudo enviar: ${r.error}`, true);
        await loadThread(cid, r.link ? manualSendNotice(r.link, conv.channel) : '');
        loadList();
      } catch (err) { toast(err.message, true); }
    };

    const side = $('#side');
    if (!client) {
      side.innerHTML = `<h2>Sin ficha de cliente</h2><p class="muted" style="margin:0;font-size:14px">Este número aún no está en tus clientes.</p><button type="button" class="btn" id="mkClient">Crear ficha con este contacto</button>`;
      $('#mkClient').onclick = async () => {
        const r = await api('/api/clients', { method: 'POST', body: { name: conv.contact_name || `+${conv.contact}`, phone: conv.channel === 'email' ? '' : conv.contact, email: conv.channel === 'email' ? conv.contact : '' } });
        await api(`/api/conversations/${cid}`, { method: 'PUT', body: { client_id: r.id } });
        toast('Ficha creada');
        loadThread(cid);
      };
    } else {
      const st = client.stats;
      side.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>${esc(client.client.name)}</h2><span class="tag ${STATE_TAG[client.state] || ''}">${esc(client.state)}</span></div>
        <div>
          <div class="kv"><span>Visitas</span><span>${fmt(st.visits)}</span></div>
          <div class="kv"><span>Última visita</span><span>${st.lastVisit ? fdate(st.lastVisit) : '—'}</span></div>
          <div class="kv"><span>Próxima estimada</span><span class="${st.nextVisitOverdue ? 'down' : ''}">${st.nextVisit ? fdate(st.nextVisit) : '—'}</span></div>
          <div class="kv"><span>Ticket medio</span><span>${eur(st.avgTicket, 2)}</span></div>
          <div class="kv"><span>Top servicio</span><span>${esc(client.topServices[0]?.name || '—')}</span></div>
        </div>
        <div class="block-title" style="margin-top:4px">Lo que sabemos</div>
        ${insightsBlock(d.insights)}
        ${client.client.notes ? `<div class="notes" style="padding:12px 14px"><h3>Notas técnicas</h3><div style="font-size:13px;white-space:pre-line">${esc(client.client.notes)}</div></div>` : ''}
        <div class="head-actions"><a class="btn small" href="#/clientes/${client.client.id}">Ver ficha</a><a class="btn small dark" href="#/cobro?cliente=${client.client.id}">Nuevo cobro</a></div>`;
    }
    $$('#convList [data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === String(cid))));
    refreshUnread();
  }

  await loadList();
  if (id) await loadThread(Number(id)).catch((e) => { $('#thread').innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; });
}
const CONV_FILTERS = [['abiertas', 'Abiertas'], ['sin_leer', 'Sin leer'], ['pendientes', 'Pendientes'], ['cerradas', 'Cerradas'], ['todas', 'Todas']];

async function renderReminders(box) {
  const d = await api('/api/reminders');
  const total = d.groups.reduce((a, g) => a + g.items.length, 0);
  $('#msgEyebrow').textContent = `${total} clientes a los que conviene escribir hoy`;
  box.innerHTML = `
    <div class="notice ${d.channels.whatsapp === 'api' ? '' : 'info'}" style="margin-bottom:16px">${d.channels.whatsapp === 'api'
      ? 'WhatsApp Business conectado: los recordatorios salen al momento.'
      : 'Modo manual: al enviar, los mensajes quedan registrados y te damos un botón por cliente para abrirlos en WhatsApp. Conecta WhatsApp Business en Ajustes para que salgan solos.'}</div>
    <div class="grid g2" id="remGroups">${d.groups.map((g, gi) => `<section class="card" data-group="${gi}">
      <div class="card-head"><h2>${esc(g.title)} <span class="muted" style="font-weight:500">· ${g.items.length}</span></h2>
        ${g.items.length ? `<button type="button" class="btn small primary" data-send="${gi}">Enviar seleccionados</button>` : ''}</div>
      <p class="muted" style="margin:0;font-size:13px">${esc(g.description)}</p>
      <div class="rem-list">${g.items.length ? g.items.map((it, ii) => `<label class="rem-item">
        <input type="checkbox" checked data-item="${ii}">
        <span><b>${esc(it.name)}</b> <small class="muted">· ${esc(it.reason)}</small><br><span class="rem-text">${esc(it.text)}</span></span>
      </label>`).join('') : '<div class="empty">Nadie por ahora.</div>'}</div>
      <div class="rem-result"></div>
    </section>`).join('')}</div>`;
  $$('[data-send]', box).forEach((btn) => (btn.onclick = async () => {
    const gi = Number(btn.dataset.send);
    const g = d.groups[gi];
    const card = $(`[data-group="${gi}"]`, box);
    const items = $$('[data-item]', card).filter((c) => c.checked).map((c) => g.items[Number(c.dataset.item)]).map((it) => ({ client_id: it.client_id, text: it.text, kind: g.kind }));
    if (!items.length) return toast('Marca al menos un cliente', true);
    btn.disabled = true;
    try {
      const r = await api('/api/reminders/send', { method: 'POST', body: { items } });
      const manual = r.results.filter((x) => x.link);
      const ok = r.results.filter((x) => x.status === 'enviado').length;
      $('.rem-list', card).innerHTML = '';
      $('.rem-result', card).innerHTML = `${ok ? `<div class="notice">${ok} enviados por WhatsApp.</div>` : ''}
        ${manual.length ? `<div class="notice info">Ábrelos uno a uno y pulsa enviar en WhatsApp:</div>${manual.map((x) => `<div class="kv"><span>${esc(x.name)}</span><a class="btn small" href="${esc(x.link)}" target="_blank" rel="noopener">Abrir WhatsApp</a></div>`).join('')}` : ''}`;
      btn.remove();
      refreshUnread();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  }));
}

async function renderTemplates(box) {
  const d = await api('/api/templates');
  $('#msgEyebrow').textContent = `${d.templates.length} plantillas · usa {nombre}, {salon}, {servicio}, {dias} y {fecha}`;
  box.innerHTML = `<section class="card">
    <div class="card-head"><h2>Plantillas de mensajes</h2><button type="button" class="btn small primary" id="newTpl">Nueva plantilla</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Uso</th><th>Texto</th><th></th></tr></thead>
    <tbody>${d.templates.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td><span class="tag">${esc((TEMPLATE_KINDS.find(([k]) => k === t.kind) || [, t.kind])[1])}</span></td><td style="min-width:280px">${esc(t.body)}</td>
      <td class="r"><button type="button" class="btn small" data-edit="${t.id}">Editar</button> <button type="button" class="icon-btn" data-del="${t.id}" aria-label="Borrar plantilla">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>
  </section>`;
  const form = (t = null) => openForm({
    title: t ? 'Editar plantilla' : 'Nueva plantilla',
    fields: [
      { name: 'name', label: 'Nombre', value: t?.name, required: true },
      { name: 'kind', label: 'Uso', type: 'select', value: t?.kind || 'otro', options: TEMPLATE_KINDS },
      { name: 'body', label: 'Texto', type: 'textarea', value: t?.body, required: true, full: true, hint: 'Variables: {nombre}, {salon}, {servicio}, {dias}, {fecha}' }
    ],
    onSubmit: async (v) => { await api(t ? `/api/templates/${t.id}` : '/api/templates', { method: t ? 'PUT' : 'POST', body: v }); toast('Plantilla guardada'); renderTemplates(box); }
  });
  $('#newTpl').onclick = () => form();
  $$('[data-edit]', box).forEach((b) => (b.onclick = () => form(d.templates.find((t) => String(t.id) === b.dataset.edit))));
  $$('[data-del]', box).forEach((b) => (b.onclick = async () => {
    if (!(await confirmAction('¿Borrar esta plantilla?', 'Borrar'))) return;
    await api(`/api/templates/${b.dataset.del}`, { method: 'DELETE', body: {} });
    renderTemplates(box);
  }));
}

/* ---------- Primeros pasos (salones en prueba) ---------- */
function onboardingCard(o) {
  if (!o || o.done >= o.total) return '';
  return `<section class="card onboarding" aria-label="Primeros pasos">
    <div class="card-head"><h2>Primeros pasos · ${o.done} de ${o.total}</h2><span class="muted">En una tarde lo tienes funcionando</span></div>
    <div class="bar"><div style="width:${Math.round((o.done / o.total) * 100)}%"></div></div>
    <div class="steps">${o.steps.map((s) => `<div class="step ${s.done ? 'done' : ''}">
      <span class="check" aria-hidden="true">${s.done ? '✓' : ''}</span>
      <span class="txt"><b>${esc(s.label)}</b><small>${esc(s.hint)}</small></span>
      ${s.done ? '<span class="tag green">Hecho</span>' : s.action === 'starter' ? '<button type="button" class="btn small primary" data-starter>Cargar menú típico</button>' : `<a class="btn small" href="${s.href}">Empezar</a>`}
    </div>`).join('')}</div>
  </section>`;
}

/* Canales de comunicación del salón (Ajustes). */
async function renderChannels(box) {
  const c = await api('/api/channels');
  const webhook = `${location.origin}/api/webhooks/whatsapp`;
  box.innerHTML = `
    <div class="card-head"><h2>Canales de comunicación</h2><span class="muted">Para recibir y enviar mensajes desde «Mensajes»</span></div>
    <div class="grid g2">
      <form id="waForm" class="channel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>WhatsApp Business</h3><span class="tag ${c.status.whatsapp === 'api' ? 'green' : 'amber'}">${c.status.whatsapp === 'api' ? 'Conectado' : 'Modo manual'}</span></div>
        <p class="muted" style="margin:0;font-size:13px">Con la API de WhatsApp Business (Meta), los mensajes de tus clientes llegan aquí solos y las respuestas y recordatorios salen al momento. Sin conectar, funciona en modo manual: se registra todo y se abre WhatsApp para enviar.</p>
        <label class="field">Número de WhatsApp del salón<input name="wa_number" value="${esc(c.wa_number || '')}" placeholder="+34 600 000 000"></label>
        <label class="field">Phone number ID (de Meta)<input name="wa_phone_number_id" value="${esc(c.wa_phone_number_id || '')}" autocomplete="off"></label>
        <label class="field">Token de acceso<input name="wa_token" type="password" autocomplete="off" placeholder="${c.wa_token_set ? 'Guardado · escribe uno nuevo para cambiarlo' : 'Pega aquí el token permanente'}"></label>
        <div class="field">URL del webhook (configúrala en Meta)<code class="key">${esc(webhook)}</code>
          <span class="hint">${c.webhookReady ? 'El token de verificación te lo da tu proveedor de SalonPro.' : 'Falta configurar WA_VERIFY_TOKEN en el servidor para activar la recepción.'}</span></div>
        <div class="form-actions">${c.status.whatsapp === 'api' ? '<button type="button" class="btn small danger" id="waOff">Desconectar</button>' : ''}<button class="btn primary" type="submit">Guardar WhatsApp</button></div>
      </form>
      <form id="emailForm" class="channel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>Email</h3><span class="tag ${c.status.email === 'api' ? 'green' : 'amber'}">${c.status.email === 'api' ? 'Conectado' : 'Modo manual'}</span></div>
        <p class="muted" style="margin:0;font-size:13px">Envío de emails con Resend (resend.com). Sin conectar, se abre tu programa de correo con el mensaje escrito.</p>
        <label class="field">Remitente<input name="email_from" value="${esc(c.email_from || '')}" placeholder="Salón <hola@tusalon.es>"></label>
        <label class="field">Clave de API de Resend<input name="email_api_key" type="password" autocomplete="off" placeholder="${c.email_key_set ? 'Guardada · escribe una nueva para cambiarla' : 're_…'}"></label>
        <div class="form-actions">${c.status.email === 'api' ? '<button type="button" class="btn small danger" id="emOff">Desconectar</button>' : ''}<button class="btn primary" type="submit">Guardar email</button></div>
      </form>
    </div>`;
  const save = async (body) => {
    try { await api('/api/channels', { method: 'PUT', body: { wa_number: c.wa_number, wa_phone_number_id: c.wa_phone_number_id, email_from: c.email_from, ...body } }); toast('Canales guardados'); renderChannels(box); }
    catch (err) { toast(err.message, true); }
  };
  $('#waForm').onsubmit = (e) => { e.preventDefault(); const f = e.target; save({ wa_number: f.wa_number.value, wa_phone_number_id: f.wa_phone_number_id.value, wa_token: f.wa_token.value }); };
  $('#emailForm').onsubmit = (e) => { e.preventDefault(); const f = e.target; save({ email_from: f.email_from.value, email_api_key: f.email_api_key.value }); };
  const waOff = $('#waOff');
  if (waOff) waOff.onclick = () => save({ clear_wa: true });
  const emOff = $('#emOff');
  if (emOff) emOff.onclick = () => save({ clear_email: true });
}

/* Alta de un salón (opcionalmente desde una solicitud de prueba). */
function salonForm(lead = null) {
  openForm({
    title: lead ? `Dar de alta: ${lead.salon_name || lead.name}` : 'Dar de alta un salón',
    intro: 'Se crea el salón y el acceso del dueño. Envíale su email y contraseña: podrá cambiarla en Ajustes.',
    fields: [
      { name: 'name', label: 'Nombre del salón', required: true, value: lead?.salon_name || '' },
      { name: 'city', label: 'Ciudad', value: lead?.city || '' },
      { name: 'plan', label: 'Plan', value: lead ? 'Prueba' : 'Base' },
      { name: 'monthly_fee', label: 'Cuota mensual (€)', type: 'money', value: lead ? '0' : '49', hint: lead ? 'Durante la prueba, 0 €' : '' },
      { name: 'owner_name', label: 'Nombre del dueño', value: lead?.name || '' },
      { name: 'owner_email', label: 'Email del dueño', type: 'email', required: true, autocomplete: 'off', value: lead?.email || '' },
      { name: 'owner_password', label: 'Contraseña inicial', type: 'text', required: true, hint: 'Mínimo 8 caracteres', autocomplete: 'off', value: lead ? `Prueba-${Math.random().toString(36).slice(2, 8)}` : '' }
    ],
    submit: 'Crear salón',
    onSubmit: async (v) => {
      const r = await api('/api/admin/salons', { method: 'POST', body: { ...v, lead_id: lead?.id } });
      S.me = null;
      toast(`Salón creado. Acceso: ${v.owner_email} · ${v.owner_password}`);
      S.salonId = r.id;
      store.set('salonId', r.id);
      if (location.hash === '#/panel') render(); else go('#/panel');
    }
  });
}

const LEAD_STATUS = [['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['en prueba', 'En prueba'], ['cliente', 'Cliente'], ['descartado', 'Descartado']];
async function renderLeads(box) {
  const { leads } = await api('/api/admin/leads');
  const fresh = leads.filter((l) => l.status === 'nuevo').length;
  box.innerHTML = `
    <div class="card-head"><h2>Solicitudes de prueba${fresh ? ` <span class="tag solid">${fresh} nuevas</span>` : ''}</h2><span class="muted">Llegan desde la web comercial</span></div>
    ${leads.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Contacto</th><th>Salón</th><th>Equipo</th><th>Mensaje</th><th>Estado</th><th></th></tr></thead>
    <tbody>${leads.map((l) => `<tr>
      <td class="muted" style="white-space:nowrap">${fdate(l.created_at.slice(0, 10))}</td>
      <td><b>${esc(l.name)}</b><br><small class="muted">${esc([l.email, l.phone].filter(Boolean).join(' · '))}</small></td>
      <td>${esc(l.salon_name || '—')}<br><small class="muted">${esc(l.city || '')}</small></td>
      <td>${esc(l.team_size || '—')}</td>
      <td style="min-width:200px;font-size:13px">${esc(l.message || '')}</td>
      <td><select class="input small-select" data-lead="${l.id}" aria-label="Estado de ${esc(l.name)}">${LEAD_STATUS.map(([v, t]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td class="r">${l.status === 'nuevo' || l.status === 'contactado' ? `<button type="button" class="btn small primary" data-onboard="${l.id}">Dar de alta</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Aún no hay solicitudes. Comparte tu web comercial para recibirlas aquí.</div>'}`;
  $$('[data-lead]', box).forEach((sel) => (sel.onchange = async () => { await api(`/api/admin/leads/${sel.dataset.lead}`, { method: 'PUT', body: { status: sel.value } }); toast('Solicitud actualizada'); }));
  $$('[data-onboard]', box).forEach((b) => (b.onclick = () => salonForm(leads.find((l) => String(l.id) === b.dataset.onboard))));
}

/* ---------- Tiempos reales y rentabilidad ---------- */
const eurMin = (v) => (v == null ? '—' : `${fmt(v, 2)} €/min`);
const SOURCE_LABEL = { cronometro: 'cronómetro', tpv: 'TPV', csv: 'importación', api: 'integración', manual: 'horas tecleadas', otro: 'otros' };

function periodControls(current, ref) {
  return `<div class="seg" role="group" aria-label="Periodo">
      ${[['month', 'Mes'], ['quarter', 'Trimestre'], ['year', 'Año']].map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${current === k}">${l}</button>`).join('')}
    </div>
    <input class="input" type="month" id="refMonth" value="${ref}" max="${S.me.today.slice(0, 7)}" aria-label="Mes de referencia" style="width:170px">`;
}
function bindPeriod(main) {
  $$('[data-period]', main).forEach((b) => (b.onclick = () => { S.period = b.dataset.period; render(); }));
  $('#refMonth', main).onchange = (e) => { if (e.target.value) { S.ref = e.target.value; render(); } };
}
const verdictTag = (s) => (s.profitable == null ? '<span class="tag">Sin datos</span>' : s.profitable ? '<span class="tag green">Rentable</span>' : '<span class="tag red">No rentable</span>');
const devCell = (v) => (v == null ? '—' : `<span class="${v > 10 ? 'down' : v < -5 ? 'up' : ''}">${v > 0 ? '+' : ''}${fmt(v)} %</span>`);

function serviceTable(services) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Servicio</th><th class="r">Veces</th><th class="r">Precio menú</th><th class="r">Precio medio</th><th class="r">Min. menú</th><th class="r">Min. reales</th><th class="r">Desviación</th><th class="r">€/min menú</th><th class="r">€/min real</th><th class="r">€/hora real</th><th>Resultado</th></tr></thead>
    <tbody>${services.length ? services.map((s) => `<tr>
      <td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.category || '')}${s.measuredUnits < s.units ? ` · ${fmt(s.measuredUnits)} de ${fmt(s.units)} medidos` : ''}</small></td>
      <td class="r num">${fmt(s.units)}</td><td class="r num">${eur(s.menuPrice, 2)}</td><td class="r num">${eur(s.avgPrice, 2)}</td>
      <td class="r num">${s.menuMinutes ? `${fmt(s.menuMinutes)} min` : '—'}</td>
      <td class="r num"><b>${s.realMinutes == null ? '—' : `${fmt(s.realMinutes)} min`}</b></td>
      <td class="r num">${devCell(s.deviationPct)}</td>
      <td class="r num">${s.perMinMenu == null ? '—' : fmt(s.perMinMenu, 2)}</td>
      <td class="r num"><b>${s.perMinReal == null ? '—' : fmt(s.perMinReal, 2)}</b></td>
      <td class="r num">${eur(s.perHourReal, 2)}</td>
      <td>${verdictTag(s)}</td></tr>`).join('') : '<tr><td colspan="11" class="empty">Sin servicios en este periodo.</td></tr>'}</tbody></table></div>`;
}

function profitabilityPanel(t) {
  const good = t.services.filter((s) => s.profitable === true).sort((a, b) => (b.perMinReal ?? b.perMinMenu) - (a.perMinReal ?? a.perMinMenu));
  const bad = t.services.filter((s) => s.profitable === false).sort((a, b) => (a.perMinReal ?? a.perMinMenu) - (b.perMinReal ?? b.perMinMenu));
  const pm = (s) => s.perMinReal ?? s.perMinMenu;
  const mins = (s) => s.realMinutes ?? s.menuMinutes;
  return `<section class="grid g2" aria-label="Rentabilidad de los servicios">
    <div class="card">
      <div class="card-head"><h2>No rentables · ${bad.length}</h2><span class="muted">Por debajo de ${fmt(t.threshold, 2)} €/min</span></div>
      ${bad.length ? bad.map((s) => `<div class="profit-row bad">
        <div><b>${esc(s.name)}</b><small>${fmt(pm(s), 2)} €/min · ${fmt(mins(s))} min ${s.basedOn === 'real' ? 'reales' : 'de menú (sin medir)'} · ${fmt(s.units)} veces</small></div>
        <div class="fix">Subir a <b>${eur(s.minPrice)}</b>${s.avgPrice ? `<small>o hacerlo en ${fmt(s.avgPrice / t.threshold)} min</small>` : ''}</div>
      </div>`).join('') : '<div class="empty">Todos los servicios llegan al mínimo.</div>'}
    </div>
    <div class="card">
      <div class="card-head"><h2>Rentables · ${good.length}</h2><span class="muted">${fmt(t.threshold, 2)} €/min o más</span></div>
      ${good.length ? good.map((s) => `<div class="profit-row good">
        <div><b>${esc(s.name)}</b><small>${fmt(mins(s))} min ${s.basedOn === 'real' ? 'reales' : 'de menú'} · ${fmt(s.units)} veces</small></div>
        <div class="fix"><b>${fmt(pm(s), 2)} €/min</b><small>${eur(pm(s) * 60, 0)}/hora</small></div>
      </div>`).join('') : '<div class="empty">Ningún servicio llega al mínimo todavía.</div>'}
    </div>
  </section>`;
}

VIEWS.tiempos = async (main) => {
  const d = await api(`/api/service-times?period=${S.period}&ref=${S.ref}`);
  const sm = d.summary;
  const sources = Object.entries(sm.sources).map(([k, v]) => `${SOURCE_LABEL[k] || k} ${fmt(v)}`).join(' · ');
  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow">${esc(d.label)} · rentable a partir de ${fmt(d.threshold, 2)} €/min</div><h1>Tiempos y rentabilidad</h1></div>
    <div class="head-actions">${periodControls(S.period, S.ref)}</div>
  </header>
  <section class="grid g4">
    <div class="kpi"><span class="k">Precio por minuto real</span><span class="v ${sm.perMinReal != null && sm.perMinReal < d.threshold ? 'down' : ''}">${eurMin(sm.perMinReal)}</span><span class="d">Lo cobrado en servicios / minutos reales</span></div>
    <div class="kpi"><span class="k">Tiempo real frente al menú</span><span class="v">${sm.deviationPct == null ? '—' : `${sm.deviationPct > 0 ? '+' : ''}${fmt(sm.deviationPct)} %`}</span><span class="d">${sm.deviationPct == null ? 'Sin mediciones' : sm.deviationPct > 0 ? 'Se tarda más de lo previsto' : 'Se tarda menos de lo previsto'}</span></div>
    <div class="kpi"><span class="k">Servicios medidos</span><span class="v">${fmt(sm.measuredShare * 100)} %</span><span class="d">${fmt(sm.measuredUnits)} de ${fmt(sm.units)}${sources ? ` · ${esc(sources)}` : ''}</span></div>
    <div class="kpi"><span class="k">Servicios no rentables</span><span class="v ${sm.unprofitableCount ? 'down' : 'up'}">${fmt(sm.unprofitableCount)}</span><span class="d">${fmt(sm.unprofitableRevenueShare * 100)} % de la facturación en servicios</span></div>
  </section>
  ${sm.measuredShare < 0.5 ? `<div class="notice info">Solo el ${fmt(sm.measuredShare * 100)} % de los servicios tiene tiempo medido. Para medirlo siempre: en «Nuevo cobro» pulsa «Empezar servicio» al empezar y cobra al terminar, o importa del TPV la hora de inicio y fin. Mientras tanto, la rentabilidad usa la duración del menú.</div>` : ''}
  ${profitabilityPanel(d)}
  <section class="card">
    <div class="card-head"><h2>Precio y tiempo de cada servicio</h2><span class="muted">Menú = lo previsto · Real = medido en el salón</span></div>
    ${serviceTable(d.services)}
  </section>
  <section class="card">
    <div class="card-head"><h2>Tiempo real por empleado</h2><span class="muted">Comparado con la duración del menú de los servicios que hace</span></div>
    <div class="table-wrap"><table><thead><tr><th>Empleado</th><th class="r">Servicios medidos</th><th class="r">Min. reales por servicio</th><th class="r">Frente al menú</th><th class="r">€/min real</th></tr></thead>
    <tbody>${d.team.length ? d.team.map((e) => `<tr><td><div class="person"><span class="avatar">${esc(initials(e.name))}</span><b>${esc(e.name)}</b></div></td>
      <td class="r num">${fmt(e.units)}</td><td class="r num">${e.realPerService == null ? '—' : `${fmt(e.realPerService)} min`}</td><td class="r num">${devCell(e.deviationPct)}</td>
      <td class="r num"><b class="${e.perMinReal != null && e.perMinReal < d.threshold ? 'down' : ''}">${e.perMinReal == null ? '—' : fmt(e.perMinReal, 2)}</b></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Sin servicios medidos.</td></tr>'}</tbody></table></div>
  </section>`;
  bindPeriod(main);
};

/* ---------- Reporte del salón (distribuidor) ---------- */
async function saveFile(blob, filename) {
  try {
    const dl = await window.claude?.use?.('downloads');
    if (dl) {
      await dl.save({ filename, data: blob });
      return true;
    }
  } catch (err) {
    if (err?.code === 'declined') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

VIEWS.reporte = async (main) => {
  if (!isAdmin()) return go('#/panel');
  const q = `salon=${S.salonId}&period=${S.period}&ref=${S.ref}`;
  const r = await api(`/api/admin/report?${q}`);
  const s = r.summary;
  const t = r.times;
  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow">Reporte para el distribuidor · ${esc(r.label)}</div><h1>${esc(r.salon.name)}</h1></div>
    <div class="head-actions no-print">${periodControls(S.period, S.ref)}
      <button type="button" class="btn primary" id="dlXlsx">Descargar Excel</button>
      <button type="button" class="btn" id="printReport">Imprimir</button>
    </div>
  </header>
  <section class="card no-print threshold">
    <form id="thrForm" class="threshold-form">
      <label class="field" style="flex-direction:row;align-items:center;gap:10px">Rentable a partir de
        <input class="input" name="thr" inputmode="decimal" value="${fmt(t.threshold, 2)}" style="width:90px;text-align:right" aria-label="Euros por minuto"> €/min
      </label>
      <button class="btn small" type="submit">Guardar</button>
      <span class="muted" style="font-size:13px">Se aplica a este salón en el reporte y en «Tiempos y rentabilidad».</span>
    </form>
  </section>
  <section class="grid g4" aria-label="Resumen">
    <div class="kpi"><span class="k">Empleados que trabajan</span><span class="v">${fmt(s.employees)}</span><span class="d">${fmt(s.hours)} h trabajadas${s.hoursEstimated ? ' (estimadas)' : ''}</span></div>
    <div class="kpi"><span class="k">Precio hora del salón</span><span class="v">${s.hourlyRate == null ? '—' : `${fmt(s.hourlyRate, 2)} €/h`}</span><span class="d">Facturación ${eur(s.revenue)}</span></div>
    <div class="kpi"><span class="k">Ticket medio general</span><span class="v">${eur(s.avgTicket, 2)}</span><span class="d">${fmt(s.visits)} visitas · ${fmt(s.clients)} clientes</span></div>
    <div class="kpi"><span class="k">Precio por minuto real</span><span class="v ${t.summary.perMinReal != null && t.summary.perMinReal < t.threshold ? 'down' : 'up'}">${eurMin(t.summary.perMinReal)}</span><span class="d">Mínimo ${fmt(t.threshold, 2)} €/min</span></div>
  </section>
  <section class="grid g2">
    <div class="card"><div class="block-title">Mujer</div>
      <div class="kv"><span>Servicios de mujer</span><span>${fmt(s.servicesWomen)}</span></div>
      <div class="kv"><span>Ticket medio de mujer</span><span>${eur(r.gender.women.avgTicket, 2)}</span></div>
      <div class="kv"><span>Tickets</span><span>${fmt(r.gender.women.tickets)}</span></div>
      <div class="kv"><span>Facturación</span><span>${eur(r.gender.women.revenue)}</span></div>
    </div>
    <div class="card"><div class="block-title">Hombre</div>
      <div class="kv"><span>Servicios de hombre</span><span>${fmt(s.servicesMen)}</span></div>
      <div class="kv"><span>Ticket medio de hombre</span><span>${eur(r.gender.men.avgTicket, 2)}</span></div>
      <div class="kv"><span>Tickets</span><span>${fmt(r.gender.men.tickets)}</span></div>
      <div class="kv"><span>Facturación</span><span>${eur(r.gender.men.revenue)}</span></div>
    </div>
  </section>
  <section class="card">
    <h2>Equipo</h2>
    <div class="table-wrap"><table><thead><tr><th>Empleado</th><th class="r">Horas</th><th class="r">Servicios</th><th class="r">Visitas</th><th class="r">Ticket medio</th><th class="r">Facturación</th><th class="r">€/hora</th><th class="r">Min. reales/serv.</th><th class="r">Frente al menú</th></tr></thead>
    <tbody>${r.team.map((e) => `<tr><td><b>${esc(e.name)}</b><br><small class="muted">${esc(e.role || '')}</small></td>
      <td class="r num">${fmt(e.hours)}${e.hoursEstimated ? '<small class="muted"> est.</small>' : ''}</td><td class="r num">${fmt(e.services)}</td><td class="r num">${fmt(e.visits)}</td>
      <td class="r num"><b>${eur(e.avgTicket, 2)}</b></td><td class="r num">${eur(e.revenue)}</td><td class="r num">${eur(e.hourlyRate, 2)}</td>
      <td class="r num">${e.realPerService == null ? '—' : `${fmt(e.realPerService)} min`}</td><td class="r num">${devCell(e.timeDeviationPct)}</td></tr>`).join('')}</tbody></table></div>
  </section>
  ${profitabilityPanel(t)}
  <section class="card">
    <div class="card-head"><h2>Precios y tiempos de los servicios trabajados</h2><span class="muted">${fmt(t.summary.measuredShare * 100)} % con tiempo medido</span></div>
    ${serviceTable(t.services)}
  </section>
  <p class="muted print-only" style="font-size:12px">Generado por SalonPro el ${fdate(r.generatedAt.slice(0, 10))}.</p>`;
  bindPeriod(main);
  $('#printReport').onclick = () => window.print();
  $('#dlXlsx').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/admin/report.xlsx?${q}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo generar el reporte');
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'reporte.xlsx';
      if (await saveFile(await res.blob(), name)) toast('Reporte descargado');
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  };
  $('#thrForm').onsubmit = async (e) => {
    e.preventDefault();
    const v = parseNum(e.target.thr.value);
    if (!(v > 0)) return toast('Escribe un precio por minuto válido, por ejemplo 0,85', true);
    try { await api(`/api/admin/salons/${S.salonId}`, { method: 'PUT', body: { min_price_minute: v } }); toast('Mínimo guardado'); render(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Agenda ---------- */
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const APPT_STATUS = { pendiente: ['Pendiente', 'amber'], confirmada: ['Confirmada', 'green'], en_curso: ['En curso', 'plum'], completada: ['Completada', ''], cancelada: ['Cancelada', 'red'], no_presentada: ['No vino', 'red'] };
const SOURCE_NAME = { salon: 'Salón', web: 'Reserva online', booksy: 'Booksy', treatwell: 'Treatwell', fresha: 'Fresha', ical: 'Calendario', api: 'Integración' };
const LANE_COLORS = ['#EFE4EA', '#E2EBF4', '#E3F0E7', '#F6EBD9', '#EDE7F6', '#FCE4EC'];
const LANE_BORDER = ['#6E2A4E', '#2B5C8A', '#2E6B45', '#B7792B', '#5E4B8B', '#A8436A'];
const hmToMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const minToHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isoAdd = (date, n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (date) => { const wd = new Date(`${date}T12:00:00Z`).getUTCDay(); return isoAdd(date, wd === 0 ? -6 : 1 - wd); };
const dayLabel = (date) => { const d = new Date(`${date}T12:00:00Z`); return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const salonNameNow = () => S.me.salon?.name || S.me.salons?.find((x) => x.id === S.salonId)?.name || '';
const bookingUrl = (slug) => `${location.origin}/reservar/${slug}`;

VIEWS.agenda = async (main) => {
  S.agendaWeek = S.agendaWeek || mondayOf(S.me.today);
  const d = await api(`/api/agenda?from=${S.agendaWeek}&days=7`);
  const empFilter = S.agendaEmp || '';
  const emps = d.employees.filter((e) => !empFilter || String(e.id) === String(empFilter));
  const laneOf = new Map(d.employees.map((e, i) => [e.id, i]));
  const visible = d.appointments.filter((a) => a.status !== 'cancelada' && (!empFilter || String(a.employee_id) === String(empFilter)));
  const pending = d.appointments.filter((a) => a.status === 'pendiente');
  const days = Array.from({ length: 7 }, (_, i) => isoAdd(d.from, i)).filter((day) => d.schedule[new Date(`${day}T12:00:00Z`).getUTCDay()] || visible.some((a) => a.date === day));
  const hoursOf = (day) => d.schedule[new Date(`${day}T12:00:00Z`).getUTCDay()];
  const opens = days.map((day) => hoursOf(day)).filter(Boolean);
  const startMin = Math.min(...opens.map((h) => hmToMin(h[0])), ...visible.map((a) => hmToMin(a.start)), 9 * 60);
  const endMin = Math.max(...opens.map((h) => hmToMin(h[1])), ...visible.map((a) => hmToMin(a.end)), 14 * 60);
  const PX = 1.3;
  const lanes = Math.max(1, emps.length);
  const block = (a) => {
    const lane = empFilter ? 0 : (laneOf.get(a.employee_id) ?? 0);
    const color = laneOf.get(a.employee_id) ?? 0;
    const top = (hmToMin(a.start) - startMin) * PX;
    const h = Math.max(18, (hmToMin(a.end) - hmToMin(a.start)) * PX - 2);
    return `<button type="button" class="appt st-${a.status}" data-appt="${a.id}" style="top:${top}px;height:${h}px;left:calc(${(lane / lanes) * 100}% + 2px);width:calc(${100 / lanes}% - 4px);background:${LANE_COLORS[color % 6]};border-left-color:${LANE_BORDER[color % 6]}" aria-label="${esc(`${a.start} ${a.client_name || 'Cita'}: ${a.services.map((s) => s.name).join(', ')}`)}">
      <b>${esc((a.client_name || 'Sin nombre').split(' ')[0])}</b><small>${esc(a.start)} · ${esc(a.services.map((s) => s.name).join(' + '))}</small></button>`;
  };
  const weekEnd = isoAdd(d.from, 6);
  main.innerHTML = `
  <header class="page-head">
    <div><div class="eyebrow">Semana del ${dayLabel(d.from)} al ${dayLabel(weekEnd)} · ${visible.length} citas${pending.length ? ` · ${pending.length} por confirmar` : ''}</div><h1>Agenda</h1></div>
    <div class="head-actions">
      <button type="button" class="btn small" id="wPrev" aria-label="Semana anterior">‹</button>
      <button type="button" class="btn small" id="wToday">Hoy</button>
      <button type="button" class="btn small" id="wNext" aria-label="Semana siguiente">›</button>
      <select class="input small-select" id="empFilter" aria-label="Profesional"><option value="">Todo el equipo</option>${d.employees.map((e) => `<option value="${e.id}" ${String(e.id) === String(empFilter) ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <button type="button" class="btn primary" id="newAppt">Nueva cita</button>
    </div>
  </header>
  ${pending.length ? `<section class="card pending-card"><div class="card-head"><h2>Reservas por confirmar · ${pending.length}</h2><span class="muted">Llegan de la reserva online y de otras plataformas</span></div>
    ${pending.slice(0, 6).map((a) => `<div class="pending-row"><span><b>${esc(a.client_name || 'Sin nombre')}</b> <small class="muted">${dayLabel(a.date)} · ${a.start} · ${esc(a.services.map((s) => s.name).join(' + '))}${a.employee_name ? ` · ${esc(a.employee_name)}` : ''}</small></span>
      <span class="head-actions"><button type="button" class="btn small primary" data-confirm="${a.id}">Confirmar</button><button type="button" class="btn small" data-appt="${a.id}">Ver</button></span></div>`).join('')}</section>` : ''}
  <div class="legend agenda-legend">${(empFilter ? emps : d.employees).map((e) => `<span><i style="background:${LANE_BORDER[(laneOf.get(e.id) ?? 0) % 6]}"></i>${esc(e.name)}</span>`).join('')}
    <span class="muted">· Toca un hueco para crear una cita</span>${isStaff() ? "" : `<a class="btn small ghost" href="#/ajustes" style="margin-left:auto">Reservas online y horario</a>`}</div>
  <section class="card agenda-card">
    <div class="agenda-grid" style="--cols:${days.length};--colw:${Math.max(150, lanes * 62)}px">
      <div class="agenda-times" style="height:${(endMin - startMin) * PX}px">${Array.from({ length: Math.ceil((endMin - startMin) / 60) + 1 }, (_, i) => startMin + i * 60).filter((m) => m <= endMin).map((m) => `<span style="top:${(m - startMin) * PX}px">${minToHm(m)}</span>`).join('')}</div>
      ${days.map((day) => {
        const h = hoursOf(day);
        const closedTop = h ? (hmToMin(h[1]) - startMin) * PX : 0;
        return `<div class="agenda-day ${day === d.today ? 'today' : ''}">
          <div class="agenda-day-head"><b>${DAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${Number(day.slice(8))}</b><small>${visible.filter((a) => a.date === day).length} citas</small></div>
          <div class="agenda-col" data-day="${day}" style="height:${(endMin - startMin) * PX}px;background-size:100% ${60 * PX}px">
            ${h && hmToMin(h[0]) > startMin ? `<div class="closed" style="top:0;height:${(hmToMin(h[0]) - startMin) * PX}px"></div>` : ''}
            ${h && hmToMin(h[1]) < endMin ? `<div class="closed" style="top:${closedTop}px;height:${(endMin - hmToMin(h[1])) * PX}px"></div>` : ''}
            ${!h ? `<div class="closed" style="top:0;height:100%"></div>` : ''}
            ${day === d.today ? (() => { const n = new Date(); const nm = n.getHours() * 60 + n.getMinutes(); return nm > startMin && nm < endMin ? `<div class="now-line" style="top:${(nm - startMin) * PX}px"></div>` : ''; })() : ''}
            ${visible.filter((a) => a.date === day).map(block).join('')}
          </div></div>`;
      }).join('')}
    </div>
  </section>
  <section class="agenda-list" aria-label="Citas de la semana">
    ${days.map((day) => {
      const list = visible.filter((a) => a.date === day);
      return `<div class="card"><h2>${dayLabel(day)}${day === d.today ? ' · hoy' : ''}</h2>
        ${list.length ? list.map((a) => `<button type="button" class="list-appt" data-appt="${a.id}"><span class="time">${a.start}</span><span class="txt"><b>${esc(a.client_name || 'Sin nombre')}</b><small>${esc(a.services.map((s) => s.name).join(' + '))}${a.employee_name ? ` · ${esc(a.employee_name)}` : ''}</small></span><span class="tag ${APPT_STATUS[a.status][1]}">${APPT_STATUS[a.status][0]}</span></button>`).join('') : `<div class="muted" style="font-size:14px">${hoursOf(day) ? 'Sin citas' : 'Cerrado'}</div>`}
        ${hoursOf(day) ? `<button type="button" class="btn small" data-newday="${day}">Nueva cita este día</button>` : ''}</div>`;
    }).join('')}
  </section>`;

  $('#wPrev').onclick = () => { S.agendaWeek = isoAdd(S.agendaWeek, -7); render(); };
  $('#wNext').onclick = () => { S.agendaWeek = isoAdd(S.agendaWeek, 7); render(); };
  $('#wToday').onclick = () => { S.agendaWeek = mondayOf(S.me.today); render(); };
  $('#empFilter').onchange = (e) => { S.agendaEmp = e.target.value; render(); };
  $('#newAppt').onclick = () => appointmentForm({ date: d.today >= d.from && d.today <= weekEnd ? d.today : days[0] || d.from });
  $$('[data-appt]', main).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); appointmentDialog(Number(b.dataset.appt)); }));
  $$('[data-newday]', main).forEach((b) => (b.onclick = () => appointmentForm({ date: b.dataset.newday })));
  $$('[data-confirm]', main).forEach((b) => (b.onclick = async () => { await api(`/api/appointments/${b.dataset.confirm}`, { method: 'PUT', body: { status: 'confirmada' } }); toast('Cita confirmada'); render(); }));
  $$('.agenda-col', main).forEach((col) => (col.onclick = (e) => {
    if (e.target.closest('.appt')) return;
    const rect = col.getBoundingClientRect();
    const m = Math.round(((e.clientY - rect.top) / PX + startMin) / 15) * 15;
    appointmentForm({ date: col.dataset.day, time: minToHm(m), employeeId: empFilter || '' });
  }));
};

/* Diálogo "Nueva cita": cliente, servicios (la duración se suma sola),
   profesional, día y uno de los huecos libres. */
async function appointmentForm({ date, time = '', employeeId = '', client = null } = {}) {
  const cat = await api('/api/catalog');
  const services = cat.services.filter((s) => s.active);
  const employees = cat.employees.filter((e) => e.active);
  const st = { client, newClient: null, services: [], employee: String(employeeId || ''), date, time };
  const dlg = document.createElement('dialog');
  dlg.className = 'wide';
  dlg.innerHTML = `<form method="dialog">
    <h2>Nueva cita</h2>
    <div class="field">Clienta o cliente<div id="apClient"></div></div>
    <div class="field">Servicios <span class="hint">Toca uno o varios: la duración se calcula sola.</span>
      <div class="svc-chips" id="apSvc">${services.map((s) => `<button type="button" class="chip" data-svc="${s.id}" aria-pressed="false">${esc(s.name)} <small>${s.duration_min} min · ${eur(s.price)}</small></button>`).join('')}</div></div>
    <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <label class="field">Profesional<select id="apEmp"><option value="">Cualquiera libre</option>${employees.map((e) => `<option value="${e.id}" ${String(e.id) === st.employee ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field">Día<input type="date" id="apDate" value="${esc(date)}" min="${S.me.today}"></label>
    </div>
    <div class="field">Hora <span class="hint" id="apSummary">Elige servicios para ver los huecos libres.</span><div class="slots" id="apSlots"></div></div>
    <label class="field">Nota (opcional)<input id="apNotes" placeholder="Por ejemplo: trae foto de referencia"></label>
    <p class="err down hidden" role="alert" style="margin:0;font-weight:600"></p>
    <div class="form-actions"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn primary" type="submit">Crear cita</button></div>
  </form>`;
  document.body.appendChild(dlg);
  const err = (m) => { const p = $('.err', dlg); p.textContent = m; p.classList.toggle('hidden', !m); };
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());

  const renderClientBox = () => {
    const box = $('#apClient', dlg);
    if (st.client) {
      box.innerHTML = `<div class="input" style="display:flex;align-items:center;justify-content:space-between"><span><b>${esc(st.client.name)}</b> <small class="muted">${esc(st.client.phone || '')}</small></span><button type="button" class="btn small ghost" id="apClear">Cambiar</button></div>`;
      $('#apClear', dlg).onclick = () => { st.client = null; renderClientBox(); };
      return;
    }
    if (st.newClient) {
      box.innerHTML = `<div class="form-grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,0.8fr)"><input class="input" id="apNcName" placeholder="Nombre" value="${esc(st.newClient.name)}" aria-label="Nombre"><input class="input" id="apNcPhone" type="tel" placeholder="Teléfono" aria-label="Teléfono"><select class="input" id="apNcGender" aria-label="Género"><option value="M">Mujer</option><option value="H">Hombre</option><option value="U">—</option></select></div>`;
      $('#apNcName', dlg).oninput = (e) => (st.newClient.name = e.target.value);
      $('#apNcPhone', dlg).oninput = (e) => (st.newClient.phone = e.target.value);
      $('#apNcGender', dlg).onchange = (e) => (st.newClient.gender = e.target.value);
      return;
    }
    box.innerHTML = `<div class="suggest"><input class="input" id="apSearch" placeholder="Buscar por nombre o teléfono" autocomplete="off" aria-label="Buscar cliente"><div class="suggest-list hidden" id="apSuggest"></div></div><button type="button" class="btn small ghost" id="apNew" style="align-self:flex-start">+ Cliente nuevo</button>`;
    let t;
    $('#apSearch', dlg).oninput = (e) => {
      clearTimeout(t);
      const q = e.target.value.trim();
      const list = $('#apSuggest', dlg);
      if (q.length < 2) return list.classList.add('hidden');
      t = setTimeout(async () => {
        const r = await api(`/api/clients?q=${encodeURIComponent(q)}`);
        list.innerHTML = r.clients.slice(0, 8).map((c) => `<button type="button" data-cid="${c.id}">${esc(c.name)} <small class="muted">${esc(c.phone || '')}</small></button>`).join('') || '<div class="empty">Sin resultados</div>';
        list.classList.remove('hidden');
        $$('[data-cid]', list).forEach((b) => (b.onclick = () => { st.client = r.clients.find((c) => String(c.id) === b.dataset.cid); renderClientBox(); }));
      }, 200);
    };
    $('#apNew', dlg).onclick = () => { st.newClient = { name: $('#apSearch', dlg).value, phone: '', gender: 'M' }; renderClientBox(); };
  };

  const loadSlots = async () => {
    const box = $('#apSlots', dlg);
    const total = st.services.reduce((a, id) => a + (services.find((s) => s.id === id)?.duration_min || 0), 0);
    const price = st.services.reduce((a, id) => a + (services.find((s) => s.id === id)?.price || 0), 0);
    if (!st.services.length || !st.date) { box.innerHTML = ''; $('#apSummary', dlg).textContent = 'Elige servicios para ver los huecos libres.'; return; }
    $('#apSummary', dlg).textContent = `${total} min · ${eur(price, 2)}`;
    box.innerHTML = '<span class="muted">Buscando huecos…</span>';
    const r = await api(`/api/agenda/slots?date=${st.date}&services=${st.services.join(',')}${st.employee ? `&employee=${st.employee}` : ''}`);
    if (st.time && !r.slots.some((x) => x.time === st.time)) st.time = '';
    box.innerHTML = r.slots.length ? r.slots.map((x) => `<button type="button" class="slot" data-time="${x.time}" aria-pressed="${x.time === st.time}">${x.time}</button>`).join('') : '<span class="muted">No quedan huecos ese día para esta duración. Prueba otro día o profesional.</span>';
    $$('[data-time]', box).forEach((b) => (b.onclick = () => { st.time = b.dataset.time; $$('[data-time]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  };

  $$('[data-svc]', dlg).forEach((b) => (b.onclick = () => {
    const id = Number(b.dataset.svc);
    st.services = st.services.includes(id) ? st.services.filter((x) => x !== id) : [...st.services, id];
    b.setAttribute('aria-pressed', String(st.services.includes(id)));
    loadSlots();
  }));
  $('#apEmp', dlg).onchange = (e) => { st.employee = e.target.value; loadSlots(); };
  $('#apDate', dlg).onchange = (e) => { st.date = e.target.value; loadSlots(); };
  $('form', dlg).addEventListener('submit', async (e) => {
    e.preventDefault();
    err('');
    if (!st.services.length) return err('Elige al menos un servicio.');
    if (!st.time) return err('Elige una hora libre.');
    if (!st.client && !st.newClient?.name?.trim()) return err('Elige o crea la clienta.');
    try {
      const a = await api('/api/appointments', { method: 'POST', body: {
        client_id: st.client?.id || null, new_client: st.client ? null : st.newClient, employee_id: st.employee || null,
        date: st.date, start: st.time, service_ids: st.services, notes: $('#apNotes', dlg).value
      } });
      dlg.close();
      toast(`Cita creada: ${dayLabel(a.date)} a las ${a.start}${a.employee_name ? ` con ${a.employee_name}` : ''}`);
      S.agendaWeek = mondayOf(a.date);
      if (location.hash.startsWith('#/agenda')) render(); else go('#/agenda');
    } catch (ex) { err(ex.message); }
  });
  renderClientBox();
  dlg.showModal();
}

async function appointmentDialog(id) {
  const a = await api(`/api/appointments/${id}`);
  const [label, tone] = APPT_STATUS[a.status];
  const price = a.services.reduce((s, x) => s + (x.price || 0), 0);
  const active = ['pendiente', 'confirmada'].includes(a.status);
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><h2>${esc(a.client_name || 'Cita')}</h2><span class="tag ${tone}">${label}</span></div>
    <div>
      <div class="kv"><span>Cuándo</span><span>${dayLabel(a.date)} · ${a.start}–${a.end}</span></div>
      <div class="kv"><span>Servicios</span><span>${esc(a.services.map((s) => s.name).join(' + '))}</span></div>
      <div class="kv"><span>Profesional</span><span>${esc(a.employee_name || 'Sin asignar')}</span></div>
      <div class="kv"><span>Precio previsto</span><span>${eur(price, 2)}</span></div>
      <div class="kv"><span>Origen</span><span>${esc(SOURCE_NAME[a.source] || a.source)}</span></div>
      ${a.client_phone ? `<div class="kv"><span>Teléfono</span><span>${esc(a.client_phone)}</span></div>` : ''}
      ${a.notes ? `<div class="kv"><span>Nota</span><span style="white-space:normal;text-align:right">${esc(a.notes)}</span></div>` : ''}
    </div>
    <div class="appt-actions">
      ${a.status === 'pendiente' ? '<button type="button" class="btn primary" data-act="confirmada">Confirmar</button>' : ''}
      ${active ? '<button type="button" class="btn primary" data-act="start">Empezar servicio</button><button type="button" class="btn" data-act="charge">Cobrar</button><button type="button" class="btn" data-act="move">Cambiar día u hora</button>' : ''}
      ${a.status === 'en_curso' ? '<a class="btn primary" href="#/cobro">Ir a cobrar</a>' : ''}
      ${active && a.client_id ? '<button type="button" class="btn" data-act="write">Escribirle</button>' : ''}
      ${a.client_id ? `<a class="btn ghost" href="#/clientes/${a.client_id}">Ver ficha</a>` : ''}
      ${active ? '<button type="button" class="btn danger" data-act="no_presentada">No vino</button><button type="button" class="btn danger" data-act="cancelada">Cancelar cita</button>' : ''}
    </div>
    <div class="form-actions"><button type="button" class="btn" data-cancel>Cerrar</button></div>
  </form>`;
  document.body.appendChild(dlg);
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  $$('[data-act]', dlg).forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    try {
      if (act === 'start') {
        await api(`/api/appointments/${a.id}/start`, { method: 'POST', body: {} });
        dlg.close();
        toast('Cronómetro en marcha: cobra desde «Nuevo cobro» al terminar');
        return go('#/cobro');
      }
      if (act === 'charge') { dlg.close(); return go(`#/cobro?cita=${a.id}`); }
      if (act === 'move') { dlg.close(); return rescheduleForm(a); }
      if (act === 'write') { dlg.close(); return newMessageDialog({ id: a.client_id, name: a.client_name, phone: a.client_phone }); }
      if ((act === 'cancelada' || act === 'no_presentada') && !(await confirmAction(act === 'cancelada' ? '¿Cancelar esta cita? El hueco queda libre.' : '¿Marcar que no vino a la cita?', act === 'cancelada' ? 'Cancelar cita' : 'Marcar'))) return;
      await api(`/api/appointments/${a.id}`, { method: 'PUT', body: { status: act } });
      dlg.close();
      toast(act === 'confirmada' ? 'Cita confirmada' : act === 'cancelada' ? 'Cita cancelada' : 'Anotado');
      render();
    } catch (err) { toast(err.message, true); }
  }));
  dlg.showModal();
}

async function rescheduleForm(a) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `<form method="dialog"><h2>Cambiar cita</h2>
    <p class="muted" style="margin:0">${esc(a.client_name || '')} · ${esc(a.services.map((s) => s.name).join(' + '))} (${hmToMin(a.end) - hmToMin(a.start)} min)</p>
    <label class="field">Día<input type="date" id="rsDate" value="${a.date}" min="${S.me.today}"></label>
    <div class="field">Hora<div class="slots" id="rsSlots"></div></div>
    <p class="err down hidden" role="alert" style="margin:0;font-weight:600"></p>
    <div class="form-actions"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn primary" type="submit">Guardar cambio</button></div></form>`;
  document.body.appendChild(dlg);
  let time = '';
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  const load = async () => {
    const ids = a.services.map((s) => s.service_id).filter(Boolean);
    const r = await api(`/api/agenda/slots?date=${$('#rsDate', dlg).value}&services=${ids.join(',')}&ignore=${a.id}`);
    const box = $('#rsSlots', dlg);
    box.innerHTML = r.slots.length ? r.slots.map((x) => `<button type="button" class="slot" data-time="${x.time}" aria-pressed="false">${x.time}</button>`).join('') : '<span class="muted">Sin huecos ese día.</span>';
    $$('[data-time]', box).forEach((b) => (b.onclick = () => { time = b.dataset.time; $$('[data-time]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  };
  $('#rsDate', dlg).onchange = load;
  $('form', dlg).addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!time) { const p = $('.err', dlg); p.textContent = 'Elige una hora'; p.classList.remove('hidden'); return; }
    try {
      const r = await api(`/api/appointments/${a.id}`, { method: 'PUT', body: { date: $('#rsDate', dlg).value, start: time } });
      dlg.close();
      toast(`Cita movida a ${dayLabel(r.date)} a las ${r.start}`);
      S.agendaWeek = mondayOf(r.date);
      render();
    } catch (err) { const p = $('.err', dlg); p.textContent = err.message; p.classList.remove('hidden'); }
  });
  await load();
  dlg.showModal();
}

/* Ajustes: reservas online, horario y agendas externas. */
async function renderBookingSettings(box) {
  const b = await api('/api/booking-settings');
  const url = bookingUrl(b.booking_slug);
  const cal = `${location.origin}/api/public/calendar/${b.calendar_token}`;
  const cat = await api('/api/catalog');
  box.innerHTML = `
    <div class="card-head"><h2>Agenda y reservas online</h2><span class="tag ${b.booking_enabled ? 'green' : ''}">${b.booking_enabled ? 'Reservas abiertas' : 'Reservas cerradas'}</span></div>
    <div class="grid g2">
      <form id="bkForm" class="channel">
        <h3>Página de reservas para tus clientas</h3>
        <p class="muted" style="margin:0;font-size:13px">Compártela en tu WhatsApp, Instagram, Google y tu web. Cada reserva entra en la Agenda y te avisa en Mensajes.</p>
        <div class="copy-row"><code class="key" id="bkUrl">${esc(url)}</code><button type="button" class="btn small" data-copy="${esc(url)}">Copiar enlace</button><a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a></div>
        <label class="field">Dirección<span style="display:flex;align-items:center;gap:6px;font-weight:400"><span class="muted">/reservar/</span><input name="slug" value="${esc(b.booking_slug)}" style="flex:1"></span></label>
        <label class="check"><input type="checkbox" name="enabled" ${b.booking_enabled ? 'checked' : ''}> Aceptar reservas online</label>
        <label class="check"><input type="checkbox" name="auto" ${b.booking_auto_confirm ? 'checked' : ''}> Confirmarlas automáticamente (si no, quedan «por confirmar»)</label>
        <div class="field">Horario del salón
          <div class="schedule">${[1, 2, 3, 4, 5, 6, 0].map((d) => { const h = b.schedule[d]; return `<div class="sched-row"><label class="check"><input type="checkbox" data-open="${d}" ${h ? 'checked' : ''}> ${DAY_NAMES[d]}</label><input type="time" class="input" data-from="${d}" value="${h ? h[0] : '09:30'}" aria-label="Abre el ${DAY_NAMES[d]}"><input type="time" class="input" data-to="${d}" value="${h ? h[1] : '20:00'}" aria-label="Cierra el ${DAY_NAMES[d]}"></div>`; }).join('')}</div></div>
        <div class="form-actions"><button class="btn primary" type="submit">Guardar</button></div>
      </form>
      <div class="channel">
        <h3>Conectar otras agendas</h3>
        <p class="muted" style="margin:0;font-size:13px">Si el salón ya usa Booksy, Treatwell, Fresha, Google Calendar u otro sistema, sus citas pueden entrar aquí solas.</p>
        <div class="block-title">1 · Calendario iCal (Google Calendar, Outlook, muchos programas de reservas)</div>
        ${b.feeds.length ? b.feeds.map((f) => `<div class="feed-row"><span><b>${esc(f.name || 'Calendario')}</b>${f.employee_name ? ` · ${esc(f.employee_name)}` : ''}<br><small class="muted">${f.last_sync ? `Última sincronización: ${esc(f.last_result || '')}` : 'Sin sincronizar'}</small></span>
          <span class="head-actions"><button type="button" class="btn small" data-sync="${f.id}">Sincronizar</button><button type="button" class="icon-btn" data-delfeed="${f.id}" aria-label="Quitar calendario">${icon('trash', 16)}</button></span></div>`).join('') : ''}
        <form id="feedForm" class="form-grid" style="grid-template-columns:minmax(0,1fr)">
          <input class="input" name="url" placeholder="Dirección iCal (https:// o webcal://)" aria-label="Dirección iCal">
          <div class="form-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><input class="input" name="name" placeholder="Nombre (p. ej. Booksy)" aria-label="Nombre del calendario">
          <select class="input" name="employee" aria-label="Profesional"><option value="">Varios profesionales</option>${cat.employees.filter((e) => e.active).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
          <button class="btn small" type="submit">Conectar calendario</button>
        </form>
        <span class="muted" style="font-size:12px">Se actualiza solo cada 15 minutos. El título del evento se usa para reconocer a la clienta y el servicio.</span>
        <div class="block-title">2 · Integración directa (Booksy, Treatwell, Fresha vía Make o Zapier)</div>
        <pre class="code">POST ${esc(location.origin)}/api/ingest/appointments
Authorization: Bearer &lt;clave del salón&gt;
{ "appointments": [{ "ref": "bk-123", "source": "booksy",
  "date": "2026-10-16", "start": "10:00", "duration": 60,
  "status": "confirmed", "employee": "Laura M.",
  "client": { "name": "Marta Gil", "phone": "600111222" },
  "services": [{ "name": "Color raíz", "price": 55 }] }] }</pre>
        <span class="muted" style="font-size:12px">La clave está en «Conectar TPV». Si llega otra vez la misma «ref», la cita se actualiza (cambios de hora y cancelaciones).</span>
        <div class="block-title">3 · Ver la agenda en el móvil</div>
        <div class="copy-row"><code class="key">${esc(cal)}</code><button type="button" class="btn small" data-copy="${esc(cal)}">Copiar</button></div>
        <span class="muted" style="font-size:12px">En Google Calendar: «Otros calendarios → Desde URL». En iPhone: Ajustes → Calendario → Cuentas → Añadir calendario suscrito.</span>
      </div>
    </div>`;
  $$('[data-copy]', box).forEach((btn) => (btn.onclick = async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); toast('Copiado'); }
    catch { toast('No se pudo copiar: selecciona el texto y cópialo', true); }
  }));
  $('#bkForm', box).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const schedule = {};
    for (let d = 0; d < 7; d++) schedule[d] = $(`[data-open="${d}"]`, f).checked ? [$(`[data-from="${d}"]`, f).value, $(`[data-to="${d}"]`, f).value] : null;
    try {
      await api('/api/booking-settings', { method: 'PUT', body: { schedule, booking_slug: f.slug.value.trim(), booking_enabled: f.enabled.checked, booking_auto_confirm: f.auto.checked } });
      toast('Agenda guardada');
      renderBookingSettings(box);
    } catch (err) { toast(err.message, true); }
  };
  $('#feedForm', box).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api('/api/calendar-feeds', { method: 'POST', body: { url: f.url.value.trim(), name: f.name.value, employee_id: f.employee.value || null } });
      toast(r.sync.ok ? `Calendario conectado: ${r.sync.message}` : `Conectado, pero no se pudo leer: ${r.sync.error}`, !r.sync.ok);
      renderBookingSettings(box);
    } catch (err) { toast(err.message, true); }
  };
  $$('[data-sync]', box).forEach((btn) => (btn.onclick = async () => {
    const r = await api(`/api/calendar-feeds/${btn.dataset.sync}/sync`, { method: 'POST', body: {} });
    toast(r.ok ? `Sincronizado: ${r.message}` : `Error: ${r.error}`, !r.ok);
    renderBookingSettings(box);
  }));
  $$('[data-delfeed]', box).forEach((btn) => (btn.onclick = async () => {
    if (!(await confirmAction('¿Desconectar este calendario? Las citas ya copiadas se quedan.', 'Desconectar'))) return;
    await api(`/api/calendar-feeds/${btn.dataset.delfeed}`, { method: 'DELETE', body: {} });
    renderBookingSettings(box);
  }));
}

render();
