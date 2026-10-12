/* Prepara la web comercial para Netlify (o cualquier hosting estático):
   - index.html: la landing, con el formulario conectado a Netlify Forms.
   - demo/: la demo de Salon OS que funciona solo en el navegador.
   Uso: node scripts/build-netlify.mjs [carpeta-destino] [--app-url=https://app.tumarca.es]
   Sin --app-url se quitan los enlaces «Entrar» (aún no hay aplicación publicada). */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const appArg = args.find((a) => a.startsWith('--app-url='));
const appUrl = (appArg ? appArg.slice('--app-url='.length) : process.env.APP_URL || '').replace(/\/+$/, '');
const out = resolve(args.find((a) => !a.startsWith('--')) || join(root, 'netlify-dist'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let html = readFileSync(join(root, 'public', 'landing.html'), 'utf8');
function swap(from, to) {
  if (!html.includes(from)) throw new Error(`No encuentro en landing.html: ${from}`);
  html = html.split(from).join(to);
}

// Netlify detecta el formulario al publicar; el campo «website» es la trampa para bots.
swap('<form class="lead" id="leadForm" novalidate>',
  '<form class="lead" id="leadForm" name="prueba" method="POST" data-netlify="true" netlify-honeypot="website" novalidate>\n        <input type="hidden" name="form-name" value="prueba">');
swap('<a class="btn" href="app" id="demoLink">', '<a class="btn" href="demo/" id="demoLink">');
if (appUrl) {
  swap('href="app"', `href="${appUrl}/app"`);
} else {
  swap('      <a class="btn secondary" href="app" id="loginLink">Entrar</a>\n',
    '      <a class="btn secondary" href="demo/" id="loginLink">Ver la demo</a>\n');
  swap('<a href="app">Entrar en mi cuenta</a>', '<a href="demo/">Ver la demo</a>');
}
swap('<script src="landing.js"></script>', '<script src="netlify-lead.js"></script>\n<script src="landing.js"></script>');
writeFileSync(join(out, 'index.html'), html);

cpSync(join(root, 'public', 'landing.js'), join(out, 'landing.js'));
cpSync(join(root, 'public', 'favicon.svg'), join(out, 'favicon.svg'));
writeFileSync(join(out, 'netlify-lead.js'), `/* Envía la solicitud de prueba a Netlify Forms (ver landing.js). */
window.salonSubmitLead = async function (data) {
  var body = new URLSearchParams(Object.assign({ 'form-name': 'prueba' }, data));
  var res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) throw new Error('No hemos podido enviar la solicitud. Inténtalo de nuevo o escríbenos.');
};
`);

execFileSync(process.execPath, [join(root, 'web-demo', 'build.mjs'), join(out, 'demo')], { stdio: 'ignore' });

console.log(`Web para Netlify lista en ${out}${appUrl ? ` (enlace «Entrar» → ${appUrl}/app)` : ''}`);
