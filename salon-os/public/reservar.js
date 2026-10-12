/* Reserva online de MetricSalon: /reservar/<salón> y /reservar/<salón>/cita/<código>. */
(function () {
  var app = document.getElementById('app');
  var m = location.pathname.match(/^\/reservar\/([a-z0-9-]+)(?:\/cita\/([a-f0-9]+))?/);
  var slug = m && m[1];
  var token = m && m[2];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function euro(n) { return (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0).replace('.', ',') + ' €'; }
  function addDays(date, n) { var d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function longDate(date) { var d = new Date(date + 'T12:00:00Z'); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MONTHS[d.getUTCMonth()]; }
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Algo ha fallado. Inténtalo de nuevo.'); return d; }); });
  }
  function fail(msg) { app.innerHTML = '<div class="msg err">' + esc(msg) + '</div>'; }

  if (!slug) return fail('Falta el nombre del salón en la dirección.');
  if (token) return manage();
  book();

  function book() {
    var st = { services: [], employee: '', date: '', time: '' };
    var data;
    api('/api/public/booking/' + slug).then(function (d) {
      data = d;
      document.title = 'Reserva en ' + d.salon.name;
      var cats = {};
      d.services.forEach(function (s) { (cats[s.category || 'Servicios'] = cats[s.category || 'Servicios'] || []).push(s); });
      app.innerHTML =
        '<header class="salon"><small>Reserva online' + (d.salon.city ? ' · ' + esc(d.salon.city) : '') + '</small><h1>' + esc(d.salon.name) + '</h1></header>' +
        '<section class="step" id="s1"><h2><span class="n">1</span>¿Qué te hacemos?</h2>' +
          Object.keys(cats).map(function (c) {
            return '<div class="cat">' + esc(c) + '</div>' + cats[c].map(function (s) {
              return '<button type="button" class="svc" data-svc="' + s.id + '" aria-pressed="false"><span><b>' + esc(s.name) + '</b><small>' + s.duration_min + ' min</small></span><span class="price">' + euro(s.price) + '</span></button>';
            }).join('');
          }).join('') +
        '</section>' +
        '<section class="step" id="s2" hidden><h2><span class="n">2</span>¿Con quién?</h2><div class="chips" id="emps"><button type="button" class="chip" data-emp="" aria-pressed="true">Me da igual</button>' +
          d.employees.map(function (e) { return '<button type="button" class="chip" data-emp="' + e.id + '" aria-pressed="false">' + esc(e.name) + '</button>'; }).join('') + '</div></section>' +
        '<section class="step" id="s3" hidden><h2><span class="n">3</span>¿Qué día?</h2><div class="days" id="days"></div></section>' +
        '<section class="step" id="s4" hidden><h2><span class="n">4</span>¿A qué hora?</h2><div class="slots" id="slots"></div></section>' +
        '<form class="step" id="s5" hidden novalidate><h2><span class="n">5</span>Tus datos</h2>' +
          '<label class="field">Nombre y apellidos<input name="name" autocomplete="name" required></label>' +
          '<label class="field">Teléfono (para confirmarte la cita)<input name="phone" type="tel" autocomplete="tel" required></label>' +
          '<label class="field">Email (opcional)<input name="email" type="email" autocomplete="email"></label>' +
          '<label class="field">¿Algo que debamos saber? (opcional)<textarea name="notes" placeholder="Alergias, foto de referencia, si es para un evento…"></textarea></label>' +
          '<label class="hp" aria-hidden="true">No rellenar<input name="website" tabindex="-1" autocomplete="off"></label>' +
          '<label class="consent"><input type="checkbox" name="consent"> <span>Acepto que ' + esc(d.salon.name) + ' use mis datos para gestionar la cita y enviarme recordatorios.</span></label>' +
          '<div id="formMsg"></div>' +
          '<button class="btn primary" type="submit" id="confirm">Confirmar reserva</button>' +
        '</form>' +
        '<footer>Reservas con MetricSalon</footer>' +
        '<div class="bar" id="bar" hidden><div class="in"><div class="sum"><b id="barTitle"></b><small id="barSub"></small></div><button type="button" class="btn primary" id="barNext">Continuar</button></div></div>';
      bind();
    }).catch(function (e) { fail(e.message); });

    function chosen() { return st.services.map(function (id) { return data.services.find(function (s) { return s.id === id; }); }); }
    function duration() { return chosen().reduce(function (a, s) { return a + s.duration_min; }, 0); }
    function show(id) { document.getElementById(id).hidden = false; }
    function updateBar() {
      var bar = document.getElementById('bar');
      bar.hidden = !st.services.length;
      var price = chosen().reduce(function (a, s) { return a + s.price; }, 0);
      document.getElementById('barTitle').textContent = st.services.length + (st.services.length === 1 ? ' servicio' : ' servicios') + ' · ' + duration() + ' min · ' + euro(price);
      document.getElementById('barSub').textContent = st.date ? longDate(st.date) + (st.time ? ' a las ' + st.time : '') : chosen().map(function (s) { return s.name; }).join(' + ');
      var next = document.getElementById('barNext');
      next.textContent = st.time ? 'Poner mis datos' : st.date ? 'Elegir hora' : 'Elegir día';
    }
    function renderDays() {
      var box = document.getElementById('days');
      var html = '';
      for (var i = 0; i < 30; i++) {
        var date = addDays(data.today, i);
        var wd = new Date(date + 'T12:00:00Z').getUTCDay();
        var open = !!data.schedule[wd];
        html += '<button type="button" class="day" data-date="' + date + '" aria-pressed="' + (date === st.date) + '"' + (open ? '' : ' disabled') + ' aria-label="' + longDate(date) + (open ? '' : ', cerrado') + '"><small>' + (i === 0 ? 'hoy' : i === 1 ? 'mañana' : SHORT[wd]) + '</small><b>' + Number(date.slice(8)) + '</b><small>' + MONTHS[Number(date.slice(5, 7)) - 1].slice(0, 3) + '</small></button>';
      }
      box.innerHTML = html;
      box.querySelectorAll('[data-date]').forEach(function (b) {
        b.onclick = function () {
          st.date = b.dataset.date; st.time = '';
          box.querySelectorAll('[data-date]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          loadSlots(); updateBar();
        };
      });
    }
    function loadSlots() {
      if (!st.date || !st.services.length) return;
      show('s4');
      var box = document.getElementById('slots');
      box.innerHTML = '<span class="muted">Buscando horas libres…</span>';
      api('/api/public/booking/' + slug + '/slots?date=' + st.date + '&services=' + st.services.join(',') + (st.employee ? '&employee=' + st.employee : '')).then(function (r) {
        box.innerHTML = r.slots.length ? r.slots.map(function (t) { return '<button type="button" class="slot" data-time="' + t + '" aria-pressed="' + (t === st.time) + '">' + t + '</button>'; }).join('')
          : '<span class="muted">No quedan horas libres este día. Prueba otro día' + (st.employee ? ' u otra profesional' : '') + '.</span>';
        box.querySelectorAll('[data-time]').forEach(function (b) {
          b.onclick = function () {
            st.time = b.dataset.time;
            box.querySelectorAll('[data-time]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            show('s5'); updateBar();
            document.getElementById('s5').scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        });
      }).catch(function (e) { box.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
    }
    function bind() {
      document.querySelectorAll('[data-svc]').forEach(function (b) {
        b.onclick = function () {
          var id = Number(b.dataset.svc);
          st.services = st.services.indexOf(id) >= 0 ? st.services.filter(function (x) { return x !== id; }) : st.services.concat(id);
          b.setAttribute('aria-pressed', String(st.services.indexOf(id) >= 0));
          st.time = '';
          if (st.services.length) { show('s2'); show('s3'); renderDays(); }
          loadSlots(); updateBar();
        };
      });
      document.querySelectorAll('[data-emp]').forEach(function (b) {
        b.onclick = function () {
          st.employee = b.dataset.emp; st.time = '';
          document.querySelectorAll('[data-emp]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          loadSlots(); updateBar();
        };
      });
      document.getElementById('barNext').onclick = function () {
        var target = st.time ? 's5' : st.date ? 's4' : 's3';
        show(target);
        document.getElementById(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      document.getElementById('s5').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target;
        var msg = document.getElementById('formMsg');
        function err(t) { msg.innerHTML = '<div class="msg err">' + esc(t) + '</div>'; }
        if (!st.time) return err('Elige una hora.');
        if (!f.name.value.trim()) return err('Escribe tu nombre.');
        if (f.phone.value.replace(/\D/g, '').length < 9) return err('Escribe un teléfono válido.');
        if (!f.consent.checked) return err('Para reservar, acepta el uso de tus datos para gestionar la cita.');
        var btn = document.getElementById('confirm');
        btn.disabled = true; btn.textContent = 'Reservando…';
        api('/api/public/booking/' + slug, { method: 'POST', body: {
          service_ids: st.services, employee_id: st.employee || null, date: st.date, start: st.time,
          name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), notes: f.notes.value.trim(), consent: true, website: f.website.value
        } }).then(function (a) {
          try { localStorage.setItem('salonos-cita-' + slug, a.token); } catch (x) { /* sin almacenamiento */ }
          done(a);
        }).catch(function (x) {
          err(x.message); btn.disabled = false; btn.textContent = 'Confirmar reserva';
          if (/hueco/.test(x.message)) loadSlots();
        });
      });
    }
  }

  function summaryHtml(a) {
    return '<div class="summary">' +
      '<div class="row"><span>Cuándo</span><span>' + longDate(a.date) + ' a las ' + a.start + '</span></div>' +
      '<div class="row"><span>Servicios</span><span>' + esc(a.services.map(function (s) { return s.name; }).join(' + ')) + '</span></div>' +
      (a.employee ? '<div class="row"><span>Con</span><span>' + esc(a.employee) + '</span></div>' : '') +
      '<div class="row"><span>Precio orientativo</span><span>' + euro(a.services.reduce(function (s, x) { return s + x.price; }, 0)) + '</span></div>' +
      '</div>';
  }

  function done(a) {
    var pending = a.status === 'pendiente';
    var manageUrl = location.origin + '/reservar/' + slug + '/cita/' + a.token;
    window.scrollTo(0, 0);
    app.innerHTML = '<header class="salon"><small>' + esc(a.salon.name) + '</small><h1>' + (pending ? 'Solicitud enviada' : '¡Cita reservada!') + '</h1></header>' +
      '<section class="step">' +
        '<div class="msg ' + (pending ? 'info' : 'ok') + '">' + (pending ? 'El salón revisará tu solicitud y te confirmará la cita.' : 'Te esperamos. Te enviaremos un recordatorio antes de la cita.') + '</div>' +
        summaryHtml(a) +
        '<div class="actions"><a class="btn primary" href="/api/public/appointment/' + a.token + '/ics">Añadir a mi calendario</a>' +
        '<a class="btn" href="' + esc(manageUrl) + '">Ver o cancelar mi cita</a></div>' +
        '<p class="muted" style="font-size:14px">Guarda este enlace para cambiar o cancelar tu cita: <br><span style="word-break:break-all">' + esc(manageUrl) + '</span></p>' +
      '</section>';
  }

  function manage() {
    api('/api/public/appointment/' + token).then(render).catch(function (e) { fail(e.message); });
    function render(a) {
      var STATUS = { pendiente: ['Pendiente de confirmar', 'info'], confirmada: ['Confirmada', 'ok'], en_curso: ['En curso', 'ok'], completada: ['Completada', 'ok'], cancelada: ['Cancelada', 'err'], no_presentada: ['No asististe', 'err'] };
      var s = STATUS[a.status] || ['', 'info'];
      var canCancel = a.status === 'pendiente' || a.status === 'confirmada';
      document.title = 'Tu cita en ' + a.salon.name;
      app.innerHTML = '<header class="salon"><small>' + esc(a.salon.name) + '</small><h1>Tu cita</h1></header>' +
        '<section class="step"><div class="msg ' + s[1] + '">' + s[0] + '</div>' + summaryHtml(a) +
        '<div class="actions">' + (canCancel ? '<a class="btn" href="/api/public/appointment/' + token + '/ics">Añadir a mi calendario</a><button type="button" class="btn danger" id="cancel">Cancelar la cita</button>' : '') +
        '<a class="btn primary" href="/reservar/' + esc(a.salon.slug) + '">Reservar otra cita</a></div><div id="cmsg"></div></section>';
      var c = document.getElementById('cancel');
      if (c) c.onclick = function () {
        if (c.dataset.sure !== '1') { c.dataset.sure = '1'; c.textContent = 'Sí, cancelar la cita'; document.getElementById('cmsg').innerHTML = '<p class="muted" style="font-size:14px">Pulsa otra vez para confirmar. El hueco quedará libre para otra persona.</p>'; return; }
        c.disabled = true;
        api('/api/public/appointment/' + token + '/cancel', { method: 'POST', body: {} }).then(render).catch(function (e) {
          document.getElementById('cmsg').innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; c.disabled = false;
        });
      };
    }
  }
})();
