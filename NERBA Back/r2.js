/**
 * Grupo NERBA HIDALGO - Almacén de imágenes en Cloudflare R2 (gratis, 10GB).
 *
 * Las fotos del catálogo vivían como base64 DENTRO de Postgres y llenaron el
 * volumen (89%). Ahora viven como archivos en R2 y en la base solo queda la
 * URL (bytes por registro). Sin SDK en el bundle del front: todo pasa por el
 * backend (/api/fotos y /api/migrar-fotos-r2).
 *
 * Env (Railway):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET, R2_PUBLIC_URL (ej. https://pub-xxxx.r2.dev, sin / final)
 */
let S3 = null;
function sdk() {
  if (!S3) S3 = require('@aws-sdk/client-s3');
  return S3;
}

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

function cliente() {
  const c = cfg();
  if (!c) throw new Error('R2 no configurado (faltan variables R2_* en Railway)');
  const { S3Client } = sdk();
  return {
    s3: new S3Client({
      region: 'auto',
      endpoint: 'https://' + c.account + '.r2.cloudflarestorage.com',
      credentials: { accessKeyId: c.key, secretAccessKey: c.secret },
    }),
    bucket: c.bucket,
    pub: c.pub,
  };
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
  const parte = parteDataUrl(dataUrl);
  if (!parte) throw new Error('No es data URL de imagen válida');
  const { HeadObjectCommand, PutObjectCommand } = sdk();
  const { s3, bucket, pub } = cliente();
  const ext = MIME_EXT[parte.mime] || 'jpg';
  const ahora = new Date();
  const aamm = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0');
  const rand = require('crypto').randomBytes(8).toString('hex');
  const key = 'fotos/' + (prefijo || 'img') + '/' + aamm + '/' + rand + '.' + ext;
  const cuerpo = Buffer.from(parte.b64, 'base64');
  if (!cuerpo.length) throw new Error('Imagen vacía');
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: cuerpo,
    ContentType: parte.mime, CacheControl: 'public, max-age=31536000, immutable',
  }));
  await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return pub + '/' + key;
}

module.exports = { cfg, listo, subirFoto, parteDataUrl };
