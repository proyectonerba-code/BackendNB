/**
 * Grupo NERBA HIDALGO - Capa Postgres (Railway).
 * Sin DATABASE_URL el backend usa JSON local como siempre (dev intacto).
 * Con DATABASE_URL: misma interfaz, tablas como fuente de verdad.
 * Requiere dependencia "pg" (solo se carga si hay DATABASE_URL).
 */
let pool = null;

function isEnabled() {
  return !!String(process.env.DATABASE_URL || '').trim();
}

function getPool() {
  if (pool) return pool;
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === '0' ? false : { rejectUnauthorized: false },
  });
  pool.on('error', (e) => console.log('PG pool: ' + e.message));
  return pool;
}

async function init() {
  const p = getPool();
  // KV genérico por tabla: clave -> JSONB. Simple y fiel a las formas actuales.
  await p.query(`CREATE TABLE IF NOT EXISTS kv_users (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_sessions (key TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at BIGINT NOT NULL, data JSONB)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_quotes (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_productos (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_marcas (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_categorias (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_contacto (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_mantenimiento (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_auditoria (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_recuperacion (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
}

async function replaceAll(table, obj) {
  const p = getPool();
  const entries = Object.entries(obj || {});
  await p.query('BEGIN');
  try {
    await p.query(`DELETE FROM ${table}`);
    for (const [k, v] of entries) {
      if (table === 'kv_sessions') {
        await p.query(`INSERT INTO ${table} (key, email, expires_at, data) VALUES ($1,$2,$3,$4)`, [k, String((v && v.email) || ''), Number((v && v.expiresAt) || 0), v || {}]);
      } else {
        await p.query(`INSERT INTO ${table} (key, data) VALUES ($1,$2)`, [k, v === undefined ? null : v]);
      }
    }
    await p.query('COMMIT');
  } catch (e) {
    await p.query('ROLLBACK');
    throw e;
  }
}

async function loadAll(table) {
  const p = getPool();
  const r = await p.query(`SELECT key, data FROM ${table}`);
  const out = {};
  for (const row of r.rows) out[row.key] = row.data;
  return out;
}

async function loadSessions() {
  const p = getPool();
  const r = await p.query(`SELECT key, email, expires_at FROM kv_sessions WHERE expires_at > $1`, [Date.now()]);
  const out = {};
  for (const row of r.rows) out[row.key] = { email: row.email, expiresAt: Number(row.expires_at) };
  return out;
}

async function loadList(table) {
  const p = getPool();
  const r = await p.query(`SELECT data FROM ${table} ORDER BY key`);
  return r.rows.map((x) => x.data);
}

async function loadAllState() {
  const [users, sessions, quotes, productos, marcas, categorias, contacto, mant, auditoria, recup] = await Promise.all([
    loadAll('kv_users'),
    loadSessions(),
    loadAll('kv_quotes'),
    loadAll('kv_productos'),
    loadAll('kv_marcas'),
    loadAll('kv_categorias'),
    loadList('kv_contacto'),
    loadList('kv_mantenimiento'),
    loadAll('kv_auditoria'),
    loadAll('kv_recuperacion'),
  ]);
  const items = Object.values(auditoria || {}).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  let lastHash = 'GENESIS';
  try {
    const m = getPool().query(`SELECT value FROM kv_meta WHERE key='audit_last'`);
    const r = await m;
    if (r.rows[0]) lastHash = r.rows[0].value;
  } catch {}
  if (items.length) lastHash = items[items.length - 1].hash || lastHash;
  return { users, sessions, quotes, productos: Object.values(productos || {}), marcas, categorias, contacto, mant, recup: recup || {}, audit: { items, lastHash } };
}

// Escritura directa (write-through). Fire-and-forget desde server.js.
function wt(promise) {
  Promise.resolve(promise).catch((e) => console.log('Aviso PG write: ' + e.message));
}

module.exports = { isEnabled, init, replaceAll, loadAllState, wt, getPool };
