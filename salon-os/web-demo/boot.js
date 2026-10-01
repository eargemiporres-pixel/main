/* Demo en el navegador: ejecuta el mismo servidor de Salon OS dentro de la
   página. La base de datos SQLite vive en memoria (sql.js), se llena con los
   datos de ejemplo y las llamadas a /api/ se atienden aquí mismo sin red.
   Al recargar la página la demo empieza de cero. */
import { Bytes } from 'node:crypto';

// Sin process.versions: sql.js lo usaría para creerse dentro de Node.
globalThis.process = { env: { DEMO: '1' } };
globalThis.Buffer = {
  from: (s) => Bytes.fromHex(s),
  concat: (chunks) => { const text = chunks.join(''); return { toString: () => text }; }
};

const status = document.getElementById('bootStatus');
const say = (t) => { if (status) status.textContent = t; };

/* Sustituye fetch('/api/…') por una llamada directa al manejador del servidor. */
function serveApiInPage(handle) {
  const realFetch = window.fetch.bind(window);
  let sid = null;
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);
    return new Promise((resolve) => {
      const headers = {};
      for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = v;
      if (sid) headers.cookie = `sid=${sid}`;
      const listeners = {};
      const req = {
        url,
        method: (init.method || 'GET').toUpperCase(),
        headers,
        socket: { remoteAddress: 'navegador' },
        on(ev, cb) { listeners[ev] = cb; return req; },
        destroy() {}
      };
      const resHeaders = {};
      let code = 200;
      const res = {
        setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
        writeHead(s, h = {}) { code = s; for (const [k, v] of Object.entries(h)) resHeaders[k.toLowerCase()] = v; },
        end(body) {
          const cookie = resHeaders['set-cookie'];
          if (cookie) {
            const m = /^sid=([^;]*)/.exec(cookie);
            sid = m && m[1] ? m[1] : null;
            delete resHeaders['set-cookie'];
          }
          resolve(new Response(body ?? null, { status: code, headers: resHeaders }));
        }
      };
      handle(req, res);
      setTimeout(() => {
        if (init.body != null) listeners.data?.(String(init.body));
        listeners.end?.();
      }, 0);
    });
  };
}

try {
  if (!window.initSqlJs) throw new Error('no se pudo cargar el motor de base de datos (sql.js).');
  say('Preparando la base de datos…');
  const SQL = await window.initSqlJs();
  (await import('node:sqlite')).setSql(SQL);
  const { openDb } = await import('./src/db.js');
  const { seedDemo } = await import('./src/seed.js');
  const { createApp } = await import('./src/app.js');
  say('Generando 20 meses de actividad de 6 salones de ejemplo…');
  await new Promise((r) => setTimeout(r, 40));
  const db = openDb(':memory:');
  seedDemo(db);
  serveApiInPage(createApp(db));
  await import('./ui.js');
} catch (err) {
  console.error(err);
  say(`No se pudo arrancar la demo: ${err.message} Recarga la página para intentarlo de nuevo.`);
}
