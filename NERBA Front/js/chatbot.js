/* NerBot — ventana flotante, solo rol CLIENTE.
   Abrir/cerrar con FAB + minimizar desde el header.
   FAB y ventana arrastrables (posición persistente).
   Iconos SVG inline (no dependen de fuentes externas).
   Respuestas locales por reglas (sin backend). Diseños intactos. */
(function () {
  if (window.__nbLoaded) return;
  window.__nbLoaded = true;

  // Iconos SVG inline: siempre renderizan, con o sin internet.
  var ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 9H7V9h4v2zm6 0h-4V9h4v2z"/></svg>';
  var ICON_MIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13H5v-2h14v2z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>';

  // Logo del bot: archivo /assets/chatbot.png (tu logo con audífonos).
  // Cadena de respaldo: chatbot.png → logo.png → letra "N" / SVG.
  var NB_LOGO = '/assets/chatbot.png?v=3';
  var NB_LOGO_OLD = '/assets/logo.png';
  window.__nbLogoErr = function (img) {
    if (!img.dataset.fbk) { img.dataset.fbk = '1'; img.src = NB_LOGO_OLD; }
    else if (img.parentNode) img.parentNode.removeChild(img);
  };
  function nbLogoImg() {
    return '<span class="nb-ava-fb">N</span><img src="' + NB_LOGO + '" alt="NerBot" onerror="__nbLogoErr(this)">';
  }

  function getUser() {
    try {
      if (window.UN && UN.getUser) return UN.getUser();
      return JSON.parse(localStorage.getItem('unidos_user') || 'null');
    } catch (e) { return null; }
  }
  function isClient() {
    var u = getUser();
    return !!(localStorage.getItem('unidos_token') && u && u.rol === 'CLIENTE');
  }
  // Solo clientes: admin, superadmin, especiales y electrónica no lo ven.
  // Tampoco invitados sin sesión.
  if (!isClient()) return;

  (function () {
    if (document.querySelector('link[data-nb-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.setAttribute('data-nb-css', '1');
    l.href = '/css/chatbot.css?v=2.2';
    document.head.appendChild(l);
  })();

  var user = getUser() || {};
  var userName = user.nombre || 'Ingeniero';
  var storeKey = 'nerba_chat_hist::' + (user.email || 'anon');
  var openKey = 'nerba_chat_open::' + (user.email || 'anon');
  // Limpieza única: posiciones de la etapa movible para volver a la esquina fija.
  try { localStorage.removeItem('nerba_chat_fabpos'); localStorage.removeItem('nerba_chat_panelpos'); } catch (e0) {}

  // ---------- Estructura flotante ----------
  var fab = document.createElement('button');
  fab.id = 'nb-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Abrir chat NerBot');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = 'NerBot · Asistente Virtual';
  fab.innerHTML = '<span class="nb-fab-svg">' + ICON_CHAT + '</span>' +
    '<img class="nb-fab-img" src="' + NB_LOGO + '" alt="NerBot" onerror="__nbLogoErr(this)">' +
    '<span id="nb-fab-dot"></span>';

  var teaser = document.createElement('div');
  teaser.id = 'nb-teaser';
  teaser.setAttribute('role', 'status');
  teaser.setAttribute('aria-live', 'polite');
  teaser.setAttribute('aria-hidden', 'true');
  teaser.textContent = 'COMUNÍCATE CON NOSOTROS';

  var panel = document.createElement('div');
  panel.id = 'nb-panel';
  panel.className = 'nb-hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat NerBot');
  panel.innerHTML =
    '<div id="nb-bar"></div>' +
    '<div id="nb-head"><div id="nb-head-info">' +
      '<div id="nb-avatar">' + nbLogoImg() + '</div>' +
      '<div><div id="nb-title">NerBot <span id="nb-badge">Asistente Virtual</span></div>' +
      '<div id="nb-status"><i></i>En línea 24/7</div></div>' +
    '</div><div id="nb-head-btns">' +
      '<button id="nb-min" type="button" title="Minimizar" aria-label="Minimizar">' + ICON_MIN + '</button>' +
      '<button id="nb-close" type="button" title="Cerrar" aria-label="Cerrar">' + ICON_X + '</button>' +
    '</div></div>' +
    '<div id="nb-body" aria-live="polite"></div>' +
    '<div id="nb-quick"></div>' +
    '<div id="nb-form-wrap"><form id="nb-form">' +
      '<input id="nb-input" type="text" placeholder="Escribe tu consulta técnica…" autocomplete="off" maxlength="500">' +
      '<button id="nb-send" type="submit" title="Enviar" aria-label="Enviar">' + ICON_SEND + '</button>' +
    '</form><div id="nb-foot"><i></i>Soporte Especializado Nerba · Respuesta en tiempo real</div></div>';

  document.body.appendChild(fab);
  document.body.appendChild(teaser);
  document.body.appendChild(panel);

  var body = panel.querySelector('#nb-body');
  var quick = panel.querySelector('#nb-quick');
  var form = panel.querySelector('#nb-form');
  var input = panel.querySelector('#nb-input');

  function hour() {
    return new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function saveHist(items) {
    try { localStorage.setItem(storeKey, JSON.stringify(items.slice(-30))); } catch (e) {}
  }
  function loadHist() {
    try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch (e) { return []; }
  }
  var hist = loadHist();

  function addMsg(who, html) {
    var row = document.createElement('div');
    row.className = 'nb-row' + (who === 'user' ? ' nb-user' : '');
    var av = who === 'bot'
      ? '<div class="nb-ava">' + nbLogoImg() + '</div>' : '';
    row.innerHTML = av + '<div style="min-width:0"><div class="nb-bubble">' + html + '</div>' +
      '<div class="nb-time">' + hour() + '</div></div>';
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }
  function botSay(html) {
    hist.push({ who: 'bot', html: html }); saveHist(hist);
    addMsg('bot', html);
  }
  function userSay(text) {
    hist.push({ who: 'user', html: esc(text) }); saveHist(hist);
    addMsg('user', esc(text));
  }

  // ---------- Cerebro local por reglas ----------
  function answer(q) {
    var t = (q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function has() { for (var i = 0; i < arguments.length; i++) if (t.indexOf(arguments[i]) >= 0) return true; return false; }
    if (!t.trim()) return 'Cuéntame qué necesitas: cerco eléctrico, CCTV, alarma, portón o una <strong>cotización</strong>.';
    if (has('poste', 'altura', 'muro', '2.6', '2,6', 'cerco electrico', 'cercas'))
      return 'Para un muro de <strong>2.60 m</strong>, conforme a la norma <span class="nb-red">IEC 60335-2-76</span>, el primer hilo debe iniciar a no menos de 2.00 m del suelo. Se recomiendan <strong>postes de 1.00–1.20 m</strong> con 6 líneas de alambre acerado galvanizado.';
    if (has('calibre', 'cable', '420', 'metros', 'metraje', 'alambre'))
      return 'Para tiradas de ~<strong>420 m</strong> usa <strong>cable de aluminio-acero calibre 14–12 AWG</strong> con aisladores de porcelana cada 3 m y tensores trinquetes. Evita empalmes intermedios: cada empalme es un punto de falla y de caída de pulso.';
    if (has('energizador', 'iec', 'electrificador', 'volts', 'voltaje', 'pulso'))
      return 'Los energizadores homologados <span class="nb-red">IEC 60335-2-76</span> entregan pulsos regulados de <strong>10,000–14,000 V</strong> no letales, con alerta inmediata ante corte o sabotaje. Dime tus metros lineales y te sugiero la potencia (joules) adecuada.';
    if (has('cctv', 'camara', 'camaras', 'dvr', 'nvr', 'ptz', 'videovigilancia'))
      return 'En <strong>CCTV</strong> manejamos kits 4K con IA (detección de personas/vehículos) y PTZ 360° para fincas e industrias. Explora el <a href="/index.html#seccion-catalogo">catálogo</a> y dime cuántas cámaras y qué distancia necesitas cubrir.';
    if (has('alarma', 'sensor', 'sirena', 'movimiento', 'intrusion'))
      return 'Las <strong>alarmas WiFi/4G</strong> avisan directo a tu smartphone, con sensores inmunes a mascotas y respaldo 4G ante cortes. ¿Es para casa, local o bodega? Así te dimensiono el kit.';
    if (has('porton', 'portones', 'motor', 'automatizacion', 'cochera', 'corredizo'))
      return 'Automatizamos portones corredizos y levadizos: apertura en <strong>menos de 10 s</strong>, fotocélula anti-aplastamiento y control móvil. ¿Qué ancho tiene tu acceso vehicular?';
    if (has('cotiz', 'precio', 'costo', 'presupuesto', 'pdf', 'cuanto cuesta'))
      return 'Puedo guiarte a tu <strong>cotización formal en PDF</strong>: entra al <a href="/cotizador.html">Cotizador Online</a>, registra tu solicitud y descárgala desde <a href="/mis-cotizaciones.html">Mis cotizaciones</a>. ¿Quieres que te diga qué datos pedirán?';
    if (has('humano', 'asesor', 'tecnico', 'telefono', 'contacto', 'horario', 'soporte', 'ayuda'))
      return 'Nuestro soporte especializado responde <strong>24/7</strong> por este chat. Para visita técnica o emergencia, deja tu solicitud en el <a href="/cotizador.html">cotizador</a> y un ingeniero te contacta. ¿Describimos tu inmueble ahora?';
    if (has('gracias', 'perfecto', 'excelente', 'genial'))
      return '¡Con gusto, <strong>' + esc(userName) + '</strong>! Quedo atento 24/7 para tu dimensionamiento perimetral y equipos homologados.';
    if (has('adios', 'bye', 'hasta luego', 'nos vemos'))
      return '¡Hasta luego! El chat queda aquí abajo cuando lo necesites. <strong>Grupo NERBA HIDALGO</strong> · Ingeniería 24/7.';
    if (has('hola', 'buenas', 'buenos dias', 'buenas tardes', 'que tal', 'saludos'))
      return '¡Hola <strong>' + esc(userName) + '</strong>! Soy <span class="nb-red">NerBot</span>, tu asesor de ingeniería y cotización de <strong>Grupo NERBA HIDALGO</strong>. ¿Te ayudo con dimensionamiento perimetral o equipos homologados?';
    return 'Entendido. Para darte la recomendación exacta dime: <strong>1)</strong> tipo de inmueble, <strong>2)</strong> metros a proteger y <strong>3)</strong> si buscas cerco, CCTV, alarma o portón. También puedes ir directo al <a href="/cotizador.html">cotizador</a>.';
  }

  function botReply(q) {
    var typing = document.createElement('div');
    typing.className = 'nb-row';
    typing.innerHTML = '<div class="nb-ava">' + nbLogoImg() + '</div>' +
      '<div class="nb-bubble"><span class="nb-typing"><span></span><span></span><span></span></span></div>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      botSay(answer(q));
    }, 700);
  }

  // ---------- Atajos ----------
  var QUICK = ['Altura de postes', 'Calibre de cable', 'Ver catálogo', 'Generar cotización'];
  QUICK.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = q;
    b.addEventListener('click', function () {
      if (q === 'Ver catálogo') { location.href = '/index.html#seccion-catalogo'; return; }
      if (q === 'Generar cotización') { location.href = '/cotizador.html'; return; }
      openFull();
      userSay(q); botReply(q);
    });
    quick.appendChild(b);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = (input.value || '').trim();
    if (!v) return;
    input.value = '';
    userSay(v); botReply(v);
    input.focus();
  });

  // ---------- Abrir / minimizar / cerrar ----------
  function persist(open) {
    try { localStorage.setItem(openKey, open ? '1' : '0'); } catch (e) {}
  }
  /* Widget fijo: la ventana abre siempre en su esquina. */
  var nbT = null;
  function clearNbT() { if (nbT) { clearTimeout(nbT); nbT = null; } }
  function nbMotionOK() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
  }
  var teaserCycleTimer = null;
  var teaserHideTimer = null;
  function hideTeaser() {
    if (teaserHideTimer) { clearTimeout(teaserHideTimer); teaserHideTimer = null; }
    teaser.classList.remove('nb-teaser-show');
    teaser.setAttribute('aria-hidden', 'true');
  }
  function showTeaser() {
    if (document.hidden || !panel.classList.contains('nb-hidden') || fab.style.display === 'none') return;
    if (teaserHideTimer) { clearTimeout(teaserHideTimer); teaserHideTimer = null; }
    teaser.classList.remove('nb-teaser-show');
    teaser.setAttribute('aria-hidden', 'false');
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); };
    raf(function () {
      if (fab.style.display !== 'none' && panel.classList.contains('nb-hidden')) teaser.classList.add('nb-teaser-show');
    });
    teaserHideTimer = setTimeout(hideTeaser, 10000);
  }
  function showFab(pop) {
    fab.classList.remove('nb-hide');
    fab.classList.remove('nb-pop');
    if (pop && nbMotionOK()) { void fab.offsetWidth; fab.classList.add('nb-pop'); }
  }
  function openFull() {
    clearNbT();
    hideTeaser();
    fab.setAttribute('aria-expanded', 'true');
    panel.classList.remove('nb-hidden', 'nb-min', 'nb-closing');
    // El icono se desvanece con transición ligera al abrir la ventana
    if (fab.style.display !== 'none' && fab.offsetWidth) {
      fab.classList.add('nb-hide');
      var d = nbMotionOK() ? 140 : 0;
      nbT = setTimeout(function () { fab.style.display = 'none'; fab.classList.remove('nb-hide'); nbT = null; }, d);
    } else {
      fab.style.display = 'none';
    }
    persist(true);
    setTimeout(function () { input.focus(); }, 120);
  }
  // Minimizar regresa al icono flotante (misma armonía que cerrar):
  // solo existen dos estados, icono ⇄ ventana.
  panel.querySelector('#nb-min').addEventListener('click', closeAll);
  function closeAll() {
    clearNbT();
    fab.setAttribute('aria-expanded', 'false');
    // Transición ligera de salida y regreso al icono fijo de la esquina
    panel.classList.add('nb-closing');
    var wait = nbMotionOK() ? 170 : 0;
    nbT = setTimeout(function () {
      panel.classList.add('nb-hidden');
      panel.classList.remove('nb-min', 'nb-closing');
      fab.style.display = 'flex';
      showFab(true);
      nbT = null;
    }, wait);
    persist(false);
  }
  panel.querySelector('#nb-close').addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.classList.contains('nb-hidden')) closeAll();
  });

  // Widget fijo en su esquina (sin arrastre).
  fab.addEventListener('click', openFull);

  // ---------- Historial + bienvenida ----------
  if (hist.length) hist.forEach(function (m) { addMsg(m.who, m.html); });
  else botSay('¡Hola <strong>' + esc(userName) + '</strong>! Soy tu asistente de ingeniería y cotización de <span class="nb-red">Grupo NERBA HIDALGO</span>. Estoy listo para ayudarte con tu dimensionamiento perimetral y equipos homologados.');

  var wasOpen = false;
  try { wasOpen = localStorage.getItem(openKey) === '1'; } catch (e) {}
  if (wasOpen) { fab.style.display = 'none'; openFull(); }
  else { panel.classList.add('nb-hidden'); fab.style.display = 'flex'; showFab(true); }
  teaserCycleTimer = setInterval(showTeaser, 120000);

  window.NerBot = { open: openFull, close: closeAll, showTeaser: showTeaser, toggle: function () {
    if (panel.classList.contains('nb-hidden')) openFull(); else closeAll();
  } };
})();
