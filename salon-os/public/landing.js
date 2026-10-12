/* Envío de la solicitud de prueba. En el servidor de Salon OS va a /api/leads
   y aparece en la consola del distribuidor. Una página que aloje esta web en
   otro sitio puede definir window.salonSubmitLead(datos) para guardarla. */
(function () {
  var form = document.getElementById('leadForm');
  var msg = document.getElementById('leadMsg');
  var btn = document.getElementById('leadSubmit');
  function show(text, ok) {
    msg.textContent = text;
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    msg.hidden = false;
  }
  async function submitLead(data) {
    if (typeof window.salonSubmitLead === 'function') return window.salonSubmitLead(data);
    var res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(out.error || 'No hemos podido enviar la solicitud. Inténtalo de nuevo.');
  }
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim()) return show('Escribe tu nombre.', false);
    if (!data.email.trim() && !data.phone.trim()) return show('Déjanos un email o un teléfono para contactarte.', false);
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return show('Revisa el email: parece incompleto.', false);
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      await submitLead(data);
      form.reset();
      show('¡Recibido! Te contactamos en menos de 24 horas laborables para preparar tu prueba.', true);
    } catch (err) {
      show(err.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Quiero mi prueba gratis';
    }
  });
})();
