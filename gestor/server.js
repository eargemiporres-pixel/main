/* Muttto · Gestor de Proyectos — servidor para Render.
   Guarda en Postgres si hay DATABASE_URL; si no, en un archivo JSON (solo para pruebas locales). */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // sin variable, las sesiones caducan al reiniciar
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP !== 'false';
const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD || 'Muttto2026!';
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
const checkPw = (pw, h) => { const [salt, key] = String(h).split(':'); if (!key) return false;
  const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(key, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sign = obj => { const p = Buffer.from(JSON.stringify(obj)).toString('base64url'); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
const verify = tok => { const [p, m] = String(tok).split('.'); if (!m) return null;
  const ok = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); if (m.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(ok))) return null;
  const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null; };
const COLLS = ['users', 'projects', 'tasks', 'comments'];
const DEPTS = ['proyectos','operaciones','marketing','logistica','finanzas','formacion','consultoria','comercial'];

/* ---------- Almacén: colecciones de documentos {id, ...} ---------- */
async function makeStore() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
    await pool.query('create table if not exists docs (coll text not null, id text not null, data jsonb not null, primary key (coll, id))');
    return {
      kind: 'postgres',
      async all(c) { return (await pool.query('select data from docs where coll=$1', [c])).rows.map(r => r.data); },
      async put(c, d) { await pool.query('insert into docs(coll,id,data) values($1,$2,$3) on conflict (coll,id) do update set data=$3', [c, d.id, d]); },
      async del(c, id) { await pool.query('delete from docs where coll=$1 and id=$2', [c, id]); }
    };
  }
  const file = process.env.DATA_FILE || path.join(__dirname, 'data.json');
  let db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  COLLS.forEach(c => db[c] = db[c] || []);
  const save = () => fs.writeFileSync(file, JSON.stringify(db));
  return {
    kind: 'archivo',
    async all(c) { return db[c]; },
    async put(c, d) { const i = db[c].findIndex(x => x.id === d.id); if (i >= 0) db[c][i] = d; else db[c].push(d); save(); },
    async del(c, id) { db[c] = db[c].filter(x => x.id !== id); save(); }
  };
}

/* ---------- Datos iniciales (solo si no hay usuarios) ---------- */
const uid = () => crypto.randomUUID();
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
async function seed(store) {
  if ((await store.all('users')).length) return;
  const hash = hashPw(INITIAL_PASSWORD);
  const users = [
    ['proyectos@muttto.com', 'Responsable de Proyectos', 'Reformas e interiorismo', 'proyectos'],
    ['comercial@muttto.com', 'Equipo Comercial', 'Comercial', 'comercial'],
    ['marketing@muttto.com', 'Equipo Marketing', 'Marketing', 'marketing'],
    ['operaciones@muttto.com', 'Equipo Operaciones', 'Operaciones', 'operaciones']
  ].map(([email, name, role, department]) => ({ id: uid(), email, name, role, department, hash }));
  for (const u of users) await store.put('users', u);
  const P = (name, description, department, line, o, status, priority, s, e) =>
    ({ id: uid(), name, description, department, line, owner_id: users[o].id, status, priority, start_date: addDays(s), due_date: addDays(e) });
  const projects = [
    P('Reforma de showroom (EJEMPLO)', 'Proyecto de ejemplo: borra o edita lo que quieras.', 'proyectos', 'reformas', 0, 'en_curso', 'alta', -10, 35),
    P('Lanzamiento Vibro Wellness Suite (EJEMPLO)', 'Plan de lanzamiento comercial y de comunicación.', 'marketing', 'vibro', 2, 'en_curso', 'media', -5, 50),
    P('Catálogo de formaciones Q1 (EJEMPLO)', 'Preparar y publicar el catálogo del trimestre.', 'formacion', 'formacion', 3, 'planificado', 'media', 7, 40)];
  for (const p of projects) await store.put('projects', p);
  const T = (p, title, a, status, priority, s, e) => ({ id: uid(), project_id: projects[p].id, title, notes: '', assignee_id: users[a].id, status, priority, start_date: addDays(s), due_date: addDays(e) });
  const tasks = [
    T(0, 'Medición y levantamiento de planos', 0, 'hecha', 'alta', -10, -6), T(0, 'Presupuesto de obra y proveedores', 0, 'en_curso', 'alta', -5, 3),
    T(0, 'Selección de mobiliario', 1, 'pendiente', 'media', 2, 15), T(0, 'Ejecución de obra', 0, 'pendiente', 'alta', 10, 30),
    T(0, 'Aprobación de muestras', 1, 'revision', 'media', -3, -1), T(1, 'Definir mensajes y claims', 2, 'en_curso', 'media', -5, 5),
    T(1, 'Fotografía de producto', 2, 'pendiente', 'media', 6, 20), T(1, 'Campaña de lanzamiento', 2, 'pendiente', 'alta', 20, 45),
    T(2, 'Revisar contenidos y temarios', 3, 'pendiente', 'media', 7, 20), T(2, 'Maquetar catálogo', 2, 'pendiente', 'baja', 20, 35)];
  for (const t of tasks) await store.put('tasks', t);
}

/* ---------- App ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const ALLOWED = { projects: ['name','description','department','line','owner_id','status','priority','start_date','due_date'],
  tasks: ['project_id','title','notes','assignee_id','status','priority','start_date','due_date'],
  comments: ['task_id','body'] };
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role || '', department: u.department });

(async () => {
  const store = await makeStore();
  await seed(store);

  const send = (res, code, obj, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
  const cookie = (req, name) => (req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === name)?.[1] || '';
  const sessionCookie = (u, clear) => `sid=${clear ? '' : sign({ id: u.id, exp: Date.now() + 30 * 864e5 })}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 30 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  const body = req => new Promise((ok, ko) => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e5) { ko(new Error('grande')); req.destroy(); } });
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } }); });

  async function api(req, res, parts) {
    const m = req.method, route = parts[0];
    if (m === 'POST' && route === 'signup') {
      if (!ALLOW_SIGNUP) return send(res, 403, { error: 'El registro está desactivado.' });
      const { email = '', password = '', name = '', department = 'proyectos' } = await body(req);
      const e = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e) || String(password).length < 6 || !String(name).trim()) return send(res, 400, { error: 'Revisa nombre, correo y contraseña (mín. 6 caracteres).' });
      if ((await store.all('users')).some(u => u.email === e)) return send(res, 409, { error: 'Ese correo ya existe.' });
      const u = { id: uid(), email: e, name: String(name).trim().slice(0, 80), role: '', department: DEPTS.includes(department) ? department : 'proyectos', hash: hashPw(String(password)) };
      await store.put('users', u); return send(res, 200, publicUser(u), { 'Set-Cookie': sessionCookie(u) });
    }
    if (m === 'POST' && route === 'login') {
      const b = await body(req), e = String(b.email || '').trim().toLowerCase();
      const u = (await store.all('users')).find(x => x.email === e);
      if (!u || !checkPw(String(b.password || ''), u.hash)) return send(res, 401, { error: 'Correo o contraseña incorrectos.' });
      return send(res, 200, publicUser(u), { 'Set-Cookie': sessionCookie(u) });
    }
    if (m === 'POST' && route === 'logout') return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(null, true) });

    const tok = verify(cookie(req, 'sid'));
    const user = tok && (await store.all('users')).find(x => x.id === tok.id);
    if (!user) return send(res, 401, { error: 'No has iniciado sesión' });

    if (m === 'GET' && route === 'me') return send(res, 200, publicUser(user));
    if (m === 'GET' && route === 'data') {
      const [users, projects, tasks, comments] = await Promise.all(COLLS.map(c => store.all(c)));
      return send(res, 200, { profiles: users.map(publicUser), projects, tasks, comments });
    }
    const [coll, id] = parts;
    if (!ALLOWED[coll] || !id) return send(res, 404, { error: 'No existe' });
    if (m === 'PUT') {
      const b = await body(req);
      const old = (await store.all(coll)).find(x => x.id === id) || {};
      const doc = { ...old, id };
      for (const k of ALLOWED[coll]) if (k in b) doc[k] = typeof b[k] === 'string' ? b[k].slice(0, 5000) : b[k];
      doc.created_at = old.created_at || new Date().toISOString();
      if (coll === 'comments') doc.author_id = old.author_id || user.id;
      await store.put(coll, doc); return send(res, 200, doc);
    }
    if (m === 'DELETE') {
      const tasks = await store.all('tasks'), comments = await store.all('comments');
      const taskIds = coll === 'projects' ? tasks.filter(t => t.project_id === id).map(t => t.id) : coll === 'tasks' ? [id] : [];
      for (const c of comments.filter(c => taskIds.includes(c.task_id))) await store.del('comments', c.id);
      if (coll === 'projects') for (const t of taskIds) await store.del('tasks', t);
      await store.del(coll, id); return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Método no permitido' });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
      if (p === '/healthz') { res.end('ok'); return; }
      if (p.startsWith('/api/')) return await api(req, res, p.slice(5).split('/').filter(Boolean));
      const file = path.normalize(path.join(__dirname, 'public', p === '/' ? 'index.html' : p));
      if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('No encontrado'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: 'Error del servidor' }); else res.end(); }
  });
  server.listen(PORT, () => console.log(`Gestor Muttto en :${PORT} (almacén: ${store.kind})`));
})();
