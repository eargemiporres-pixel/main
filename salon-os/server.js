/* Arranque de Salon OS.
   Variables de entorno:
     PORT            puerto HTTP (por defecto 3000)
     DB_PATH         archivo SQLite (por defecto ./data/salon-os.db)
     DEMO=1          si la base está vacía, la llena con datos de demostración
     ADMIN_EMAIL / ADMIN_PASSWORD   crea la cuenta del distribuidor en el primer arranque
     COOKIE_SECURE=1 marca la cookie de sesión como Secure (detrás de HTTPS) */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from './src/db.js';
import { createApp } from './src/app.js';
import { seedDemo } from './src/seed.js';
import { hashPassword } from './src/auth.js';

const db = openDb(process.env.DB_PATH || fileURLToPath(new URL('./data/salon-os.db', import.meta.url)));

if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  if (process.env.DEMO === '1') {
    console.log('Base de datos vacía: cargando datos de demostración…');
    seedDemo(db);
    console.log('Demo lista. Distribuidor: admin@demo.com · Salón: norte@demo.com · contraseña: demo1234');
  } else {
    const email = (process.env.ADMIN_EMAIL || 'admin@salon-os.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');
    db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, 'Distribuidor', ?, 'admin')").run(email, hashPassword(password));
    console.log(`Cuenta de distribuidor creada: ${email}${process.env.ADMIN_PASSWORD ? '' : ` · contraseña: ${password} (cámbiala al entrar)`}`);
  }
}

const port = Number(process.env.PORT) || 3000;
createServer(createApp(db)).listen(port, () => console.log(`Salon OS escuchando en http://localhost:${port}`));
