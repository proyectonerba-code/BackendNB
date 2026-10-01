// Inserta el bloque de series de folio justo despues de la declaracion del
// contador viejo, que esta antes de que se carguen las cotizaciones. Si se
// inserta mas abajo, las constantes noch no existen cuando se recorren los
// folios guardados y el servidor no arranca.
const fs = require('fs');
const ruta = 'C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\work\\Back\\NERBA Back\\server.js';
let h = fs.readFileSync(ruta, 'utf8');

if (h.includes('const SERIES_FOLIO')) {
  console.log('  ya estaba el bloque de series, no se hace nada');
  process.exit(0);
}

const bloque = [
  '',
  '// --- Folios: una serie por tipo de trabajo ---------------------------------',
  '// Antes todas las cotizaciones compartian un solo contador (COT-8850-2026),',
  '// asi que una venta de equipo y una instalacion quedaban con numeros mezclados.',
  '// Ahora cada tipo lleva su serie:',
  '//   INS  instalacion / cerco / videovigilancia',
  '//   ELC  productos electronicos',
  '//   MAT  mantenimiento y polizas',
  '//   ESP  proyectos especiales',
  'function sinAcentos(s) {',
  "  return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();",
  '}',
  'const SERIES_FOLIO = {',
  "  GENERAL: 'INS',",
  "  PRODUCTOS_ELECTRONICOS: 'ELC',",
  "  MANTENIMIENTO: 'MAT',",
  "  PROYECTOS_ESPECIALES: 'ESP',",
  '};',
  '// Los contadores se deducen de los folios que ya hay en cada arranque, en vez',
  '// de guardarse aparte. Asi, aunque el servidor se reinicie o se redeploye, el',
  '// numero sigue subiendo y nunca se repite uno.',
  'const folioSeqs = { GENERAL: 0, PRODUCTOS_ELECTRONICOS: 0, MANTENIMIENTO: 0, PROYECTOS_ESPECIALES: 0 };',
  'function tomaFolioExistente(folio) {',
  '  const m = /^COT-([A-Z]{3})-(\\d{4})-\\d{4}$/.exec(String(folio || \'\'));',
  '  if (!m) return;',
  '  const serie = Object.keys(SERIES_FOLIO).find((k) => SERIES_FOLIO[k] === m[1]);',
  '  if (!serie) return;',
  '  const n = parseInt(m[2], 10) || 0;',
  '  if (n > (folioSeqs[serie] || 0)) folioSeqs[serie] = n;',
  '}',
  'function folioSiguiente(serie, year) {',
  '  folioSeqs[serie] = (folioSeqs[serie] || 0) + 1;',
  "  return `COT-${SERIES_FOLIO[serie]}-${String(folioSeqs[serie]).padStart(4, '0')}-${year}`;",
  '}',
  '// Decide la serie. Primero hace caso de lo que pidio el cliente; si no, se',
  '// deduce del area y, en ultimo caso, de si la cotizacion habla de',
  '// mantenimiento o poliza.',
  'function serieDeCotizacion(body, area) {',
  "  const pedido = String(body.tipoCotizacion || '').trim().toUpperCase().replace(/[\\s-]+/g, '_');",
  "  if (pedido === 'MANTENIMIENTO') return 'MANTENIMIENTO';",
  "  if (pedido === 'PRODUCTOS_ELECTRONICOS' || pedido === 'ELECTRONICOS') return 'PRODUCTOS_ELECTRONICOS';",
  "  if (pedido === 'PROYECTOS_ESPECIALES' || pedido === 'ESPECIALES') return 'PROYECTOS_ESPECIALES';",
  "  if (pedido === 'GENERAL' || pedido === 'INSTALACION') return 'GENERAL';",
  "  if (area === 'PROYECTOS_ESPECIALES') return 'PROYECTOS_ESPECIALES';",
  "  if (area === 'PRODUCTOS_ELECTRONICOS') return 'PRODUCTOS_ELECTRONICOS';",
  '  // Se compara sin tildes: "Productos Electronicos" escrito de otra forma',
  '  // tiene que caer en la misma serie, si no se va a instalacion sin avisar.',
  "  const tipo = sinAcentos(String(body.tipoInmueble || ''));",
  '  if (/productos\\s+electronicos/.test(tipo)) return \'PRODUCTOS_ELECTRONICOS\';',
  '  if (/proyecto\\s+especial/.test(tipo)) return \'PROYECTOS_ESPECIALES\';',
  "  const textos = [String(body.producto || ''), String(body.descripcion || '')]",
  '    .concat(Array.isArray(body.items) ? body.items.map((i) => String((i && i.title) || \'\')) : []);',
  "  if (/mantenimiento|poliza/.test(sinAcentos(textos.join(' ')))) return 'MANTENIMIENTO';",
  "  return 'GENERAL';",
  '}',
  ''
].join('\n');

const ancla = 'let folioSeq = 8850;';
const pos = h.indexOf(ancla);
if (pos < 0) { console.log('  [FALLA] no encontre el ancla'); process.exit(1); }
h = h.slice(0, pos + ancla.length) + bloque + h.slice(pos + ancla.length);

// Recorre los folios guardados para no repetir numero.
const anclaCarga = "  const m = /^COT-(\\d+)-/.exec(q.folio || '');\n  if (m && parseInt(m[1], 10) >= folioSeq) folioSeq = parseInt(m[1], 10) + 1;";
if (h.includes(anclaCarga)) {
  h = h.replace(anclaCarga, anclaCarga + '\n  tomaFolioExistente(q.folio);');
} else {
  console.log('  [aviso] no encontre el bucle de carga de folios');
}

// El folio nuevo y la serie que se guarda.
const anclaFolio = 'const folio = `COT-${folioSeq++}-${year}`;';
if (!h.includes(anclaFolio)) { console.log('  [FALLA] no encontre la generacion del folio'); process.exit(1); }
h = h.replace(anclaFolio, 'const serie = serieDeCotizacion(body, area);\n    const folio = folioSiguiente(serie, year);');

// Guardar la serie para que el panel pueda agrupar y etiquetar.
h = h.replace(/\n(\s*)area,\r?\n/, '\n$1area,\n$1// Con que serie quedo: el panel usa esto para agrupar y para poner la\n$1// etiqueta correcta en el documento.\n$1serie,\n$1tipoCotizacion: serie,\n');

fs.writeFileSync(ruta, h, 'utf8');
console.log('  bloque insertado');
console.log('  serie en el objeto: ' + (h.match(/\n\s*serie,\n/g) || []).length);
console.log('  tomaFolioExistente en la carga: ' + (h.match(/\n\s*tomaFolioExistente\(q\.folio\);/g) || []).length);
console.log('  ALCANCE declarado antes de usarse: ' + (h.indexOf('const ALCANCE') < h.indexOf('ALCANCE.run')));
console.log('  SERIES_FOLIO antes de la carga: ' + (h.indexOf('const SERIES_FOLIO') < h.indexOf('const quotesArr = loadJSON')));