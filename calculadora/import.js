/* Lector de archivos del salón (CSV y texto de PDF).
   Convierte un archivo cualquiera en filas, detecta qué columna es cada dato
   (servicio, precio, duración, cantidad, importe, cliente, profesional)
   y devuelve servicios y datos del salón listos para revisar. */
(function (root) {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toNum(v) {
    var s = String(v == null ? '' : v).trim().replace(/[\s€]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function toMin(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    var m = s.match(/^(\d+)\s*(?:h|:|horas?)\s*(\d*)\s*(?:min|m)?$/);
    if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    return toNum(s);
  }
  function isNumCell(c) {
    return /^[\s€$]*-?\d[\d.,]*\s*(€|eur|min|h)?\s*$/i.test(String(c).trim());
  }
  var RENT = /\b(color|colour|tinte|tintes|raiz|raices|mecha|mechas|balayage|californiana|babylight|aclarad|decolor|platino|alisad|keratina|botox|nanoplastia|tratamiento|hidrat|mascarilla|olaplex|ampolla|gloss|matiz|reflejo|permanente)/;
  function isRent(name) { return RENT.test(norm(name)); }

  /* ---------- CSV ---------- */
  function splitLine(line, d) {
    var out = [], cur = '', q = false, i, c;
    for (i = 0; i < line.length; i++) {
      c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var best = ',', bestScore = -1;
    [';', ',', '\t', '|'].forEach(function (d) {
      var counts = {}, top = 0, topN = 0;
      lines.slice(0, 15).forEach(function (l) {
        var n = l.split(d).length - 1;
        if (n > 0) { counts[n] = (counts[n] || 0) + 1; if (counts[n] > top) { top = counts[n]; topN = n; } }
      });
      var score = top * 10 + topN;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return lines.map(function (l) {
      return splitLine(l, best).map(function (c) { return c.trim(); });
    });
  }

  /* ---------- PDF: items de texto -> filas ---------- */
  function pdfItemsToRows(pages) {
    var rows = [];
    pages.forEach(function (items) {
      items = items.filter(function (it) { return String(it.str).trim() !== ''; });
      items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var lines = [];
      items.forEach(function (it) {
        var ln = lines[lines.length - 1];
        if (ln && Math.abs(ln.y - it.y) <= 3) ln.items.push(it);
        else lines.push({ y: it.y, items: [it] });
      });
      lines.forEach(function (ln) {
        ln.items.sort(function (a, b) { return a.x - b.x; });
        var cells = [], cur = null, prevEnd = null;
        ln.items.forEach(function (it) {
          var gap = prevEnd == null ? 0 : it.x - prevEnd;
          if (cur === null || gap > 9) { if (cur !== null) cells.push(cur.trim()); cur = it.str; }
          else cur += (gap > 1 ? ' ' : '') + it.str;
          prevEnd = it.x + (it.w || it.str.length * 4);
        });
        if (cur !== null) cells.push(cur.trim());
        cells = cells.filter(function (c) { return c !== ''; });
        if (cells.length) rows.push(cells);
      });
    });
    return rows;
  }

  /* ---------- detección de columnas ---------- */
  var ROLES = [
    ['price', ['precio', 'pvp', 'tarifa', 'precio unitario', 'precio unidad', 'precio medio', 'p unit', 'importe unitario', 'unitario']],
    ['min', ['duracion', 'minutos', 'minuto', 'mins', 'min', 'tiempo', 'duracion min']],
    ['qty', ['cantidad', 'cant', 'unidades', 'uds', 'ud', 'veces', 'realizados', 'n servicios', 'num servicios', 'numero de servicios', 'total servicios', 'servicios realizados', 'n de servicios', 'n']],
    ['client', ['cliente', 'clienta', 'clientes', 'ticket', 'n ticket', 'id cliente', 'visita', 'nombre cliente', 'n factura', 'id']],
    ['staff', ['empleado', 'empleada', 'profesional', 'estilista', 'trabajador', 'peluquero', 'peluquera', 'personal', 'operario', 'colaborador']],
    ['total', ['importe', 'total', 'facturacion', 'ingresos', 'ventas', 'venta', 'facturado', 'neto', 'bruto', 'total euros', 'importe total', 'total eur']],
    ['name', ['servicio', 'servicios', 'concepto', 'descripcion', 'articulo', 'tratamiento', 'nombre', 'producto', 'prestacion', 'trabajo', 'detalle']]
  ];
  function hasPhrase(h, syn) { return (' ' + h + ' ').indexOf(' ' + syn + ' ') > -1; }
  function mapHeader(row) {
    var heads = row.map(norm), map = {}, used = {};
    ROLES.forEach(function (r) {
      for (var i = 0; i < heads.length; i++) {
        if (used[i] || !heads[i]) continue;
        if (r[1].some(function (s) { return hasPhrase(heads[i], s); })) { map[r[0]] = i; used[i] = true; break; }
      }
    });
    return map;
  }
  function findHeader(rows) {
    var best = -1, bestScore = 1, bestMap = null;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var m = mapHeader(rows[i]), score = Object.keys(m).length;
      if (score > bestScore) { best = i; bestScore = score; bestMap = m; }
    }
    return best >= 0 ? { index: best, map: bestMap } : null;
  }

  var RE_TOTAL = /^(total|totales|suma|subtotal|total general|importe total|total facturacion|base imponible|iva)\b/;
  var RE_FACT = /^(total )?(facturacion|ingresos|ventas)( totales| total| del mes| mensual| mensuales)?$/;
  var RE_CLI = /^(n |num |numero de )?(clientes|clientas|tickets|visitas)( atendidos| atendidas| del mes)?$/;
  var RE_PER = /^(n |num |numero de )?(empleados|empleadas|profesionales|personas|trabajadores|estilistas)$/;
  function firstNum(cells, skip) {
    for (var i = 0; i < cells.length; i++) { if (i === skip) continue; if (isNumCell(cells[i])) return toNum(cells[i]); }
    return NaN;
  }

  function analyze(rows) {
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
    var res = { services: [], salon: { factura: NaN, clientes: NaN, personas: NaN }, notes: [], guess: false };
    if (!rows.length) { res.notes.push('El archivo está vacío.'); return res; }

    var hdr = findHeader(rows), map = hdr ? hdr.map : null, body;
    var groups = {}, order = [], labelFact = NaN, labelCli = NaN, labelPer = NaN, totalRow = NaN;
    var clients = {}, staff = {}, sawQty = false;

    function group(name) {
      var k = norm(name);
      if (!groups[k]) { groups[k] = { name: name.trim(), qty: 0, rows: 0, rev: 0, hasRev: false, pSum: 0, pW: 0, mins: [] }; order.push(k); }
      return groups[k];
    }
    function labelRow(nameN, cells, nameIdx) {
      if (RE_FACT.test(nameN)) { labelFact = firstNum(cells, nameIdx); return true; }
      if (RE_CLI.test(nameN)) { labelCli = firstNum(cells, nameIdx); return true; }
      if (RE_PER.test(nameN)) { labelPer = firstNum(cells, nameIdx); return true; }
      if (RE_TOTAL.test(nameN)) {
        var v = (map && map.total != null && isNumCell(cells[map.total] || '')) ? toNum(cells[map.total]) : NaN;
        if (!map) { var nums = cells.filter(isNumCell).map(toNum); v = nums.length ? Math.max.apply(null, nums) : NaN; }
        if (/^iva|base/.test(nameN)) return true;
        if (isFinite(v)) totalRow = v;
        return true;
      }
      return false;
    }

    if (map) {
      body = rows.slice(hdr.index + 1);
      var headN = rows[hdr.index].map(norm).join('|');
      if (map.name == null) {
        // primera columna con texto no numérico
        var cols = rows[0].length;
        for (var c = 0; c < cols; c++) {
          var tx = body.filter(function (r) { return r[c] && !isNumCell(r[c]); }).length;
          if (tx > body.length / 2 && !Object.keys(map).some(function (k) { return map[k] === c; })) { map.name = c; break; }
        }
      }
      sawQty = map.qty != null;
      body.forEach(function (r) {
        if (r.map(norm).join('|') === headN) return;
        var name = map.name != null ? (r[map.name] || '').trim() : '';
        if (!name || isNumCell(name)) return;
        var nN = norm(name);
        if (labelRow(nN, r, map.name)) return;
        if (map.client != null && r[map.client]) clients[norm(r[map.client])] = 1;
        if (map.staff != null && r[map.staff]) staff[norm(r[map.staff])] = 1;
        var g = group(name);
        var q = map.qty != null ? toNum(r[map.qty]) : 1;
        if (!isFinite(q) || q <= 0) q = 1;
        var price = map.price != null ? toNum(r[map.price]) : NaN;
        var total = map.total != null ? toNum(r[map.total]) : NaN;
        var rev = isFinite(total) ? total : (isFinite(price) ? price * q : NaN);
        g.qty += q; g.rows++;
        if (isFinite(rev)) { g.rev += rev; g.hasRev = true; }
        if (isFinite(price)) { g.pSum += price * q; g.pW += q; }
        var mn = map.min != null ? toMin(r[map.min]) : NaN;
        if (isFinite(mn) && mn > 0) g.mins.push(mn);
      });
    } else {
      // sin cabecera: filas con texto y números
      res.guess = true;
      rows.forEach(function (r) {
        var text = [], nums = [];
        r.forEach(function (c) { if (isNumCell(c)) nums.push(toNum(c)); else text.push(c); });
        if (!text.length) return;
        var name = text[0], nN = norm(name);
        if (!/[a-z]/.test(nN)) return;
        if (labelRow(nN, r, 0)) return;
        if (!nums.length) return;
        var g = group(name), q = NaN, price = NaN, total = NaN, i, j, k;
        if (nums.length >= 3) {
          outer: for (i = 0; i < nums.length; i++) for (j = 0; j < nums.length; j++) for (k = 0; k < nums.length; k++) {
            if (i === j || j === k || i === k) continue;
            if (Math.abs(nums[i] * nums[j] - nums[k]) <= Math.max(0.02, nums[k] * 0.01) && nums[i] === Math.round(nums[i])) {
              q = nums[i]; price = nums[j]; total = nums[k]; break outer;
            }
          }
        }
        if (!isFinite(q) && nums.length === 2) {
          if (nums[0] === Math.round(nums[0]) && nums[1] !== Math.round(nums[1])) { q = nums[0]; total = nums[1]; price = total / q; }
          else if (nums[0] === Math.round(nums[0]) && nums[1] === Math.round(nums[1])) { q = Math.min(nums[0], nums[1]); price = Math.max(nums[0], nums[1]); total = price * q; }
          else if (nums[1] === Math.round(nums[1])) { price = nums[0]; q = nums[1]; total = price * q; }
        }
        if (!isFinite(q) && nums.length === 1) { price = nums[0]; q = NaN; }
        sawQty = sawQty || isFinite(q);
        if (isFinite(q)) { g.qty += q; g.rows++; }
        else g.rows++;
        if (isFinite(total)) { g.rev += total; g.hasRev = true; }
        if (isFinite(price)) { g.pSum += price * (isFinite(q) ? q : 1); g.pW += (isFinite(q) ? q : 1); }
      });
    }

    var transaction = !sawQty && order.some(function (k) { return groups[k].rows > 1; });
    var anyRev = false, sumRev = 0;
    order.forEach(function (k) {
      var g = groups[k], price = g.pW > 0 ? g.pSum / g.pW : (g.hasRev && g.qty > 0 ? g.rev / g.qty : NaN);
      var veces = (sawQty || transaction) && g.qty > 0 ? g.qty : NaN;
      var minv = g.mins.length ? g.mins.reduce(function (a, b) { return a + b; }, 0) / g.mins.length : NaN;
      if (g.hasRev && (sawQty || transaction)) { anyRev = true; sumRev += g.rev; }
      else if (isFinite(price) && isFinite(veces)) { anyRev = true; sumRev += price * veces; }
      res.services.push({
        name: g.name, precio: isFinite(price) ? Math.round(price * 100) / 100 : NaN,
        min: isFinite(minv) ? Math.round(minv) : NaN,
        veces: isFinite(veces) ? Math.round(veces) : NaN, rent: isRent(g.name)
      });
    });
    res.services = res.services.slice(0, 60);

    var nc = Object.keys(clients).length, ns = Object.keys(staff).length;
    res.salon.factura = isFinite(labelFact) ? labelFact : (isFinite(totalRow) ? totalRow : (anyRev ? Math.round(sumRev) : NaN));
    res.salon.clientes = isFinite(labelCli) ? labelCli : (nc > 0 ? nc : NaN);
    res.salon.personas = isFinite(labelPer) ? labelPer : (ns > 0 ? ns : NaN);

    // avisos
    var s = res.services, miss = function (f) { return s.filter(function (x) { return !isFinite(x[f]); }).length; };
    if (!s.length) res.notes.push('No hemos encontrado servicios en el archivo. Mira que tenga una columna con el nombre del servicio y otra con precio o importe.');
    else {
      if (miss('min')) res.notes.push('Falta la duración de ' + miss('min') + ' servicio' + (miss('min') > 1 ? 's' : '') + '. Los programas de gestión casi nunca la incluyen. Complétala en la lista.');
      if (miss('precio')) res.notes.push('Falta el precio de ' + miss('precio') + ' servicio' + (miss('precio') > 1 ? 's' : '') + '.');
      if (res.guess) res.notes.push('El archivo no tiene títulos de columna claros. Hemos adivinado qué número es el precio: revisa cada línea.');
    }
    return res;
  }

  var api = { norm: norm, toNum: toNum, toMin: toMin, isRent: isRent, parseCSV: parseCSV, pdfItemsToRows: pdfItemsToRows, analyze: analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MuttoImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
