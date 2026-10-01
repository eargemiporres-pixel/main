/* Sustituto de node:sqlite para el navegador, sobre sql.js (SQLite compilado
   a JavaScript). Implementa solo lo que usa Salon OS: exec, prepare y
   get/all/run con parámetros posicionales. Las sentencias se reutilizan. */
let SQL = null;
export function setSql(sql) { SQL = sql; }

const params = (args) => args.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));

class Statement {
  constructor(owner, sql) {
    this.owner = owner;
    this.st = owner.db.prepare(sql);
  }
  #bind(args) {
    this.st.reset();
    if (args.length) this.st.bind(params(args));
  }
  all(...args) {
    try {
      this.#bind(args);
      const out = [];
      while (this.st.step()) out.push(this.st.getAsObject());
      return out;
    } finally { this.st.reset(); }
  }
  get(...args) {
    try {
      this.#bind(args);
      return this.st.step() ? this.st.getAsObject() : undefined;
    } finally { this.st.reset(); }
  }
  run(...args) {
    try {
      this.#bind(args);
      this.st.step();
    } finally { this.st.reset(); }
    const db = this.owner;
    return { changes: db.db.getRowsModified(), lastInsertRowid: db.lastId() };
  }
}

export class DatabaseSync {
  constructor() {
    if (!SQL) throw new Error('sql.js no está cargado');
    this.db = new SQL.Database();
    this.cache = new Map();
  }
  exec(sql) { this.db.exec(sql); }
  prepare(sql) {
    let st = this.cache.get(sql);
    if (!st) { st = new Statement(this, sql); this.cache.set(sql, st); }
    return st;
  }
  lastId() {
    if (!this.idStmt) this.idStmt = this.db.prepare('SELECT last_insert_rowid()');
    this.idStmt.step();
    const id = this.idStmt.get()[0];
    this.idStmt.reset();
    return id;
  }
}
