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
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
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
  await p.query(`CREATE TABLE IF NOT EXISTS kv_servicios (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_marcas (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_categorias (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_contacto (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_mantenimiento (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_auditoria (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_recuperacion (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  // Avisos personalizados del staff a usuarios (campana). Una fila por aviso.
  await p.query(`CREATE TABLE IF NOT EXISTS kv_avisos (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  // Archivo de fotos. Son DOS tablas a proposito: el indice guarda solo datos
  // pequenos (folio, cuantas fotos, cuanto pesan) y los bytes viven aparte. Si
  // estuvieran juntos, abrir la lista del archivo traeria todas las imagenes a
  // memoria, que es justo lo que el archivo existe para evitar.
  await p.query(`CREATE TABLE IF NOT EXISTS kv_fotos_archivo (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv_fotos_bin (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
}

// Lee UNA fila, bajo demanda. Las fotos archivadas NO se cargan al arrancar:
// se piden solo cuando hacen falta (al armar un PDF, al verlas, al bajar el ZIP).
async function get(table, key) {
  const p = getPool();
  const r = await p.query(`SELECT data FROM ${table} WHERE key = $1`, [key]);
  return r.rows[0] ? r.rows[0].data : null;
}

// Un solo reemplazo por tabla a la vez. Sin esto, dos escrituras simultaneas
// (p.ej. dos clientes que se registran al tiempo) se intercalaban en el pool:
// una hacia DELETE, la otra tambien, y luego ambas INSERTaban la misma clave
// ("duplicate key value violates unique constraint").
const COLAS = {};

// Escribe UNA fila, sin tocar las demas.
//
// Antes cada cambio (aprobar una cotizacion, editar un usuario) llamaba a
// replaceAll, que reescribia la tabla COMPLETA fila por fila dentro de una
// transaccion. Con 400 cotizaciones, aprobar una sola reescribia las 400: cada
// estado de una cita tardaba segundos y multiplicaba el trafico a la base.
async function upsert(table, key, valor) {
  const previo = COLAS[table] || Promise.resolve();
  COLAS[table] = previo.catch(() => {}).then(() => ejecutarUpsert(table, key, valor));
  return COLAS[table];
}

async function ejecutarUpsert(table, key, valor) {
  const p = getPool();
  const client = await p.connect();
  try {
    if (table === 'kv_sessions') {
      await client.query(
        `INSERT INTO ${table} (key, email, expires_at, data) VALUES ($1,$2,$3,$4)
         ON CONFLICT (key) DO UPDATE SET email=EXCLUDED.email, expires_at=EXCLUDED.expires_at, data=EXCLUDED.data`,
        [key, String((valor && valor.email) || ''), Number((valor && valor.expiresAt) || 0), valor || {}]
      );
    } else {
      await client.query(
        `INSERT INTO ${table} (key, data) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`,
        [key, valor === undefined ? null : valor]
      );
    }
  } finally {
    client.release();
  }
}

// Borra una sola fila (para las bajas).
async function borrar(table, key) {
  const previo = COLAS[table] || Promise.resolve();
  COLAS[table] = previo.catch(() => {}).then(async () => {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query(`DELETE FROM ${table} WHERE key = $1`, [key]);
    } finally {
      client.release();
    }
  });
  return COLAS[table];
}

async function replaceAll(table, obj) {
  const previo = COLAS[table] || Promise.resolve();
  COLAS[table] = previo.catch(() => {}).then(() => ejecutarReplace(table, obj));
  return COLAS[table];
}

async function ejecutarReplace(table, obj) {
  const p = getPool();
  const client = await p.connect();
  const entries = Object.entries(obj || {});
  try {
    await client.query('BEGIN');
    // Upsert en vez de DELETE+INSERT: si la fila ya existe se actualiza, asi
    // que un conflicto de clave deja de ser un error.
    for (const [k, v] of entries) {
      if (table === 'kv_sessions') {
        await client.query(
          `INSERT INTO ${table} (key, email, expires_at, data) VALUES ($1,$2,$3,$4)
           ON CONFLICT (key) DO UPDATE SET email=EXCLUDED.email, expires_at=EXCLUDED.expires_at, data=EXCLUDED.data`,
          [k, String((v && v.email) || ''), Number((v && v.expiresAt) || 0), v || {}]
        );
      } else {
        await client.query(
          `INSERT INTO ${table} (key, data) VALUES ($1,$2)
           ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`,
          [k, v === undefined ? null : v]
        );
      }
    }
    // Solo se borra lo que ya no existe en memoria. Se hace al final para que
    // las escrituras que llegan durante el bucle no se pierdan.
    const claves = entries.map(([k]) => k);
    if (claves.length) {
      await client.query(`DELETE FROM ${table} WHERE NOT (key = ANY($1::text[]))`, [claves]);
    }
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
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
  const [users, sessions, quotes, productos, servicios, marcas, categorias, contacto, mant, auditoria, recup, avisos] = await Promise.all([
    loadAll('kv_users'),
    loadSessions(),
    loadAll('kv_quotes'),
    loadAll('kv_productos'),
    loadAll('kv_servicios'),
    loadAll('kv_marcas'),
    loadAll('kv_categorias'),
    loadList('kv_contacto'),
    loadList('kv_mantenimiento'),
    loadAll('kv_auditoria'),
    loadAll('kv_recuperacion'),
    loadList('kv_avisos'),
  ]);
  const items = Object.values(auditoria || {}).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  let lastHash = 'GENESIS';
  try {
    const m = getPool().query(`SELECT value FROM kv_meta WHERE key='audit_last'`);
    const r = await m;
    if (r.rows[0]) lastHash = r.rows[0].value;
  } catch {}
  if (items.length) lastHash = items[items.length - 1].hash || lastHash;
  return { users, sessions, quotes, productos: Object.values(productos || {}), servicios: Object.values(servicios || {}), marcas, categorias, contacto, mant, avisos: avisos || [], recup: recup || {}, audit: { items, lastHash } };
}

// Escritura directa (write-through). Fire-and-forget desde server.js.
function wt(promise) {
  Promise.resolve(promise).catch((e) => console.log('Aviso PG write: ' + e.message));
}

// Limpieza sin servicios externos (sin R2/tarjeta): borra lo vencido y lo
// viejo que ya no se consulta, y devuelve lo liberado. NO borra cotizaciones:
// solo sesiones/recuperaciones vencidas, auditoria excedente (>2000) y fotos
// archivadas con mas de DIAS_FOTOS dias (el PDF ya quedo generado).
async function tamanos() {
  const p = getPool();
  const r = await p.query(`
    SELECT relname AS tabla, pg_total_relation_size(relid) AS bytes, n_live_tup AS filas
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC`);
  return r.rows;
}

async function liberarEspacio(opciones) {
  const dias = Math.max(7, parseInt((opciones && opciones.diasFotos) || process.env.FOTOS_DIAS || '60', 10) || 60);
  const p = getPool();
  const reporte = { diasFotos: dias };
  const s1 = await p.query(`DELETE FROM kv_sessions WHERE expires_at < $1`, [Date.now()]);
  reporte.sesionesBorradas = s1.rowCount || 0;
  const s2 = await p.query(`DELETE FROM kv_recuperacion WHERE (data->>'expiresAt')::bigint < $1`, [Date.now()]);
  reporte.recuperacionesBorradas = s2.rowCount || 0;
  // Auditoria: solo ultimas 2000 (igual que persistAudit en server.js).
  const s3 = await p.query(`DELETE FROM kv_auditoria WHERE key NOT IN (SELECT key FROM kv_auditoria ORDER BY key DESC LIMIT 2000)`);
  reporte.auditoriaBorrada = s3.rowCount || 0;
  // Chatbot: era el único crecimiento sin tope ni purga (2 filas por turno).
  // Se conservan 90 días de historial; las sesiones se van con sus mensajes.
  const s4 = await p.query(`DELETE FROM chatbot_messages WHERE created_at < NOW() - INTERVAL '90 days'`);
  reporte.mensajesChatBorrados = s4.rowCount || 0;
  const s5 = await p.query(`DELETE FROM chatbot_feedback WHERE created_at < NOW() - INTERVAL '90 days'`);
  reporte.feedbackChatBorrado = s5.rowCount || 0;
  const s6 = await p.query(`DELETE FROM chatbot_learning_candidates WHERE created_at < NOW() - INTERVAL '90 days'`);
  reporte.aprendizajeChatBorrado = s6.rowCount || 0;
  const s7 = await p.query(`DELETE FROM chatbot_sessions WHERE updated_at < NOW() - INTERVAL '90 days'`);
  reporte.sesionesChatBorradas = s7.rowCount || 0;
  // Fotos archivadas viejas: el meta guarda ISO en "archivada".
  const corte = new Date(Date.now() - dias * 864e5).toISOString();
  const viejas = await p.query(`SELECT key FROM kv_fotos_archivo WHERE (data->>'archivada') < $1`, [corte]);
  const claves = viejas.rows.map((r) => r.key);
  reporte.fotosViejasBorradas = 0;
  for (const k of claves) {
    await p.query(`DELETE FROM kv_fotos_bin WHERE key = $1`, [k]);
    await p.query(`DELETE FROM kv_fotos_archivo WHERE key = $1`, [k]);
    reporte.fotosViejasBorradas++;
  }
  await p.query(`VACUUM ANALYZE kv_sessions`);
  await p.query(`VACUUM ANALYZE kv_recuperacion`);
  await p.query(`VACUUM ANALYZE kv_auditoria`);
  await p.query(`VACUUM ANALYZE kv_fotos_bin`);
  await p.query(`VACUUM ANALYZE kv_fotos_archivo`);
  await p.query(`VACUUM ANALYZE chatbot_messages`);
  await p.query(`VACUUM ANALYZE chatbot_sessions`);
  await p.query(`VACUUM ANALYZE chatbot_feedback`);
  await p.query(`VACUUM ANALYZE chatbot_learning_candidates`);
  return reporte;
}

module.exports = { isEnabled, init, replaceAll, upsert, borrar, get, loadAll, loadAllState, wt, getPool, tamanos, liberarEspacio };
