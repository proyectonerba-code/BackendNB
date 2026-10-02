const fs = require('fs');
const path = require('path');
/**
 * Grupo NERBA HIDALGO - PDF real de cotizaciones (una sola plantilla).
 * Todas las areas descargan el mismo formato: antes cada zona armaba su
 * propia "vista de impresion" y salian documentos distintos.
 * Requiere dependencia "pdfkit" (solo se carga al generar).
 */
const ROJO = '#b0000b';
const TINTA = '#0b1c30';
const GRIS = '#64748b';
const LINEA = '#e2e8f0';

// Logo oficial. Vive en NERBA Back/assets/logo.png para no depender del
// frontend (en Railway el backend corre solo, sin la carpeta del front).
// Si falta, el documento sale con el nombre en texto, sin romperse.
let LOGO_BUF = null;
try {
  const f = path.join(__dirname, 'assets', 'logo.png');
  if (fs.existsSync(f)) LOGO_BUF = fs.readFileSync(f);
} catch (e) { LOGO_BUF = null; }

function txt(v) { return String(v == null ? '' : v); }
function fechaCorta(iso) {
  const s = txt(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || '—');
}

// Cabecera comun: logo oficial a la izquierda (ya trae la marca) y folio a
// la derecha. Sin logo, el nombre en texto como respaldo. Devuelve la y lista.
function cabecera(doc, W, y, pill, folio, fem) {
  const LOGO_W = 96, LOGO_H = 30;
  let conLogo = false;
  if (LOGO_BUF) {
    try {
      doc.image(LOGO_BUF, 45, y, { fit: [LOGO_W, LOGO_H] });
      conLogo = true;
    } catch (e) { conLogo = false; }
  }
  if (!conLogo) {
    doc.fillColor(ROJO).fontSize(15).font('Helvetica-Bold')
      .text('Grupo NERBA HIDALGO', 45, y, { width: W - 180 });
    doc.fillColor(GRIS).fontSize(8).font('Helvetica-Bold')
      .text('GRUPO EMPRESARIAL NERBA S.A DE C.V', 45, doc.y + 1, { width: W - 180 });
  }
  const pw = doc.widthOfString(pill) + 18;
  doc.fillColor(ROJO).fontSize(8).font('Helvetica-Bold')
    .text(pill, 45 + W - pw, y, { width: pw, align: 'center' });
  doc.fillColor(TINTA).fontSize(13).font('Helvetica-Bold')
    .text(folio, 45 + W - 180, doc.y + 3, { width: 180, align: 'right' });
  doc.fillColor(GRIS).fontSize(8).font('Helvetica')
    .text(fem, 45, doc.y + 3, { width: W, align: 'right' });
  // El logo es imagen (no mueve el cursor de texto): se aparta a mano.
  y = Math.max(doc.y + 8, 40 + LOGO_H + 10);
  doc.strokeColor(ROJO).lineWidth(1.5).moveTo(45, y).lineTo(45 + W, y).stroke();
  return y + 12;
}

function piePagina(doc, W, texto) {
  doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
    .text(texto, 45, Math.max(doc.y + 8, doc.page.height - 70), { width: W, align: 'center' });
}

function generar(c) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 50, left: 45, right: 45 } });
      const partes = [];
      doc.on('data', (d) => partes.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(partes)));

      const W = doc.page.width - 90;
      let y = doc.y;

      y = cabecera(doc, W, y, 'SOLICITUD DE COTIZACIÓN', txt(c.folio),
        'Emitida: ' + fechaCorta(c.fecha) + (c.validez ? '  ·  Válida hasta ' + fechaCorta(c.validez) : '') +
        '  ·  Estado: ' + txt(c.estado || 'PENDIENTE'));

      // Tarjetas lado a lado
      const colW = (W - 10) / 2;
      const y0 = y;
      y = tarjeta(doc, 45, y0, colW, 'Datos del solicitante', [
        ['Titular', c.nombre], ['Teléfono', c.telefono],
        ['Correo', c.email], ['Teléfono alt.', c.telefonoSec],
      ]);
      const yIzq = y;
      y = tarjeta(doc, 45 + colW + 10, y0, colW, 'Ubicación del inmueble', [
        ['Tipo', c.tipoInmueble], ['Distrito / Ciudad', c.distrito],
        ['Dirección', c.direccion], ['Referencia', c.referencia],
      ]);
      y = Math.max(yIzq, y) + 12;

      // Articulos o descripcion
      const items = Array.isArray(c.items) ? c.items.filter((it) => it && it.title) : [];
      y = seccion(doc, y, W, items.length ? 'Artículos y componentes cotizados' : 'Especificación técnica solicitada');
      if (items.length) {
        y = tabla(doc, y, W, items);
        const totalU = items.reduce((n, it) => n + (parseInt(it.qty, 10) || 1), 0);
        doc.fillColor(GRIS).fontSize(8).font('Helvetica')
          .text('Total de artículos: ' + items.length + '  ·  Total de unidades: ' + totalU, 45, y + 4, { width: W, align: 'right' });
        y = doc.y + 12;
      } else {
        y = caja(doc, y, W, txt(c.descripcion) || txt(c.medidasDescriptivas) || '—') + 12;
      }

      // Notas
      const notas = txt(c.notas).trim();
      if (notas) {
        y = seccion(doc, y, W, 'Notas y observaciones');
        y = caja(doc, y, W, notas) + 12;
      }

      // Fotos: TODAS las que subió el cliente, en rejilla de 3 por fila y con
      // salto de página automático. Antes se cortaban a 3 (slice) y las fotos
      // 4..20 no aparecían en ningún PDF del sistema.
      y = bloqueFotos(doc, y, W, c.fotos);

      // Pie
      piePagina(doc, W, 'Documento generado por Grupo NERBA HIDALGO. No válido para efectos fiscales.   ' +
        txt(c.folio) + ' · ' + fechaCorta(c.fecha));

      doc.end();
    } catch (e) { reject(e); }
  });
}

function generarMant(m) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 50, left: 45, right: 45 } });
      const partes = [];
      doc.on('data', (d) => partes.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(partes)));

      const W = doc.page.width - 90;
      let y = doc.y;

      y = cabecera(doc, W, y, 'FICHA DE MANTENIMIENTO', txt(m.id),
        'Fecha: ' + fechaCorta(m.fecha) + (m.folio ? '  ·  Cotización de origen: ' + txt(m.folio) : ''));

      const colW = (W - 10) / 2;
      const y0 = y;
      y = tarjeta(doc, 45, y0, colW, 'Datos del solicitante', [
        ['Titular', m.nombre], ['Correo', m.email], ['Teléfono', m.telefono],
      ]);
      const yIzq = y;
      y = tarjeta(doc, 45 + colW + 10, y0, colW, 'Datos de la instalación', [
        ['Estado', m.estado], ['Fecha', fechaCorta(m.fecha)], ['Ubicación', m.direccion],
      ]);
      y = Math.max(yIzq, y) + 12;

      y = seccion(doc, y, W, 'Motivo de la solicitud');
      y = caja(doc, y, W, txt(m.descripcion) || '—') + 12;

      // Fotos del cliente: todas, en rejilla paginada (mismo bloque que la
      // cotización, antes se cortaban a 3 y el resto no salía en la ficha).
      y = bloqueFotos(doc, y, W, m.fotos);

      piePagina(doc, W, 'Documento generado por Grupo NERBA HIDALGO. No válido para efectos fiscales.   ' +
        txt(m.id) + ' · ' + fechaCorta(m.fecha));

      doc.end();
    } catch (e) { reject(e); }
  });
}

/* Rejilla de fotografías del cliente: 3 por fila, alto fijo para que se vean
 * parecidas, numeradas ("Foto 1 de 20") y con salto de página automático.
 * Se dibujan TODAS las que se guardaron, no solo las primeras: en Proyecto
 * Especial el cotizador deja subir hasta 20 y todas tienen que quedar
 * asentadas en el documento, que es lo que el cliente se lleva y lo que
 * usa ingeniería para dimensionar. */
function bloqueFotos(doc, y, W, lista) {
  const fotos = (Array.isArray(lista) ? lista : [])
    .filter((s) => typeof s === 'string' && s.indexOf('data:image/') === 0);
  if (!fotos.length) return y;

  const COLS = 3, GAP = 7, ALTO = 85, ETIQUETA = 13;
  const fw = (W - GAP * (COLS - 1)) / COLS;
  const altoFila = ALTO + ETIQUETA;

  let tituloImpreso = false;
  let yFila = y;

  const asegurarEspacio = () => {
    if (yFila + altoFila > 730) { doc.addPage(); yFila = 60; }
  };

  fotos.forEach((s, i) => {
    if (!tituloImpreso) {
      yFila = seccion(doc, yFila, W, 'Fotografías del inmueble (' + fotos.length + ')');
      tituloImpreso = true;
    }
    // La posicion en la rejilla se saca del indice, no de un contador de
    // "dibujadas": si una foto llega corrupta y se omite, el hueco se queda
    // vacio en su lugar y las siguientes no se encima.
    const col = i % COLS;
    if (col === 0) {
      if (i > 0) yFila += altoFila + GAP;
      asegurarEspacio();
    }
    const x = 45 + col * (fw + GAP);
    try {
      const b64 = s.slice(s.indexOf(',') + 1);
      doc.image(Buffer.from(b64, 'base64'), x, yFila, { fit: [fw, ALTO], align: 'center', valign: 'center' });
    } catch (e) { /* foto corrupta: se omite sin romper el documento */ }
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
      .text('Foto ' + (i + 1) + ' de ' + fotos.length, x, yFila + ALTO + 2, { width: fw, align: 'center' });
  });

  return yFila + altoFila;
}

function tarjeta(doc, x, y, w, titulo, pares) {
  const validos = pares.filter((p) => txt(p[1]).trim());
  const alto = 20 + validos.length * 13 + 10;
  doc.roundedRect(x, y, w, alto, 5).stroke(LINEA);
  doc.fillColor(ROJO).fontSize(7.5).font('Helvetica-Bold').text(titulo.toUpperCase(), x + 9, y + 7, { width: w - 18 });
  let yy = y + 22;
  validos.forEach((p) => {
    doc.fillColor(GRIS).fontSize(8.5).font('Helvetica').text(txt(p[0]), x + 9, yy, { width: 78 });
    doc.fillColor(TINTA).font('Helvetica-Bold').text(txt(p[1]), x + 92, yy, { width: w - 101, align: 'right' });
    yy = Math.max(yy + 13, doc.y);
  });
  return y + alto;
}

function seccion(doc, y, w, titulo) {
  if (y > 700) { doc.addPage(); y = 60; }
  doc.fillColor(TINTA).fontSize(9).font('Helvetica-Bold')
    .text(titulo.toUpperCase(), 45, y, { width: w });
  doc.strokeColor(ROJO).lineWidth(1).moveTo(45, doc.y + 3).lineTo(45 + 60, doc.y + 3).stroke();
  return doc.y + 9;
}

function caja(doc, y, w, texto) {
  const h = doc.heightOfString(texto, { width: w - 20 }) + 18;
  const yy = y + h > 740 ? (doc.addPage(), 60) : y;
  doc.roundedRect(45, yy, w, h, 5).fillAndStroke('#f8fafc', LINEA);
  doc.fillColor(TINTA).fontSize(9.5).font('Helvetica').text(texto, 45 + 10, yy + 9, { width: w - 20 });
  return yy + h;
}

function tabla(doc, y, w, items) {
  const cols = [28, w - 28 - 52 - 52, 52, 52];
  const encabezados = ['#', 'Componente / producto solicitado', 'Cant.', 'Unidad'];
  let yy = y;
  const fila = (vals, negrita, fondo) => {
    const h = Math.max(16, doc.heightOfString(String(vals[1]), { width: cols[1] - 4 }) + 10);
    if (yy + h > 740) { doc.addPage(); yy = 60; }
    if (fondo) { doc.rect(45, yy, w, h).fill(fondo); }
    let xx = 45;
    vals.forEach((v, i) => {
      doc.fillColor(i === 0 ? GRIS : TINTA).fontSize(9).font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .text(String(v), xx + (i > 1 ? 0 : 4), yy + 4, { width: cols[i] - (i > 1 ? 0 : 8), align: i > 1 ? 'center' : 'left' });
      xx += cols[i];
    });
    doc.strokeColor(LINEA).lineWidth(0.5).moveTo(45, yy + h).lineTo(45 + w, yy + h).stroke();
    yy += h;
  };
  // Encabezado oscuro con altura fija
  doc.rect(45, yy, w, 18).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  let xx = 45;
  encabezados.forEach((v, i) => {
    doc.text(v.toUpperCase(), xx + 4, yy + 5, { width: cols[i] - 8, align: i > 1 ? 'center' : 'left' });
    xx += cols[i];
  });
  yy += 18;
  items.forEach((it, i) => {
    const q = parseInt(it.qty, 10) || 1;
    fila([String(i + 1), txt(it.title) + (txt(it.desc).trim() ? ' — ' + txt(it.desc).trim() : ''), String(q), 'unid.'], false, i % 2 ? '#f8fafc' : null);
  });
  return yy;
}

module.exports = { generar, generarMant };
