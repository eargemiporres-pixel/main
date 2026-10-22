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
  role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'staff')),
  salon_id INTEGER REFERENCES salons(id),
  employee_id INTEGER REFERENCES employees(id),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
-- Enlaces de un solo uso para cambiar la contraseña (se guarda el hash del código).
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
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
-- Histórico traído de otros programas: facturas, cobros y deudas, bonos y tarjetas regalo.
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  number TEXT NOT NULL,
  series TEXT DEFAULT '',
  date TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  client_tax_id TEXT DEFAULT '',
  concept TEXT DEFAULT '',
  base REAL DEFAULT 0,
  tax_rate REAL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL DEFAULT 0,
  status TEXT DEFAULT 'pagada' CHECK (status IN ('pagada', 'pendiente', 'parcial', 'anulada')),
  method TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  external_ref TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_ref)
);
CREATE INDEX IF NOT EXISTS idx_invoices_salon_date ON invoices (salon_id, date);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  date TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  concept TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  paid REAL DEFAULT 0,
  pending REAL DEFAULT 0,
  method TEXT DEFAULT '',
  status TEXT DEFAULT 'cobrado' CHECK (status IN ('cobrado', 'pendiente', 'parcial', 'devuelto')),
  invoice_number TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  external_ref TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_ref)
);
CREATE INDEX IF NOT EXISTS idx_payments_salon_date ON payments (salon_id, date);
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  code TEXT DEFAULT '',
  kind TEXT DEFAULT 'bono' CHECK (kind IN ('bono', 'tarjeta')),
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  sessions_total INTEGER,
  sessions_used INTEGER DEFAULT 0,
  amount REAL DEFAULT 0,
  balance REAL,
  purchased TEXT,
  expires TEXT,
  status TEXT DEFAULT 'activo' CHECK (status IN ('activo', 'agotado', 'caducado', 'anulado')),
  source TEXT DEFAULT 'manual',
  external_ref TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_ref)
);
CREATE INDEX IF NOT EXISTS idx_vouchers_client ON vouchers (client_id);
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

-- Comunicación con clientes: una conversación por cliente y canal.
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  client_id INTEGER REFERENCES clients(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'instagram', 'web')),
  contact TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  status TEXT DEFAULT 'abierta' CHECK (status IN ('abierta', 'pendiente', 'cerrada')),
  assigned_to INTEGER REFERENCES employees(id),
  unread INTEGER DEFAULT 0,
  last_message_at TEXT,
  last_inbound_at TEXT,
  last_preview TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, channel, contact)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT NOT NULL,
  status TEXT DEFAULT 'enviado',
  external_id TEXT,
  template TEXT,
  author TEXT DEFAULT '',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_id)
);
CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL
);
-- Lo que se va sabiendo de cada cliente por sus conversaciones.
CREATE TABLE IF NOT EXISTS client_insights (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  data TEXT NOT NULL,
  source TEXT DEFAULT 'reglas',
  updated_at TEXT DEFAULT (datetime('now'))
);
-- Canales conectados por salón (WhatsApp Business, email).
CREATE TABLE IF NOT EXISTS salon_channels (
  salon_id INTEGER PRIMARY KEY REFERENCES salons(id),
  wa_phone_number_id TEXT DEFAULT '',
  wa_token TEXT DEFAULT '',
  wa_number TEXT DEFAULT '',
  email_api_key TEXT DEFAULT '',
  email_from TEXT DEFAULT ''
);
-- Solicitudes de prueba que llegan desde la web comercial.
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  salon_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  team_size TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'en prueba', 'cliente', 'descartado')),
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
-- Agenda: citas con uno o varios servicios.
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  employee_id INTEGER REFERENCES employees(id),
  date TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  status TEXT DEFAULT 'confirmada' CHECK (status IN ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada', 'no_presentada')),
  source TEXT DEFAULT 'salon',
  external_ref TEXT,
  notes TEXT DEFAULT '',
  token TEXT,
  ticket_id INTEGER REFERENCES tickets(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (salon_id, external_ref)
);
CREATE TABLE IF NOT EXISTS appointment_services (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  name TEXT NOT NULL,
  duration_min INTEGER DEFAULT 0,
  price REAL DEFAULT 0
);
-- Calendarios externos (iCal) que se copian en la agenda.
CREATE TABLE IF NOT EXISTS calendar_feeds (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  name TEXT DEFAULT '',
  url TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  last_sync TEXT,
  last_result TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_appt_salon_date ON appointments (salon_id, date);
CREATE INDEX IF NOT EXISTS idx_appt_client ON appointments (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_token ON appointments (token);

-- Servicios en curso: se empiezan con el cronómetro y se cierran al cobrar.
CREATE TABLE IF NOT EXISTS open_visits (
  id INTEGER PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id),
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  employee_id INTEGER REFERENCES employees(id),
  lines TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_salon ON conversations (salon_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_conv_client ON conversations (client_id);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, created_at);
`;

/* Columnas añadidas después de la primera versión: se crean en bases de
   datos existentes sin perder datos. */
const MIGRATIONS = [
  // De dónde salen la hora de inicio y fin: 'cronometro' (medido en el salón),
  // 'tpv'/'csv'/'api' (vienen del sistema de caja) o 'manual' (tecleadas).
  ['tickets', 'time_source', "TEXT DEFAULT ''"],
  // Precio mínimo por minuto para considerar un servicio rentable.
  ['salons', 'min_price_minute', 'REAL DEFAULT 0.85'],
  // Agenda y reservas online.
  ['salons', 'schedule', "TEXT DEFAULT ''"],
  ['salons', 'booking_slug', 'TEXT'],
  ['salons', 'booking_enabled', 'INTEGER DEFAULT 1'],
  ['salons', 'booking_auto_confirm', 'INTEGER DEFAULT 1'],
  ['salons', 'calendar_token', 'TEXT'],
  ['open_visits', 'appointment_id', 'INTEGER'],
  // Alta libre: fin de la prueba gratuita y de dónde viene el salón.
  ['salons', 'trial_ends', 'TEXT'],
  ['salons', 'signup_source', "TEXT DEFAULT 'distribuidor'"],
  ['salons', 'phone', "TEXT DEFAULT ''"],
  // Migración desde otros programas.
  ['clients', 'birthdate', "TEXT DEFAULT ''"],
  ['clients', 'import_source', "TEXT DEFAULT ''"],
  ['clients', 'tax_id', "TEXT DEFAULT ''"],
  // Movimientos de caja importados: la referencia evita duplicados al reimportar.
  ['cash_movements', 'external_ref', 'TEXT'],
  // Asistente de WhatsApp con IA.
  ['salons', 'ai_enabled', 'INTEGER DEFAULT 0'],
  ['salons', 'ai_mode', "TEXT DEFAULT 'borrador'"],
  ['salons', 'ai_name', "TEXT DEFAULT ''"],
  ['salons', 'ai_info', "TEXT DEFAULT ''"],
  ['salons', 'ai_when', "TEXT DEFAULT 'siempre'"],
  ['conversations', 'ai_paused', 'INTEGER DEFAULT 0'],
  ['conversations', 'ai_draft', "TEXT DEFAULT ''"],
  ['conversations', 'ai_note', "TEXT DEFAULT ''"],
  // Guías de la aplicación que cada persona ya ha visto (lista JSON).
  ['users', 'guides', "TEXT DEFAULT '[]'"]
];

/* La primera versión solo admitía los roles admin y owner. SQLite no deja
   cambiar un CHECK, así que se rehace la tabla conservando los datos. */
function upgradeUsers(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!row || row.sql.includes("'staff'")) return;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`CREATE TABLE users_new (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'staff')),
      salon_id INTEGER REFERENCES salons(id),
      employee_id INTEGER REFERENCES employees(id),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, email, name, password_hash, role, salon_id, created_at)
      SELECT id, email, name, password_hash, role, salon_id, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;`);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function migrate(db) {
  for (const [table, column, def] of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_ext ON cash_movements (salon_id, external_ref)');
}

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  upgradeUsers(db);
  db.exec(SCHEMA);
  migrate(db);
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
