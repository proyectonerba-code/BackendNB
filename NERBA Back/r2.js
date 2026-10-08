/**
 * Grupo NERBA HIDALGO - Almacén de imágenes en Cloudflare R2 (gratis, 10GB).
 *
 * Las fotos del catálogo vivían como base64 DENTRO de Postgres y llenaron el
 * volumen (89%). Ahora viven como archivos en R2 y en la base solo queda la
 * URL (bytes por registro). Sin dependencias: firma SigV4 con crypto nativo
 * (un SDK externo rompió el build de Railway una vez; esto no puede romperse).
 *
 * Env (Railway):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET, R2_PUBLIC_URL (ej. https://pub-xxxx.r2.dev, sin / final)
 */
const crypto = require('crypto');

function cfg() {
  const account = String(process.env.R2_ACCOUNT_ID || '').trim();
  const key = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secret = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.R2_BUCKET || '').trim();
  const pub = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (!account || !key || !secret || !bucket || !pub) return null;
  return { account, key, secret, bucket, pub };
}

function listo() { return !!cfg(); }

// Firma una petición SigV4 (servicio s3, región auto de R2). `ahora` solo se
// usa en pruebas para comparar contra el SDK oficial con fecha fija.
function firma(metodo, urlObj, cuerpoHashHex, tipoContenido, ahora) {
  const c = cfg();
  const momento = ahora ? new Date(ahora) : new Date();
  const fecha = momento.toISOString().slice(0, 10).replace(/-/g, '');
  const hora = momento.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';
  const amzFecha = fecha + 'T' + hora;
  const host = urlObj.host;
  const canonUri = urlObj.pathname.split('/').map((t) => encodeURIComponent(decodeURIComponent(t))).join('/');
  const cabeceras = {
    host: host,
    'x-amz-content-sha256': cuerpoHashHex,
    'x-amz-date': amzFecha,
  };
  if (tipoContenido) cabeceras['content-type'] = tipoContenido;
  const firmadas = Object.keys(cabeceras).sort();
  const canonCab = firmadas.map((k) => k + ':' + String(cabeceras[k]).trim() + '\n').join('');
  const peticionCanon = [metodo, canonUri, '', canonCab, firmadas.join(';'), cuerpoHashHex].join('\n');
  const alcance = fecha + '/auto/s3/aws4_request';
  const porFirmar = ['AWS4-HMAC-SHA256', amzFecha, alcance,
    crypto.createHash('sha256').update(peticionCanon, 'utf8').digest('hex')].join('\n');
  const hmac = (clave, dato) => crypto.createHmac('sha256', clave).update(dato).digest();
  const kFecha = hmac('AWS4' + c.secret, fecha);
  const kRegion = hmac(kFecha, 'auto');
  const kServ = hmac(kRegion, 's3');
  const kFirma = hmac(kServ, 'aws4_request');
  const firmaHex = crypto.createHmac('sha256', kFirma).update(porFirmar).digest('hex');
  return {
    Authorization: 'AWS4-HMAC-SHA256 Credential=' + c.key + '/' + alcance +
      ', SignedHeaders=' + firmadas.join(';') + ', Signature=' + firmaHex,
    'x-amz-date': amzFecha,
    'x-amz-content-sha256': cuerpoHashHex,
  };
}

async function peticionR2(metodo, key, cuerpo, tipoContenido) {
  const c = cfg();
  if (!c) throw new Error('R2 no configurado (faltan variables R2_* en Railway)');
  const url = new URL('https://' + c.account + '.r2.cloudflarestorage.com/' + c.bucket + '/' + key);
  const hash = crypto.createHash('sha256').update(cuerpo || '').digest('hex');
  const cab = firma(metodo, url, hash, tipoContenido);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url.toString(), {
      method: metodo, signal: ctrl.signal,
      headers: { ...cab, ...(tipoContenido ? { 'Content-Type': tipoContenido } : {}), ...(cuerpo ? { 'Content-Length': String(cuerpo.length) } : {}) },
      body: cuerpo || undefined,
    });
    const texto = await r.text().catch(() => '');
    if (!r.ok) throw new Error('R2 ' + r.status + ': ' + String(texto).slice(0, 160));
    return r;
  } finally { clearTimeout(t); }
}

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function parteDataUrl(s) {
  const m = /^data:(image\/(png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return null;
  const mime = m[1] === 'image/jpeg' || m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  return { mime, b64: m[3] };
}

// Sube una data URL y devuelve la URL pública. Verifica con HEAD antes de
// responder: si R2 no la tiene, no se reporta éxito (la migración solo
// reemplaza lo verificado).
async function subirFoto(dataUrl, prefijo) {
  const c = cfg();
  if (!c) throw new Error('R2 no configurado (faltan variables R2_* en Railway)');
  const parte = parteDataUrl(dataUrl);
  if (!parte) throw new Error('No es data URL de imagen válida');
  const ext = MIME_EXT[parte.mime] || 'jpg';
  const ahora = new Date();
  const aamm = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(8).toString('hex');
  const key = 'fotos/' + (prefijo || 'img') + '/' + aamm + '/' + rand + '.' + ext;
  const cuerpo = Buffer.from(parte.b64, 'base64');
  if (!cuerpo.length) throw new Error('Imagen vacía');
  await peticionR2('PUT', key, cuerpo, parte.mime);
  await peticionR2('HEAD', key, null, null);
  return c.pub + '/' + key;
}

module.exports = { cfg, listo, subirFoto, parteDataUrl, firma };
