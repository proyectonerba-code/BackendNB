/* Grupo NERBA HIDALGO - Transicion entre interfaces (cortina con logo de marca).
   Al salir: cubre la pantalla y navega. Al entrar no hace nada, porque de eso
   se encarga la pantalla de arranque de js/tema-oscuro.js: al usar el mismo
   isotipo y la misma barra, el relevo queda continuo y sin parpadeo.
   Solo intervene enlaces internos de verdad: respeta anclas, modificadores,
   descargas, ventanas nuevas, mailto/tel y todo lo que no sea http(s).
   Se autobloquea: si la navegacion no llega a ocurrir, la cortina se quita
   sola y los enlaces vuelven a funcionar. */
(function () {
  if (window.UNTransicion) return;

  var OUT_MS = 200;    // duracion de la cortina
  var GO_MS = 240;     // espera antes de navegar (deja terminar el fundido)
  var MAX_MS = 3500;   // red de seguridad: si no se navego, se destraba
  var leaving = false;
  var navT = null, unlockT = null;

  function motionOK() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
  }

  function injectCss() {
    if (document.getElementById('un-veil-css')) return;
    var st = document.createElement('style');
    st.id = 'un-veil-css';
    st.textContent =
      '#un-page-veil{position:fixed;inset:0;z-index:2147483647;background:#fff;opacity:0;' +
      'pointer-events:none;transition:opacity ' + OUT_MS + 'ms ease}' +
      '#un-page-veil.un-veil-on{opacity:1}' +
      '#un-page-veil.un-veil-lock{pointer-events:auto}' +
      '#un-page-veil .un-veil-box{position:absolute;inset:0;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:20px}' +
      '#un-page-veil .un-veil-box img{width:80px;height:80px;object-fit:contain;display:block}' +
      // Misma barra que la pantalla de arranque: el relevo entre paginas no se nota.
      '#un-page-veil .un-veil-line{position:relative;width:150px;height:6px;border-radius:999px;overflow:hidden;' +
      'background:#b0000b;box-shadow:0 0 12px rgba(217,27,27,.4)}' +
      '#un-page-veil .un-veil-line::before{content:\'\';position:absolute;top:-3px;bottom:-3px;left:0;width:28px;' +
      'border-radius:999px;background:#fff;opacity:.45;filter:blur(2px);animation:unVeilSheen 1.35s ease-in-out infinite}' +
      '#un-page-veil .un-veil-line i{position:relative;z-index:1;display:block;width:48%;height:100%;border-radius:inherit;' +
      'background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.25) 25%,#fff 50%,rgba(255,255,255,.25) 75%,transparent 100%);' +
      'box-shadow:0 0 8px rgba(255,255,255,.55);animation:unVeilSlide .8s cubic-bezier(.4,0,.2,1) infinite;animation-delay:-.25s}' +
      '@keyframes unVeilSlide{0%{transform:translateX(-190%)}100%{transform:translateX(360%)}}' +
      '@keyframes unVeilSheen{0%{transform:translateX(-50px);opacity:0}20%{opacity:.6}80%{opacity:.6}100%{transform:translateX(180px);opacity:0}}' +
      'html.dark-mode #un-page-veil,html.dark #un-page-veil{background:#0b1120}' +
      '@media (prefers-reduced-motion:reduce){#un-page-veil{transition:none}' +
      '#un-page-veil .un-veil-line::before,#un-page-veil .un-veil-line i{animation:none}' +
      '#un-page-veil .un-veil-line i{width:100%}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function getVeil() {
    injectCss();
    var v = document.getElementById('un-page-veil');
    if (!v) {
      v = document.createElement('div');
      v.id = 'un-page-veil';
      v.setAttribute('aria-hidden', 'true');
      v.innerHTML = '<div class="un-veil-box">' +
        '<img src="/assets/nerba-isotipo.svg" alt="" onerror="this.style.display=\'none\'">' +
        '<span class="un-veil-line"><i></i></span></div>';
      (document.body || document.documentElement).appendChild(v);
    }
    return v;
  }

  // Destraba siempre: la cortina desaparece y los enlaces vuelven a funcionar.
  function unlock() {
    leaving = false;
    clearTimeout(navT);
    clearTimeout(unlockT);
    navT = unlockT = null;
    var v = document.getElementById('un-page-veil');
    if (v && v.parentNode) v.parentNode.removeChild(v);
  }

  // Cortina de salida: opaco total, sin clicks, y navega al terminar el fundido.
  function coverThenGo(href) {
    leaving = true;
    // Si la pantalla de arranque sigue puesta (click muy rapido tras cargar),
    // se aparta para que la cortina quede sola arriba.
    try { if (window.UN_ZONE_BOOT && UN_ZONE_BOOT.remove) UN_ZONE_BOOT.remove(); } catch (e) {}
    var v = getVeil();
    v.classList.remove('un-veil-on');
    v.style.transition = 'none';
    v.style.opacity = '0';
    void v.offsetWidth;
    requestAnimationFrame(function () {
      v.style.transition = '';
      v.classList.add('un-veil-on', 'un-veil-lock');
    });
    navT = setTimeout(function () { location.href = href; }, GO_MS);
    // Si la pagina sigue aqui cuando corran los 3.5 s, nadie navego:
    // se destraba todo para no dejar la pantalla inutilizable.
    unlockT = setTimeout(unlock, MAX_MS);
  }

  // Navegacion con cortina. Si el destino no sirve para esto, va directo.
  function go(href) {
    var url;
    try { url = new URL(href, location.href); } catch (e) { location.href = href; return; }
    if (leaving) return;
    if (!motionOK() || url.origin !== location.origin) { location.href = url.href; return; }
    if (!document.body) { location.href = url.href; return; }
    coverThenGo(url.href);
  }

  // Intercepta en fase de burbuja: si el destino ya hizo preventDefault
  // (modal de sesion, pestana, boton que no navega), aqui se respeta.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (leaving) { e.preventDefault(); return; }
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.hasAttribute('download')) return;
    if (a.target && a.target !== '_self' && a.target !== '_top') return;
    var raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#') return;
    if (/^\s*(javascript|mailto|tel|sms|data|blob|file):/i.test(raw)) return;
    var url;
    try { url = new URL(raw, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    // Solo cambia el hash: es scroll nativo, no hay cambio de interfaz.
    if (url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    go(url.href);
  });

  // Atras/adelante, o vuelta desde la cache del navegador: hay que destrabar.
  window.addEventListener('popstate', function () { if (leaving) unlock(); });
  window.addEventListener('pageshow', function (e) { if (leaving) unlock(); });
  window.addEventListener('pagehide', function () { if (leaving) unlock(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && leaving) unlock(); });

  window.UNTransicion = {
    go: go,
    unlock: unlock,
    active: function () { return leaving; },
  };
})();
