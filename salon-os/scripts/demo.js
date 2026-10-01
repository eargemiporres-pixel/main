/* Arranca la demo en cualquier sistema (Windows, Mac o Linux) y abre el
   navegador. Uso: node scripts/demo.js  ·  node scripts/demo.js --reset */
import { rmSync } from 'node:fs';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nNecesitas Node.js 22.13 o superior (tienes ${process.versions.node}).`);
  console.error('Descarga la versión LTS desde https://nodejs.org, instálala y vuelve a intentarlo.\n');
  process.exit(1);
}

const db = fileURLToPath(new URL('../data/demo.db', import.meta.url));
if (process.argv.includes('--reset')) {
  for (const f of [db, `${db}-wal`, `${db}-shm`]) rmSync(f, { force: true });
  console.log('Demo borrada: se vuelve a generar.');
}

process.env.DEMO = '1';
process.env.DB_PATH = db;
process.env.PORT = process.env.PORT || '3000';

await import('../server.js');

const url = `http://localhost:${process.env.PORT}`;
console.log(`\nAbre ${url} en tu navegador (se abrirá solo en unos segundos).`);
console.log('Para parar la aplicación, cierra esta ventana o pulsa Ctrl + C.\n');
const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
setTimeout(() => exec(cmd, () => {}), 1200);
