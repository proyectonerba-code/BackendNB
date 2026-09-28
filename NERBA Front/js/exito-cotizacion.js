/* Grupo NERBA HIDALGO - Velo de exito al enviar una solicitud o cotizacion.
   UN.exitoCotizacion(opciones) devuelve una promesa: cubre la pantalla con el
   logo de la empresa, dibuja el check y se cierra sola (tambien al hacer clic
   o pulsar Escape). El folio NO se muestra aqui: vive en el PDF y en el aviso
   de la pagina. El primer argumento se acepta y se ignora, para que los tres
   flujos que ya lo llaman sigan funcionando sin tocarlos.
   Opciones: { titulo, sub, logo, ms } para cada tipo de envio.
   Estilos con prefijo un-qo: no toca los disenos ni el modo oscuro. */
(function () {
  if (!window.UN) return;
  if (UN.__qoOK) return;
  UN.__qoOK = true;

  var ID = 'un-quote-ok';
  var CSS_ID = 'un-qo-css';
  var LOGO = '/assets/logo.png';
  var VIVO_MS = 1500;   // tiempo con la pantalla puesta
  var FUERA_MS = 240;   // fundido de salida

  function motionOK() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '#' + ID + '{position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;' +
      'align-items:center;justify-content:center;opacity:0;transition:opacity ' + FUERA_MS + 'ms ease}' +
      '#' + ID + '.un-qo-on{opacity:1}' +
      '.un-qo-card{text-align:center;padding:24px;max-width:92vw;transform:translateY(6px);' +
      'transition:transform .32s cubic-bezier(.16,1,.3,1)}' +
      '#' + ID + '.un-qo-on .un-qo-card{transform:none}' +
      // El logo de la empresa manda: si no carga, el check sostiene la pantalla.
      '.un-qo-logo{height:56px;width:auto;max-width:min(78vw,420px);object-fit:contain;margin:0 auto 16px;display:block}' +
      '.un-qo-check{width:88px;height:88px;margin:0 auto 14px;display:block}' +
      '.un-qo-check circle{fill:#d91b1b;transform-origin:46px 46px;animation:unQoPop .45s cubic-bezier(.16,1,.3,1) forwards}' +
      '.un-qo-check path{fill:none;stroke:#fff;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;' +
      'stroke-dasharray:80;stroke-dashoffset:80;animation:unQoDraw .5s ease .32s forwards}' +
      '@keyframes unQoPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}' +
      '@keyframes unQoDraw{to{stroke-dashoffset:0}}' +
      '.un-qo-title{font:800 22px \'Plus Jakarta Sans\',Inter,system-ui,sans-serif;color:#0b1c30;margin:0}' +
      '.un-qo-sub{color:#64748b;font:400 13px Inter,system-ui,sans-serif;margin:14px 0 0}' +
      'html.dark-mode #' + ID + ',html.dark #' + ID + '{background:#0b1120}' +
      'html.dark-mode .un-qo-title,html.dark .un-qo-title{color:#f1f5f9}' +
      'html.dark-mode .un-qo-sub,html.dark .un-qo-sub{color:#94a3b8}' +
      '@media (prefers-reduced-motion:reduce){#' + ID + '{transition:none}' +
      '.un-qo-card{transform:none}' +
      '.un-qo-check circle,.un-qo-check path{animation:none}' +
      '.un-qo-check path{stroke-dashoffset:0}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function quitar(ov, resolve) {
    if (ov._cerrada) return;
    ov._cerrada = true;
    document.removeEventListener('keydown', onTecla, true);
    var fin = function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      resolve();
    };
    if (motionOK()) {
      ov.classList.remove('un-qo-on');
      setTimeout(fin, FUERA_MS + 40);
    } else fin();
  }
  function onTecla(e) {
    var ov = document.getElementById(ID);
    if (ov && !ov._cerrada && e.key === 'Escape') { e.preventDefault(); quitar(ov, ov._resolve); }
  }

  UN.exitoCotizacion = function (folio, opciones) {
    var o = opciones || {};
    return new Promise(function (resolve) {
      if (!document.body) { resolve(); return; }
      injectCss();
      // Nunca dos pantallas encima: si ya habia una, se cierra primero.
      var previo = document.getElementById(ID);
      if (previo) { previo._cerrada = true; if (previo.parentNode) previo.parentNode.removeChild(previo); }
      try { if (window.UN_ZONE_BOOT && UN_ZONE_BOOT.remove) UN_ZONE_BOOT.remove(); } catch (e) {}
      var ms = Number(o.ms) > 0 ? Number(o.ms) : (motionOK() ? VIVO_MS : 200);
      var ov = document.createElement('div');
      ov.id = ID;
      ov._resolve = resolve;
      ov.setAttribute('role', 'status');
      ov.setAttribute('aria-live', 'polite');
      ov.innerHTML =
        '<div class="un-qo-card">' +
        '<img class="un-qo-logo" src="' + esc(o.logo || LOGO) + '" alt="Grupo NERBA HIDALGO" onerror="this.style.display=\'none\'">' +
        '<svg class="un-qo-check" viewBox="0 0 92 92" aria-hidden="true"><circle cx="46" cy="46" r="42"></circle>' +
        '<path d="M30 47.5 41 58.5 63 35"></path></svg>' +
        '<h3 class="un-qo-title">' + esc(o.titulo || '¡Cotización enviada con éxito!') + '</h3>' +
        '<p class="un-qo-sub">' + esc(o.sub || 'Preparando tu documento…') + '</p></div>';
      document.body.appendChild(ov);
      document.addEventListener('keydown', onTecla, true);
      ov.addEventListener('click', function () { quitar(ov, resolve); });
      // Un frame con la pantalla oculta y luego se enciende: el fundido entra solo.
      requestAnimationFrame(function () {
        if (!ov._cerrada) ov.classList.add('un-qo-on');
      });
      setTimeout(function () { quitar(ov, resolve); }, ms);
    });
  };
})();
