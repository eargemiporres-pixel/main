/* Cuentas: alta libre de salones, prueba gratuita, recuperar la contraseña y
   usuarios del equipo de cada salón. */
import { randomBytes, scryptSync } from 'node:crypto';
import { tx } from './db.js';
import { hashPassword, newApiKey } from './auth.js';
import { today, addDays, daysBetween } from './dates.js';
import { ensureTemplates } from './messaging.js';
import { ensureBookingSetup } from './agenda.js';

export const ROLES = { owner: 'Dueño/a', staff: 'Equipo' };
const RESET_HOURS = 24;
export const trialDays = () => Math.max(1, Math.min(365, Number(process.env.TRIAL_DAYS) || 30));
export const signupOpen = () => process.env.SIGNUP !== '0';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);

export class AccountError extends Error {}
const fail = (msg) => { throw new AccountError(msg); };

function checkPassword(p) {
  if (String(p ?? '').length < 8) fail('La contraseña debe tener al menos 8 caracteres');
}

function checkEmail(db, email, exceptId = null) {
  if (!EMAIL.test(email)) fail('El email no parece válido');
  const other = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (other && other.id !== exceptId) fail('Ya existe una cuenta con ese email. Si es tuya, entra o recupera la contraseña.');
}

/* Alta libre: crea el salón en prueba gratuita y su usuario dueño. */
export function signup(db, body) {
  const salonName = clean(body.salon_name);
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  if (!salonName) fail('Escribe el nombre de tu salón');
  if (!name) fail('Escribe tu nombre');
  checkEmail(db, email);
  checkPassword(body.password);
  if (body.accept !== true) fail('Para crear la cuenta tienes que aceptar las condiciones y la política de privacidad');
  return tx(db, () => {
    const s = db.prepare(`INSERT INTO salons (name, city, phone, plan, monthly_fee, api_key, trial_ends, signup_source)
        VALUES (?, ?, ?, 'Prueba', 0, ?, ?, 'registro')`)
      .run(salonName, clean(body.city, 80), clean(body.phone, 40), newApiKey(), addDays(today(), trialDays()));
    const salonId = Number(s.lastInsertRowid);
    const u = db.prepare("INSERT INTO users (email, name, password_hash, role, salon_id) VALUES (?, ?, ?, 'owner', ?)")
      .run(email, name, hashPassword(body.password), salonId);
    ensureTemplates(db, salonId);
    ensureBookingSetup(db, db.prepare('SELECT * FROM salons WHERE id = ?').get(salonId));
    return { salonId, userId: Number(u.lastInsertRowid) };
  });
}

/* Estado de la prueba gratuita. Los salones sin fecha de fin no caducan. */
export function trialInfo(salon) {
  if (!salon || salon.plan !== 'Prueba' || !salon.trial_ends) return null;
  const left = daysBetween(today(), salon.trial_ends);
  return { ends: salon.trial_ends, days_left: Math.max(0, left), expired: left < 0 };
}

/* --- Recuperar la contraseña --- */
const hashToken = (t) => scryptSync(t, 'salonpro-reset', 32).toString('hex');

export function createResetToken(db, userId) {
  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + RESET_HOURS * 3600000).toISOString();
  db.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').run(userId, new Date().toISOString());
  db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expires);
  return token;
}

export function resetPassword(db, token, password) {
  if (!/^[a-f0-9]{48}$/.test(String(token ?? ''))) fail('El enlace no es válido. Pide uno nuevo.');
  checkPassword(password);
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hashToken(token));
  if (!row || row.used || row.expires_at < new Date().toISOString()) fail('El enlace ha caducado o ya se usó. Pide uno nuevo.');
  tx(db, () => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(row.token_hash);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });
  return row.user_id;
}

export const resetLink = (origin, token) => `${origin}/app#/restablecer?codigo=${token}`;

/* --- Usuarios del equipo de un salón --- */
export function listTeamUsers(db, salonId) {
  return db.prepare(`SELECT u.id, u.email, u.name, u.role, u.employee_id, u.active, u.created_at, e.name AS employee_name
      FROM users u LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.salon_id = ? ORDER BY u.role = 'staff', u.name`).all(salonId);
}

function checkEmployee(db, salonId, employeeId) {
  if (employeeId == null || employeeId === '') return null;
  const e = db.prepare('SELECT id FROM employees WHERE id = ? AND salon_id = ?').get(Number(employeeId), salonId);
  if (!e) fail('Esa persona del equipo no existe');
  return e.id;
}

const activeOwners = (db, salonId, exceptId) => db.prepare(
  "SELECT COUNT(*) AS n FROM users WHERE salon_id = ? AND role = 'owner' AND active = 1 AND id != ?").get(salonId, exceptId).n;

export function createTeamUser(db, salonId, body) {
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  if (!name) fail('Escribe el nombre');
  checkEmail(db, email);
  checkPassword(body.password);
  const role = body.role === 'owner' ? 'owner' : 'staff';
  const r = db.prepare('INSERT INTO users (email, name, password_hash, role, salon_id, employee_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(email, name, hashPassword(body.password), role, salonId, checkEmployee(db, salonId, body.employee_id));
  return { id: Number(r.lastInsertRowid) };
}

export function updateTeamUser(db, salonId, userId, actingUserId, body) {
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND salon_id = ?').get(userId, salonId);
  if (!u) fail('Usuario no encontrado');
  const name = body.name !== undefined ? clean(body.name) : u.name;
  if (!name) fail('Escribe el nombre');
  const email = body.email !== undefined ? clean(body.email).toLowerCase() : u.email;
  if (email !== u.email) checkEmail(db, email, u.id);
  const role = body.role === undefined ? u.role : body.role === 'owner' ? 'owner' : 'staff';
  const active = body.active === undefined ? u.active : body.active ? 1 : 0;
  const losesOwner = u.role === 'owner' && u.active && (role !== 'owner' || !active);
  if (losesOwner && activeOwners(db, salonId, u.id) === 0) fail('El salón necesita al menos un dueño con acceso');
  if (u.id === actingUserId && !active) fail('No puedes desactivar tu propio usuario');
  const employeeId = body.employee_id !== undefined ? checkEmployee(db, salonId, body.employee_id) : u.employee_id;
  tx(db, () => {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, employee_id = ? WHERE id = ?').run(name, email, role, active, employeeId, u.id);
    if (body.password) {
      checkPassword(body.password);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), u.id);
    }
    if (!active || body.password) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  });
  return { ok: true };
}

export function deleteTeamUser(db, salonId, userId, actingUserId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND salon_id = ?').get(userId, salonId);
  if (!u) fail('Usuario no encontrado');
  if (u.id === actingUserId) fail('No puedes borrar tu propio usuario');
  if (u.role === 'owner' && u.active && activeOwners(db, salonId, u.id) === 0) fail('El salón necesita al menos un dueño con acceso');
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  return { ok: true };
}
