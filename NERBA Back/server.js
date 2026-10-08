/**
 * Grupo NERBA HIDALGO - Backend en JavaScript (Node.js, sin dependencias).
 * Sirve la API REST (/api/*) y los archivos del frontend en el mismo puerto.
 *
 * Uso:
 *   node server.js [puerto]
 * O doble clic a run.bat
 */

// Zona horaria. Railway corre en UTC, asi que sin esto el servidor guardaba las
// horas en UTC y la bitacora se veía con 6 horas de diferencia (y hasta con el
// dia equivocado) respecto a lo que marca el reloj del usuario en Hidalgo.
// Se fija antes de usar Date para que TODO el backend razone en hora local.
process.env.TZ = process.env.TZ || 'America/Mexico_City';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || process.argv[2] || '8080', 10);

// Capa de datos: Postgres si hay DATABASE_URL, JSON local si no.
const db = require('./db');
const nerbot = require('./nerbot');
let DB_MODE = false;
// Mirrors en memoria cuando hay DB (lecturas sync, escritura write-through).
let cProductos = null, cServicios = null, cMarcas = null, cCategorias = null, cContacto = null, cMant = null, cAudit = null, cRecup = null;

// Carpeta del frontend: Railway usa FRONT_DIR; local usa carpeta hermana.
const CANDIDATES = [
  process.env.FRONT_DIR || '',
  path.resolve(__dirname, '../NERBA Front'),
].filter(Boolean);
const FRONT_DIR = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || path.resolve(__dirname, '../NERBA Front');
// FRONTEND_URL es el origen principal, pero se aceptan varios (por ejemplo
// mientras el sitio migra de Netlify a Cloudflare). Separados por coma.
// Vacio = '*' (solo para desarrollo; en produccion define la lista).
const FRONTEND_URL = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
const FRONTEND_ORIGINS = FRONTEND_URL
  ? FRONTEND_URL.split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean)
  : [];
const ORIGENES_PERMITIDOS = FRONTEND_ORIGINS.concat([
  'http://localhost:8080',
  'https://nerbaproyecto.pages.dev',
]);
// Falla seguro. Antes era !== '0', o sea que si la variable NO existia el
// seed se activaba solo: con el repo publico, cualquiera con acceso de lectura
// podia entrar a produccion como SUPERADMIN con la contrasena del seed.
// Ahora solo se siembran si se pide de forma explicita con SEED_DEMO=1.
const SEED_DEMO = process.env.SEED_DEMO === '1';
// SERVE_STATIC=0: solo API (deploy separado: frontend en Netlify). Local: 1.
const SERVE_STATIC = process.env.SERVE_STATIC !== '0';
// Recuperacion de contrasena por correo: Resend (HTTPS) primero porque Railway
// bloquea los puertos SMTP; SMTP queda de respaldo para VPS/Hostinger.
// Sin ninguna de las dos, /api/recuperar responde 503 en vez de prometer un
// correo que nunca sale.
// RECOVERY_DEBUG=1 imprime el enlace en el log (respaldo manual) y lo devuelve
// en la respuesta. Solo para pruebas: nunca activarlo en produccion.
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
const SMTP_FROM = String(process.env.SMTP_FROM || ('Grupo NERBA HIDALGO <' + (SMTP_USER || 'no-reply@nerba.mx') + '>')).trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM = String(process.env.RESEND_FROM || 'Nerba <onboarding@resend.dev>').trim();
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const BREVO_FROM_EMAIL = String(process.env.BREVO_FROM || SMTP_USER || 'proyectonerba@gmail.com').trim();
const BREVO_FROM_NAME = String(process.env.BREVO_FROM_NAME || 'Grupo NERBA HIDALGO').trim();
function hayCorreo() { return !!BREVO_API_KEY || !!RESEND_API_KEY || (!!SMTP_USER && !!SMTP_PASS); }
const RECOVERY_DEBUG = process.env.RECOVERY_DEBUG === '1';
const RESET_MINUTOS = parseInt(process.env.RESET_MINUTOS || '30', 10);
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const usersFile = path.join(DATA_DIR, 'users.json');
const quotesFile = path.join(DATA_DIR, 'cotizaciones.json');
const sessionsFile = path.join(DATA_DIR, 'sesiones.json');

// ---------- estado en memoria + persistencia ----------
let users = {};      // email -> { nombre, email, telefono, passHash, direccion, rol, createdAt }
let sessions = {};   // token -> { email, expiresAt }
let quotes = {};     // folio -> cotizacion
let folioSeq = 8850;
// --- Folios: una serie por tipo de trabajo ---------------------------------
// Antes todas las cotizaciones compartian un solo contador (COT-8850-2026),
// asi que una venta de equipo y una instalacion quedaban con numeros mezclados.
// Ahora cada tipo lleva su serie:
//   INS  instalacion / cerco / videovigilancia
//   ELC  productos electronicos
//   MAT  mantenimiento y polizas
//   ESP  proyectos especiales
function sinAcentos(s) {
  // Se quita todo lo que no sean letras, no solo las tildes. Si un texto llega
  // con un byte roto (por ejemplo "Electr?nicos" desde un cliente o un proxy),
  // comparar palabra por palabra fallaba en silencio y la cotizacion se iba a
  // la serie equivocada. Asi se comparan letras limpias.
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
}
const SERIES_FOLIO = {
  GENERAL: 'INS',
  PRODUCTOS_ELECTRONICOS: 'ELC',
  MANTENIMIENTO: 'MAT',
  PROYECTOS_ESPECIALES: 'ESP',
};
// Los contadores se deducen de los folios que ya hay en cada arranque, en vez
// de guardarse aparte. Asi, aunque el servidor se reinicie o se redeploye, el
// numero sigue subiendo y nunca se repite uno.
const folioSeqs = { GENERAL: 0, PRODUCTOS_ELECTRONICOS: 0, MANTENIMIENTO: 0, PROYECTOS_ESPECIALES: 0 };
function tomaFolioExistente(folio) {
  const m = /^COT-([A-Z]{3})-(\d{4})-\d{4}$/.exec(String(folio || ''));
  if (!m) return;
  const serie = Object.keys(SERIES_FOLIO).find((k) => SERIES_FOLIO[k] === m[1]);
  if (!serie) return;
  const n = parseInt(m[2], 10) || 0;
  if (n > (folioSeqs[serie] || 0)) folioSeqs[serie] = n;
}
function folioSiguiente(serie, year) {
  folioSeqs[serie] = (folioSeqs[serie] || 0) + 1;
  return `COT-${SERIES_FOLIO[serie]}-${String(folioSeqs[serie]).padStart(4, '0')}-${year}`;
}
// Decide la serie. Primero hace caso de lo que pidio el cliente; si no, se
// deduce del area y, en ultimo caso, de si la cotizacion habla de
// mantenimiento o poliza.
function serieDeCotizacion(body, area) {
  const pedido = String(body.tipoCotizacion || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (pedido === 'MANTENIMIENTO') return 'MANTENIMIENTO';
  if (pedido === 'PRODUCTOS_ELECTRONICOS' || pedido === 'ELECTRONICOS') return 'PRODUCTOS_ELECTRONICOS';
  if (pedido === 'PROYECTOS_ESPECIALES' || pedido === 'ESPECIALES') return 'PROYECTOS_ESPECIALES';
  if (pedido === 'GENERAL' || pedido === 'INSTALACION') return 'GENERAL';
  if (area === 'PROYECTOS_ESPECIALES') return 'PROYECTOS_ESPECIALES';
  if (area === 'PRODUCTOS_ELECTRONICOS') return 'PRODUCTOS_ELECTRONICOS';
  // Se compara sin tildes: "Productos Electronicos" escrito de otra forma
  // tiene que caer en la misma serie, si no se va a instalacion sin avisar.
  const tipo = sinAcentos(String(body.tipoInmueble || ''));
  if (tipo.indexOf('productoselectronicos') >= 0) return 'PRODUCTOS_ELECTRONICOS';
  if (tipo.indexOf('proyectoespecial') >= 0) return 'PROYECTOS_ESPECIALES';
  const textos = [String(body.producto || ''), String(body.descripcion || '')]
    .concat(Array.isArray(body.items) ? body.items.map((i) => String((i && i.title) || '')) : []);
  if (/mantenimiento|poliza/.test(sinAcentos(textos.join(' ')))) return 'MANTENIMIENTO';
  return 'GENERAL';
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_ALLOWED_DOMAIN = String(process.env.GOOGLE_ALLOWED_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');

// --- Cifrado de los archivos de datos -------------------------------------
// En el disco quedan fotos de propiedades, direcciones, correos y telefonos en
// JSON plano: con que alguien baje ese archivo se lleva todo. Si se define
// DATA_KEY, todo lo que pasa por loadJSON/saveJSON se guarda cifrado con
// AES-256-GCM y se descifra al leer, sin tocar el codigo que usa los datos.
//
// Formato en disco: un sobre JSON {"__nb_cifrado":1,"iv":..,"tag":..,"datos":".."}.
// Un archivo plano se sigue leyendo bien, asi que los datos que ya estan
// escritos se van cifrando solos en su siguiente guardado, sin migracion ni
// paso manual. Sin DATA_KEY se sigue escribiendo en plano, pero avisa al
// arrancar para que no se quede nadie creyendo que esta cifrado.
const DATA_KEY_TXT = String(process.env.DATA_KEY || '').trim();
const DATA_KEY = DATA_KEY_TXT
  ? crypto.createHash('sha256').update(DATA_KEY_TXT, 'utf8').digest()
  : null;
function cifra(texto) {
  if (!DATA_KEY) return texto;
  const iv = crypto.randomBytes(12);
  const cif = crypto.createCipheriv('aes-256-gcm', DATA_KEY, iv);
  const out = Buffer.concat([cif.update(texto, 'utf8'), cif.final()]);
  return JSON.stringify({ __nb_cifrado: 1, iv: iv.toString('base64'), tag: cif.getAuthTag().toString('base64'), datos: out.toString('base64') });
}
function descifra(sobre) {
  if (!DATA_KEY || !sobre || sobre.__nb_cifrado !== 1) return sobre;
  try {
    const desc = crypto.createDecipheriv('aes-256-gcm', DATA_KEY, Buffer.from(sobre.iv, 'base64'));
    desc.setAuthTag(Buffer.from(sobre.tag, 'base64'));
    return JSON.parse(Buffer.concat([desc.update(Buffer.from(sobre.datos, 'base64')), desc.final()]).toString('utf8'));
  } catch (e) {
    // O la llave no es la de estos datos, o el archivo se corrompio. No se
    // pisa nada: se avisa y se sigue con el fallback de siempre.
    console.log('AVISO: no se pudo descifrar un archivo. Revisa DATA_KEY: ' + e.message);
    return null;
  }
}

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      // Sin esto, un BOM (PowerShell/Excel al editar) rompe el parseo y la
      // siguiente escritura vaciaría el archivo.
      const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      let datos = JSON.parse(raw);
      if (datos && datos.__nb_cifrado === 1) {
        // El archivo esta cifrado y no hay llave (no se defini DATA_KEY o se
        // cambio). Devolver el sobre seria peor que nada: el sistema creeria
        // que no hay usuarios ni cotizaciones. Se avisa y se sigue con el
        // fallback de siempre.
        if (!DATA_KEY) {
          console.log('AVISO: ' + file + ' esta cifrado y DATA_KEY no esta definida. Revisa la variable de entorno.');
          return fallback;
        }
        datos = descifra(datos);
        if (datos === null) return fallback;
      }
      return datos;
    }
  } catch (e) { console.log('Aviso cargando ' + file + ': ' + e.message); }
  return fallback;
}
function saveJSON(file, data) {
  fs.writeFileSync(file, cifra(JSON.stringify(data, null, 2)), 'utf8');
}
// Igual que saveJSON pero escribiendo a un archivo temporal y renombrando al
// final: si el proceso se muere a mitad, el archivo bueno sigue intacto en vez
// de quedar truncado.
function writeJSONAtomico(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, cifra(JSON.stringify(data, null, 2)), 'utf8');
  fs.renameSync(tmp, file);
}

users = loadJSON(usersFile, {});
// Las sesiones previas del demo no incluían expiración. Se invalidan al actualizar
// para que ningún token antiguo quede activo indefinidamente.
const storedSessions = loadJSON(sessionsFile, {});
sessions = Object.fromEntries(Object.entries(storedSessions).filter(([, s]) =>
  s && typeof s.email === 'string' && Number(s.expiresAt) > Date.now()
));
if (Object.keys(sessions).length !== Object.keys(storedSessions).length) persistSessions();
const quotesArr = loadJSON(quotesFile, []);
let migDemo = false;
for (const q of quotesArr) {
  if (String(q.email || '').toLowerCase() === 'demo@nerba.mx' && q.demo !== true) { q.demo = true; migDemo = true; }
  quotes[q.folio] = q;
  // Las series nuevas (COT-INS-0001-2026) llevan su propia cuenta: se recorren
  // los folios guardados para no repetir numero cuando el servidor arranca.
  tomaFolioExistente(q.folio);
  const m = /^COT-(\d+)-/.exec(q.folio || '');
  if (m && parseInt(m[1], 10) >= folioSeq) folioSeq = parseInt(m[1], 10) + 1;
}
// Migración: el área se deriva del tipo (las electrónicas viejas entran a su zona).
let migArea = false;
for (const q of Object.values(quotes)) {
  let want = 'GENERAL';
  if (q.tipoInmueble === 'Proyecto Especial') want = 'PROYECTOS_ESPECIALES';
  else if (q.tipoInmueble === 'Productos Electrónicos') want = 'PRODUCTOS_ELECTRONICOS';
  if (!q.area || (want !== 'GENERAL' && q.area !== want)) { q.area = want; migArea = true; }
}
if (migArea || migDemo) persistQuotes();

function seedDemo() {
  quotes['COT-8849-2024'] = {
    folio: 'COT-8849-2024', fecha: '2024-11-28', email: 'demo@nerba.mx', demo: true,
    nombre: 'Ing. Carlos Mendoza', telefono: '55 1234 5678', tipoInmueble: 'Empresa',
    direccion: 'Av. Industria 450, CDMX', producto: 'Kit CCTV 8 Camaras 4K + Cerco 100m',
    descripcion: 'Sistema perimetral corporativo con NVR PoE y respaldo 2TB.',
    subtotal: 34999, instalacion: 6300, iva: 6607.84, total: 47906.84,
    estado: 'APROBADA', validez: '2024-12-13',
  };
  quotes['COT-7621-2024'] = {
    folio: 'COT-7621-2024', fecha: '2024-10-15', email: 'demo@nerba.mx', demo: true,
    nombre: 'Ing. Carlos Mendoza', telefono: '55 1234 5678', tipoInmueble: 'Casa',
    direccion: 'Calle Robles 12, Toluca', producto: 'Kit CCTV 4 Camaras Full HD',
    descripcion: 'Residencial con vision nocturna y app movil.',
    subtotal: 18999, instalacion: 3420, iva: 3587.04, total: 26006.04,
    estado: 'PENDIENTE', validez: '2024-10-30',
  };
  persistQuotes();
}
if (SEED_DEMO && Object.keys(quotes).length === 0) seedDemo();

// Cuentas de prueba para chequeos en local (solo se crean si no existen).
// En producción define SEED_DEMO=0 para no crearlas.
function seedUsers() {
  if (!SEED_DEMO) { console.log('SEED_DEMO=0: no se crean cuentas demo.'); return; }
  const demo = [
    { nombre: 'Cliente Demo', email: 'cliente@nerba.mx', password: 'cliente123', rol: 'CLIENTE' },
    { nombre: 'Admin Grupo NERBA HIDALGO', email: 'admin@nerba.mx', password: 'admin123', rol: 'ADMIN' },
    { nombre: 'SuperAdmin Grupo NERBA HIDALGO', email: 'superadmin@nerba.mx', password: 'super123', rol: 'SUPERADMIN' },
    { nombre: 'Proyectos Especiales', email: 'proyectos@nerba.mx', password: 'especial123', rol: 'PROYECTOS_ESPECIALES' },
    { nombre: 'Encargado Electrónicos', email: 'electronica@nerba.mx', password: 'electronica123', rol: 'PRODUCTOS_ELECTRONICOS' },
  ];
  let changed = false;
  for (const d of demo) {
    if (!users[d.email]) {
      users[d.email] = { nombre: d.nombre, email: d.email, passHash: hashPassword(d.password), rol: d.rol, activo: true, lastLogin: null, createdAt: fechaLocal() };
      changed = true;
    } else {
      if (users[d.email].passHash === sha256(d.password)) {
        // Actualiza únicamente las credenciales demo que todavía usan el hash heredado.
        users[d.email].passHash = hashPassword(d.password);
        changed = true;
      }
      // Migración: campos del rol SuperAdmin en cuentas existentes.
      if (users[d.email].activo === undefined) { users[d.email].activo = true; changed = true; }
      if (users[d.email].lastLogin === undefined) { users[d.email].lastLogin = null; changed = true; }
    }
  }
  if (changed) persistUsers();
}
seedUsers();

// Guardado. Cada cambio escribe SOLO lo que cambio en Postgres (antes se
// reescribia la tabla completa fila por fila, y con 400 cotizaciones aprobar una
// sola tardaba segundos). El archivo local sigue siendo la copia de respaldo,
// pero se escribe fuera del hilo principal: antes un writeFileSync de cientos
// de MB congelaba el servidor entero y nadie recibia nada.
// Sin valor a proposito: seedDemo() corre al cargar el modulo (llama a
// persistQuotes antes de que el archivo llegue aqui), y cualquier asignacion en
// esta linea se ejecutaria DESPUES y dejaria la cola en null otra vez. Con var
// sin valor solo se declara, y el array se crea en el primer uso.
var COLA_ESCRITURA;
function guardarJSONDespues(file, data) {
  if (!COLA_ESCRITURA) COLA_ESCRITURA = [];
  COLA_ESCRITURA.push(function () { return writeJSONAtomico(file, data); });
  if (COLA_ESCRITURA.length === 1) {
    setImmediate(function () {
      const trabajo = COLA_ESCRITURA.splice(0, COLA_ESCRITURA.length);
      Promise.resolve()
        .then(function () { return trabajo.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); })
        .catch(function (e) { console.log('Aviso escribiendo ' + file + ': ' + e.message); });
    });
  }
}
function persistUsers(email) {
  if (email && DB_MODE) db.wt(db.upsert('kv_users', email, users[email]));
  else if (DB_MODE) db.wt(db.replaceAll('kv_users', users));
  guardarJSONDespues(usersFile, users);
}
function persistSessions(clave) {
  if (clave && DB_MODE) db.wt(db.upsert('kv_sessions', clave, sessions[clave]));
  else if (DB_MODE) db.wt(db.replaceAll('kv_sessions', sessions));
  guardarJSONDespues(sessionsFile, sessions);
}
// folio: la cotizacion que cambio. Sin folio (carga inicial, restauraciones
// masivas) se cae al comportamiento de antes, que reescribe todo.
function persistQuotes(folio) {
  if (folio && DB_MODE && quotes[folio]) db.wt(db.upsert('kv_quotes', folio, quotes[folio]));
  else if (DB_MODE) db.wt(db.replaceAll('kv_quotes', quotes));
  guardarJSONDespues(quotesFile, Object.values(quotes));
}
function borrarQuoteEnDb(folio) {
  delete quotes[folio];
  if (DB_MODE) db.wt(db.borrar('kv_quotes', folio));
// Si tenia fotos en el archivo, se van con ella: dejar el archivo con
  // huerfanos solo ocuparia espacio.
  db.wt(borrarFotosArchivadas(folio));
  // Solo el respaldo local. OJO: no llamar a persistQuotes() aqui: sin folio
  // reescribiria la tabla completa en Postgres, que es justo lo que evita el
  // borrado por fila.
  guardarJSONDespues(quotesFile, Object.values(quotes));
}

// ---------- archivo de fotos: los bytes salen de la memoria ----------
// Las fotos son ~99.9% del peso de una cotizacion (1,000 citas con 5 fotos son
// 916 MB, y sin fotos son 0.6 MB). Archivar NO borra nada: la cotizacion sigue
// igual de visible en la tabla, el historial, las busquedas y los Excel; unico
// cambio es que los bytes de las imagenes se mueven a una tabla aparte, fuera de
// la memoria del proceso. Cuando hacen falta (PDF, galeria, ZIP) se vuelven a
// pedir por folio.
//
// Por que esto NO puede repetir un folio: la numeracion se retoma con las
// cotizaciones que estan cargadas (tomaFolioExistente) y archivar nunca borra la
// fila de la tabla de cotizaciones, solo le saca las imagenes. El folio sigue
// ahi, asi que el siguiente numero continua igual.
const archivoFotosFile = path.join(DATA_DIR, 'fotos-archivo.json');
let cFotosArchivo = null;
function archivoLocal() {
  if (cFotosArchivo) return cFotosArchivo;
  cFotosArchivo = {};
  try { if (fs.existsSync(archivoFotosFile)) Object.assign(cFotosArchivo, loadJSON(archivoFotosFile, {})); } catch {}
  return cFotosArchivo;
}
// Fecha de la cotizacion para decidir que es "viejo". Viene como YYYY-MM-DD en
// hora local; si no esta, se usa la actual para no dejar nada fuera por error.
function fechaDeCotizacion(c) {
  const s = String((c && c.fecha) || '').slice(0, 10);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T12:00:00') : NaN;
  return Number.isFinite(t) ? t : Date.now();
}
function metaArchivo(c, fotos) {
  return {
    folio: c.folio,
    n: fotos.length,
    // Las fotos vienen en base64: ~4/3 del peso real.
    kb: Math.round((fotos.reduce(function (a, f) { return a + String(f || '').length; }, 0) * 0.75) / 1024),
    fecha: c.fecha || '',
    cliente: c.nombre || '',
    email: c.email || '',
    producto: c.producto || '',
    archivada: new Date().toISOString(),
  };
}
async function metaFotosArchivadas(folio) {
  if (DB_MODE) return (await db.get('kv_fotos_archivo', folio)) || null;
  const e = archivoLocal()[folio];
  if (!e) return null;
  const copia = { ...e };
  delete copia.fotos;
  return copia;
}
async function binFotosArchivadas(folio) {
  if (DB_MODE) return (await db.get('kv_fotos_bin', folio)) || null;
  const e = archivoLocal()[folio];
  return e && Array.isArray(e.fotos) ? e.fotos : null;
}
async function guardarFotosArchivadas(folio, meta, fotos) {
  if (DB_MODE) {
    await db.upsert('kv_fotos_bin', folio, { folio: folio, fotos: fotos });
    await db.upsert('kv_fotos_archivo', folio, meta);
    return;
  }
  const a = archivoLocal();
  a[folio] = { ...meta, fotos: fotos };
  guardarJSONDespues(archivoFotosFile, a);
}
async function borrarFotosArchivadas(folio) {
  if (!folio) return;
  if (DB_MODE) {
    await db.borrar('kv_fotos_bin', folio);
    await db.borrar('kv_fotos_archivo', folio);
    return;
  }
  const a = archivoLocal();
  if (a[folio]) { delete a[folio]; guardarJSONDespues(archivoFotosFile, a); }
}
// Indice del archivo (sin imagenes): por eso el listado es liviano.
async function listarFotosArchivadas() {
  if (DB_MODE) return Object.values(await db.loadAll('kv_fotos_archivo'));
  return Object.values(archivoLocal()).map(function (e) {
    const copia = { ...e };
    delete copia.fotos;
    return copia;
  });
}
// Para armar un documento: si la cotizacion no tiene fotos a mano pero las tiene
// archivadas, se las poner encima. El PDF sale igual que antes de archivar.
async function fotosParaDocumento(c) {
  if (Array.isArray(c.fotos) && c.fotos.length) return c;
  if (!c.fotosArchivadas) return c;
  const fotos = await binFotosArchivadas(c.folio);
  return fotos && fotos.length ? { ...c, fotos: fotos } : c;
}

// ---------- ZIP del archivo (respaldo para el disco del usuario) ----------
// Se escribe POR TROZOS: si el archivo tiene 4 GB, armar el ZIP en memoria
// mataria el servidor. Solo se guarda en memoria el indice central (unos 60
// bytes por foto), que es lo unico que hace falta para el final del archivo.
const TABLA_CRC = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32Buffer(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function fotoAPng(f) {
  const s = String(f || '');
  if (/^data:image\/png/i.test(s)) return 'png';
  if (/^data:image\/(webp|gif)/i.test(s)) return 'jpg';
  return 'jpg';
}
function bytesDeFoto(f) {
  const s = String(f || '');
  const b64 = s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s;
  try { return Buffer.from(b64, 'base64'); } catch { return Buffer.alloc(0); }
}
const esperarDrain = (res) => new Promise(function (r) { res.once('drain', r); });
// fuente: async function* que entrega { nombre, datos }
async function enviarZip(req, res, fuente, nombreArchivo) {
  const central = [];
  let offset = 0;
  const d = new Date();
  const hora = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const fecha = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="' + nombreArchivo + '"',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Vary': 'Origin',
  });
  for await (const a of fuente()) {
    const nombre = Buffer.from(String(a.nombre), 'utf8');
    const datos = Buffer.isBuffer(a.datos) ? a.datos : Buffer.from(String(a.datos), 'utf8');
    const crc = crc32Buffer(datos);
    const lh = Buffer.alloc(30 + nombre.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    lh.writeUInt16LE(0, 8); // sin compresion: la foto ya viene comprimida
    lh.writeUInt16LE(hora, 10);
    lh.writeUInt16LE(fecha, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(datos.length, 18);
    lh.writeUInt32LE(datos.length, 22);
    lh.writeUInt16LE(nombre.length, 26);
    nombre.copy(lh, 30);

    const cd = Buffer.alloc(46 + nombre.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(hora, 12);
    cd.writeUInt16LE(fecha, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(datos.length, 20);
    cd.writeUInt32LE(datos.length, 24);
    cd.writeUInt16LE(nombre.length, 28);
    cd.writeUInt32LE(offset, 42);
    nombre.copy(cd, 46);
    central.push(cd);
    offset += lh.length + datos.length;

    if (!res.write(lh)) await esperarDrain(res);
    if (!res.write(datos)) await esperarDrain(res);
  }
  const cdBuf = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(central.length, 8);
  fin.writeUInt16LE(central.length, 10);
  fin.writeUInt32LE(cdBuf.length, 12);
  fin.writeUInt32LE(offset, 16);
  res.write(cdBuf);
  res.end(fin);
}

// ---------- bitacora de auditoria (solo SUPERADMIN la consulta) ----------
const auditFile = path.join(DATA_DIR, 'auditoria.json');
function loadAudit() {
  if (DB_MODE && cAudit) return cAudit;
  try {
    if (fs.existsSync(auditFile)) {
      const d = loadJSON(auditFile, {});
      if (d && Array.isArray(d.items)) { if (DB_MODE) cAudit = d; return d; }
    }
  } catch {}
  return { items: [], lastHash: 'GENESIS' };
}
function persistAudit(a) {
  if (a.items.length > 2000) a.items = a.items.slice(-2000);
  saveJSON(auditFile, a);
  if (DB_MODE) {
    cAudit = a;
    const byId = {};
    for (const e of a.items) byId[e.id] = e;
    db.wt(db.replaceAll('kv_auditoria', byId).then(() =>
      db.getPool().query(`INSERT INTO kv_meta (key,value) VALUES ('audit_last',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [a.lastHash || 'GENESIS'])
    ));
  }
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || '';
  const ip = String(fwd).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
  return ip.replace(/^::ffff:/, '').slice(0, 45);
}
/* ---------- Recuperacion de contrasena por correo ----------
   El token se guarda hasheado, no en claro: si alguien lee la base, no le
   sirve para cambiar contrasenas. Expira y se quema al usarse. */
const resetFile = path.join(DATA_DIR, 'resets.json');
let resets = loadJSON(resetFile, {});

function persistResets() { saveJSON(resetFile, resets); }

function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Deja el telefono en E.164 de Mexico (52 + 10 digitos) para que WhatsApp y
// SMS lo usen tal cual. Acepta "775 130 0335", "+52 775...", "(775) 130-0335".
function normalizaTelefono(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 13 && (d.startsWith('044') || d.startsWith('040'))) d = d.slice(3);
  else if (d.length === 11 && (d.startsWith('044') || d.startsWith('040'))) d = d.slice(3);
  if (d.length === 10) d = '52' + d;
  else if (d.length === 11 && d.charAt(0) === '1') d = '52' + d.slice(1);
  else if (d.length > 12) d = d.slice(0, 12);
  return d;
}

function nuevoToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Nunca se guarda ni se compara el token en claro: la tabla se indexa por su
// hash sha256, asi que un volcado de resets.json no sirve para entrar.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

function tokenGuardado(hash) {
  const r = resets[hash];
  if (!r) return null;
  if (Date.now() > r.expira) { delete resets[hash]; persistResets(); return null; }
  return r;
}

function correoRecuperacion(destino, nombre, link) {
  const asunto = 'Recupera tu contrasena - Grupo NERBA HIDALGO';
  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">' +
    '<h2 style="color:#b0000b;margin:0 0 16px">Grupo NERBA HIDALGO</h2>' +
    '<p>Hola ' + escapeHTML(nombre || '') + ',</p>' +
    '<p>Recibimos una solicitud para restablecer la contrasena de tu cuenta.</p>' +
    '<p style="margin:28px 0"><a href="' + escapeHTML(link) + '" ' +
    'style="background:#b0000b;color:#fff;padding:13px 26px;border-radius:8px;' +
    'text-decoration:none;font-weight:700;display:inline-block">Cambiar mi contrasena</a></p>' +
    '<p style="font-size:13px;color:#666">El enlace vence en ' + RESET_MINUTOS +
    ' minutos y solo puede usarse una vez. Si no pediste esto, ignora este correo: ' +
    'tu contrasena sigue igual.</p>' +
    '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">' +
    '<p style="font-size:12px;color:#888">Si el boton no funciona, copia esta direccion:<br>' +
    escapeHTML(link) + '</p>' +
    '<p style="font-size:12px;color:#888">Grupo Empresarial Nerba, S.A. de C.V. &middot; ' +
    '775 130 0335 &middot; 771 219 8250 &middot; gruponerba@hotmail.com</p></div>';
  const texto =
    'Recuperacion de contrasena - Grupo NERBA HIDALGO\n\n' +
    'Hola ' + (nombre || '') + ',\n\n' +
    'Abre este enlace para cambiar tu contrasena (vence en ' + RESET_MINUTOS + ' minutos):\n' +
    link + '\n\nSi no pediste esto, ignora este mensaje.\n';

  // En Railway los puertos SMTP (465/587/25) estan bloqueados: Gmail siempre
  // da timeout. Por eso los proveedores HTTP (Brevo, Resend) van PRIMERO y el
  // SMTP queda como respaldo para despliegues con salida SMTP (VPS, Hostinger).
  return enviarCorreo({ destino, nombre, asunto, html, texto });
}

// Un solo punto de envio para todo el sistema (recuperacion, confirmaciones).
// Orden: Brevo -> Resend -> SMTP. Los errores se acumulan para saber CUAL fallo.
function enviarCorreo(o) {
  const destino = o.destino, nombre = o.nombre || '', asunto = o.asunto, html = o.html, texto = o.texto;
  const intentos = [];
  if (BREVO_API_KEY) intentos.push(['brevo', enviaBrevo]);
  if (RESEND_API_KEY) intentos.push(['resend', enviaResend]);
  if (SMTP_USER && SMTP_PASS) intentos.push(['smtp', enviaSMTP]);
  if (!intentos.length) return Promise.reject(new Error('Sin proveedor de correo configurado'));

  // Se prueban en orden y se acumulan los errores: si todos fallan, el mensaje
  // dice CUAL fallo y por que (asi se distingue "key invalida" de "sin salida").
  const errores = [];
  return intentos.reduce(function (cadena, item) {
    return cadena.catch(function () {
      return item[1]().catch(function (e) {
        errores.push(item[0] + ': ' + ((e && e.message) || 'error'));
        throw e;
      });
    });
  }, Promise.reject(new Error('sin intentos'))).catch(function (e) {
    throw new Error(errores.join(' | ') || ((e && e.message) || 'fallo el envio'));
  });

  function enviaBrevo() {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
        to: [{ email: destino, name: nombre || '' }],
        subject: asunto,
        htmlContent: html,
        textContent: texto,
      }),
      signal: ctrl.signal,
    }).then(function (r) {
      return r.text().then(function (cuerpo) {
        if (!r.ok) throw new Error('Brevo ' + r.status + ': ' + cuerpo.slice(0, 200));
        return true;
      });
    }).finally(function () { clearTimeout(t); });
  }

  function enviaResend() {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [destino], subject: asunto, html, text: texto }),
      signal: ctrl.signal,
    }).then(function (r) {
      return r.text().then(function (cuerpo) {
        if (!r.ok) throw new Error('Resend ' + r.status + ': ' + cuerpo.slice(0, 200));
        return true;
      });
    }).finally(function () { clearTimeout(t); });
  }

  function enviaSMTP() {
    const nodemailer = require('nodemailer');
    // Puerto 465 cuando el despliegue si permite SMTP; 587 con STARTTLS como
    // alternativa. secure:true solo aplica al 465.
    const puerto = parseInt(process.env.SMTP_PORT || '465', 10);
    const tx = nodemailer.createTransport({
      host: String(process.env.SMTP_HOST || 'smtp.gmail.com'),
      port: puerto,
      secure: puerto === 465,
      requireTLS: puerto !== 465,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return tx.sendMail({ from: SMTP_FROM, to: destino, subject: asunto, html, text: texto });
  }
}

// Confirmacion al crear cualquier cotizacion (cotizador general o pedido de
// refacciones/electronica). Se manda sin bloquear la respuesta: si el correo
// falla, la cotizacion ya quedo guardada y solo se registra en el log.
function correoConfirmacionCotizacion(destino, nombre, c) {
  const folio = String((c && c.folio) || '');
  const esElec = String((c && c.area) || '') === 'PRODUCTOS_ELECTRONICOS' ||
    String((c && c.tipoInmueble) || '') === 'Productos Electrónicos';
  const asunto = 'Recibimos tu solicitud ' + folio + ' - Grupo NERBA HIDALGO';
  const items = Array.isArray(c && c.items) ? c.items : [];
  const listaItems = items.slice(0, 20).map(function (it) {
    return ' - ' + String((it && it.title) || 'Componente') + ' x' + (parseInt(it && it.qty, 10) || 1);
  }).join('\n');
  const detalle = listaItems || String((c && c.descripcion) || 'Solicitud registrada.');
  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">' +
    '<h2 style="color:#b0000b;margin:0 0 16px">Grupo NERBA HIDALGO</h2>' +
    '<p>Hola ' + escapeHTML(nombre || '') + ',</p>' +
    '<p>Recibimos tu solicitud <strong>' + escapeHTML(folio) + '</strong>' +
    (esElec ? ' de electrónica y refacciones.' : ' de cotización.') + '</p>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:13px;white-space:pre-line">' +
    escapeHTML(detalle) + '</div>' +
    '<p>Estado: <strong>' + escapeHTML(String((c && c.estado) || 'PENDIENTE')) + '</strong>' +
    (c && c.validez ? ' · Válida hasta ' + escapeHTML(String(c.validez)) : '') + '</p>' +
    '<p>Te avisaremos por este medio cuando cambie su estado. Puedes verla en Mis Cotizaciones.</p>' +
    '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">' +
    '<p style="font-size:12px;color:#888">Grupo Empresarial Nerba, S.A. de C.V. &middot; ' +
    '775 130 0335 &middot; 771 219 8250 &middot; gruponerba@hotmail.com</p></div>';
  const texto =
    'Grupo NERBA HIDALGO - Solicitud ' + folio + ' recibida\n\n' +
    'Hola ' + (nombre || '') + ',\n\n' + detalle +
    '\n\nEstado: ' + String((c && c.estado) || 'PENDIENTE') + '.\n' +
    'Te avisaremos por este medio cuando cambie su estado.\n';
  return enviarCorreo({ destino, nombre, asunto, html, texto });
}


// --- Hora local, sin mezclar zonas -----------------------------------------
// Antes se usaba toISOString() para la fecha y toTimeString() para la hora.
// toISOString() devuelve SIEMPRE UTC y toTimeString() la hora local del
// servidor: las dos iban en el mismo registro y se contradecian. Despues de
// las 18:00 la fecha ya era del dia siguiente con la hora del dia anterior.
// Ahora las dos salen del mismo instante y en hora local.
function dosDigitos(n) { return String(n).padStart(2, '0'); }
function fechaLocal(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
}
function horaLocal(d) {
  d = d || new Date();
  return dosDigitos(d.getHours()) + ':' + dosDigitos(d.getMinutes()) + ':' + dosDigitos(d.getSeconds());
}
// Fecha y hora del mismo momento, para que no se contradigan.
function ahoraLocal() {
  const d = new Date();
  return { fecha: fechaLocal(d), hora: horaLocal(d) };
}
function logAudit(req, info) {
  try {
    const a = loadAudit();
    const token = getToken(req);
    const u = userByToken(token);
    const prev = a.lastHash || 'GENESIS';
    const e = {
      id: 'EVT-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(),
      fecha: fechaLocal(),
      hora: horaLocal(),
      modulo: String((info && info.modulo) || 'sistema'),
      evento: String((info && info.evento) || ''),
      detalle: String((info && info.detalle) || '').slice(0, 500),
      folio: (info && info.folio) || '',
      usuario: u ? u.email : String((info && info.usuario) || '—'),
      nombre: u ? u.nombre : '',
      rol: u ? u.rol : '',
      ip: clientIp(req),
      agente: String(req.headers['user-agent'] || '').slice(0, 160),
    };
    e.hash = crypto.createHash('sha256').update(prev + JSON.stringify([e.id, e.fecha, e.hora, e.modulo, e.evento, e.usuario, e.folio])).digest('hex').slice(0, 32);
    a.items.push(e);
    a.lastHash = e.hash;
    persistAudit(a);
  } catch {}
}

// ---------- catalogo ----------
const CATALOGO = [
  { id: 'cctv-kit-4ch', nombre: 'Kit CCTV 4 Camaras Full HD', categoria: 'cctv', descripcion: 'Kit de 4 camaras 1080p + DVR 1TB + vision nocturna 30m + app movil.', precio: 18999, precioAntes: 19999, rating: '4.9', resenas: 124, imagen: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'cctv-kit-8ch', nombre: 'Kit CCTV 8 Camaras 4K', categoria: 'cctv', descripcion: '8 camaras 4K + NVR PoE + disco 2TB + deteccion de personas.', precio: 34999, precioAntes: 38999, rating: '4.8', resenas: 86, imagen: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'cerco-100m', nombre: 'Cerco Electrico 100m lineales', categoria: 'cerco', descripcion: 'Energizador 10,000V + 3 lineas + sirena + senalizacion + instalacion.', precio: 14500, precioAntes: 16500, rating: '4.9', resenas: 203, imagen: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'alarma-wifi', nombre: 'Alarma WiFi + Sensores', categoria: 'alarmas', descripcion: 'Panel WiFi + 4 sensores puerta/ventana + 2 PIR + 2 controles + sirena.', precio: 8900, precioAntes: 10900, rating: '4.7', resenas: 158, imagen: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'porton-automatico', nombre: 'Automatizacion de Porton', categoria: 'portones', descripcion: 'Motor 600kg + 2 controles + fotoceldas + instalacion y garantia 2 anos.', precio: 16900, precioAntes: 18900, rating: '4.8', resenas: 97, imagen: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'videoportero', nombre: 'Videoportero IP + Chapa', categoria: 'portones', descripcion: 'Videoportero 7" + frente de calle IP + chapa electrica + app.', precio: 7500, precioAntes: 8900, rating: '4.6', resenas: 74, imagen: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'biometrico', nombre: 'Control Biometrico Huella+RFID', categoria: 'alarmas', descripcion: 'Terminal huella + 1000 usuarios + torniquete opcional + software.', precio: 12300, precioAntes: 14200, rating: '4.7', resenas: 61, imagen: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80', badge: 'Instalacion incluida' },
  { id: 'mantenimiento', nombre: 'Poliza Mantenimiento Anual', categoria: 'cctv', descripcion: '4 visitas preventivas + correctivo prioritario + refacciones -15%.', precio: 6800, precioAntes: 8000, rating: '5.0', resenas: 45, imagen: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80', badge: 'Instalacion incluida' },
];

// ---------- utilidades ----------
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
// Regla de contrasena. Antes eran 6 caracteres, que con un scrypt bien hecho
// todavia se abre con un diccionario pequeno. 8 es el minimo razonable para no
// dar ventaja a los ataques de fuerza bruta sin volverla incomoda de escribir.
// Todas las altas y los cambios de contrasena pasan por aqui, para que la regla
// sea la misma en cada pantalla.
const MIN_PASSWORD = 8;
function problemaDePassword(password) {
  const p = String(password == null ? '' : password);
  if (p.length < MIN_PASSWORD) return 'La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres.';
  if (p.length > 200) return 'La contrasena es demasiado larga.';
  return null;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}
function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length === 3 && parts[0] === 'scrypt') {
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(String(password), parts[1], 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  // Compatibilidad única con datos de la versión anterior; se actualiza al iniciar sesión.
  const expected = Buffer.from(sha256(password), 'hex');
  const legacy = Buffer.from(stored, 'hex');
  return expected.length === legacy.length && crypto.timingSafeEqual(expected, legacy);
}
function verifyGoogleCredential(credential) {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) return reject(new Error('Google Sign-In no configurado'));
    const target = new URL('https://oauth2.googleapis.com/tokeninfo');
    target.searchParams.set('id_token', String(credential || ''));
    const request = https.get(target, { headers: { Accept: 'application/json' } }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { if (raw.length < 100000) raw += chunk; });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch (_) { return reject(new Error('Respuesta inválida de Google')); }
        const email = String(data.email || '').trim().toLowerCase();
        const verified = data.email_verified === true || data.email_verified === 'true';
        const validIssuer = data.iss === 'accounts.google.com' || data.iss === 'https://accounts.google.com';
        const validAudience = data.aud === GOOGLE_CLIENT_ID && (!data.azp || data.azp === GOOGLE_CLIENT_ID);
        const validExpiry = Number(data.exp) > Math.floor(Date.now() / 1000);
        const validDomain = !GOOGLE_ALLOWED_DOMAIN || email.endsWith('@' + GOOGLE_ALLOWED_DOMAIN);
        if (response.statusCode !== 200 || !email || !data.sub || !verified || !validIssuer || !validAudience || !validExpiry || !validDomain) {
          return reject(new Error('Credencial de Google inválida'));
        }
        const fullName = String(data.name || [data.given_name, data.family_name].filter(Boolean).join(' ') || email.split('@')[0]).trim().slice(0, 120);
        resolve({ email, nombre: fullName, sub: String(data.sub) });
      });
    });
    request.setTimeout(8000, () => request.destroy(new Error('Google no respondió')));
    request.on('error', reject);
  });
}

// El token se genera aqui y se devuelve al cliente, pero lo que se guarda en
// sesiones.json es su hash (sha256), igual que se hacia con los tokens de
// recuperacion. Antes se guardaba el token en claro: quien pudiera leer ese
// archivo podia escribir la sesion de cualquier cuenta y hacerse el pasa.
function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[hashToken(token)] = { email, expiresAt: Date.now() + SESSION_TTL_MS };
  persistSessions();
  return token;
}
function publicUser(u) {
  const last = u.lastLogin ? { fecha: u.lastLogin.fecha || '', hora: u.lastLogin.hora || '' } : null;
  return { nombre: u.nombre, email: u.email, telefono: u.telefono || '', telefonoSec: u.telefonoSec || '', direccion: u.direccion || '', empresa: u.empresa || '', rol: u.rol, activo: u.activo !== false, tema: u.tema === 'dark' ? 'dark' : 'light', foto: u.foto || '', lastLogin: last, createdAt: u.createdAt || '' };
}
// Foto de perfil: data URL de imagen, tope 250KB en texto (~180KB reales).
// El navegador la achica a 256px antes de mandarla (~20-40KB); el tope solo
// rechaza basura. '' la borra. undefined = no viene en el request.
const MAX_FOTO_PERFIL = 250 * 1024;
function fotoPerfilValida(v) {
  if (v === undefined) return undefined;
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= MAX_FOTO_PERFIL) return s;
  return null;
}
function publicAudit(e) {
  return {
    id: e.id || '', fecha: e.fecha || '', hora: e.hora || '', modulo: e.modulo || '', evento: e.evento || '',
    detalle: e.detalle || '', folio: e.folio || '', usuario: e.usuario || '', nombre: e.nombre || '', rol: e.rol || '',
  };
}
// El origen se resuelve con el req del contexto, no con el parametro de
// sendJSON: hay mas de cien llamadas que no lo pasan, y con allowlist eso
// hacia que todas respondieran con el origen principal y el navegador
// bloqueara el fetch desde otro dominio (Cloudflare, por ejemplo).
// AsyncLocalStorage mantiene el req correcto aunque haya varias peticiones
// simultaneas, cosa que una variable global no garantiza.
const { AsyncLocalStorage } = require('async_hooks');
const ALCANCE = new AsyncLocalStorage();

function corsOrigin(req) {
  const actual = req || (ALCANCE.getStore() && ALCANCE.getStore().req) || null;
  // Sin lista configurada se deja abierto (solo util en desarrollo).
  if (!ORIGENES_PERMITIDOS.length) return '*';
  const o = String((actual && actual.headers && actual.headers.origin) || '').trim();
  // Sin Origin (curl, healthcheck, same-origin) se responde con el principal.
  if (!o) return ORIGENES_PERMITIDOS[0];
  // Allowlist: si el origen no esta en la lista, NO se refleja. Se responde con
  // el principal para que el navegador lo rechace, en vez de dejarlo pasar.
  return ORIGENES_PERMITIDOS.indexOf(o.replace(/\/$/, '')) > -1 ? o : ORIGENES_PERMITIDOS[0];
}
// Content-Security-Policy. En produccion la manda Cloudflare Pages (archivo
// _headers del front); esta es la misma politica para cuando el backend sirve
// el front en local, para no developsar con una seguridad distinta a la de
// produccion. La lista de origenes sale de lo que el sitio usa de verdad.
function cspHeader() {
  const api = String(process.env.API_ORIGIN || 'https://backendnb-production.up.railway.app').replace(/\/$/, '');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://ui-avatars.com https://images.unsplash.com https://*.r2.dev",
    "connect-src 'self' " + api + ' https://accounts.google.com https://apis.google.com https://cdn.tailwindcss.com',
    "frame-src 'self' blob: data: https://accounts.google.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}
function sendJSON(res, status, obj, req) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.end(body);
}
function normalizeSearch(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/ß/g, 'ss')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function compactSearch(value) { return normalizeSearch(value).replace(/\s+/g, ''); }
function matchesSearch(value, query) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const hay = normalizeSearch(value);
  const compactHay = hay.replace(/\s+/g, '');
  if (hay.includes(needle) || compactHay.includes(compactSearch(needle))) return true;
  return needle.split(/\s+/).filter(Boolean).every((token) => hay.includes(token) || compactHay.includes(compactSearch(token)));
}
// 16MB: un Proyecto Especial manda legitimamente hasta 20 fotos ya comprimidas
// en el navegador (1200 px / JPEG 0.72 ≈ 150-250 KB cada una, ~4 MB). Antes
// el tope era 3 MB y una docena de fotos reventaba el request con un 413 a
// medio enviar, que es lo que el cliente veía como "no deja subir".
const MAX_BODY_BYTES = 16 * 1024 * 1024;
// Topes de las fotos que adjunta el cliente a una solicitud.
// 20 fotos es lo que el cotizador ofrece en Proyecto Especial y 5 en el resto,
// asi que el servidor tiene que aguantar el caso mayor: se sube el conteo a 20
// y el peso por foto a 1.2 MB (el front ya las achica a 1000-1200 px, así que
// una foto real pesa 100-250 KB; el tope es solo para una que llegue sin
// comprimir). El tope que de verdad protege es el total: 10 MB.
const MAX_FOTOS_COTIZACION = 20;
const MAX_BYTES_FOTO_COTIZACION = 1200 * 1024;
const MAX_BYTES_TOTAL_FOTOS = 10 * 1024 * 1024;
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return reject(Object.assign(new Error('Payload muy grande'), { code: 413 }));
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}
// Rate-limit mínimo en memoria para login/registro/contacto/google (anti fuerza bruta)
const __rl = new Map(); // ip -> { n, reset }
function rateLimit(req, max = 30, windowMs = 60000) {
  const ip = clientIp(req) || 'unknown';
  const now = Date.now();
  const e = __rl.get(ip);
  if (!e || now > e.reset) { __rl.set(ip, { n: 1, reset: now + windowMs }); return true; }
  e.n++;
  if (e.n > max) return false;
  return true;
}
function getToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  // NOTA: ya no se acepta ?token= por seguridad (quedaba en logs/historial/referer).
  return null;
}
// La tabla de sesiones esta indexada por el hash del token, no por el token.
function userByToken(token) {
  if (!token) return null;
  const clave = hashToken(token);
  const session = sessions[clave];
  if (!session || Number(session.expiresAt) <= Date.now()) {
    if (session) { delete sessions[clave]; persistSessions(clave); }
    return null;
  }
  const u = users[session.email.toLowerCase()] || null;
  if (u && u.activo === false) return null;
  return u;
}
function isStaff(user) { return user && (user.rol === 'ADMIN' || user.rol === 'SUPERADMIN' || user.rol === 'PRODUCTOS_ELECTRONICOS'); }
// Alcance de cotizaciones por rol: SUPERADMIN todo, ADMIN todo menos PE,
// PROYECTOS_ESPECIALES solo su área, PRODUCTOS_ELECTRONICOS solo la suya,
// CLIENTE solo las propias. Nada fuera de su zona.
function quoteScope(u, c) {
  if (!u || !c) return false;
  if (u.rol === 'SUPERADMIN') return true;
  var area = c.area || 'GENERAL';
  // Cada rol ve una sola zona. Antes ADMIN veia todo menos PROYECTOS_ESPECIALES,
  // y eso le metia en la bandeja las cotizaciones de productos electronicos,
  // que son del rol PRODUCTOS_ELECTRONICOS y no suyas.
  var soloSuZona = {
    ADMIN: ['GENERAL', 'MANTENIMIENTO'],
    PRODUCTOS_ELECTRONICOS: ['PRODUCTOS_ELECTRONICOS'],
    PROYECTOS_ESPECIALES: ['PROYECTOS_ESPECIALES'],
  };
  if (soloSuZona[u.rol]) {
    // Si la zona del rol no cuadra con lo que dice el tipo de inmueble, se
    // respeta el area: manda lo que guardo el servidor, no lo que mando el
    // cliente en el formulario.
    return soloSuZona[u.rol].indexOf(area) !== -1;
  }
  if (u.rol === 'CLIENTE') return c.demo !== true && !!(c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase());
  return !!(c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase());
}
function canSeeQuoteAudit(u) {
  return !!(u && (u.rol === 'ADMIN' || u.rol === 'SUPERADMIN' || u.rol === 'PROYECTOS_ESPECIALES'));
}
// --- Borrado por lado -----------------------------------------------------
// Antes, DELETE /api/cotizaciones/:folio borraba el registro para siempre: si un
// admin lo eliminaba desde su panel, la cotizacion desaparecia tambien para el
// cliente, que es su documento. Ahora es borrado logico y cada quien decide
// sobre lo suyo: el personal la oculta para el personal y el cliente la oculta
// para su cuenta. El registro nunca se borra solo.
function esPersonal(u) {
  return !!(u && (isStaff(u) || u.rol === 'PROYECTOS_ESPECIALES'));
}
function ocultaStaff(c) { return !!(c && c.oculta && c.oculta.staff); }
function ocultaCliente(c) { return !!(c && c.oculta && c.oculta.cliente); }
// El SUPERADMIN siempre ve todas para poder supervisar y corregir.
function quoteVisible(c, u) {
  if (!c || !u) return false;
  if (u.rol === 'SUPERADMIN') return true;
  return esPersonal(u) ? !ocultaStaff(c) : !ocultaCliente(c);
}
// En las LISTAS no se viajan las fotos: solo cuantas tiene.
//
// Antes cada panel (admin, superadmin, historial, el del cliente) se descargaba
// TODAS las fotos de TODAS las cotizaciones al refrescar. Con 200 cotizaciones
// de 5 fotos eran 183 MB por visita, y el panel se volvia inservible con
// internet normal. Ahora la lista viaja ligera y las fotos se piden por
// cotizacion (GET /api/cotizaciones/:folio) solo cuando de verdad se van a ver.
//
// Los PDF no se ven afectados: el servidor los arma con su propia copia de la
// cotizacion, no con lo que devolvio esta lista.
function quoteForUser(c, u, opciones) {
  const out = { ...c };
  if (!canSeeQuoteAudit(u)) {
    delete out.estadoHistorial;
    delete out.estadoActualizadoPor;
    delete out.estadoActualizadoAt;
  }
  // Marcas de borrado logico para que cada panel sepa que hacer.
  out.ocultaStaff = ocultaStaff(c);
  out.ocultaCliente = ocultaCliente(c);
  if (!out.oculta && !out.ocultaStaff && !out.ocultaCliente) delete out.oculta;
  if (opciones && opciones.sinFotos) {
    // Con las fotos archivadas la lista ya no trae imagenes, pero el numero
    // sigue siendo el real: sale del archivo, no de 0.
    out.fotosN = c.fotosArchivadas && c.fotosArchivadas.n ? Number(c.fotosArchivadas.n) || 0
      : (Array.isArray(c.fotos) ? c.fotos.length : 0);
    delete out.fotos;
  }
  return out;
}
function recordQuoteState(c, u, anterior, estado) {
  const now = new Date().toISOString();
  if (!Array.isArray(c.estadoHistorial)) c.estadoHistorial = [];
  c.estadoHistorial.push({
    estado,
    anterior: anterior || null,
    usuario: u.email,
    nombre: u.nombre,
    rol: u.rol,
    fecha: now,
  });
  if (c.estadoHistorial.length > 50) c.estadoHistorial = c.estadoHistorial.slice(-50);
  c.estadoActualizadoPor = { email: u.email, nombre: u.nombre, rol: u.rol };
  c.estadoActualizadoAt = now;
}

const MIME = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
  avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
  ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
};

// ---------- servidor ----------
// ALCANCE.run() envuelve cada peticion para que corsOrigin sepa de quien es
// la respuesta, sin tener que pasar req a las mas de cien llamadas a sendJSON.
const server = http.createServer((req, res) => {
  ALCANCE.run({ req }, () => manejar(req, res));
});

async function manejar(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  // ----- API -----
  if (pathname === '/api/health') return sendJSON(res, 200, { ok: true, service: 'grupo-nerba-hidalgo', port: PORT }, req);
  if (pathname === '/api/config') return sendJSON(res, 200, { googleClientId: GOOGLE_CLIENT_ID }, req);

  // ----- NerBot: solo clientes autenticados (el staff puede con NERBOT_STAFF=1) -----
  const nerbotNo = (u) => (!u || (u.rol !== 'CLIENTE' && !nerbot.staff));
  if (pathname === '/api/chatbot/message' && req.method === 'POST') {
    if (!rateLimit(req, 20, 60000)) return sendJSON(res, 429, { error: 'Demasiadas consultas seguidas. Espera un momento.' }, req);
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch (e) {
      return sendJSON(res, 400, { error: 'Solicitud inválida' }, req);
    }
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesión para usar NerBot.' }, req);
    if (nerbotNo(u)) return sendJSON(res, 403, { error: 'NerBot está disponible para cuentas CLIENTE.' }, req);
    try {
      const result = await nerbot.message({
        sessionId: body.session_id || body.sessionId,
        user: u,
        question: body.message,
        catalog: loadProductos(),
      });
      return sendJSON(res, 200, result, req);
    } catch (e) {
      const status = Number(e && e.status) || 500;
      return sendJSON(res, status, { error: e.message || 'No se pudo procesar la consulta.' }, req);
    }
  }

  if (pathname === '/api/chatbot/history' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesión para consultar el historial.' }, req);
    if (nerbotNo(u)) return sendJSON(res, 403, { error: 'NerBot está disponible para cuentas CLIENTE.' }, req);
    try {
      const items = await nerbot.history({ sessionId: url.searchParams.get('session_id') || '', user: u });
      return sendJSON(res, 200, { items }, req);
    } catch (e) {
      const status = Number(e && e.status) || 500;
      return sendJSON(res, status, { error: e.message || 'No se pudo cargar el historial.' }, req);
    }
  }

  if (pathname === '/api/chatbot/feedback' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch (e) {
      return sendJSON(res, 400, { error: 'Solicitud inválida' }, req);
    }
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesión para enviar feedback.' }, req);
    if (nerbotNo(u)) return sendJSON(res, 403, { error: 'NerBot está disponible para cuentas CLIENTE.' }, req);
    try {
      const result = await nerbot.feedback({
        sessionId: body.session_id || body.sessionId,
        user: u,
        messageId: body.message_id || body.messageId,
        rating: body.rating,
        note: body.note,
      });
      return sendJSON(res, 200, result, req);
    } catch (e) {
      const status = Number(e && e.status) || 500;
      return sendJSON(res, status, { error: e.message || 'No se pudo guardar el feedback.' }, req);
    }
  }
  if (pathname === '/api/catalogo') return sendJSON(res, 200, CATALOGO, req);

  if (pathname === '/api/register' && req.method === 'POST') {
    if (!rateLimit(req, 20)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }, req);
    let body = {};
    try {
      let rawBody = await readBody(req);
      try { body = JSON.parse(rawBody); } catch (e) { body = {}; }
    } catch (e) { if (e && e.code === 413) return sendJSON(res, 413, { error: 'Datos muy grandes' }, req); body = {}; }
    const nombre = String(body.nombre || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!nombre || !email || !password) return sendJSON(res, 400, { error: 'Nombre, email y contrasena son obligatorios' });
    if (!email.includes('@')) return sendJSON(res, 400, { error: 'Email no valido' });
    if (problemaDePassword(password)) return sendJSON(res, 400, { error: problemaDePassword(password) });
    if (users[email]) return sendJSON(res, 409, { error: 'Ese correo ya esta registrado. Inicia sesion.' });
    // El formulario de registro pide el telefono, pero antes se descartaba aqui y
    // publicUser lo devolvia vacio. Se guarda normalizado a solo digitos para que
    // el envio de SMS o WhatsApp no tenga que limpiarlo.
    const telefono = normalizaTelefono(body.telefono);
    users[email] = { nombre, email, telefono, passHash: hashPassword(password), passPropia: true, rol: 'CLIENTE', activo: true, tema: 'light', lastLogin: null, createdAt: fechaLocal() };
    persistUsers();
    logAudit(req, { modulo: 'accesos', evento: 'registro', detalle: nombre, usuario: email });
    const token = createSession(email);
    return sendJSON(res, 201, { token, ...publicUser(users[email]) });
  }

  /* --- Recuperacion de contrasena ---
   /api/recuperar siempre responde 200 con el mismo mensaje, exista o no el
   correo. Si dijera "no encontramos esa cuenta", alguien podria usarla para
   averiguar quais correos estan registrados. */
if (pathname === '/api/recuperar' && req.method === 'POST') {
  if (!rateLimit(req, 5)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }, req);
  if (!hayCorreo()) return sendJSON(res, 503, { error: 'La recuperacion por correo no esta disponible por ahora. Escribe a gruponerba@hotmail.com o llama al 775 130 0335.' }, req);
  let body = {};
  try { body = JSON.parse(await readBody(req)); } catch (e) { body = {}; }
  const email = String(body.email || '').trim().toLowerCase();
  const ok = { ok: true, mensaje: 'Si ese correo esta registrado, te enviamos un enlace para cambiar tu contrasena.' };
  if (!email.includes('@')) return sendJSON(res, 200, ok, req);
  const u = users[email];
  if (!u || u.activo === false) { logAudit(req, { modulo: 'accesos', evento: 'recuperar-desconocido', detalle: email, usuario: email }); return sendJSON(res, 200, ok, req); }

  const token = nuevoToken();
  const hash = hashToken(token);
  resets[hash] = { email, expira: Date.now() + RESET_MINUTOS * 60000, creado: new Date().toISOString() };
  persistResets();
  const base = FRONTEND_URL || (req.headers.origin || '').replace(/\/$/, '');
  const link = base + '/restablecer.html?token=' + encodeURIComponent(token);
  try {
    await correoRecuperacion(email, u.nombre, link);
    logAudit(req, { modulo: 'accesos', evento: 'recuperar-enviado', detalle: email, usuario: email });
  } catch (e) {
    delete resets[hash]; persistResets();
    console.log('Aviso correo recuperacion: ' + e.message);
    // Respaldo: si el envio fallo (sin SMTP en Railway, quota de Resend, etc.)
    // el enlace se imprime para mandarlo por WhatsApp. Con RECOVERY_DEBUG=1 se
    // devuelve en la respuesta, solo para pruebas.
    if (RECOVERY_DEBUG) console.log('ENLACE ' + link);
      const motivo = String((e && e.message) || 'fallo desconocido').replace(/\s+/g, ' ').slice(0, 300);
      logAudit(req, { modulo: 'accesos', evento: 'recuperar-error', detalle: email + ' | ' + motivo, usuario: u.email });
    // Se responde igual que en el caso exitoso a proposito. Si aqui se
    // devolviera 502, un atacante deduciria quais correos estan registrados:
    // los inexistentes darian 200 y los existentes 502.
  }
  if (RECOVERY_DEBUG) return sendJSON(res, 200, Object.assign({}, ok, { enlace: link }), req);
  return sendJSON(res, 200, ok, req);
}

/* Verifica el token y deja mostrar el formulario. No lo quema: ese paso es
   /api/restablecer, para que recargar la pagina no corte el proceso. */
if (pathname === '/api/restablecer/verificar' && req.method === 'POST') {
  let body = {};
  try { body = JSON.parse(await readBody(req)); } catch (e) { body = {}; }
  // La tabla esta indexada por el hash del token, no por el token en claro.
  const r = tokenGuardado(hashToken(body.token));
  if (!r) return sendJSON(res, 400, { error: 'El enlace vencio o ya se uso. Pide uno nuevo.' }, req);
  const u = users[r.email] || {};
    return sendJSON(res, 200, { ok: true, email: r.email, nombre: u.nombre || '', expira: r.expira, minutos: RESET_MINUTOS }, req);
}

if (pathname === '/api/restablecer' && req.method === 'POST') {
  if (!rateLimit(req, 10)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }, req);
  let body = {};
  try { body = JSON.parse(await readBody(req)); } catch (e) { body = {}; }
  const hash = hashToken(body.token);
  const r = tokenGuardado(hash);
  if (!r) return sendJSON(res, 400, { error: 'El enlace vencio o ya se uso. Pide uno nuevo.' }, req);
  const nueva = String(body.password || '');
  if (problemaDePassword(nueva)) return sendJSON(res, 400, { error: problemaDePassword(nueva) }, req);
  const u = users[r.email];
  if (!u) { delete resets[hash]; persistResets(); return sendJSON(res, 404, { error: 'La cuenta ya no existe' }, req); }
  u.passHash = hashPassword(nueva); u.passPropia = true;
  // El token se quema y se cierra el resto de sesiones abiertas de esa cuenta.
  delete resets[hash]; persistResets();
  Object.keys(sessions).forEach(function (k) { if (sessions[k] && sessions[k].email === r.email) delete sessions[k]; });
  persistSessions();
  persistUsers();
  logAudit(req, { modulo: 'accesos', evento: 'contrasena-restablecida', detalle: r.email, usuario: r.email });
  return sendJSON(res, 200, { ok: true }, req);
}

/* Diagnostico del correo (solo ADMIN/SUPERADMIN). /api/recuperar siempre
   responde 200 para no revelar que correos existen, asi que un fallo de SMTP o
   de Resend no se ve desde el sitio. Este endpoint manda un correo de prueba a
   la direccion que se le pida y devuelve el error real del proveedor, o por que
   no se intento ninguno. */
if (pathname === '/api/admin/probar-correo' && req.method === 'POST') {
  let body = {};
  try { body = JSON.parse(await readBody(req)); } catch (e) { body = {}; }
  const u = userByToken(getToken(req));
  if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo administracion' }, req);
  const destino = String(body.email || '').trim().toLowerCase();
  if (!destino.includes('@')) return sendJSON(res, 400, { error: 'Escribe un correo valido' }, req);
  const configCorreo = {
    resend: !!RESEND_API_KEY,
    smtp: !!(SMTP_USER && SMTP_PASS),
    smtpDesde: SMTP_FROM || SMTP_USER || '(sin definir)',
    resendDesde: RESEND_FROM,
  };
  if (!configCorreo.resend && !configCorreo.smtp) {
    logAudit(req, { modulo: 'accesos', evento: 'correo-prueba-sin-proveedor', detalle: destino + ' | falta RESEND_API_KEY o SMTP_USER/SMTP_PASS', usuario: u.email });
    return sendJSON(res, 503, {
      error: 'No hay ningun proveedor de correo configurado en el servidor.',
      como: 'Define RESEND_API_KEY, o SMTP_USER y SMTP_PASS, en las variables de entorno.',
      config: configCorreo,
    }, req);
  }
  const enlace = (FRONTEND_URL || '') + '/restablecer.html?token=prueba';
  try {
    await correoRecuperacion(destino, u.nombre, enlace);
    logAudit(req, { modulo: 'accesos', evento: 'correo-prueba-ok', detalle: destino, usuario: u.email });
    return sendJSON(res, 200, { ok: true, enviado: true, destino: destino, config: configCorreo }, req);
  } catch (e) {
    const motivo = String((e && e.message) || 'fallo desconocido').replace(/\s+/g, ' ').slice(0, 300);
    logAudit(req, { modulo: 'accesos', evento: 'correo-prueba-error', detalle: destino + ' | ' + motivo, usuario: u.email });
    return sendJSON(res, 502, { error: 'El correo NO se pudo enviar.', motivo: motivo, destino: destino, config: configCorreo }, req);
  }
}

if (pathname === '/api/login' && req.method === 'POST') {
    if (!rateLimit(req, 30)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }, req);
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch (e) { if (e && e.code === 413) return sendJSON(res, 413, { error: 'Datos muy grandes' }, req); body = {}; }
    const email = String(body.email || '').trim().toLowerCase();
    const u = users[email];
    if (!u || !verifyPassword(body.password || '', u.passHash)) {
      logAudit(req, { modulo: 'accesos', evento: 'login-fallido', detalle: email, usuario: email });
      return sendJSON(res, 401, { error: 'Credenciales invalidas' });
    }
    if (u.activo === false) {
      logAudit(req, { modulo: 'accesos', evento: 'login-bloqueado', detalle: email, usuario: email });
      return sendJSON(res, 403, { error: 'Cuenta desactivada. Contacta al administrador.' });
    }
    if (!u.passHash.startsWith('scrypt$')) { u.passHash = hashPassword(body.password || ''); u.passPropia = true; persistUsers(); }
    u.lastLogin = { fecha: fechaLocal(), hora: horaLocal(), ip: clientIp(req) };
    persistUsers();
    const token = createSession(email);
    logAudit(req, { modulo: 'accesos', evento: 'login', detalle: u.nombre + ' (' + u.rol + ')' });
    return sendJSON(res, 200, { token, ...publicUser(u) });
  }

  if (pathname === '/api/auth/google' && req.method === 'POST') {
    if (!rateLimit(req, 30)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }, req);
    if (!GOOGLE_CLIENT_ID) return sendJSON(res, 503, { error: 'Google Sign-In no está configurado en el servidor.' });
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch (e) { if (e && e.code === 413) return sendJSON(res, 413, { error: 'Datos muy grandes' }, req); body = {}; }
    let profile;
    try { profile = await verifyGoogleCredential(body.credential); }
    catch (_) { return sendJSON(res, 401, { error: 'No se pudo validar la cuenta de Google.' }); }
    let u = users[profile.email];
    if (u && u.googleSub && u.googleSub !== profile.sub) return sendJSON(res, 409, { error: 'Esta cuenta ya está vinculada a otro acceso de Google.' });
    if (u && u.activo === false) return sendJSON(res, 403, { error: 'Cuenta desactivada. Contacta al administrador.' });
    let esNuevo = false;
    if (!u) {
      const randomPassword = crypto.randomBytes(24).toString('hex');
      u = users[profile.email] = { nombre: profile.nombre, email: profile.email, passHash: hashPassword(randomPassword), googleSub: profile.sub, authProvider: 'google', rol: 'CLIENTE', activo: true, tema: 'light', lastLogin: null, createdAt: fechaLocal() };
      persistUsers();
      esNuevo = true;
      logAudit(req, { modulo: 'accesos', evento: 'registro', detalle: profile.nombre + ' (Google)', usuario: profile.email });
    } else if (!u.googleSub) {
      u.googleSub = profile.sub;
      u.authProvider = u.authProvider || 'google';
    }
    u.lastLogin = { fecha: fechaLocal(), hora: horaLocal(), ip: clientIp(req) };
    persistUsers();
    const token = createSession(profile.email);
    logAudit(req, { modulo: 'accesos', evento: esNuevo ? 'registro' : 'login', detalle: u.nombre + ' (' + u.rol + ', Google)' });
    return sendJSON(res, esNuevo ? 201 : 200, { token, ...publicUser(u), nuevo: esNuevo });
  }

  // ----- logout: invalida la sesion en el servidor -----
  if (pathname === '/api/logout' && req.method === 'POST') {
    await readBody(req); // drenar cuerpo: si no se consume, Node puede tumbar el socket
    const token = getToken(req);
    if (token && sessions[hashToken(token)]) {
      delete sessions[hashToken(token)];
      persistSessions();
    }
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/me') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'No autorizado' });
    if (req.method === 'GET') return sendJSON(res, 200, publicUser(u));
    if (req.method === 'PUT') {
      if (body.nombre !== undefined) u.nombre = String(body.nombre).trim().slice(0, 120) || u.nombre;
      if (body.telefono !== undefined) u.telefono = normalizaTelefono(body.telefono);
      if (body.telefonoSec !== undefined) u.telefonoSec = normalizaTelefono(body.telefonoSec);
      if (body.direccion !== undefined) u.direccion = String(body.direccion).trim().slice(0, 240);
      if (body.empresa !== undefined) u.empresa = String(body.empresa).trim().slice(0, 160);
      if (body.tema === 'dark' || body.tema === 'light') u.tema = body.tema;
      // Foto de perfil: vive en el servidor para que se vea igual en todas
      // las computadoras (antes solo quedaba en el localStorage de cada una).
      if (body.foto !== undefined) {
        const f = fotoPerfilValida(body.foto);
        if (f === null) return sendJSON(res, 400, { error: 'Foto no válida (JPG, PNG o WebP, máx 250KB)' });
        u.foto = f;
      }
      if (body.newPassword) {
        if (problemaDePassword(body.newPassword)) return sendJSON(res, 400, { error: problemaDePassword(body.newPassword) });
        if (!verifyPassword(body.currentPassword || '', u.passHash)) return sendJSON(res, 401, { error: 'La contrasena actual es incorrecta' });
        u.passHash = hashPassword(body.newPassword);
      }
      persistUsers(String(u.email || '').toLowerCase());
      return sendJSON(res, 200, publicUser(u));
    }
    if (req.method === 'DELETE') {
      // Borrado total de la cuenta propia: usuario, sesiones, cotizaciones,
      // mantenimientos y tokens de recuperacion. La bitacora conserva el
      // registro anonimizado (trazabilidad del sistema).
      // Cuentas con contrasena propia la confirman; las creadas solo con
      // Google (sin contrasena conocida) confirman escribiendo su correo.
      const email = String(u.email || '').toLowerCase();
      if (u.passPropia) {
        if (!verifyPassword(body.currentPassword || '', u.passHash)) {
          return sendJSON(res, 401, { error: 'Confirma tu contraseña actual para eliminar la cuenta.' }, req);
        }
      } else {
        if (String(body.email || '').trim().toLowerCase() !== email || !email) {
          return sendJSON(res, 401, { error: 'Escribe tu correo para confirmar la eliminación.' }, req);
        }
      }
      if (u.rol === 'SUPERADMIN' && !Object.values(users).some((x) => x.rol === 'SUPERADMIN' && String(x.email || '').toLowerCase() !== email)) {
        return sendJSON(res, 400, { error: 'No puedes eliminar al último SUPERADMIN.' }, req);
      }
      delete users[email];
      for (const t of Object.keys(sessions)) {
        if (sessions[t] && String(sessions[t].email || '').toLowerCase() === email) delete sessions[t];
      }
      for (const f of Object.keys(quotes)) {
        if (quotes[f] && String(quotes[f].email || '').toLowerCase() === email) delete quotes[f];
      }
      try {
        // (autocontenido: loadMant/persistMant se declaran mas abajo en el handler)
        const mf = path.join(DATA_DIR, 'mantenimiento.json');
        let lista = [];
        try { lista = loadJSON(mf, []) || []; } catch (e) {}
        const filtrada = lista.filter((m) => String(m.email || '').toLowerCase() !== email);
        if (filtrada.length !== lista.length) {
          saveJSON(mf, filtrada);
          if (DB_MODE) {
            cMant = filtrada;
            const byId = {};
            for (const mm of filtrada) byId[mm.id] = mm;
            db.wt(db.replaceAll('kv_mantenimiento', byId));
          }
        }
      } catch (e) {}
      try {
        const rs = loadRecup();
        let cambio = false;
        for (const k of Object.keys(rs)) {
          if (String((rs[k] || {}).email || '').toLowerCase() === email) { delete rs[k]; cambio = true; }
        }
        if (cambio) persistRecup(rs);
      } catch (e) {}
      persistUsers();
      persistSessions();
      persistQuotes();
      logAudit(req, { modulo: 'usuarios', evento: 'baja-propia', detalle: u.nombre + ' (' + u.rol + ')', usuario: email });
      return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { error: 'Metodo no permitido' });
  }

  if (pathname === '/api/cotizaciones' && req.method === 'GET') {
    const token = getToken(req);
    const u = userByToken(token);
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para consultar cotizaciones' });
    let lista = Object.values(quotes).sort((a, b) => (a.folio < b.folio ? 1 : -1));
    // Cada rol ve solo su zona (ver quoteScope) y solo lo que no tiene oculto:
    // si el personal la occulto en su panel, el cliente la sigue viendo, y al
    // reves. El filtro ?email= es solo staff.
    lista = lista.filter((c) => quoteScope(u, c) && quoteVisible(c, u));
    const emailFiltro = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (emailFiltro && (u.rol === 'ADMIN' || u.rol === 'SUPERADMIN')) {
      lista = lista.filter((c) => c.email && String(c.email).trim().toLowerCase() === emailFiltro);
    }
    return sendJSON(res, 200, lista.map((c) => quoteForUser(c, u, { sinFotos: true })));
  }

  if (pathname === '/api/cotizaciones/historial' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || (u.rol !== 'ADMIN' && u.rol !== 'SUPERADMIN')) return sendJSON(res, 403, { error: 'Solo Admin puede consultar el Historial General' });
    const lista = Object.values(quotes)
      .filter((c) => quoteScope(u, c) && quoteVisible(c, u))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .map((c) => quoteForUser(c, u, { sinFotos: true }));
    return sendJSON(res, 200, lista);
  }

  if (pathname === '/api/cotizaciones' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para cotizar' });
    const base = parseFloat(body.montoBase) || 12900;
    const instalacion = Math.round(base * 0.18);
    const iva = Math.round((base + instalacion) * 0.16);
    const tipoInmueble = String(body.tipoInmueble || 'Casa');
    // El area se deriva en servidor (no se confia en el cliente): Proyecto Especial
    // va unicamente al rol de Proyectos Especiales; Productos Electrónicos,
    // unicamente al rol de Productos Electrónicos; el resto es GENERAL.
let area = tipoInmueble === 'Proyecto Especial' ? 'PROYECTOS_ESPECIALES'
    : (tipoInmueble === 'Productos Electrónicos' ? 'PRODUCTOS_ELECTRONICOS' : 'GENERAL');
  const espTipoInfraestructura = String(body.espTipoInfraestructura || '');
  if (area === 'PROYECTOS_ESPECIALES' && !espTipoInfraestructura) {
    return sendJSON(res, 400, { error: 'Selecciona el alcance o tipo de infraestructura del proyecto especial' });
  }
  const year = new Date().getFullYear();
  const serie = serieDeCotizacion(body, area);
  // El area se hacia solo mirando el tipo de inmueble. Cuando la peticion viene
  // de la pagina de productos electronicos, esa casilla no viaja y el area
  // quedaba en GENERAL: el folio salia de electronica (COT-ELC) pero la
  // cotizacion se colaba en la bandeja de ADMIN. Ahora el area sale de la misma
  // serie que decide el folio, para que las dos cosas no se contradigan.
  if (area === 'GENERAL' && serie !== 'GENERAL') area = serie;
  const folio = folioSiguiente(serie, year);
  // Se validan las fotos antes de armar el registro para poder reportar
  // cuantas entraron y cuantas quedaron guardadas.
  const saneadas = sanitizaFotos(body.fotos);
    const c = {
      folio,
      fecha: fechaLocal(),
      email: u.email, nombre: u.nombre,
      telefono: String(body.telefono || u.telefono || ''),
      telefonoSec: String(body.telefonoSec || ''),
      distrito: String(body.distrito || ''),
      referencia: String(body.referencia || ''),
      tipoInmueble,
      espTipoInfraestructura,
      medidasDescriptivas: String(body.medidasDescriptivas || ''),
      area,
      // Con que serie quedo: el panel usa esto para agrupar y para poner la
      // etiqueta correcta en el documento.
      serie,
      tipoCotizacion: serie,
      direccion: String(body.direccion || ''),
      producto: String(body.producto || 'Sistema de seguridad integral'),
      descripcion: String(body.descripcion || ''),
      notas: String(body.notas || '').slice(0, 2000),
      // Fotos que el cliente adjuntó a la solicitud. El navegador ya las achica
      // antes de mandarlas (1200 px / JPEG 0.72, y 1000 px / 0.62 de la 6a en
      // adelante), así que acá solo se valida que sean imágenes de verdad y que
      // no vengan más de las permitidas.
      fotos: saneadas.lista,
      // Si alguna no se pudo guardar, el cliente lo tiene que saber: se
      // devuelve el conteo para que la pantalla avise en vez de prometer 20
      // fotos y entregar 13 sin decir nada.
      fotosRecibidas: saneadas.recibidas,
      fotosGuardadas: saneadas.guardadas,
      // Artículos sueltos de la cotización: permiten imprimirlos en tabla.
      items: (Array.isArray(body.items) ? body.items : []).slice(0, 80).map((it) => ({
        title: String((it && it.title) || '').trim().slice(0, 200),
        qty: Math.max(1, Math.min(999, parseInt(it && it.qty, 10) || 1)),
        desc: String((it && it.desc) || '').trim().slice(0, 300),
      })).filter((it) => it.title),
      subtotal: base, instalacion, iva, total: base + instalacion + iva,
      estado: 'PENDIENTE',
      validez: fechaLocal(new Date(Date.now() + 15 * 864e5)),
    };
    quotes[folio] = c;
    // Solo se escribe ESTA cotizacion (upsert por fila). Sin folio caeria al
    // reescritura completa de la tabla, que es lo que se evita.
    persistQuotes(folio);
    logAudit(req, { modulo: 'cotizaciones', evento: 'alta', detalle: (c.producto || '') + ' para ' + u.email, folio });
    // Confirmacion por correo al cliente. No bloquea ni falla la respuesta:
    // si no hay proveedor de correo o falla el envio, solo queda en el log.
    try {
      correoConfirmacionCotizacion(c.email, c.nombre, c).catch(function (e) {
        console.log('Aviso correo confirmacion ' + folio + ': ' + e.message);
      });
    } catch (e) {
      console.log('Aviso correo confirmacion ' + folio + ': ' + e.message);
    }
    return sendJSON(res, 201, c);
  }

  // ----- PDF real de la cotizacion (archivo .pdf, no vista de impresion) -----
  // Unifica el formato para todas las areas: la misma plantilla del servidor,
  // con nombre de archivo = folio. La vista en pantalla (viewQuote) sigue
  // existiendo; esto es para descargar el documento oficial.
  const mPdf = /^\/api\/cotizaciones\/(.+)\/pdf$/.exec(pathname);
  if (mPdf && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para descargar el documento' }, req);
    const c = quotes[mPdf[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    if (!quoteScope(u, c)) return sendJSON(res, 403, { error: 'No tienes permiso para descargar esta cotizacion' }, req);
    // Si el cliente la occulto en su cuenta, tampoco puede descargarla.
    if (!quoteVisible(c, u)) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    let pdf;
    try {
      pdf = require('./pdf');
    } catch (e) {
      return sendJSON(res, 501, { error: 'Generador PDF no disponible en este despliegue.' }, req);
    }
    let buf;
    try {
      // Si las fotos estan en el archivo, se traen antes de armar el PDF: el
      // documento sale con las imagenes igual que si nunca se hubieran movido.
      buf = await pdf.generar(await fotosParaDocumento(c));
    } catch (e) {
      console.log('Aviso PDF ' + c.folio + ': ' + e.message);
      return sendJSON(res, 500, { error: 'No se pudo generar el documento.' }, req);
    }
    logAudit(req, { modulo: 'cotizaciones', evento: 'descarga-pdf', detalle: c.folio, folio: c.folio });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + String(c.folio).replace(/[^A-Za-z0-9._-]+/g, '_') + '.pdf"',
      'Content-Length': buf.length,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Vary': 'Origin',
    });
    return res.end(buf);
  }

  const mFolio = /^\/api\/cotizaciones\/(.+)$/.exec(pathname);
  if (mFolio && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para consultar una cotizacion' });
    const c = quotes[mFolio[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' });
    if (!quoteScope(u, c)) return sendJSON(res, 403, { error: 'No tienes permiso para consultar esta cotizacion' });
    if (!quoteVisible(c, u)) return sendJSON(res, 404, { error: 'No encontrada' });
    return sendJSON(res, 200, quoteForUser(c, u));
  }

  // ----- archivo de fotos (solo SUPERADMIN) -----
  // Archivar NO borra la cotizacion: solo saca los bytes de las imagenes de la
  // memoria y los deja en el archivo, donde se vuelven a pedir cuando hacen
  // falta. La tabla, el historial, las busquedas y los Excel no cambian.
  //
  // Orden importante: la ruta del .zip va antes que la de :folio, porque
  // "/api/archivo/fotos.zip" tambien cabria en el patron de un solo segmento.
  if (pathname === '/api/archivo/fotos.zip' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo el Super Admin puede bajar el archivo de fotos' }, req);
    logAudit(req, { modulo: 'cotizaciones', evento: 'descarga-archivo-fotos', detalle: 'ZIP completo del archivo de fotos' });
    return enviarZip(req, res, async function* () {
      const lista = await listarFotosArchivadas();
      yield { nombre: 'resumen.json', datos: Buffer.from(JSON.stringify(lista, null, 2), 'utf8') };
      for (const meta of lista) {
        const fotos = await binFotosArchivadas(meta.folio);
        if (!fotos || !fotos.length) continue;
        const base = String(meta.folio).replace(/[^A-Za-z0-9._-]+/g, '_');
        for (let i = 0; i < fotos.length; i++) {
          yield {
            nombre: 'fotos/' + base + '-' + String(i + 1).padStart(2, '0') + '.' + fotoAPng(fotos[i]),
            datos: bytesDeFoto(fotos[i]),
          };
        }
      }
    }, 'archivo-fotos-' + fechaLocal() + '.zip');
  }

  if (pathname === '/api/archivo/fotos' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo el Super Admin puede ver el archivo de fotos' }, req);
    const lista = await listarFotosArchivadas();
    lista.sort((a, b) => String(a.archivada || '').localeCompare(String(b.archivada || '')));
    return sendJSON(res, 200, lista, req);
  }

  if (pathname === '/api/archivo/fotos' && req.method === 'POST') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo el Super Admin puede archivar fotos' }, req);
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const meses = Number.isFinite(Number(body.meses)) ? Math.max(0, Math.floor(Number(body.meses))) : 12;
    const corte = meses > 0 ? Date.now() - meses * 30.4 * 864e5 : null;
    const conFotos = [];
    let movidas = 0, movidasN = 0, movidasKb = 0;
    for (const c of Object.values(quotes)) {
      if (!Array.isArray(c.fotos) || !c.fotos.length) continue;
      conFotos.push({ folio: c.folio, kb: Math.round(c.fotos.reduce((a, f) => a + String(f || '').length, 0) * 0.75 / 1024) });
      if (corte && fechaDeCotizacion(c) > corte) continue;
      // Primero se guardan los bytes y despues se marca la cotizacion: si se
      // cayera el servidor en medio, la foto sigue en el archivo y la
      // cotizacion todavia la tiene (no se perdio nada).
      const fotos = c.fotos;
      const meta = metaArchivo(c, fotos);
      await guardarFotosArchivadas(c.folio, meta, fotos);
      c.fotos = [];
      c.fotosN = fotos.length;
      c.fotosArchivadas = { n: meta.n, kb: meta.kb, archivada: meta.archivada };
      persistQuotes(c.folio);
      movidas++;
      movidasN += fotos.length;
      movidasKb += meta.kb;
    }
    logAudit(req, {
      modulo: 'cotizaciones',
      evento: 'archivo-fotos',
      detalle: movidas + ' cotizacion(es), ' + movidasN + ' fotos, ' + movidasKb + ' KB (meses: ' + meses + ')',
    });
    return sendJSON(res, 200, {
      ok: true,
      meses: meses,
      movidas: movidas,
      fotos: movidasN,
      kb: movidasKb,
      quedanConFotos: conFotos.length - movidas,
      kbVivo: conFotos.reduce(function (a, x) { return a + x.kb; }, 0) - movidasKb,
    }, req);
  }

  // Ver las fotos de una cotizacion archivada (mismos permisos que verla).
  const mFotosArchivadas = /^\/api\/archivo\/fotos\/([^/]+)$/.exec(pathname);
  if (mFotosArchivadas && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para ver las fotografias' }, req);
    const c = quotes[mFotosArchivadas[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    if (!quoteScope(u, c)) return sendJSON(res, 403, { error: 'No tienes permiso para ver estas fotografias' }, req);
    if (!quoteVisible(c, u)) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    const fotos = await binFotosArchivadas(c.folio);
    if (!fotos || !fotos.length) return sendJSON(res, 404, { error: 'Esta cotizacion no tiene fotos archivadas' }, req);
    return sendJSON(res, 200, { folio: c.folio, fotos: fotos, archivada: c.fotosArchivadas || null }, req);
  }

  // Devolver las fotos de una cotizacion a su estado normal.
  const mRestaurarFotos = /^\/api\/archivo\/fotos\/([^/]+)\/restaurar$/.exec(pathname);
  if (mRestaurarFotos && req.method === 'POST') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo el Super Admin puede restaurar fotos' }, req);
    const c = quotes[mRestaurarFotos[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    const fotos = await binFotosArchivadas(c.folio);
    if (!fotos || !fotos.length) return sendJSON(res, 404, { error: 'Esta cotizacion no tiene fotos archivadas' }, req);
    c.fotos = fotos;
    c.fotosN = fotos.length;
    delete c.fotosArchivadas;
    persistQuotes(c.folio);
    await borrarFotosArchivadas(c.folio);
    logAudit(req, { modulo: 'cotizaciones', evento: 'restauracion-fotos', detalle: c.folio + ' (' + fotos.length + ' fotos)', folio: c.folio });
    return sendJSON(res, 200, { ok: true, folio: c.folio, fotos: fotos.length }, req);
  }

  // ----- staff: resumen operativo -----
  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    let lista = Object.values(quotes);
    // Cada rol ve su zona: electrónicos solo la suya; admin todo menos PE.
    if (u.rol === 'PRODUCTOS_ELECTRONICOS') {
      lista = lista.filter((c) => (c.area || 'GENERAL') === 'PRODUCTOS_ELECTRONICOS' || c.tipoInmueble === 'Productos Electrónicos');
    } else if (u.rol !== 'SUPERADMIN') {
      lista = lista.filter((c) => (c.area || 'GENERAL') !== 'PROYECTOS_ESPECIALES');
    }
    const total = lista.reduce((s, c) => s + (Number(c.total) || 0), 0);
    return sendJSON(res, 200, {
      usuarios: Object.keys(users).length,
      cotizaciones: lista.length,
      montoTotal: Math.round(total * 100) / 100,
      pendientes: lista.filter((c) => c.estado === 'PENDIENTE').length,
      aprobadas: lista.filter((c) => c.estado === 'APROBADA').length,
    });
  }

  // ----- superadmin: usuarios (matriz completa) -----
  if (pathname === '/api/users' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN puede consultar usuarios' });
    return sendJSON(res, 200, Object.values(users).map(publicUser));
  }
  if (pathname === '/api/users' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN puede crear usuarios' });
    const nombre = String(body.nombre || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const rol = String(body.rol || 'CLIENTE').toUpperCase();
    if (!nombre || !email || !email.includes('@')) return sendJSON(res, 400, { error: 'Nombre y email valido son obligatorios' });
    if (problemaDePassword(password)) return sendJSON(res, 400, { error: problemaDePassword(password) });
    if (!['CLIENTE', 'ADMIN', 'SUPERADMIN', 'PROYECTOS_ESPECIALES', 'PRODUCTOS_ELECTRONICOS'].includes(rol)) return sendJSON(res, 400, { error: 'Rol no valido' });
    if (users[email]) return sendJSON(res, 409, { error: 'Ese correo ya esta registrado' });
    users[email] = {
      nombre, email,
      telefono: normalizaTelefono(body.telefono),
      direccion: String(body.direccion || '').trim().slice(0, 240),
      empresa: String(body.empresa || '').trim().slice(0, 160),
      passHash: hashPassword(password), passPropia: true, rol,
      activo: body.activo === undefined ? true : !!body.activo,
      lastLogin: null, createdAt: fechaLocal(),
    };
    persistUsers();
    logAudit(req, { modulo: 'usuarios', evento: 'alta', detalle: nombre + ' (' + rol + ')', usuario: email });
    return sendJSON(res, 201, publicUser(users[email]));
  }

  const mUser = /^\/api\/users\/(.+)$/.exec(pathname);
  if (mUser && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN puede editar usuarios' });
    const email = decodeURIComponent(mUser[1]).toLowerCase();
    const target = users[email];
    if (!target) return sendJSON(res, 404, { error: 'Usuario no encontrado' });
    const self = email === u.email;
    if (body.rol !== undefined) {
      const rol = String(body.rol || '').toUpperCase();
      if (!['CLIENTE', 'ADMIN', 'SUPERADMIN', 'PROYECTOS_ESPECIALES', 'PRODUCTOS_ELECTRONICOS'].includes(rol)) return sendJSON(res, 400, { error: 'Rol no valido' });
      if (self) return sendJSON(res, 400, { error: 'No puedes cambiar tu propio rol' });
      if (target.rol !== rol) logAudit(req, { modulo: 'usuarios', evento: 'cambio-rol', detalle: target.nombre + ': ' + target.rol + ' → ' + rol, usuario: email });
      target.rol = rol;
    }
    if (body.nombre !== undefined && String(body.nombre).trim()) target.nombre = String(body.nombre).trim().slice(0, 120);
    if (body.telefono !== undefined) target.telefono = normalizaTelefono(body.telefono);
    if (body.direccion !== undefined) target.direccion = String(body.direccion).trim().slice(0, 240);
    if (body.empresa !== undefined) target.empresa = String(body.empresa).trim().slice(0, 160);
    if (body.activo !== undefined) {
      if (self && !body.activo) return sendJSON(res, 400, { error: 'No puedes desactivar tu propia cuenta' });
      if (target.activo !== !!body.activo) logAudit(req, { modulo: 'usuarios', evento: body.activo ? 'activacion' : 'desactivacion', detalle: target.nombre, usuario: email });
      target.activo = !!body.activo;
    }
    if (body.newPassword) {
      if (problemaDePassword(body.newPassword)) return sendJSON(res, 400, { error: problemaDePassword(body.newPassword) });
      target.passHash = hashPassword(body.newPassword); target.passPropia = true;
      logAudit(req, { modulo: 'usuarios', evento: 'cambio-password', detalle: target.nombre, usuario: email });
    }
    if (body.foto !== undefined) {
      const f = fotoPerfilValida(body.foto);
      if (f === null) return sendJSON(res, 400, { error: 'Foto no válida (JPG, PNG o WebP, máx 250KB)' });
      target.foto = f;
    }
    persistUsers(email);
    return sendJSON(res, 200, publicUser(target));
  }
  if (mUser && req.method === 'DELETE') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN puede eliminar usuarios' });
    const email = decodeURIComponent(mUser[1]).toLowerCase();
    const target = users[email];
    if (!target) return sendJSON(res, 404, { error: 'Usuario no encontrado' });
    if (email === u.email) return sendJSON(res, 400, { error: 'No puedes eliminar tu propia cuenta' });
    if (target.rol === 'SUPERADMIN' && !Object.values(users).some((x) => x.rol === 'SUPERADMIN' && x.email !== email)) {
      return sendJSON(res, 400, { error: 'No puedes eliminar al último SUPERADMIN' });
    }
    delete users[email];
    for (const t of Object.keys(sessions)) { if (sessions[t] && sessions[t].email.toLowerCase() === email) delete sessions[t]; }
    persistUsers();
    persistSessions();
    logAudit(req, { modulo: 'usuarios', evento: 'baja', detalle: target.nombre + ' (' + target.rol + ')', usuario: email });
    return sendJSON(res, 200, { ok: true });
  }

  // ----- superadmin: bitacora de auditoria -----
  if (pathname === '/api/auditoria' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN' });
    const a = loadAudit();
    let items = a.items.slice().reverse();
    const modulo = normalizeSearch(url.searchParams.get('modulo') || '');
    const q = normalizeSearch(url.searchParams.get('q') || '');
    const desde = url.searchParams.get('desde') || '';
    const hasta = url.searchParams.get('hasta') || '';
    const limit = Math.max(1, Math.min(2000, parseInt(url.searchParams.get('limit') || '200', 10) || 200));
    if (modulo && modulo !== 'todos') items = items.filter((e) => normalizeSearch(e.modulo || '') === modulo);
    if (desde) items = items.filter((e) => (e.fecha || '') >= desde);
    if (hasta) items = items.filter((e) => (e.fecha || '') <= hasta);
    if (q) items = items.filter((e) => matchesSearch((e.evento || '') + ' ' + (e.detalle || '') + ' ' + (e.usuario || '') + ' ' + (e.nombre || '') + ' ' + (e.folio || ''), q));
    return sendJSON(res, 200, { total: a.items.length, totalFiltered: items.length, items: items.slice(0, limit).map(publicAudit) });
  }

  // Vaciar la bitácora. Es una acción destructiva, así que se exige una
  // confirmación escrita: mandar "BORRAR" de vuelta. Aunque llegue el request
  // mal, no se borra nada.
  if (pathname === '/api/auditoria' && req.method === 'DELETE') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN' });
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    if (String(body.confirmar || '').trim().toUpperCase() !== 'BORRAR') {
      return sendJSON(res, 400, { error: 'Falta la confirmacion. Escribe BORRAR para vaciar la bitacora.' });
    }
    const antes = loadAudit().items.length;
    persistAudit({ items: [], lastHash: 'GENESIS' });
    // Queda constancia de que se vacio, para que el borrado no quede sin rastro.
    logAudit(req, { modulo: 'accesos', evento: 'bitacora-vaciada', detalle: 'Se borraron ' + antes + ' registros a peticion del SUPERADMIN', usuario: u.email });
    return sendJSON(res, 200, { ok: true, borrados: antes });
  }

  // ----- staff: cambiar estado de cotizacion -----
  const mEstado = /^\/api\/cotizaciones\/(.+)\/estado$/.exec(pathname);
  if (mEstado && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    const c = quotes[mEstado[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' });
    const puedePE = u && u.rol === 'PROYECTOS_ESPECIALES' && c.area === 'PROYECTOS_ESPECIALES';
    if (!quoteScope(u, c) || (!isStaff(u) && !puedePE)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const estado = String(body.estado || '').toUpperCase();
    if (!['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(estado)) return sendJSON(res, 400, { error: 'Estado no valido' });
    const anterior = c.estado;
    c.estado = estado;
    if (anterior !== estado) recordQuoteState(c, u, anterior, estado);
    persistQuotes(c.folio);
    logAudit(req, { modulo: 'cotizaciones', evento: 'cambio-estado', detalle: estado, folio: c.folio });
    return sendJSON(res, 200, quoteForUser(c, u));
  }

  // ----- proyectos especiales: fases, avance y entrega (rol PE + staff) -----
  const mProy = /^\/api\/cotizaciones\/(.+)\/proyecto$/.exec(pathname);
  if (mProy && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    const c = quotes[mProy[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' });
    const puedePE = u && u.rol === 'PROYECTOS_ESPECIALES' && c.area === 'PROYECTOS_ESPECIALES';
    if (!u || (!isStaff(u) && !puedePE)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    if (Array.isArray(body.fases)) {
      c.fases = body.fases.slice(0, 12).map((f) => ({
        titulo: String((f && f.titulo) || '').slice(0, 140),
        desc: String((f && f.desc) || '').slice(0, 500),
        pct: Math.max(0, Math.min(100, parseInt((f && f.pct) || 0, 10) || 0)),
        estado: String((f && f.estado) || 'Por iniciar').slice(0, 40),
      }));
    }
    if (body.avance !== undefined) c.avance = Math.max(0, Math.min(100, parseInt(body.avance, 10) || 0));
    if (body.tecnico !== undefined) c.tecnico = String(body.tecnico).slice(0, 120);
    if (body.entregado !== undefined) c.entregado = !!body.entregado;
    if (body.enRevision !== undefined) c.enRevision = !!body.enRevision;
    if (body.notas !== undefined) c.notas = String(body.notas).slice(0, 1000);
    persistQuotes(c.folio);
    logAudit(req, { modulo: 'proyectos', evento: 'avance', detalle: 'fases/avance de ' + c.folio, folio: c.folio });
    return sendJSON(res, 200, c);
  }

  // ----- ocultar / eliminar cotizacion (cada rol decide sobre la suya) -----
  // Antes esto borraba el registro para siempre: si un admin lo eliminaba desde
  // su panel, la cotizacion desaparecia tambien para el cliente, que es su
  // documento. Ahora es borrado logico por lado:
  //   - el personal la occulta para el personal (el cliente la sigue viendo),
  //   - el cliente la occulta en su cuenta (el personal la sigue viendo),
  //   - el SUPERADMIN puede pedir el borrado definitivo con ambito "todos".
  const mDel = /^\/api\/cotizaciones\/([^/]+)$/.exec(pathname);
  if (mDel && req.method === 'DELETE') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    const c = quotes[mDel[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' });
    const puedePE = u && u.rol === 'PROYECTOS_ESPECIALES' && c.area === 'PROYECTOS_ESPECIALES';
    // Solo dentro de su zona: un rol nunca borra cotizaciones de otro. El
    // cliente unicamente las propias (quoteScope ya excluye las demo).
    const esDueno = u && u.rol === 'CLIENTE' && c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase();
    if (!u || !quoteScope(u, c) || (!isStaff(u) && !puedePE && !esDueno)) {
      return sendJSON(res, 403, { error: 'No tienes permiso para eliminar esta cotizacion' });
    }
    // Proyecto especial aprobado: ya hay staff asignado y fases en curso, asi
    // que el cliente ya no puede eliminarla por su cuenta. Si la necesita dada
    // de baja, que lo pida al personal, que si puede. El personal siempre puede.
    const esEspecial = c.area === 'PROYECTOS_ESPECIALES' || c.tipoInmueble === 'Proyecto Especial';
    const aprobada = String(c.estado || '').toUpperCase() === 'APROBADA';
    if (esDueno && esEspecial && aprobada) {
      return sendJSON(res, 403, { error: 'Este proyecto especial ya fue aprobado, por eso ya no se puede eliminar. Si necesitas darlo de baja, avisale a Grupo NERBA HIDALGO.' });
    }
    if (u.rol === 'SUPERADMIN' && body.ambito === 'todos') {
      // Tambien se lleva las fotos del archivo, si las tenia.
      borrarQuoteEnDb(mDel[1]);
      logAudit(req, { modulo: 'cotizaciones', evento: 'baja-definitiva', detalle: (c.producto || '') + ' de ' + (c.email || ''), folio: mDel[1] });
      return sendJSON(res, 200, { ok: true, ambito: 'todos' });
    }
    if (!c.oculta || typeof c.oculta !== 'object') c.oculta = {};
    const lado = esPersonal(u) ? 'staff' : 'cliente';
    if (c.oculta[lado]) return sendJSON(res, 200, { ok: true, ambito: lado, yaOculta: true });
    c.oculta[lado] = { por: u.email, nombre: u.nombre, rol: u.rol, fecha: new Date().toISOString() };
    persistQuotes(c.folio);
    logAudit(req, {
      modulo: 'cotizaciones',
      evento: lado === 'staff' ? 'baja-panel' : 'baja-cliente',
      detalle: (c.producto || '') + ' de ' + (c.email || '') +
        (lado === 'staff' ? ' (oculta al personal; el cliente la sigue viendo)' : ' (oculta al cliente; el personal la sigue viendo)'),
      folio: mDel[1],
    });
    return sendJSON(res, 200, { ok: true, ambito: lado });
  }

  // ----- restaurar una cotizacion oculta (solo SUPERADMIN) -----
  // Sin esto, un borrado-logico mal hecho por el personal se perdia para
  // siempre sin que nadie lo notara.
  const mRest = /^\/api\/cotizaciones\/([^/]+)\/restaurar$/.exec(pathname);
  if (mRest && req.method === 'PUT') {
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo el Super Admin puede restaurar cotizaciones' });
    const c = quotes[mRest[1]];
    if (!c) return sendJSON(res, 404, { error: 'No encontrada' });
    if (c.oculta && typeof c.oculta === 'object') {
      delete c.oculta.staff;
      delete c.oculta.cliente;
      if (!Object.keys(c.oculta).length) delete c.oculta;
    }
    persistQuotes(c.folio);
    logAudit(req, { modulo: 'cotizaciones', evento: 'restauracion', detalle: 'Vuelta a verse en ambos paneles: ' + (c.producto || ''), folio: mRest[1] });
    return sendJSON(res, 200, quoteForUser(c, u));
  }

  // ----- mensajes de contacto -----
  const contactoFile = path.join(DATA_DIR, 'contacto.json');
  function loadContacto() {
    if (DB_MODE && cContacto) return cContacto;
    try {
      const l = loadJSON(contactoFile, {});
      if (l) { if (DB_MODE) cContacto = l; return l; }
    } catch {}
    return [];
  }
  function saveContacto(lista) {
    saveJSON(contactoFile, lista);
    if (DB_MODE) {
      cContacto = lista;
      const byId = {};
      for (const m of lista) byId[m.id] = m;
      db.wt(db.replaceAll('kv_contacto', byId));
    }
  }
  if (pathname === '/api/contacto' && req.method === 'POST') {
    if (!rateLimit(req, 15)) return sendJSON(res, 429, { error: 'Demasiados mensajes. Espera un minuto.' }, req);
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch (e) { if (e && e.code === 413) return sendJSON(res, 413, { error: 'Mensaje muy grande' }, req); body = {}; }
    const nombre = String(body.nombre || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 160);
    const mensaje = String(body.mensaje || '').trim().slice(0, 2000);
    if (!nombre || !email || !mensaje) return sendJSON(res, 400, { error: 'Nombre, email y mensaje son obligatorios' });
    if (!email.includes('@')) return sendJSON(res, 400, { error: 'Email no valido' });
    const lista = loadContacto();
    const m = {
      id: 'MSG-' + Date.now().toString(36).toUpperCase(),
      fecha: fechaLocal(),
      nombre, email,
      telefono: String(body.telefono || '').trim(),
      asunto: String(body.asunto || 'Consulta general').trim(),
      mensaje, leido: false,
    };
    lista.unshift(m);
    saveContacto(lista);
    return sendJSON(res, 201, { ok: true, id: m.id });
  }
  if (pathname === '/api/contacto' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    return sendJSON(res, 200, loadContacto());
  }
  const mMsg = /^\/api\/contacto\/(.+)$/.exec(pathname);
  if (mMsg && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const lista = loadContacto();
    const m = lista.find((x) => x.id === mMsg[1]);
    if (!m) return sendJSON(res, 404, { error: 'No encontrado' });
    m.leido = true;
    saveContacto(lista);
    return sendJSON(res, 200, m);
  }

  // ----- servicios generales del index (carrusel, los edita el staff) -----
  // Mismo esquema que el catalogo: JSON local + Postgres kv_servicios, y las
  // mismas guardas de rol (isCatalogAdmin = ADMIN o SUPERADMIN).
  const serviciosFile = path.join(DATA_DIR, 'servicios.json');
  const serviciosSeed = path.join(__dirname, 'servicios.seed.json');
  function loadServicios() {
    // Se normaliza tambien desde la cache de Postgres: si no, los servicios que
    // ya estaban guardados sin 'orden' se quedaban en 0 y se adelantaban a los
    // que el staff si habia ordenado.
    if (DB_MODE && cServicios) return normalizaOrden(cServicios);
    try {
      { const l = loadJSON(serviciosFile, null); if (l) { if (DB_MODE) cServicios = l; return normalizaOrden(l); } }
      if (fs.existsSync(serviciosSeed)) {
        const seed = JSON.parse(fs.readFileSync(serviciosSeed, 'utf8'));
        saveJSON(serviciosFile, seed);
        if (DB_MODE) cServicios = seed;
        return normalizaOrden(seed);
      }
    } catch {}
    return [];
  }
  // Los servicios guardados antes de que existiera el campo 'orden' llegan sin
  // el. Se les asigna por posicion la primera vez, y se guarda, para que las
  // flechas del panel partan de un orden estable en vez de.sort alfabetico.
  function normalizaOrden(lista) {
    if (!Array.isArray(lista) || !lista.length) return lista;
    const falta = lista.some((x) => !Number.isFinite(Number(x.orden)));
    if (!falta) return lista;
    ordenarServicios(lista).forEach((x, i) => { x.orden = i + 1; });
    persistServicios(lista);
    return lista;
  }
  function persistServicios(list) {
    saveJSON(serviciosFile, list);
    if (DB_MODE) {
      cServicios = list;
      const byId = {};
      for (const s of list) byId[s.id] = s;
      db.wt(db.replaceAll('kv_servicios', byId));
    }
  }
  function cleanServicio(b) {
    const s = (v) => String(v == null ? '' : v).trim();
    return {
      eyebrow: s(b.eyebrow).slice(0, 60),   // etiqueta pequena, ej. "VIDEOS Y MONITOREO"
      title: s(b.title).slice(0, 120),
      description: s(b.description).slice(0, 600),
      image: s(b.image).slice(0, 2000000),
      href: s(b.href).slice(0, 200),
      // Posicion en el carrusel. Lo mueve el staff con las flechas del panel.
      orden: Math.max(0, Math.min(9999, parseInt(b.orden, 10) || 0)),
      activo: b.activo === undefined ? true : (b.activo === true || String(b.activo).toLowerCase() === 'true'),
    };
  }
  function ordenarServicios(lista) {
    // Orden estable: primero los activos, luego por el campo 'orden', que es el
    // que mueve el staff con las flechas del panel. El titulo solo desempata,
    // para que dos servicios con el mismo orden no salten de lado.
    return lista.slice().sort((a, b) => {
      const aa = a.activo === false ? 1 : 0, ba = b.activo === false ? 1 : 0;
      if (aa !== ba) return aa - ba;
      const oa = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 0;
      const ob = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 0;
      if (oa !== ob) return oa - ob;
      return String(a.title || '').localeCompare(String(b.title || ''), 'es');
    });
  }
  // Solo ADMIN y SUPERADMIN editan los servicios. No se usa isStaff() porque
  // ese tambien deja pasar a PRODUCTOS_ELECTRONICOS, que solo debe tocar el
  // catalogo de electronica.
  function isServiciosAdmin(user) {
    return !!user && (user.rol === 'ADMIN' || user.rol === 'SUPERADMIN');
  }
  if (pathname === '/api/servicios' && req.method === 'GET') {
    return sendJSON(res, 200, ordenarServicios(loadServicios()));
  }
  if (pathname === '/api/servicios' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isServiciosAdmin(u)) return sendJSON(res, 403, { error: 'Solo administracion' });
    const srv = cleanServicio(body);
    if (!srv.title) return sendJSON(res, 400, { error: 'El titulo es obligatorio' });
    if (srv.image && srv.image.length > 2000000) return sendJSON(res, 400, { error: 'Imagen muy pesada (máx 2MB, se comprime al subir)' });
    const lista = loadServicios();
    const base = srv.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'servicio';
    let id = base, n = 2;
    while (lista.some((x) => x.id === id)) id = base + '-' + (n++);
    // Si el staff no dijo en que posicion va, se va al final. Asi lo nuevo no
    // se cuela al principio de un carrusel que el admin ordeno a mano.
    if (!body.orden && body.orden !== 0) {
      const max = lista.reduce((m, x) => Math.max(m, Number(x.orden) || 0), 0);
      srv.orden = max + 1;
    }
    const nuevo = { id, ...srv };
    lista.push(nuevo);
    persistServicios(lista);
    logAudit(req, { modulo: 'servicios', evento: 'alta', detalle: nuevo.title });
    return sendJSON(res, 201, nuevo);
  }
  // Reordena varias publicaciones de golpe. Es lo que llaman las flechas del
// panel: llegan los ids en el orden que el admin quiere y se renumeran 1..n.
if (pathname === '/api/servicios/ordenar' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isServiciosAdmin(u)) return sendJSON(res, 403, { error: 'Solo administracion' }, req);
    const orden = Array.isArray(body.orden) ? body.orden : [];
    if (!orden.length) return sendJSON(res, 400, { error: 'No se recibio el orden nuevo' }, req);
    const lista = loadServicios();
    const porId = {};
    for (const x of lista) porId[x.id] = x;
    const cambios = [];
    orden.forEach((id, i) => {
      const s = porId[id];
      // Un id que no existe se ignora en vez de tumbar toda la operacion.
      if (s && Number(s.orden || 0) !== i + 1) { s.orden = i + 1; cambios.push(s.title || id); }
    });
    persistServicios(lista);
    logAudit(req, { modulo: 'servicios', evento: 'orden', detalle: cambios.length ? cambios.join(' | ') : 'sin cambios' });
    return sendJSON(res, 200, { ok: true, servicios: ordenarServicios(lista) });
  }

  const mServ = /^\/api\/servicios\/([^/]+)$/.exec(pathname);
  if (mServ && (req.method === 'PUT' || req.method === 'DELETE')) {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isServiciosAdmin(u)) return sendJSON(res, 403, { error: 'Solo administracion' });
    const lista = loadServicios();
    const idx = lista.findIndex((x) => x.id === mServ[1]);
    if (idx < 0) return sendJSON(res, 404, { error: 'No encontrado' });
    if (req.method === 'DELETE') {
      const quitado = lista.splice(idx, 1)[0];
      persistServicios(lista);
      logAudit(req, { modulo: 'servicios', evento: 'baja', detalle: String(quitado.title || mServ[1]) });
      return sendJSON(res, 200, { ok: true });
    }
    const upd = cleanServicio({ ...lista[idx], ...body });
    if (upd.image && upd.image.length > 2000000) return sendJSON(res, 400, { error: 'Imagen muy pesada (máx 2MB, se comprime al subir)' });
    if (!upd.title) return sendJSON(res, 400, { error: 'El titulo es obligatorio' });
    // El id no se deja cambiar desde la API: moverlo dejaria rotas las URLs.
    lista[idx] = { id: lista[idx].id, ...upd };
    persistServicios(lista);
    logAudit(req, { modulo: 'servicios', evento: 'edicion', detalle: upd.title });
    return sendJSON(res, 200, lista[idx]);
  }

  // ----- catalogo de productos (gestionado por staff, visible en index y catalogo) -----
  const productosFile = path.join(DATA_DIR, 'productos.json');
  const productosSeed = path.join(__dirname, 'productos.seed.json');
  function loadProductos() {
    if (DB_MODE && cProductos) return cProductos;
    try {
      { const l = loadJSON(productosFile, null); if (l) { if (DB_MODE) cProductos = l; return l; } }
      if (fs.existsSync(productosSeed)) {
        const seed = JSON.parse(fs.readFileSync(productosSeed, 'utf8'));
        saveJSON(productosFile, seed);
        if (DB_MODE) cProductos = seed;
        return seed;
      }
    } catch {}
    return [];
  }
  function persistProductos(list) {
    saveJSON(productosFile, list);
    if (DB_MODE) {
      cProductos = list;
      const byId = {};
      for (const p of list) byId[p.id] = p;
      db.wt(db.replaceAll('kv_productos', byId));
    }
  }
  function cleanProduct(b) {
    const s = (v) => String(v == null ? '' : v).trim();
    const arr = (v) => Array.isArray(v) ? v.map(s).filter(Boolean) : s(v).split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    return {
      // Jerarquía del catálogo: marca (nivel 1) -> categoría/tipo (nivel 2) -> producto.
      brand: s(b.brand).slice(0, 60),
      categoryCode: s(b.categoryCode) || 'general',
      category: s(b.category) || s(b.categoryCode) || 'General',
      title: s(b.title),
      description: s(b.description),
      images: arr(b.images),
      idealFor: arr(b.idealFor),
      electronico: b.electronico === true || String(b.electronico).toLowerCase() === 'true',
    };
  }
  function imagenPesada(b) {
    return Array.isArray(b.images) && b.images.some((x) => String(x).length > 2000000);
  }
  // Con R2, las fotos nuevas llegan como URL https. Se aceptan data URL chicas
  // (máx 200KB, p. ej. iconos) para no romper flujos viejos, pero nada que
  // vuelva a llenar la base con megabytes en base64. El front las sube primero
  // a POST /api/fotos.
  function imagenCatalogoOk(s) {
    s = String(s || '');
    if (!s) return true;
    if (/^https:\/\/[^ ]{1,2000}$/.test(s)) return true;
    if (/^http:\/\/localhost(:\d+)?\//.test(s)) return true;
    return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 200 * 1024;
  }
  function imagenesCatalogoMal(lista) {
    const arr = Array.isArray(lista) ? lista : [];
    for (const s of arr) { if (!imagenCatalogoOk(s)) return true; }
    return false;
  }
  // Fotos de la solicitud de cotización. Solo se acepta data URL de imagen y
  // se acota el número y el tamaño: si no, un cliente podría mandar archivos
  // enormes y reventar el límite del request o inflar la cotización guardada.
  // Además de contar se suma el peso, porque el request entero tiene tope: es
  // preferible guardar algunas fotos a devolver un error raro de "payload too
  // large" en pleno envío.
  // Devuelve tambien cuántas entraron y cuántas quedaron, porque si se cae
  // alguna el cliente tiene que enterarse: antes se descartaba en silencio y el
  // PDF salía con menos fotos de las que el cliente subir, sin explicación.
  function sanitizaFotos(lista) {
    if (!Array.isArray(lista)) return { lista: [], recibidas: 0, guardadas: 0 };
    const recibidas = lista.length;
    const salida = [];
    let total = 0;
    for (const f of lista.slice(0, MAX_FOTOS_COTIZACION)) {
      const s = String((f && f !== true ? f : '') || '').trim();
      if (!s) continue;
      // Solo data URL de imagen; cualquier otra cosa se descarta.
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) continue;
      if (s.length > MAX_BYTES_FOTO_COTIZACION * 1.4) continue;
      if (total + s.length > MAX_BYTES_TOTAL_FOTOS) break;
      total += s.length;
      salida.push(s);
    }
    return { lista: salida, recibidas, guardadas: salida.length };
  }
  // Lista LIVIANA: sin bytes de imagenes (solo cuantas trae). Con cientos de
  // publicaciones, mandar las fotos en la lista son decenas de MB por
  // refresco y el catálogo no carga. Las fotos se piden por producto
  // (GET /api/productos/:id) solo cuando se van a ver.
  function productoLista(p) {
    const out = { ...p };
    out.nFotos = Array.isArray(p.images) ? p.images.length : 0;
    delete out.images;
    return out;
  }
  if (pathname === '/api/productos' && req.method === 'GET') {
    return sendJSON(res, 200, loadProductos().map(productoLista));
  }
  // Detalle completo (con fotos) de una publicación. Público como el catálogo.
  const mProdGet = /^\/api\/productos\/([^/]+)$/.exec(pathname);
  if (mProdGet && req.method === 'GET') {
    const p = loadProductos().find((x) => x.id === mProdGet[1]);
    if (!p) return sendJSON(res, 404, { error: 'No encontrada' });
    return sendJSON(res, 200, p);
  }
  if (pathname === '/api/productos' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    if (!body.title || !String(body.title).trim()) return sendJSON(res, 400, { error: 'El titulo es obligatorio' });
    if (imagenesCatalogoMal(body.images)) return sendJSON(res, 400, { error: 'Las fotos deben subirse primero (el catálogo ya no guarda base64 pesado en la base)' });
    const lista = loadProductos();
    const base = String(body.title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'producto';
    let id = base, n = 2;
    while (lista.some((p) => p.id === id)) id = base + '-' + (n++);
    const p = { id, ...cleanProduct(body) };
    lista.push(p);
    persistProductos(lista);
    logAudit(req, { modulo: 'catalogo', evento: 'alta', detalle: p.title });
    return sendJSON(res, 201, p);
  }
  // Reasigna publicaciones de una marca o de un tipo a otro destino. Se usa
  // al quitar una marca/tipo que todavía tiene publicaciones encima.
  if (pathname === '/api/productos/reasignar' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const desde = String(body.desde || ''); // 'marca' | 'tipo'
    const code = slugMarca(body.code || '');
    const lista = loadProductos();
    let moving = 0;
    if (desde === 'marca') {
      const destino = String(body.brand || '').trim();
      if (!destino) return sendJSON(res, 400, { error: 'Elige la marca de destino' });
      const dcode = slugMarca(destino);
      if (dcode === code) return sendJSON(res, 400, { error: 'El destino es la misma marca' });
      lista.forEach((p) => { if (slugMarca(p.brand || 'NERBA') === code) { p.brand = destino; moving++; } });
    } else if (desde === 'tipo') {
      const destino = String(body.categoryCode || '').trim() || 'general';
      const etiqueta = String(body.category || '').trim() || destino;
      if (destino === code) return sendJSON(res, 400, { error: 'El destino es el mismo tipo' });
      lista.forEach((p) => { if (String(p.categoryCode || 'general') === code) { p.categoryCode = destino; p.category = etiqueta; moving++; } });
    } else {
      return sendJSON(res, 400, { error: 'Origen no válido' });
    }
    if (!moving) return sendJSON(res, 400, { error: 'No hay publicaciones en ese origen' });
    persistProductos(lista);
    logAudit(req, { modulo: 'catalogo', evento: 'edicion', detalle: 'Reasignadas ' + moving + ' publicaciones de ' + code });
    return sendJSON(res, 200, { ok: true, movidas: moving });
  }
  const mProd = /^\/api\/productos\/([^/]+)$/.exec(pathname);
  if (mProd && (req.method === 'PUT' || req.method === 'DELETE')) {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const lista = loadProductos();
    const idx = lista.findIndex((p) => p.id === mProd[1]);
    if (idx < 0) return sendJSON(res, 404, { error: 'No encontrado' });
    if (req.method === 'DELETE') {
      lista.splice(idx, 1);
      persistProductos(lista);
      logAudit(req, { modulo: 'catalogo', evento: 'baja', detalle: mProd[1] });
      return sendJSON(res, 200, { ok: true });
    }
    const upd = cleanProduct({ ...lista[idx], ...body, electronico: body.electronico !== undefined ? body.electronico : lista[idx].electronico });
    if (body.images !== undefined && imagenesCatalogoMal(body.images)) return sendJSON(res, 400, { error: 'Las fotos deben subirse primero (el catálogo ya no guarda base64 pesado en la base)' });
    if (!upd.title) return sendJSON(res, 400, { error: 'El titulo es obligatorio' });
    lista[idx] = { id: lista[idx].id, ...upd };
    persistProductos(lista);
    logAudit(req, { modulo: 'catalogo', evento: 'edicion', detalle: upd.title });
    return sendJSON(res, 200, lista[idx]);
  }


  // ----- marcas del catálogo (imagen + etiqueta; las crea/edita el staff) -----
  const marcasFile = path.join(DATA_DIR, 'marcas.json');
  function slugMarca(value) {
    return String(value == null ? '' : value).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60) || 'nerba';
  }
  function loadMarcas() {
    if (DB_MODE && cMarcas) return cMarcas;
    try { const o = loadJSON(marcasFile, null); if (o) { if (DB_MODE) cMarcas = o; return o; } } catch {}
    return {};
  }
  function saveMarcas(o) { saveJSON(marcasFile, o); if (DB_MODE) { cMarcas = o; db.wt(db.replaceAll('kv_marcas', o)); } }
  if (pathname === '/api/marcas' && req.method === 'GET') {
    const over = loadMarcas();
    const seen = {};
    const out = [];
    loadProductos().forEach(function (p) {
      const label = String(p.brand || '').trim() || 'NERBA';
      const code = slugMarca(label);
      if (seen[code]) return;
      seen[code] = true;
      const o = over[code] || {};
      out.push({ code, label: o.label || label, image: o.image || '', total: 0 });
    });
    Object.keys(over).forEach((code) => {
      if (seen[code]) return;
      seen[code] = true;
      out.push({ code, label: over[code].label || code, image: over[code].image || '', total: 0 });
    });
    out.forEach((b) => { b.total = loadProductos().filter((p) => slugMarca(p.brand || 'NERBA') === b.code).length; });
    return sendJSON(res, 200, out);
  }
  const mMarca = /^\/api\/marcas\/(.+)$/.exec(pathname);
  if (mMarca && (req.method === 'PUT' || req.method === 'DELETE')) {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const code = slugMarca(decodeURIComponent(mMarca[1] || ''));
    const over = loadMarcas();
    if (req.method === 'DELETE') {
      const usadas = loadProductos().filter((p) => slugMarca(p.brand || 'NERBA') === code);
      if (usadas.length) {
        return sendJSON(res, 409, { error: 'La marca tiene ' + usadas.length + ' publicación(es). Quítalas o cámbialas de marca primero.' });
      }
      delete over[code];
      saveMarcas(over);
      logAudit(req, { modulo: 'catalogo', evento: 'baja', detalle: 'Marca ' + code });
      return sendJSON(res, 200, { ok: true });
    }
    if (body.image && !imagenCatalogoOk(body.image)) return sendJSON(res, 400, { error: 'El logo debe subirse primero (el catálogo ya no guarda base64 pesado en la base)' });
    over[code] = {
      label: String(body.label || (over[code] && over[code].label) || code).slice(0, 80),
      image: String(body.image || '').slice(0, 2000000),
    };
    saveMarcas(over);
    logAudit(req, { modulo: 'catalogo', evento: 'edicion', detalle: 'Marca ' + code });
    return sendJSON(res, 200, { code, label: over[code].label, ok: true });
  }

  // ----- fotos en R2 (las bases dejan de guardar bytes de imagen) -----
  // Las fotos del catálogo vivían como base64 en Postgres y llenaron el
  // volumen. Ahora viven como archivos en Cloudflare R2 y en la base solo
  // queda la URL. Requiere variables R2_* en Railway.
  const mFotoUp = pathname === '/api/fotos' && req.method === 'POST';
  if (mFotoUp) {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const s = String(body.imagen || '');
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) {
      return sendJSON(res, 400, { error: 'No es imagen válida (JPG, PNG o WebP)' });
    }
    if (s.length > 2000000) return sendJSON(res, 400, { error: 'Imagen muy pesada (máx 2MB, se comprime al subir)' });
    try {
      const r2 = require('./r2');
      const url = await r2.subirFoto(s, 'catalogo');
      logAudit(req, { modulo: 'catalogo', evento: 'sube-foto-r2', detalle: url });
      return sendJSON(res, 201, { url });
    } catch (e) {
      const msg = /R2 no configurado/.test(String((e && e.message) || '')) 
        ? 'Almacén de fotos no configurado (faltan variables R2_* en Railway)'
        : 'No se pudo subir la foto: ' + ((e && e.message) || 'error');
      return sendJSON(res, 503, { error: msg });
    }
  }
  // Migración de lo ya guardado: sube a R2 cada base64 de productos y marcas
  // y lo reemplaza por su URL. Idempotente (lo que ya es URL se salta) y solo
  // reemplaza lo verificado en R2. Con {soloInforme:true} solo cuenta.
  if (pathname === '/api/migrar-fotos-r2' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN' });
    try {
      const r2 = require('./r2');
      if (!r2.listo()) return sendJSON(res, 503, { error: 'R2 no configurado (faltan variables R2_* en Railway)' });
      const esUrl = (s) => /^https?:\/\/[^ ]{1,2000}$/.test(String(s || ''));
      const rep = { productos: 0, imagenesProd: 0, marcas: 0, fallos: [], bytesAntes: 0, bytesDespues: 0 };
      const lista = loadProductos();
      for (const p of lista) {
        if (!Array.isArray(p.images)) continue;
        for (let i = 0; i < p.images.length; i++) {
          const s = String(p.images[i] || '');
          if (!s) continue;
          if (esUrl(s)) { rep.bytesDespues += s.length; continue; }
          rep.bytesAntes += s.length;
          if (body.soloInforme) continue;
          try {
            const url = await r2.subirFoto(s, 'productos');
            p.images[i] = url;
            rep.bytesDespues += url.length;
            rep.imagenesProd++;
          } catch (e) { rep.fallos.push(p.id + ': ' + ((e && e.message) || 'error')); }
        }
        rep.productos++;
      }
      const over = loadMarcas();
      for (const code of Object.keys(over)) {
        const s = String((over[code] && over[code].image) || '');
        if (!s || esUrl(s)) continue;
        rep.bytesAntes += s.length;
        if (body.soloInforme) continue;
        try {
          over[code].image = await r2.subirFoto(s, 'marcas');
          rep.bytesDespues += over[code].image.length;
          rep.marcas++;
        } catch (e) { rep.fallos.push('marca ' + code + ': ' + ((e && e.message) || 'error')); }
      }
      if (!body.soloInforme) {
        persistProductos(lista);
        saveMarcas(over);
        logAudit(req, { modulo: 'catalogo', evento: 'migracion-r2', detalle: rep.imagenesProd + ' fotos de productos y ' + rep.marcas + ' logos a R2' });
      }
      return sendJSON(res, 200, { ok: true, soloInforme: !!body.soloInforme, ...rep });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Migración falló: ' + ((e && e.message) || 'error') });
    }
  }
  // VACUUM de Postgres (solo SUPERADMIN). La basura histórica (tuplas muertas
  // de la época de reescrituras completas) solo se libera así. FULL reescribe
  // las tablas y baja el % del volumen, pero BLOQUEA mientras corre: úsalo con
  // poco tráfico. Sin full solo marca espacio reutilizable.
  if (pathname === '/api/admin/vacuum' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || u.rol !== 'SUPERADMIN') return sendJSON(res, 403, { error: 'Solo SUPERADMIN' });
    if (!DB_MODE) return sendJSON(res, 400, { error: 'Sin Postgres (modo local)' });
    // Lector y ajuste de WAL (aquí dentro: ya pasó el candado SUPERADMIN).
    // El volumen puede estar lleno de WAL retenido aunque la base sea pequeña:
    // max_wal_size alto deja el alto histórico. Bajarlo recicla segmentos.
    if (body.verAjustes || body.ajustarWal) {
      try {
        const poolW = db.getPool();
        const ajustes = {};
        for (const n of ['max_wal_size', 'min_wal_size', 'wal_keep_size', 'archive_mode', 'checkpoint_timeout']) {
          try { ajustes[n] = (await poolW.query('SHOW ' + n)).rows[0][n]; }
          catch (e) { ajustes[n] = 'sin-permiso'; }
        }
        // Duh del PGDATA a un nivel: por si lo gordo no es WAL sino otra cosa.
        try {
          const tam = async (ruta) => {
            const esDir = (await poolW.query('SELECT pg_isdir($1) AS d', [ruta])).rows[0].d;
            if (!esDir) {
              try { return Number((await poolW.query('SELECT (pg_stat_file($1)).size AS s', [ruta])).rows[0].s) || 0; }
              catch (e) { return 0; }
            }
            const hijos = (await poolW.query('SELECT name FROM pg_ls_dir($1)', [ruta])).rows.map((r) => r.name);
            let n = 0;
            for (const h of hijos) n += await tam(ruta + '/' + h);
            return n;
          };
          const fm = (b) => b >= 1048576 ? (Math.round(b / 1048576 * 10) / 10 + 'MB') : (Math.round(b / 1024) + 'KB');
          const toplevel = (await poolW.query("SELECT name FROM pg_ls_dir('.')")).rows.map((r) => r.name);
          const du = [];
          for (const d of toplevel) du.push({ dir: d, tam: fm(await tam(d)) });
          ajustes.du = du;
        } catch (e) { ajustes.du = 'sin-permiso'; }
        if (body.ajustarWal) {
          const v = String(body.ajustarWal).slice(0, 16);
          if (!/^\d+(MB|GB)$/i.test(v)) return sendJSON(res, 400, { error: 'Formato: número + MB/GB (ej. 128MB)' });
          await poolW.query('ALTER SYSTEM SET max_wal_size = ' + "'" + v.replace(/'/g, '') + "'");
          await poolW.query('SELECT pg_reload_conf()');
          try { await poolW.query('CHECKPOINT'); } catch (e) {}
          logAudit(req, { modulo: 'sistema', evento: 'ajuste-wal', detalle: 'max_wal_size=' + v });
          for (const n of ['max_wal_size', 'min_wal_size']) {
            try { ajustes[n] = (await poolW.query('SHOW ' + n)).rows[0][n]; } catch (e) {}
          }
        }
        return sendJSON(res, 200, { ok: true, ajustes });
      } catch (e) {
        return sendJSON(res, 500, { error: 'Ajuste WAL falló: ' + ((e && e.message) || 'error') });
      }
    }
    try {
      const pool = db.getPool();
      const t0 = Date.now();
      const a = await pool.query('SELECT pg_database_size(current_database()) AS b');
      const antes = Number(a.rows[0].b) || 0;
      // Radiografía por tabla + WAL, para saber qué está gordo antes de actuar.
      // El WAL retenido (slots de replicación muertos, falta de checkpoint) es
      // la causa típica de un volumen lleno con una base pequeña.
      let tablas = [], walMB = null, slots = [];
      try {
        const s = await pool.query('SELECT slot_name AS n, active AS a, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retenido FROM pg_replication_slots');
        slots = s.rows;
      } catch (e) { slots = []; }
      if (body.soltarSlot) {
        const nombre = String(body.soltarSlot).slice(0, 100);
        const hay = slots.find((x) => x.n === nombre && !x.a);
        if (!hay) return sendJSON(res, 400, { error: 'Slot no existe o sigue activo (no se toca)' });
        await pool.query('SELECT pg_drop_replication_slot($1)', [nombre]);
        logAudit(req, { modulo: 'sistema', evento: 'drop-slot', detalle: nombre });
      }
      try {
        const t = await pool.query(
          "SELECT tablename AS n, pg_total_relation_size('public.' || quote_ident(tablename)) AS b " +
          'FROM pg_tables WHERE schemaname = \'public\' ORDER BY b DESC'
        );
        tablas = t.rows.map((r) => ({ tabla: r.n, mb: Math.round(Number(r.b) / 1048576 * 10) / 10 }));
      } catch (e) { tablas = [{ tabla: 'sin-permiso', mb: 0 }]; }
      try {
        const w = await pool.query("SELECT COALESCE(SUM(size),0) AS b FROM pg_ls_waldir()");
        walMB = Math.round(Number(w.rows[0].b) / 1048576 * 10) / 10;
      } catch (e) { walMB = null; }
      // Checkpoint primero: deja reciclar segmentos viejos sin bloquear nada.
      try { await pool.query('CHECKPOINT'); } catch (e) {}
      await pool.query(body.full === true ? 'VACUUM FULL' : 'VACUUM');
      const d = await pool.query('SELECT pg_database_size(current_database()) AS b');
      const despues = Number(d.rows[0].b) || 0;
      logAudit(req, { modulo: 'sistema', evento: body.full === true ? 'vacuum-full' : 'vacuum', detalle: Math.round(antes / 1048576) + 'MB → ' + Math.round(despues / 1048576) + 'MB' });
      return sendJSON(res, 200, {
        ok: true, full: body.full === true,
        antesMB: Math.round(antes / 1048576 * 10) / 10,
        despuesMB: Math.round(despues / 1048576 * 10) / 10,
        tablas, walMB, slots,
        ms: Date.now() - t0,
      });
    } catch (e) {
      return sendJSON(res, 500, { error: 'VACUUM falló: ' + ((e && e.message) || 'error') });
    }
  }

  // ----- categorías del catálogo (imagen + etiqueta; las crea/edita el staff) -----
  const categoriasFile = path.join(DATA_DIR, 'categorias.json');
  function loadCategorias() {
    if (DB_MODE && cCategorias) return cCategorias;
    try { const o = loadJSON(categoriasFile, null); if (o) { if (DB_MODE) cCategorias = o; return o; } } catch {}
    return {};
  }
  function saveCategorias(o) { saveJSON(categoriasFile, o); if (DB_MODE) { cCategorias = o; db.wt(db.replaceAll('kv_categorias', o)); } }
  if (pathname === '/api/categorias' && req.method === 'GET') {
    const over = loadCategorias();
    const seen = {};
    const out = [];
    loadProductos().forEach(function (p) {
      var code = p.categoryCode || 'general';
      if (seen[code]) return;
      seen[code] = true;
      var o = over[code] || {};
      out.push({ code: code, label: o.label || p.category || code, image: o.image || '' });
    });
    Object.keys(over).forEach(function (code) {
      if (!seen[code]) { seen[code] = true; out.push({ code: code, label: over[code].label || code, image: over[code].image || '' }); }
    });
    return sendJSON(res, 200, out);
  }
  const mCat = /^\/api\/categorias\/(.+)$/.exec(pathname);
  if (mCat && req.method === 'DELETE') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const code = String(decodeURIComponent(mCat[1] || '')).trim().slice(0, 60) || 'general';
    const usadas = loadProductos().filter((p) => String(p.categoryCode || 'general') === code);
    if (usadas.length) {
      return sendJSON(res, 409, { error: 'El tipo tiene ' + usadas.length + ' publicación(es). Quítalas o cámbialas de tipo primero.' });
    }
    const over = loadCategorias();
    delete over[code];
    saveCategorias(over);
    logAudit(req, { modulo: 'catalogo', evento: 'baja', detalle: 'Tipo ' + code });
    return sendJSON(res, 200, { ok: true });
  }
  if (mCat && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || (u.rol !== 'ADMIN' && u.rol !== 'SUPERADMIN')) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const code = String(decodeURIComponent(mCat[1] || '')).trim().slice(0, 60) || 'general';
    if (body.image && !imagenCatalogoOk(body.image)) return sendJSON(res, 400, { error: 'El logo debe subirse primero (el catálogo ya no guarda base64 pesado en la base)' });
    const over = loadCategorias();
    over[code] = {
      label: String(body.label || (over[code] && over[code].label) || code).slice(0, 120),
      image: String(body.image || '').slice(0, 2000000),
    };
    saveCategorias(over);
    logAudit(req, { modulo: 'catalogo', evento: 'edicion', detalle: 'Categoría ' + code });
    return sendJSON(res, 200, { code: code, label: over[code].label, ok: true });
  }


  // ----- solicitudes de mantenimiento (cliente solicita, staff gestiona) -----
  const mantFile = path.join(DATA_DIR, 'mantenimiento.json');
  function loadMant() {
    if (DB_MODE && cMant) return cMant;
    try { const l = loadJSON(mantFile, null); if (l) { if (DB_MODE) cMant = l; return l; } } catch {}
    return [];
  }
  function persistMant(list) {
    saveJSON(mantFile, list);
    if (DB_MODE) {
      cMant = list;
      const byId = {};
      for (const m of list) byId[m.id] = m;
      db.wt(db.replaceAll('kv_mantenimiento', byId));
    }
  }
  if (pathname === '/api/mantenimiento' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para solicitar' });
    const descripcion = String(body.descripcion || '').trim().slice(0, 2000);
    if (!descripcion) return sendJSON(res, 400, { error: 'Describe el mantenimiento requerido' });
    const lista = loadMant();
    // ID sin colisiones tras borrados: max existente + 1
    let maxN = 0;
    for (const x of lista) { const mId = /^MNT-(\d+)-/.exec(String(x.id || '')); if (mId) maxN = Math.max(maxN, parseInt(mId[1], 10) || 0); }
    const n = maxN + 1;
    const m = {
      id: 'MNT-' + String(n).padStart(4, '0') + '-' + new Date().getFullYear(),
      folio: String(body.folio || '').trim(),
      fecha: fechaLocal(),
      email: u.email, nombre: u.nombre,
      telefono: String(body.telefono || u.telefono || '').trim(),
      direccion: String(body.direccion || u.direccion || '').trim(),
      descripcion,
      estado: 'PENDIENTE',
    };
    lista.unshift(m);
    persistMant(lista);
    return sendJSON(res, 201, m);
  }
  if (pathname === '/api/mantenimiento' && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'No autorizado' });
    let lista = loadMant();
    if (!isStaff(u)) {
      lista = lista.filter((m) => m.email && m.email.toLowerCase() === u.email.toLowerCase());
    }
    return sendJSON(res, 200, lista);
  }
  const mMant = /^\/api\/mantenimiento\/(.+)$/.exec(pathname);
  if (mMant && req.method === 'PUT') {
    let body = {};
    try { body = JSON.parse(await readBody(req)); } catch { body = {}; }
    const u = userByToken(getToken(req));
    if (!u || !isStaff(u)) return sendJSON(res, 403, { error: 'Solo personal autorizado' });
    const lista = loadMant();
    const m = lista.find((x) => x.id === mMant[1]);
    if (!m) return sendJSON(res, 404, { error: 'No encontrada' });
    const estado = String(body.estado || '').toUpperCase();
    if (!['PENDIENTE', 'EN_PROCESO', 'REALIZADA'].includes(estado)) return sendJSON(res, 400, { error: 'Estado no valido' });
    m.estado = estado;
    persistMant(lista);
    logAudit(req, { modulo: 'mantenimiento', evento: 'cambio-estado', detalle: estado, folio: m.id });
    return sendJSON(res, 200, m);
  }

  // ----- PDF real de la ficha de mantenimiento (misma plantilla del servidor) -----
  const mMantPdf = /^\/api\/mantenimiento\/(.+)\/pdf$/.exec(pathname);
  if (mMantPdf && req.method === 'GET') {
    const u = userByToken(getToken(req));
    if (!u) return sendJSON(res, 401, { error: 'Inicia sesion para descargar el documento' }, req);
    const lista = loadMant();
    const m = lista.find((x) => x.id === mMantPdf[1]);
    if (!m) return sendJSON(res, 404, { error: 'No encontrada' }, req);
    const propia = m.email && u.email && String(m.email).toLowerCase() === String(u.email).toLowerCase();
    if (!isStaff(u) && !propia) return sendJSON(res, 403, { error: 'No tienes permiso para descargar este documento' }, req);
    let pdf;
    try {
      pdf = require('./pdf');
    } catch (e) {
      return sendJSON(res, 501, { error: 'Generador PDF no disponible en este despliegue.' }, req);
    }
    let buf;
    try {
      buf = await pdf.generarMant(m);
    } catch (e) {
      console.log('Aviso PDF ' + m.id + ': ' + e.message);
      return sendJSON(res, 500, { error: 'No se pudo generar el documento.' }, req);
    }
    logAudit(req, { modulo: 'mantenimiento', evento: 'descarga-pdf', detalle: m.id, folio: m.id });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + String(m.id).replace(/[^A-Za-z0-9._-]+/g, '_') + '.pdf"',
      'Content-Length': buf.length,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Vary': 'Origin',
    });
    return res.end(buf);
  }

  if (pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'Ruta API no encontrada' });

  // ----- archivos estaticos del frontend (desactivable en deploy separado) -----
  if (!SERVE_STATIC) {
    if (!pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'Solo API. El frontend vive en otro servicio.' }, req);
  }
  let rel = pathname === '/' ? '/index.html' : pathname;
  // Nunca exponer datos, respaldos, workspaces ni dotfiles aunque FRONT_DIR falle
  if (/^\/(_respaldo|data)(\/|$)/.test(rel)
    || /\/\.git(\/|$)/.test(rel) || /\/\.env(\/|$)/i.test(rel)
    || /\.(code-workspace|ps1)$/i.test(rel)
    || /(^|\/)(productos\.seed\.json|server\.js|package\.json|run\.bat|run_server\.bat)$/.test(rel)) {
    res.writeHead(403); return res.end('Prohibido');
  }
  const file = path.normalize(path.join(FRONT_DIR, rel));
  if (!file.startsWith(path.normalize(FRONT_DIR))) {
    res.writeHead(403); return res.end('Prohibido');
  }
  let target = file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) { res.writeHead(404); return res.end('No encontrado'); }
  const ext = path.extname(target).slice(1).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  // Sin esto el navegador se guarda el HTML viejo y los cambios no se ven:
  // se revalida en cada visita y el servidor responde 304 si no cambio nada.
  const stat = fs.statSync(target);
  const headers = {
    'Content-Type': mime + (mime.startsWith('text/') ? '; charset=utf-8' : ''),
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': cspHeader(),
    'Last-Modified': stat.mtime.toUTCString(),
    'Cache-Control': ext === 'html' || ext === 'js' || ext === 'css' || ext === 'json'
      ? 'no-cache' : 'public, max-age=3600',
  };
  const since = req.headers['if-modified-since'];
  if (since && Date.parse(since) >= Math.floor(stat.mtime.getTime() / 1000) * 1000) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, headers);
  fs.createReadStream(target).pipe(res);
}

async function start() {
  if (db.isEnabled()) {
    try {
      await db.init();
      const s = await db.loadAllState();
      // Si la DB trae datos, mandan; si está vacía y hay JSON local, se migra solo.
      if (Object.keys(s.users).length) { users = s.users; }
      else if (Object.keys(users).length) { db.wt(db.replaceAll('kv_users', users)); }
      if (Object.keys(s.sessions).length) { sessions = s.sessions; persistSessions(); }
      else if (Object.keys(sessions).length) { db.wt(db.replaceAll('kv_sessions', sessions)); }
      if (Object.keys(s.quotes).length) {
        quotes = s.quotes;
        for (const q of Object.values(quotes)) {
          const m = /^COT-(\d+)-/.exec(q.folio || '');
          if (m && parseInt(m[1], 10) >= folioSeq) folioSeq = parseInt(m[1], 10) + 1;
          // Tambien hay que retomar la cuenta de las series nuevas. Antes solo
          // se(recuperaba la numerica vieja, asi que despues de cada redeploy
          // la serie volvia a 0: la siguiente cita tomaba un folio ya usado y
          // se cargaba encima de la cotizacion anterior sin avisar.
          tomaFolioExistente(q.folio);
        }
      } else if (Object.keys(quotes).length) { db.wt(db.replaceAll('kv_quotes', quotes)); }
      if (s.productos.length) cProductos = s.productos;
      if (s.servicios && s.servicios.length) cServicios = s.servicios;
      if (Object.keys(s.marcas).length) cMarcas = s.marcas;
      if (Object.keys(s.categorias).length) cCategorias = s.categorias;
      if (s.contacto.length) cContacto = s.contacto;
      if (s.mant.length) cMant = s.mant;
      if (s.audit.items.length) cAudit = s.audit;
      if (s.recup && Object.keys(s.recup).length) {
        const vivos = {};
        for (const [k, v] of Object.entries(s.recup)) {
          if (v && Number(v.expiresAt) > Date.now()) vivos[k] = v;
        }
        if (Object.keys(vivos).length) cRecup = vivos;
      }
      DB_MODE = true;
      console.log('Postgres conectado: DB como fuente de verdad.');
    } catch (e) {
      console.log('Aviso PG (' + e.message + '): sigo con JSON local.');
    }
  }
  try {
    await nerbot.init({ db, dbMode: DB_MODE });
    console.log('NerBot: modelo ' + nerbot.model + ' | staff ' + (nerbot.staff ? 'si' : 'no') +
      (nerbot.configured ? '' : ' | SIN GEMINI_API_KEY: respondera con el fallback'));
  } catch (e) {
    console.log('Aviso NerBot: ' + e.message + '. El chat usará fallback seguro.');
  }

  server.listen(PORT, () => {
    console.log('== Grupo NERBA HIDALGO Backend (Node.js) ==');
    console.log('Frontend: ' + FRONT_DIR);
    console.log('Data: ' + (DB_MODE ? 'Postgres' : DATA_DIR));
    console.log(`Usuarios: ${Object.keys(users).length} | Cotizaciones: ${Object.keys(quotes).length}`);
    console.log('Sesiones con expiracion de 8 horas activadas (el token se guarda hasheado).');
    // Avisos de seguridad: que un descuido de configuracion se vea en el log
    // del despliegue, no cuando alguien descubra el enlace de una cuenta.
    if (RECOVERY_DEBUG) console.log('AVISO DE SEGURIDAD: RECOVERY_DEBUG=1 devuelve el enlace de recuperacion en la respuesta de la API.');
    if (!DB_MODE && !DATA_KEY) console.log('AVISO DE SEGURIDAD: sin DATA_KEY los archivos de datos se guardan SIN CIFRAR (correos, telefonos y fotos de propiedades).');
    if (DATA_KEY) console.log('Datos en disco cifrados con AES-256-GCM (DATA_KEY).');
    console.log(`Listo en http://localhost:${PORT}`);
  });
}
start();
