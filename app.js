/* =========================================================================
   Muttto · Constructor de Menú de Servicios
   Todo el estado vive en el navegador (localStorage). No hay backend.
   Ver README.md para cómo editar textos/estilos de base o desplegar cambios.
   ========================================================================= */

const STORAGE_KEY = 'muttto_menu_builder_v1';
const RATES = [0.85, 0.95, 1.10];

/* Datos reales del "Cuadrante del Estilista de Muttto". Tiempos y precio
   mínimo (0,85€/min) según el documento; cuando el documento incluía además
   un precio "recomendado por valor de producto" ya pactado, se usa como
   precio manual de partida (editable, y siempre se puede volver al automático). */
const DEFAULT_SERVICES = [
  // 1. Servicios de corte · CUT&DESIGN
  { name: 'Corte de caballero', category: 'Cortes · Cut&Design', color: '#a9862e', active: true, tApp: 15, tExp: 0, tWash: 3, manualPrice: null },
  { name: 'Corte de señora', category: 'Cortes · Cut&Design', color: '#a9862e', active: true, tApp: 25, tExp: 0, tWash: 5, manualPrice: null },

  // 2. Servicios de color
  { name: 'Coloración en Óleo NCC (Mousse Choice)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: null },
  { name: 'Color NCC + Tratamiento (Mousse Choice + Lípidos)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: null },
  { name: 'Coloración en crema (Tsubaki Cream)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: 55.00 },
  { name: 'Coloración en crema Tsuyo + Tratamiento (Aceite de Kendy)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: 55.00 },
  { name: 'Coloración en gel Confort Color (Gelatine Butter)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: 59.00 },
  { name: 'Color Confort + Tratamiento (Gelatine Butter + Lípidos)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: 59.00 },
  { name: 'Coloración de Barros Yukiro (Mud Therapy Color)', category: 'Color', color: '#8a2942', active: true, tApp: 15, tExp: 40, tWash: 5, manualPrice: 80.00 },
  { name: 'Servicio de Color + Mechas (Raíz Tsuyo + mechas Cream Light)', category: 'Color', color: '#8a2942', active: true, tApp: 30, tExp: 40, tWash: 5, manualPrice: 90.00 },

  // 0. Matización
  { name: 'Matización única + tratamiento Blend', category: 'Matización', color: '#c9a35c', active: true, tApp: 5, tExp: 20, tWash: 5, manualPrice: null },
  { name: 'Matización en Óleo (Gloss Color) + tratamiento Blend', category: 'Matización', color: '#c9a35c', active: true, tApp: 5, tExp: 20, tWash: 5, manualPrice: null },
  { name: 'Matización en Gel (Gelatine Gloss Therapy) + tratamiento Blend', category: 'Matización', color: '#c9a35c', active: true, tApp: 5, tExp: 20, tWash: 5, manualPrice: null },

  // 3. Servicio de Mechas
  { name: 'Puntos de luz (soft lights) con Matiz y Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 60, tExp: 50, tWash: 5, manualPrice: null },
  { name: 'Servicio de Mechas (Care Blond Therapy) con Matiz y Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 150, tExp: 50, tWash: 5, manualPrice: null },
  { name: 'Servicio de Mechas con Matiz y Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 180, tExp: 50, tWash: 5, manualPrice: null },
  { name: 'Servicio Airtouch LightCode con Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 210, tExp: 20, tWash: 5, manualPrice: 300.00 },
  { name: 'Servicio Airtouch Reverse con Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 210, tExp: 20, tWash: 5, manualPrice: 300.00 },
  { name: 'Servicio Airtouch Double con Blend Treatment + Protector', category: 'Mechas', color: '#6b2c91', active: true, tApp: 210, tExp: 20, tWash: 5, manualPrice: 300.00 },

  // 4. Servicios de Tratamientos
  { name: 'Servicio de Cuero Cabelludo (Wellness Therapy Teabase)', category: 'Tratamientos', color: '#2f6f5e', active: true, tApp: 15, tExp: 15, tWash: 10, manualPrice: null },
  { name: 'Hidratación con línea Hydracore (Wellness Therapy Hydracore)', category: 'Tratamientos', color: '#2f6f5e', active: true, tApp: 15, tExp: 15, tWash: 10, manualPrice: null },
  { name: 'Nutrición con línea Spa (Wellness Therapy & Spa)', category: 'Tratamientos', color: '#2f6f5e', active: true, tApp: 15, tExp: 15, tWash: 10, manualPrice: null },
  { name: 'Hidratación con aceite de Kendy (Wellness Therapy Kendy Caliente)', category: 'Tratamientos', color: '#2f6f5e', active: true, tApp: 15, tExp: 15, tWash: 10, manualPrice: 42.00 },
  { name: 'Hidratación con Panacea (Wellness Therapy Panacea)', category: 'Tratamientos', color: '#2f6f5e', active: true, tApp: 15, tExp: 15, tWash: 10, manualPrice: 42.00 },

  // 5. Servicio de Secado · DRY & STYLE
  { name: 'Dry Express', category: 'Secado · Dry & Style', color: '#b5651d', active: true, tApp: 10, tExp: 0, tWash: 5, manualPrice: null },
  { name: 'Dry & Style: corto', category: 'Secado · Dry & Style', color: '#b5651d', active: true, tApp: 20, tExp: 0, tWash: 5, manualPrice: null },
  { name: 'Dry & Style: medio', category: 'Secado · Dry & Style', color: '#b5651d', active: true, tApp: 20, tExp: 0, tWash: 5, manualPrice: null },
  { name: 'Dry & Style: largo', category: 'Secado · Dry & Style', color: '#b5651d', active: true, tApp: 30, tExp: 0, tWash: 5, manualPrice: null },
  { name: 'Dry & Style: XL', category: 'Secado · Dry & Style', color: '#b5651d', active: true, tApp: 45, tExp: 0, tWash: 5, manualPrice: null },

  // 6. Forma · SHAPE CONTROL (moldeado)
  { name: 'Shape corto', category: 'Forma · Shape Control', color: '#3d5a80', active: true, tApp: 30, tExp: 15, tWash: 5, manualPrice: null },
  { name: 'Shape medio', category: 'Forma · Shape Control', color: '#3d5a80', active: true, tApp: 45, tExp: 15, tWash: 5, manualPrice: null },
  { name: 'Shape largo', category: 'Forma · Shape Control', color: '#3d5a80', active: true, tApp: 60, tExp: 15, tWash: 5, manualPrice: null },

  // 7. SMOOTH RITUAL (alisados y laminados)
  { name: 'Smooth Straightening (laminado)', category: 'Smooth Ritual · Alisados', color: '#4a1942', active: true, tApp: 60, tExp: 30, tWash: 10, manualPrice: null },
  { name: 'Alisado Biosfera', category: 'Smooth Ritual · Alisados', color: '#4a1942', active: true, tApp: 90, tExp: 90, tWash: 15, manualPrice: 250.00 },

  // 8. SERVICIOS VIBBRO
  { name: 'Teadhara Experience', category: 'Servicios Vibbro', color: '#d1495b', active: true, tApp: 30, tExp: 0, tWash: 5, manualPrice: 60.00 },
  { name: 'Cascada Hidratante', category: 'Servicios Vibbro', color: '#d1495b', active: true, tApp: 45, tExp: 0, tWash: 5, manualPrice: 67.00 },
  { name: 'Elixir Hair & Body', category: 'Servicios Vibbro', color: '#d1495b', active: true, tApp: 60, tExp: 0, tWash: 5, manualPrice: 80.00 },
  { name: 'Mud Experience Scalp & Face', category: 'Servicios Vibbro', color: '#d1495b', active: true, tApp: 60, tExp: 0, tWash: 5, manualPrice: 80.00 },
// Los servicios que ya traían un precio pactado en el documento guardan ese
// mismo valor como "recomendado", visible aunque luego se edite o se resetee.
].map(s => ({ ...s, recommendedPrice: s.manualPrice })).map(withId);

function withId(s) { return { id: uid(), ...s }; }
function uid() { return 'svc_' + Math.random().toString(36).slice(2, 10); }

function defaultState() {
  return {
    rate: 0.85,
    rateMode: 'preset', // 'preset' | 'custom'
    customRate: null,
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
    // Backfill fields from earlier versions of the tool so old saved menus keep working.
    if (parsed.rateMode !== 'preset' && parsed.rateMode !== 'custom') parsed.rateMode = 'preset';
    if (!Number.isFinite(parsed.customRate)) parsed.customRate = null;
    parsed.services.forEach(s => { if (!Number.isFinite(s.recommendedPrice)) s.recommendedPrice = null; });
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

function round2(v) { return Math.round(v * 100) / 100; }

function autoPrice(s) { return round2(duration(s) * state.rate); }

function isManual(s) { return s.manualPrice !== null && s.manualPrice !== undefined && !Number.isNaN(s.manualPrice); }

function price(s) {
  return isManual(s) ? s.manualPrice : autoPrice(s);
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

function hasRecommended(s) { return s.recommendedPrice !== null && s.recommendedPrice !== undefined && !Number.isNaN(s.recommendedPrice); }

// Small caption under the price field for services that came from the
// reference document with an already-agreed "recomendado" price: shows a
// badge when the current price matches it, or a one-click button to apply it
// when the price has since changed (manual edit or reset to automatic).
function recommendedHint(s, currentPrice) {
  if (!hasRecommended(s)) return '';
  const matches = round2(currentPrice) === round2(s.recommendedPrice);
  if (matches) {
    return `<div class="recommended-hint is-active" title="Precio recomendado en el documento de referencia">★ Recomendado</div>`;
  }
  return `<button type="button" class="recommended-hint use-recommended-btn" data-price="${s.recommendedPrice}">Usar recomendado: ${formatPrice(s.recommendedPrice)}</button>`;
}

/* --------------------------------- DOM ---------------------------------- */

const el = {
  rateOptions: document.getElementById('rateOptions'),
  customRateCard: document.getElementById('customRateCard'),
  customRateInput: document.getElementById('customRateInput'),
  themeOptions: document.getElementById('themeOptions'),
  salonName: document.getElementById('salonName'),
  salonSubtitle: document.getElementById('salonSubtitle'),
  servicesBody: document.getElementById('servicesBody'),
  categoryList: document.getElementById('categoryList'),
  categoryManager: document.getElementById('categoryManager'),
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
  renderCategoryManager();
  renderMenuSheet(el.menuSheet);
  saveState();
}

function renderControls() {
  el.salonName.value = state.salonName;
  el.salonSubtitle.value = state.salonSubtitle;

  [...el.rateOptions.children].forEach(btn => {
    if (!btn.dataset.rate) return;
    btn.classList.toggle('active', state.rateMode === 'preset' && Number(btn.dataset.rate) === state.rate);
  });
  el.customRateCard.classList.toggle('active', state.rateMode === 'custom');
  // Don't fight the user's typing: only sync the value when the field isn't focused.
  if (document.activeElement !== el.customRateInput) {
    el.customRateInput.value = state.customRate != null ? state.customRate : '';
  }

  [...el.themeOptions.children].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.theme);
  });
}

function renderCategoryList() {
  const cats = [...new Set(state.services.map(s => s.category).filter(Boolean))];
  el.categoryList.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function renderCategoryManager() {
  const groups = [];
  state.services.forEach(s => {
    const cat = s.category || '';
    let g = groups.find(x => x.cat === cat);
    if (!g) { g = { cat, label: cat || 'Sin categoría', count: 0 }; groups.push(g); }
    g.count++;
  });

  if (groups.length === 0) { el.categoryManager.innerHTML = ''; return; }

  el.categoryManager.innerHTML = groups.map(g => `
    <div class="cat-chip">
      <span>${escapeHtml(g.label)} <em>(${g.count})</em></span>
      <button type="button" class="cat-del-btn" data-cat="${escapeAttr(g.cat)}" title="Eliminar todos los servicios de &quot;${escapeAttr(g.label)}&quot;">🗑 Eliminar grupo</button>
    </div>`).join('');
}

function renderTable() {
  el.servicesBody.innerHTML = state.services.map((s, i) => rowTemplate(s, i, state.services.length)).join('');
}

function rowTemplate(s, index, total) {
  const d = duration(s);
  const p = price(s);
  const manual = isManual(s);
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
      <td class="cell-price" data-label="Precio">
        <div class="price-cell">
          <input type="number" min="0" step="0.01" class="row-price-input ${manual ? 'is-manual' : ''}" data-field="manualPrice" value="${p.toFixed(2)}" title="${manual ? 'Precio manual' : 'Precio automático (tarifa × duración)'}">
          ${manual ? '<button type="button" class="price-reset-btn" title="Volver al precio automático">↺</button>' : ''}
        </div>
        ${recommendedHint(s, p)}
      </td>
      <td class="col-actions">
        <div class="row-actions">
          <button type="button" class="order-btn move-up-btn" title="Subir" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="order-btn move-down-btn" title="Bajar" ${index === total - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="del-btn" title="Eliminar servicio">✕</button>
        </div>
      </td>
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
    <div class="ms-footer">Tarifa base: ${state.rate.toString().replace('.', ',')} € / min${state.rateMode === 'custom' ? ' (personalizada)' : ''} · ${new Date().toLocaleDateString('es-ES')}</div>`;
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
  if (!btn || !btn.dataset.rate) return;
  state.rateMode = 'preset';
  state.rate = Number(btn.dataset.rate);
  renderAll();
});

el.customRateInput.addEventListener('input', () => {
  const v = parseFloat(el.customRateInput.value);
  state.customRate = Number.isFinite(v) && v >= 0 ? v : null;
  state.rateMode = 'custom';
  state.rate = state.customRate != null ? state.customRate : state.rate;
  // Light update: keep focus/caret in the field, sync the rest live.
  renderTable();
  [...el.rateOptions.children].forEach(btn => btn.dataset.rate && btn.classList.remove('active'));
  el.customRateCard.classList.add('active');
  renderMenuSheet(el.menuSheet);
  saveState();
});

el.customRateInput.addEventListener('change', () => renderControls());

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
  else if (field === 'manualPrice') {
    const v = parseFloat(e.target.value);
    s.manualPrice = Number.isFinite(v) && v >= 0 ? v : null;
  }
  else s[field] = e.target.value;

  // Avoid a full re-render on every keystroke for text-like fields (keeps focus/caret).
  if (field === 'name' || field === 'category' || field === 'color' || field === 'manualPrice') {
    if (field === 'category') { renderCategoryList(); renderCategoryManager(); }
    renderMenuSheet(el.menuSheet);
    saveState();
  } else {
    renderTable();
    renderMenuSheet(el.menuSheet);
    saveState();
  }
});

// On blur/enter (change), do a full row re-render so the "manual price" reset
// icon and styling reflect the latest value without disrupting typing.
el.servicesBody.addEventListener('change', e => {
  if (e.target.dataset.field === 'manualPrice') renderTable();
});

el.servicesBody.addEventListener('click', e => {
  const delBtn = e.target.closest('.del-btn');
  const upBtn = e.target.closest('.move-up-btn');
  const downBtn = e.target.closest('.move-down-btn');
  const resetBtn = e.target.closest('.price-reset-btn');
  const useRecBtn = e.target.closest('.use-recommended-btn');
  if (!delBtn && !upBtn && !downBtn && !resetBtn && !useRecBtn) return;

  const row = e.target.closest('tr');
  const id = row.dataset.id;
  const idx = state.services.findIndex(x => x.id === id);
  if (idx === -1) return;
  const s = state.services[idx];

  if (delBtn) {
    if (!confirm(`¿Eliminar "${s.name || 'este servicio'}" del menú?`)) return;
    state.services.splice(idx, 1);
  } else if (upBtn && idx > 0) {
    [state.services[idx - 1], state.services[idx]] = [state.services[idx], state.services[idx - 1]];
  } else if (downBtn && idx < state.services.length - 1) {
    [state.services[idx], state.services[idx + 1]] = [state.services[idx + 1], state.services[idx]];
  } else if (resetBtn) {
    s.manualPrice = null;
  } else if (useRecBtn) {
    s.manualPrice = Number(useRecBtn.dataset.price);
  } else {
    return;
  }
  renderAll();
});

el.categoryManager.addEventListener('click', e => {
  const btn = e.target.closest('.cat-del-btn');
  if (!btn) return;
  const cat = btn.dataset.cat;
  const affected = state.services.filter(s => (s.category || '') === cat);
  if (affected.length === 0) return;
  const label = cat || 'Sin categoría';
  if (!confirm(`¿Eliminar los ${affected.length} servicios de "${label}"? Esta acción no se puede deshacer.`)) return;
  state.services = state.services.filter(s => (s.category || '') !== cat);
  renderAll();
});

el.addServiceBtn.addEventListener('click', () => {
  state.services.push({
    id: uid(), name: 'Nuevo servicio', category: 'Otros', color: '#a9862e',
    active: true, tApp: 15, tExp: 0, tWash: 0, manualPrice: null, recommendedPrice: null,
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
      const customRate = parseFloat(parsed.customRate);
      const isCustomMode = parsed.rateMode === 'custom' && Number.isFinite(customRate) && customRate >= 0;
      state = {
        rate: isCustomMode ? customRate : (RATES.includes(parsed.rate) ? parsed.rate : 0.85),
        rateMode: isCustomMode ? 'custom' : 'preset',
        customRate: isCustomMode ? customRate : null,
        theme: ['premium', 'pastel', 'minimal'].includes(parsed.theme) ? parsed.theme : 'premium',
        salonName: parsed.salonName || 'Muttto The Beauty Lab',
        salonSubtitle: parsed.salonSubtitle || 'Menú de Servicios',
        services: parsed.services.map(s => {
          const mp = parseFloat(s.manualPrice);
          const rp = parseFloat(s.recommendedPrice);
          return {
            id: s.id || uid(),
            name: s.name || 'Servicio',
            category: s.category || 'Otros',
            color: s.color || '#a9862e',
            active: !!s.active,
            tApp: Number(s.tApp) || 0,
            tExp: Number(s.tExp) || 0,
            tWash: Number(s.tWash) || 0,
            manualPrice: Number.isFinite(mp) ? mp : null,
            recommendedPrice: Number.isFinite(rp) ? rp : null,
          };
        }),
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
