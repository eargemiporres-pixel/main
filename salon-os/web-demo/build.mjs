/* Prepara la demo que funciona solo en el navegador (sin servidor), lista
   para publicarse en cualquier hosting estático (GitHub Pages, Netlify…).
   Uso: node web-demo/build.mjs [carpeta-destino]   (por defecto web-demo/dist) */
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(process.argv[2] || join(root, 'web-demo', 'dist'));
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'src'), { recursive: true });

cpSync(join(root, 'web-demo', 'index.html'), join(out, 'index.html'));
cpSync(join(root, 'web-demo', 'boot.js'), join(out, 'boot.js'));
cpSync(join(root, 'web-demo', 'shims'), join(out, 'shims'), { recursive: true });
cpSync(join(root, 'public', 'styles.css'), join(out, 'styles.css'));
cpSync(join(root, 'public', 'favicon.svg'), join(out, 'favicon.svg'));
cpSync(join(root, 'public', 'app.js'), join(out, 'ui.js'));
for (const f of readdirSync(join(root, 'src'))) cpSync(join(root, 'src', f), join(out, 'src', f));

console.log(`Demo para navegador lista en ${out}`);
