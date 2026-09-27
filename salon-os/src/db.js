/* Base de datos: SQLite integrado en Node (node:sqlite), sin dependencias.
   Todo registro de negocio lleva salon_id: cada salón solo ve lo suyo y el
   distribuidor (rol admin) puede consultar todos. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS salons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT DEFAULT '',
  plan TEXT DEFAULT 'Base',
  monthly_fee REAL DEFAULT 0,
  hours_per_employee REAL DEFAULT 160,
  product_target_pct REAL DEFAULT 8,
  opening_float REAL DEFAULT 150,
  api_key TEXT UNIQUE,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'owner')),
  salon_id INTEGER REFERENCES salons(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  gender TEXT DEFAULT 'U' CHECK (gender IN ('M', 'H', 'U')),
  price REAL DEFAULT 0,
  duration_min INTEGER DEFAULT 30,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'retail' CHECK (kind IN ('retail', 'tecnico')),
  price REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  gender TEXT DEFAULT 'U' CHECK (gender IN ('M', 'H', 'U')),
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  client_id INTEGER REFERENCES clients(id),
  employee_id INTEGER REFERENCES employees(id),
  date TEXT NOT NULL,
  time_start TEXT,
  time_end TEXT,
  method TEXT DEFAULT 'tarjeta',
  total REAL NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual',
  external_ref TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_ref)
);
CREATE TABLE IF NOT EXISTS ticket_lines (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product')),
  item_id INTEGER,
  name TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  total REAL DEFAULT 0,
  employee_id INTEGER REFERENCES employees(id),
  duration_min INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS work_hours (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  UNIQUE (employee_id, date)
);
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount REAL NOT NULL,
  category TEXT DEFAULT '',
  method TEXT DEFAULT 'efectivo',
  note TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cash_closings (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  date TEXT NOT NULL,
  opening REAL NOT NULL,
  expected REAL NOT NULL,
  counted REAL NOT NULL,
  diff REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, date)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  date TEXT NOT NULL,
  supplier TEXT DEFAULT '',
  amount REAL NOT NULL,
  kind TEXT DEFAULT 'tecnico' CHECK (kind IN ('tecnico', 'retail', 'mixto')),
  notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tickets_salon_date ON tickets (salon_id, date);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets (client_id);
CREATE INDEX IF NOT EXISTS idx_lines_ticket ON ticket_lines (ticket_id);
CREATE INDEX IF NOT EXISTS idx_clients_salon ON clients (salon_id);
CREATE INDEX IF NOT EXISTS idx_hours_salon_date ON work_hours (salon_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_salon_date ON purchase_orders (salon_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_salon_date ON cash_movements (salon_id, date);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/* Ejecuta fn dentro de una transacción; deshace todo si algo falla. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
