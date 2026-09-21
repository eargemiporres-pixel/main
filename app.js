/* =========================================================================
   Muttto · Constructor de Menú de Servicios
   Todo el estado vive en el navegador (localStorage). No hay backend.
   Ver README.md para cómo editar textos/estilos de base o desplegar cambios.
   ========================================================================= */

const STORAGE_KEY = 'muttto_menu_builder_v1';
const RATES = [0.85, 0.95, 1.10];

const DEFAULT_SERVICES = [
  { name: 'Corte caballero',            category: 'Cortes y Peinado', color: '#a9862e', active: true,  tApp: 20, tExp: 0,  tWash: 5  },
  { name: 'Corte Señora',               category: 'Cortes y Peinado', color: '#a9862e', active: true,  tApp: 30, tExp: 0,  tWash: 10 },
  { name: 'Corte niño',                 category: 'Cortes y Peinado', color: '#a9862e', active: true,  tApp: 15, tExp: 0,  tWash: 5  },
  { name: 'Secado',                     category: 'Cortes y Peinado', color: '#a9862e', active: true,  tApp: 20, tExp: 0,  tWash: 0  },
  { name: 'Color de Raíz',              category: 'Color y Técnicas', color: '#a9862e', active: true,  tApp: 15, tExp: 30, tWash: 10 },
  { name: 'Matización',                 category: 'Color y Técnicas', color: '#a9862e', active: true,  tApp: 10, tExp: 20, tWash: 10 },
  { name: 'Mechas',                     category: 'Color y Técnicas', color: '#a9862e', active: true,  tApp: 30, tExp: 40, tWash: 15 },
  { name: 'Alisados',                   category: 'Color y Técnicas', color: '#a9862e', active: true,  tApp: 40, tExp: 30, tWash: 15 },
  { name: 'Tratamientos',               category: 'Tratamientos',     color: '#a9862e', active: true,  tApp: 10, tExp: 15, tWash: 10 },
  { name: 'Ventas',                     category: 'Otros',            color: '#a9862e', active: false, tApp: 5,  tExp: 0,  tWash: 0  },
  { name: 'Mechas Completas + Matiz',   category: 'Packs de Color',   color: '#d4af37', active: true,  tApp: 45, tExp: 40, tWash: 15 },
  { name: 'Medias Mechas + Matiz',      category: 'Packs de Color',   color: '#7b1450', active: true,  tApp: 35, tExp: 35, tWash: 15 },
  { name: 'Balayage / Babylight + Matiz', category: 'Packs de Color', color: '#8e2a75', active: true,  tApp: 50, tExp: 40, tWash: 15 },
  { name: 'Tinte Completas',            category: 'Packs de Color',   color: '#e07a95', active: true,  tApp: 20, tExp: 35, tWash: 15 },
  { name: 'Tinte Raíz',                 category: 'Packs de Color',   color: '#e8a0b4', active: true,  tApp: 15, tExp: 30, tWash: 10 },
].map(withId);

function withId(s) { return { id: uid(), ...s }; }
function uid() { return 'svc_' + Math.random().toString(36).slice(2, 10); }

function defaultState() {
  return {
    rate: 0.85,
    theme: 'premium',
    salonName: 'Muttto The Beauty Lab',
    salonSubtitle: 'Menú de Servicios',
    services: DEFAULT_SERVICES.map(s => ({ ...s, id: uid() })),
  };
}

let state = loadState();

/* ------------------------------- Storage ------------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.services)) return defaultState();
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* storage unavailable — ignore, page still works */ }
}

/* ------------------------------ Calculations ---------------------------- */

function duration(s) {
  return Math.max(0, (Number(s.tApp) || 0) + (Number(s.tExp) || 0) + (Number(s.tWash) || 0));
}

function price(s) {
  const raw = duration(s) * state.rate;
  return Math.round(raw / 0.5) * 0.5; // redondeo a 0,50 € para precios "de menú"
}

function formatDuration(min) {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatPrice(v) {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* --------------------------------- DOM ---------------------------------- */

const el = {
  rateOptions: document.getElementById('rateOptions'),
  themeOptions: document.getElementById('themeOptions'),
  salonName: document.getElementById('salonName'),
  salonSubtitle: document.getElementById('salonSubtitle'),
  servicesBody: document.getElementById('servicesBody'),
  categoryList: document.getElementById('categoryList'),
  addServiceBtn: document.getElementById('addServiceBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  printBtn: document.getElementById('printBtn'),
  menuSheet: document.getElementById('menuSheet'),
  printSheetWrap: document.getElementById('printSheetWrap'),
};

/* ------------------------------ Rendering -------------------------------- */

function renderAll() {
  renderControls();
  renderTable();
  renderCategoryList();
  renderMenuSheet(el.menuSheet);
  saveState();
}

function renderControls() {
  el.salonName.value = state.salonName;
  el.salonSubtitle.value = state.salonSubtitle;

  [...el.rateOptions.children].forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.rate) === state.rate);
  });
  [...el.themeOptions.children].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.theme);
  });
}

function renderCategoryList() {
  const cats = [...new Set(state.services.map(s => s.category).filter(Boolean))];
  el.categoryList.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function renderTable() {
  el.servicesBody.innerHTML = state.services.map(rowTemplate).join('');
}

function rowTemplate(s) {
  const d = duration(s);
  const p = price(s);
  return `
    <tr data-id="${s.id}" class="${s.active ? '' : 'is-inactive'}">
      <td class="col-check"><input type="checkbox" class="check-input" data-field="active" ${s.active ? 'checked' : ''}></td>
      <td class="col-color"><input type="color" class="row-color-input" data-field="color" value="${s.color || '#a9862e'}"></td>
      <td class="col-name"><input type="text" class="row-name-input" data-field="name" value="${escapeAttr(s.name)}" placeholder="Nombre del servicio"></td>
      <td class="col-cat" data-label="Categoría"><input type="text" class="row-cat-input" data-field="category" list="categoryList" value="${escapeAttr(s.category)}" placeholder="Categoría"></td>
      <td class="col-time" data-label="Aplic."><input type="number" min="0" step="5" class="row-time-input" data-field="tApp" value="${s.tApp}"></td>
      <td class="col-time" data-label="Expo."><input type="number" min="0" step="5" class="row-time-input" data-field="tExp" value="${s.tExp}"></td>
      <td class="col-time" data-label="Lavado"><input type="number" min="0" step="5" class="row-time-input" data-field="tWash" value="${s.tWash}"></td>
      <td class="cell-total" data-label="Duración">${formatDuration(d)}</td>
      <td class="cell-price" data-label="Precio">${formatPrice(p)}</td>
      <td class="col-del"><button type="button" class="del-btn" title="Eliminar servicio">✕</button></td>
    </tr>`;
}

function renderMenuSheet(target) {
  target.setAttribute('data-sheet-theme', state.theme);

  const active = state.services.filter(s => s.active);
  const logoSrc = 'assets/logo-muttto.png';

  if (active.length === 0) {
    target.innerHTML = `
      <div class="ms-header">
        <img class="ms-logo" src="${logoSrc}" alt="">
        <p class="ms-salon">${escapeHtml(state.salonName)}</p>
        <p class="ms-subtitle">${escapeHtml(state.salonSubtitle)}</p>
      </div>
      <div class="ms-empty">Selecciona al menos un servicio para ver el menú.</div>`;
    return;
  }

  const categories = [];
  active.forEach(s => {
    const cat = s.category || 'Servicios';
    let group = categories.find(g => g.name === cat);
    if (!group) { group = { name: cat, items: [] }; categories.push(group); }
    group.items.push(s);
  });

  const categoriesHtml = categories.map(g => `
    <div class="ms-category">
      <div class="ms-category-title">${escapeHtml(g.name)}</div>
      ${g.items.map(rowHtml).join('')}
    </div>`).join('');

  target.innerHTML = `
    <div class="ms-header">
      <img class="ms-logo" src="${logoSrc}" alt="">
      <p class="ms-salon">${escapeHtml(state.salonName)}</p>
      <p class="ms-subtitle">${escapeHtml(state.salonSubtitle)}</p>
    </div>
    <div class="ms-body">${categoriesHtml}</div>
    <div class="ms-footer">Tarifa aplicada: ${state.rate.toString().replace('.', ',')} € / min · ${new Date().toLocaleDateString('es-ES')}</div>`;
}

function rowHtml(s) {
  return `
    <div class="ms-row">
      <span class="ms-row-dot" style="background:${s.color || '#a9862e'}"></span>
      <span class="ms-row-name">${escapeHtml(s.name || 'Servicio')}</span>
      <span class="ms-row-meta">${formatDuration(duration(s))}</span>
      <span class="ms-row-fill"></span>
      <span class="ms-row-price">${formatPrice(price(s))}</span>
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

/* -------------------------------- Events --------------------------------- */

el.rateOptions.addEventListener('click', e => {
  const btn = e.target.closest('.rate-btn');
  if (!btn) return;
  state.rate = Number(btn.dataset.rate);
  renderAll();
});

el.themeOptions.addEventListener('click', e => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  state.theme = btn.dataset.theme;
  renderAll();
});

el.salonName.addEventListener('input', () => { state.salonName = el.salonName.value; renderMenuSheet(el.menuSheet); saveState(); });
el.salonSubtitle.addEventListener('input', () => { state.salonSubtitle = el.salonSubtitle.value; renderMenuSheet(el.menuSheet); saveState(); });

el.servicesBody.addEventListener('input', e => {
  const row = e.target.closest('tr');
  if (!row) return;
  const s = state.services.find(x => x.id === row.dataset.id);
  if (!s) return;
  const field = e.target.dataset.field;
  if (!field) return;

  if (field === 'active') s.active = e.target.checked;
  else if (['tApp', 'tExp', 'tWash'].includes(field)) s[field] = Math.max(0, Number(e.target.value) || 0);
  else s[field] = e.target.value;

  // Avoid a full re-render on every keystroke for text fields (keeps focus/caret).
  if (field === 'name' || field === 'category' || field === 'color') {
    if (field === 'category') renderCategoryList();
    renderMenuSheet(el.menuSheet);
    saveState();
  } else {
    renderTable();
    renderMenuSheet(el.menuSheet);
    saveState();
  }
});

el.servicesBody.addEventListener('click', e => {
  const delBtn = e.target.closest('.del-btn');
  if (!delBtn) return;
  const row = delBtn.closest('tr');
  const s = state.services.find(x => x.id === row.dataset.id);
  if (s && !confirm(`¿Eliminar "${s.name || 'este servicio'}" del menú?`)) return;
  state.services = state.services.filter(x => x.id !== row.dataset.id);
  renderAll();
});

el.addServiceBtn.addEventListener('click', () => {
  state.services.push({
    id: uid(), name: 'Nuevo servicio', category: 'Otros', color: '#a9862e',
    active: true, tApp: 15, tExp: 0, tWash: 0,
  });
  renderAll();
  const rows = el.servicesBody.querySelectorAll('tr');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('.row-name-input').focus();
});

el.resetBtn.addEventListener('click', () => {
  if (!confirm('Esto restablecerá la lista de servicios, tarifa y colores a los valores por defecto. ¿Continuar?')) return;
  state = defaultState();
  renderAll();
});

el.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `menu-servicios-muttto-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

el.importInput.addEventListener('change', () => {
  const file = el.importInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.services)) throw new Error('Formato inválido');
      state = {
        rate: RATES.includes(parsed.rate) ? parsed.rate : 0.85,
        theme: ['premium', 'pastel', 'minimal'].includes(parsed.theme) ? parsed.theme : 'premium',
        salonName: parsed.salonName || 'Muttto The Beauty Lab',
        salonSubtitle: parsed.salonSubtitle || 'Menú de Servicios',
        services: parsed.services.map(s => ({
          id: s.id || uid(),
          name: s.name || 'Servicio',
          category: s.category || 'Otros',
          color: s.color || '#a9862e',
          active: !!s.active,
          tApp: Number(s.tApp) || 0,
          tExp: Number(s.tExp) || 0,
          tWash: Number(s.tWash) || 0,
        })),
      };
      renderAll();
    } catch (err) {
      alert('No se ha podido importar el archivo. Comprueba que es un .json exportado desde esta misma herramienta.');
    }
    el.importInput.value = '';
  };
  reader.readAsText(file);
});

el.printBtn.addEventListener('click', () => {
  const active = state.services.filter(s => s.active);
  if (active.length === 0) {
    alert('Selecciona al menos un servicio antes de imprimir el menú.');
    return;
  }
  const sheet = document.createElement('div');
  sheet.className = 'menu-sheet';
  el.printSheetWrap.innerHTML = '';
  el.printSheetWrap.appendChild(sheet);
  renderMenuSheet(sheet);
  requestAnimationFrame(() => window.print());
});

/* --------------------------------- Init ----------------------------------- */

renderAll();
