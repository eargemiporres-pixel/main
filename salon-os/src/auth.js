/* Contraseñas (scrypt con sal) y sesiones por cookie HttpOnly. */
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(String(password), salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export function newApiKey() {
  return `sk_${randomBytes(24).toString('hex')}`;
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export function sessionUser(db, token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(`SELECT u.id, u.email, u.name, u.role, u.salon_id, u.employee_id, u.guides FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`).get(token, new Date().toISOString()) || null;
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/* Límite sencillo de intentos por IP (en memoria): login, altas y avisos. */
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  return {
    allowed(ip) {
      const now = Date.now();
      const a = (hits.get(ip) || []).filter((t) => now - t < windowMs);
      hits.set(ip, a);
      return a.length < max;
    },
    hit(ip) {
      const a = hits.get(ip) || [];
      a.push(Date.now());
      hits.set(ip, a);
    }
  };
}
const logins = rateLimiter(10, 15 * 60000);
export const loginAllowed = (ip) => logins.allowed(ip);
export const loginFailed = (ip) => logins.hit(ip);
