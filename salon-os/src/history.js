/* Histórico de facturas, cobros y deudas, bonos y movimientos de caja (lo que
   se trae de otro programa y lo que se registra aquí). */
import { isDate } from './dates.js';

const LIMIT = 500;
const like = (q) => `%${String(q || '').trim().toLowerCase()}%`;

function range(from, to) {
  return { from: isDate(from) ? from : '0000-01-01', to: isDate(to) ? to : '9999-12-31' };
}

export function history(db, salonId, { tab = 'invoices', from, to, q = '', status = '' }) {
  const r = range(from, to);
  const ql = like(q);
  if (tab === 'invoices') {
    const where = `salon_id = ? AND date BETWEEN ? AND ? AND (lower(number) LIKE ? OR lower(client_name) LIKE ? OR lower(client_tax_id) LIKE ? OR lower(concept) LIKE ?)${status ? ' AND status = ?' : ''}`;
    const args = [salonId, r.from, r.to, ql, ql, ql, ql, ...(status ? [status] : [])];
    const totals = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status <> 'anulada' THEN total END), 0) AS total,
        COALESCE(SUM(CASE WHEN status <> 'anulada' THEN base END), 0) AS base, COALESCE(SUM(CASE WHEN status <> 'anulada' THEN tax END), 0) AS tax,
        COALESCE(SUM(CASE WHEN status IN ('pendiente', 'parcial') THEN total - paid END), 0) AS pending FROM invoices WHERE ${where}`).get(...args);
    const rows = db.prepare(`SELECT * FROM invoices WHERE ${where} ORDER BY date DESC, series DESC, number DESC LIMIT ${LIMIT}`).all(...args);
    return { tab, totals, rows };
  }
  if (tab === 'payments') {
    const where = `salon_id = ? AND date BETWEEN ? AND ? AND (lower(client_name) LIKE ? OR lower(concept) LIKE ? OR lower(invoice_number) LIKE ?)${status ? ' AND status = ?' : ''}`;
    const args = [salonId, r.from, r.to, ql, ql, ql, ...(status ? [status] : [])];
    const totals = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status <> 'devuelto' THEN paid END), 0) AS collected,
        COALESCE(SUM(CASE WHEN status <> 'devuelto' THEN pending END), 0) AS pending FROM payments WHERE ${where}`).get(...args);
    const rows = db.prepare(`SELECT * FROM payments WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${LIMIT}`).all(...args);
    const debtors = db.prepare(`SELECT client_name, client_id, SUM(pending) AS pending, COUNT(*) AS n FROM payments
        WHERE salon_id = ? AND pending > 0 AND status <> 'devuelto' GROUP BY lower(client_name) ORDER BY pending DESC LIMIT 10`).all(salonId);
    return { tab, totals, rows, debtors };
  }
  if (tab === 'vouchers') {
    const where = `salon_id = ? AND (lower(client_name) LIKE ? OR lower(description) LIKE ? OR lower(code) LIKE ?)${status ? ' AND status = ?' : ''}`;
    const args = [salonId, ql, ql, ql, ...(status ? [status] : [])];
    const totals = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status = 'activo' THEN 1 END), 0) AS active,
        COALESCE(SUM(CASE WHEN status = 'activo' AND sessions_total IS NOT NULL THEN sessions_total - sessions_used END), 0) AS sessions,
        COALESCE(SUM(CASE WHEN status = 'activo' AND kind = 'tarjeta' THEN balance END), 0) AS balance FROM vouchers WHERE ${where}`).get(...args);
    const rows = db.prepare(`SELECT * FROM vouchers WHERE ${where} ORDER BY status = 'activo' DESC, expires IS NULL, expires, id DESC LIMIT ${LIMIT}`).all(...args);
    return { tab, totals, rows };
  }
  // Caja: movimientos y cierres.
  const where = `salon_id = ? AND date BETWEEN ? AND ? AND (lower(note) LIKE ? OR lower(category) LIKE ?)${status ? ' AND direction = ?' : ''}`;
  const args = [salonId, r.from, r.to, ql, ql, ...(status ? [status] : [])];
  const totals = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN direction = 'in' THEN amount END), 0) AS in_total,
      COALESCE(SUM(CASE WHEN direction = 'out' THEN amount END), 0) AS out_total FROM cash_movements WHERE ${where}`).get(...args);
  const rows = db.prepare(`SELECT * FROM cash_movements WHERE ${where} ORDER BY date DESC, id DESC LIMIT ${LIMIT}`).all(...args);
  const closings = db.prepare('SELECT * FROM cash_closings WHERE salon_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC LIMIT 60').all(salonId, r.from, r.to);
  return { tab: 'cash', totals, rows, closings };
}

/* Lo que hay que tener presente de una clienta al atenderla. */
export function clientMoney(db, salonId, clientId) {
  return {
    vouchers: db.prepare("SELECT * FROM vouchers WHERE salon_id = ? AND client_id = ? ORDER BY status = 'activo' DESC, id DESC LIMIT 20").all(salonId, clientId),
    pending: db.prepare("SELECT COALESCE(SUM(pending), 0) AS s FROM payments WHERE salon_id = ? AND client_id = ? AND status <> 'devuelto'").get(salonId, clientId).s
      + db.prepare("SELECT COALESCE(SUM(total - paid), 0) AS s FROM invoices WHERE salon_id = ? AND client_id = ? AND status IN ('pendiente', 'parcial')").get(salonId, clientId).s,
    invoices: db.prepare('SELECT id, number, series, date, total, status FROM invoices WHERE salon_id = ? AND client_id = ? ORDER BY date DESC LIMIT 10').all(salonId, clientId)
  };
}
