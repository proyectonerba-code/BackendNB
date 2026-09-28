/* Grupo NERBA HIDALGO — Tema oscuro global "Razer NOC" (carga temprana).
   TEMA POR CUENTA (no global del navegador):
   - Cada usuario guarda su preferencia en 'nerba_theme::<email>'.
   - Invitados (sin sesion) usan 'nerba_theme' y jamas tocan cuentas.
   - El servidor (user.tema) manda al entrar; ver UN.theme en unidos.js.
   Aplica <html class="dark dark-mode"> ANTES del primer pintado (sin flash)
   e inyecta css/tema-oscuro-razor.css si la pagina aun no lo trae. */
(function () {
  var LEGACY = 'nerba_theme';
  var PING = 'unidos_theme_ping';
  function cssHref() {
    if (/^\/(admin|superadmin|especiales|electronica)\//.test(location.pathname)) return '/css/tema-oscuro-razor.css?v=3.0';
    var depth = (location.pathname.match(/\//g) || []).length;
    if (depth > 2) return '/css/tema-oscuro-razor.css?v=3.0';
    return 'css/tema-oscuro-razor.css?v=3.0';
  }
  function ensureCSS() {
    try {
      if (document.querySelector('link[data-razor-dark]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.setAttribute('data-razor-dark', '1');
      l.href = cssHref();
      l.onerror = function () {
        if (l.getAttribute('href').charAt(0) !== '/') l.href = '/css/tema-oscuro-razor.css?v=3.0';
      };
      (document.head || document.documentElement).appendChild(l);
    } catch (e) {}
  }
  var earlyBoot = true;
  function installBoot() {
    if (!earlyBoot || document.getElementById('un-boot-screen')) return;
    var boot = document.createElement('div');
    boot.id = 'un-boot-screen';
    boot.setAttribute('aria-hidden', 'true');
    boot.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:var(--un-boot-bg,#fff);transition:opacity .12s ease;';
    boot.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:20px"><img src="/assets/nerba-isotipo.svg" width="80" height="80" alt="" aria-hidden="true" style="display:block;width:80px;height:80px;object-fit:contain"><span class="un-boot-line"><i></i></span></div>';
    (document.documentElement).appendChild(boot);
    var style = document.createElement('style');
    style.id = 'un-boot-style';
    style.textContent = ':root{--un-boot-bg:#fff}html.dark-mode,html.dark{--un-boot-bg:#0b1120}#un-boot-screen{background:var(--un-boot-bg,#fff)}.un-boot-line{position:relative;width:150px;height:6px;border-radius:999px;overflow:hidden;background:#b0000b;box-shadow:0 0 12px rgba(217,27,27,.4);animation:un-boot-line-pulse 1.2s ease-in-out infinite}.un-boot-line::before{content:\'\';position:absolute;top:-3px;bottom:-3px;left:0;width:28px;border-radius:999px;background:#fff;opacity:.45;filter:blur(2px);animation:un-boot-line-sheen 1.35s ease-in-out infinite}.un-boot-line i{position:relative;z-index:1;display:block;width:48%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.25) 25%,#fff 50%,rgba(255,255,255,.25) 75%,transparent 100%);box-shadow:0 0 8px rgba(255,255,255,.55);animation:un-boot-line .8s cubic-bezier(.4,0,.2,1) infinite;animation-delay:-.25s}@keyframes un-boot-line{0%{transform:translateX(-190%)}100%{transform:translateX(360%)}}@keyframes un-boot-line-sheen{0%{transform:translateX(-50px);opacity:0}20%{opacity:.6}80%{opacity:.6}100%{transform:translateX(180px);opacity:0}}@keyframes un-boot-line-pulse{0%,100%{box-shadow:0 0 8px rgba(217,27,27,.25)}50%{box-shadow:0 0 16px rgba(217,27,27,.6)}}@media (prefers-reduced-motion: reduce){.un-boot-line{animation:none;box-shadow:none}.un-boot-line::before{display:none}.un-boot-line i{width:100%;transform:none;animation:none;box-shadow:none;background:rgba(255,255,255,.25)}}';
    (document.head || document.documentElement).appendChild(style);
  }
  function removeBoot() {
    var boot = document.getElementById('un-boot-screen');
    if (!boot || boot._done) return;
    boot._done = true;
    boot.style.opacity = '0';
    setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 120);
  }
  window.UN_ZONE_BOOT = { remove: removeBoot };
  installBoot();
  setTimeout(removeBoot, 1200);
  function acctKey() {
    try {
      var u = JSON.parse(localStorage.getItem('unidos_user') || 'null');
      if (u && u.email) return 'nerba_theme::' + String(u.email).toLowerCase();
    } catch (e) {}
    return LEGACY;
  }
  function get() {
    try {
      var k = acctKey();
      var v = localStorage.getItem(k);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) {}
    return 'light';
  }
  function paint(mode) {
    var dark = mode === 'dark';
    try {
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.classList.toggle('dark-mode', dark);
      if (document.body) document.body.classList.toggle('dark-mode', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch (e) {}
  }
  function set(mode) {
    mode = mode === 'dark' ? 'dark' : 'light';
    try {
      var key = acctKey();
      localStorage.setItem(key, mode);
      if (key === LEGACY) localStorage.setItem(LEGACY, mode);
      localStorage.setItem(PING, String(Date.now()));
    } catch (e) {}
    paint(mode);
    return mode;
  }
  // 1) Aplicacion inmediata (head, antes del paint)
  paint(get());
  // 2) CSS en cuanto hay head/body
  if (document.head) ensureCSS();
  else document.addEventListener('DOMContentLoaded', ensureCSS);
  document.addEventListener('DOMContentLoaded', function () { ensureCSS(); paint(get()); });
  // 3) Sincronizacion en vivo entre pestanas (misma cuenta, mismo navegador)
  window.addEventListener('storage', function (e) {
    if (!e) return;
    var current = acctKey();
    if (e.key === LEGACY && current !== LEGACY) return;
    if (e.key && e.key.indexOf('nerba_theme::') === 0 && e.key !== current) return;
    if (e.key === LEGACY || e.key === PING || (e.key && e.key.indexOf('nerba_theme::') === 0)) paint(get());
  });
  // 4) API publica (la usan Perfil y UN.theme)
  window.UN_TEMA = { key: acctKey, get: get, set: set,
    toggle: function () { return set(get() === 'dark' ? 'light' : 'dark'); },
    isDark: function () { return get() === 'dark'; } };
  window.UN_SaveTheme = function (mode) { return set(mode); };
})();
