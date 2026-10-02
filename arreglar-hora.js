// Sustituye el uso mezclado de UTC y hora local por los helpers nuevos.
const fs = require('fs');
const ruta = 'C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\work\\Back\\NERBA Back\\server.js';
let c = fs.readFileSync(ruta, 'utf8');
const antes = c.length;
let n = 0;

// 1) Los registros que guardan fecha Y hora: se toman del mismo instante.
const pares = [
  ["      fecha: new Date().toISOString().slice(0, 10),\n      hora: new Date().toTimeString().slice(0, 8),",
   "      ...ahoraLocal(),", 'bitacora (logAudit)'],
  ["u.lastLogin = { fecha: new Date().toISOString().slice(0, 10), hora: new Date().toTimeString().slice(0, 8) };",
   "u.lastLogin = ahoraLocal();", 'lastLogin del usuario'],
];
for (const [viejo, nuevo, etiqueta] of pares) {
  const cuantos = c.split(viejo).length - 1;
  if (cuantos) { c = c.split(viejo).join(nuevo); n += cuantos; console.log('  ' + etiqueta + ': ' + cuantos); }
  else console.log('  [aviso] no encontre: ' + etiqueta);
}

// 2) Fechas sueltas (sin hora al lado): tambien en hora local, para que no
//    cambien de dia despues de las 18:00.
const sueltasViejo = "new Date().toISOString().slice(0, 10)";
const sueltasNuevo = "fechaLocal()";
const cuantasSueltas = c.split(sueltasViejo).length - 1;
c = c.split(sueltasViejo).join(sueltasNuevo);
n += cuantasSueltas;
console.log('  fechas sueltas en hora local: ' + cuantasSueltas);

// 3) La validez de la cotizacion: 15 dias hacia adelante, en hora local.
const valViejo = "validez: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),";
const valNuevo = "validez: fechaLocal(new Date(Date.now() + 15 * 864e5)),";
if (c.includes(valViejo)) { c = c.replace(valViejo, valNuevo); console.log('  validez de la cotizacion: en hora local'); }
else console.log('  [aviso] no encontre la validez');

// Lo que queda en UTC debe ser solo una cosa: los identificadores, que son
// marcas de tiempo y no dependen de la zona.
const toISO = c.split('toISOString()').length - 1;
console.log('  quedan usos de toISOString (UTC): ' + toISO);

fs.writeFileSync(ruta, c, 'utf8');
console.log('  cambios: ' + n + '   ' + antes + ' -> ' + c.length + ' bytes');