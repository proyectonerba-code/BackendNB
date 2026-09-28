/* Grupo NERBA HIDALGO - Contenido del pie de pagina en TODAS las interfaces.
   El pie queda limpio a proposito: solo datos de la empresa que podemos
   sostener. No se anuncian certificaciones, garantias, plazos de respuesta ni
   cifras de operaciones, porque son afirmaciones que la empresa tiene que
   poder respaldar (y un pie no es el lugar para prometer).
   Este archivo REEMPLAZA el contenido de cualquier <footer> por:
     1) la franja de datos de la empresa,
     2) la linea de derechos reservados y enlaces legales, y
     3) la linea roja con brillo que cierra el pie.
   Cambias los datos aqui y se actualizan los 25 pies del sitio a la vez. */
(function () {
  if (document.getElementById('un-pie-empresa')) return;
  var pie = document.querySelector('footer');
  if (!pie) return;

  var DATOS = {
    razon: 'GRUPO EMPRESARIAL NERBA, S.A. DE C.V.',
    giro: 'Automatización • Seguridad electrónica • CCTV • Control de acceso • Puertas automáticas • Cercos eléctricos',
    direccion: 'Los Pinos No. 112-B, Col. El Cerezo, C.P. 43669, Tulancingo de Bravo, Hidalgo, México',
    tulancingo: '775 130 0335',
    pachuca: '771 219 8250',
    correo: 'gruponerba@hotmail.com',
    logo: '/assets/logo.png',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ruta(rel) { return rel.charAt(0) === '/' ? rel : '/' + rel; }

  function css() {
    if (document.getElementById('un-pie-css')) return;
    var st = document.createElement('style');
    st.id = 'un-pie-css';
    st.textContent =
      // Aire extra: hay pies que traen padding 0 y el resplandor se salia.
      // El margen lateral va aqui porque al vaciar el pie se perdio el contenedor
      // interno que lo traia, y sin esto el texto se pegaba a los bordes.
      '#un-pie-empresa{width:100%;max-width:1280px;margin-left:auto;margin-right:auto;' +
      'display:flex;flex-direction:column;gap:1.35rem;' +
      'padding:1.15rem clamp(1rem,4vw,2rem) 1.6rem;font-family:Inter,system-ui,sans-serif;' +
      'box-sizing:border-box}' +
      '#un-pie-empresa .un-pe-fila{display:flex;flex-wrap:wrap;align-items:center;gap:1.25rem 2.5rem}' +
      '#un-pie-empresa .un-pe-logo{height:52px;width:auto;max-width:min(50vw,300px);object-fit:contain;flex:0 0 auto}' +
      '#un-pie-empresa .un-pe-bloque{display:flex;flex-direction:column;gap:.3rem;flex:1 1 280px;min-width:240px}' +
      '#un-pie-empresa .un-pe-razon{font-size:15px;font-weight:800;color:#0b1c30;letter-spacing:.02em;text-transform:uppercase;line-height:1.4}' +
      '#un-pie-empresa .un-pe-giro{font-size:13px;color:#475569;line-height:1.7}' +
      '#un-pie-empresa .un-pe-dato{font-size:13px;color:#475569;line-height:1.7;display:flex;align-items:flex-start;gap:.5rem}' +
      '#un-pie-empresa .un-pe-dato i{font-style:normal;flex:0 0 auto;opacity:.7}' +
      '#un-pie-empresa .un-pe-tel{font-weight:800;color:#0b1c30;white-space:nowrap}' +
      '#un-pie-empresa .un-pe-ciudad{font-weight:400;color:#64748b}' +
      '#un-pie-empresa .un-pe-enlace{color:#b0000b;text-decoration:none;overflow-wrap:anywhere}' +
      '#un-pie-empresa .un-pe-enlace:hover{text-decoration:underline}' +
      '#un-pie-legal{padding-top:.4rem;display:flex;flex-wrap:wrap;align-items:center;' +
      'justify-content:space-between;gap:.5rem 1rem;font-size:12.5px;color:#64748b}' +
      '#un-pie-legal nav{display:flex;flex-wrap:wrap;gap:.4rem 1.15rem}' +
      '#un-pie-legal a{color:inherit;text-decoration:none}' +
      '#un-pie-legal a:hover{color:#b0000b;text-decoration:underline}' +
      // Linea roja fina y mate. Sin brillo: el nucleo usa el rojo
      // institucional oscuro y los extremos se van a transparente para que la
      // linea se disuelva en el fondo en vez de cortarse en seco.
      '#un-pie-linea{position:relative;display:block;height:2px;width:100%;margin:1.1rem 0 .65rem;' +
      'border-radius:999px;pointer-events:none;' +
      'background:linear-gradient(90deg,rgba(176,0,11,0) 0%,rgba(176,0,11,.08) 14%,rgba(176,0,11,.28) 32%,rgba(176,0,11,.5) 50%,rgba(176,0,11,.28) 68%,rgba(176,0,11,.08) 86%,rgba(176,0,11,0) 100%);' +
      'box-shadow:0 0 2px rgba(176,0,11,.12)}' +
      '#un-pie-linea::after{content:\'\';position:absolute;left:8%;right:8%;top:50%;height:4px;' +
      'transform:translateY(-50%);border-radius:999px;pointer-events:none;' +
      'background:linear-gradient(90deg,rgba(176,0,11,0) 0%,rgba(176,0,11,.09) 32%,rgba(176,0,11,.15) 50%,rgba(176,0,11,.09) 68%,rgba(176,0,11,0) 100%);' +
      'filter:blur(3px);opacity:.65}' +
      'html.dark-mode #un-pie-empresa .un-pe-razon,html.dark #un-pie-empresa .un-pe-razon,' +
      'html.dark-mode #un-pie-empresa .un-pe-tel,html.dark #un-pie-empresa .un-pe-tel{color:#f1f5f9}' +
      'html.dark-mode #un-pie-empresa .un-pe-giro,html.dark #un-pie-empresa .un-pe-giro,' +
      'html.dark-mode #un-pie-empresa .un-pe-dato,html.dark #un-pie-empresa .un-pe-dato{color:#94a3b8}' +
      'html.dark-mode #un-pie-empresa .un-pe-ciudad,html.dark #un-pie-empresa .un-pe-ciudad{color:#64748b}' +
      'html.dark-mode #un-pie-empresa .un-pe-enlace,html.dark #un-pie-empresa .un-pe-enlace,' +
      'html.dark-mode #un-pie-legal a:hover,html.dark #un-pie-legal a:hover{color:#ff8a80}' +
      'html.dark-mode #un-pie-legal,html.dark #un-pie-legal{color:#94a3b8}' +
      'html.dark-mode #un-pie-linea,html.dark #un-pie-linea{opacity:.75}' +
      '@media (max-width:640px){#un-pie-empresa{padding:.75rem clamp(.9rem,5vw,1.25rem) 1rem}' +
      '#un-pie-empresa .un-pe-bloque{min-width:100%}#un-pie-empresa .un-pe-logo{height:38px}}' +
      '@media (prefers-reduced-motion:reduce){#un-pie-linea::after{filter:blur(3px)}}';
    (document.head || document.documentElement).appendChild(st);
  }

  css();

  // Privacidad y terminos ya traen el logo en el header. Con el logo tambien en
  // el pie la pagina muestra la misma insignia dos veces, asi que esas dos
  // interfaces se marcan con data-pie-sin-logo="1" para que aqui no se repita
  // y solo quede la insignia de arriba.
  var sinLogo = document.documentElement.getAttribute('data-pie-sin-logo') === '1';
  var imgLogo = sinLogo ? '' :
    '<img class="un-pe-logo" src="' + esc(DATOS.logo) + '" alt="Logo Grupo NERBA HIDALGO" ' +
    'onerror="this.style.display=\'none\'">';

  // El pie a veces es una fila flex: sin wrap el contenido se aplasta al lado.
  try {
    if (pie.className && /(^|\s)flex(\s|$)/.test(pie.className)) pie.style.flexWrap = 'wrap';
  } catch (e) {}

  // Algunos pies traen padding 0 (registro, privacidad, terminos): sin un
  // minimo, la linea roja y su resplandor se salen por el borde inferior.
  // Se respeta el padding que ya traia si es mayor.
  try {
    var cs = window.getComputedStyle(pie);
    var px = function (v) { return parseFloat(v) || 0; };
    if (px(cs.paddingTop) < 20) pie.style.paddingTop = '1.25rem';
    if (px(cs.paddingBottom) < 40) pie.style.paddingBottom = '2.75rem';
  } catch (e) {}

  // Se vacia el pie: fuera certificaciones, garantias, cifras y promesas.
  while (pie.firstChild) pie.removeChild(pie.firstChild);

  var caja = document.createElement('div');
  caja.id = 'un-pie-empresa';
  caja.setAttribute('role', 'contentinfo');
  caja.innerHTML =
    '<div class="un-pe-fila">' +
    imgLogo +
    '<div class="un-pe-bloque">' +
    '<span class="un-pe-razon">' + esc(DATOS.razon) + '</span>' +
    '<span class="un-pe-giro">' + esc(DATOS.giro) + '</span>' +
    '</div>' +
    '<div class="un-pe-bloque">' +
    '<span class="un-pe-dato"><i aria-hidden="true">📍</i><span>' + esc(DATOS.direccion) + '</span></span>' +
    '<span class="un-pe-dato"><i aria-hidden="true">☎</i><span class="un-pe-tel">' + esc(DATOS.tulancingo) +
    ' <span class="un-pe-ciudad">Tulancingo</span> &nbsp;|&nbsp; ' + esc(DATOS.pachuca) +
    ' <span class="un-pe-ciudad">Pachuca</span></span></span>' +
    '<span class="un-pe-dato"><i aria-hidden="true">✉</i><a class="un-pe-enlace" href="mailto:' +
    esc(DATOS.correo) + '">' + esc(DATOS.correo) + '</a></span>' +
    '</div></div>' +
    '<div id="un-pie-legal">' +
    '<span>© ' + esc(DATOS.razon) + '</span>' +
    '<nav>' +
    '<a href="' + ruta('privacidad.html') + '">Aviso de privacidad</a>' +
    '<a href="' + ruta('terminos.html') + '">Términos y condiciones</a>' +
    '</nav></div>' +
    '<span id="un-pie-linea" aria-hidden="true"></span>';
  pie.appendChild(caja);
})();
