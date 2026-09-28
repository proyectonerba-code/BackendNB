/* Grupo NERBA HIDALGO - Zona SuperAdmin (conector compartido).
   Rol aparte con interfaces propias; login compartido; el cierre de sesion
   siempre vuelve al index (UN.logout). No altera los disenos: solo datos. */
(function () {
  if (!window.UN) return;

  function q(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }
  function esc(s) { return UN.esc(s); }
  function fmtFecha(iso) {
    var p = String(iso || '').split('-');
    return (p[2] || '') + '/' + (p[1] || '') + '/' + (p[0] || '');
  }
  function waLink(tel, text) {
    var n = String(tel || '').replace(/\D/g, '');
    if (n && n[0] !== '5') n = '52' + n;
    if (!n) n = '51987654321';
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || ('Hola, le escribe el administrador de ' + (UN.brand && UN.brand.name || 'Grupo NERBA HIDALGO') + '.'));
  }
  // Pinta el usuario real donde el diseno trae demo. Solo nodos de texto.
  // Se ejecuta una sola vez por pagina (el recorrido del DOM es lo más caro).
  var DEMO_NAMES = ['Carlos Mendoza', 'Ing. Carlos Mendoza', 'Ing. Carlos Mendoza Rivas', 'Roberto Silva', 'Ing. Roberto Silva'];
  var DEMO_MAILS = ['carlos.mendoza@empresa.com', 'roberto.silva@unidosnerba.pe'];
  function paintUser() {
    if (document._saPainted) return;
    document._saPainted = true;
    var u = UN.getUser() || {};
    var map = [];
    if (u.nombre) DEMO_NAMES.forEach(function (n) { map.push([n, u.nombre]); });
    if (u.email) DEMO_MAILS.forEach(function (m) { map.push([m, u.email]); });
    if (!map.length) return;
    try {
      (function walk(n) {
        var c = n.firstChild;
        while (c) {
          var nx = c.nextSibling;
          if (c.nodeType === 3) {
            var v = c.nodeValue;
            for (var i = 0; i < map.length; i++) {
              if (v.indexOf(map[i][0]) >= 0) v = v.split(map[i][0]).join(map[i][1]);
            }
            c.nodeValue = v;
          } else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') walk(c);
          c = nx;
        }
      })(document.body);
    } catch (e) { /* nunca romper el diseno */ }
  }
  function csvDownload(name, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); }, 500);
  }
  // Nav de la zona: hrefs reales (el diseno trae # o #bitacora).
  var ZONE_NAV = {
    'Cotizaciones': '/superadmin/cotizaciones.html',
    'Catálogo': '/superadmin/catalogo.html',
    'Catalogo': '/superadmin/catalogo.html',
    'Usuarios': '/superadmin/usuarios.html',
    'Bitácora': '/superadmin/bitacora.html',
    'Bitacora': '/superadmin/bitacora.html',
  };
  // Limpia el texto del enlace (los iconos Material/SVG dejan palabras como
  // "group", "grid_view" o el contador "148" pegado al texto) para comparar.
  function cleanNavText(a) {
    var t = (a.textContent || '').replace(/[\s_]+/g, ' ').trim();
    // quita posible palabra de icono al inicio y contadores al final
    t = t.replace(/^(request_quote|inventory_2|group|assignment|history_toggle_off|description|grid_view|calculate|home|shield|person|lock|menu|close|arrow_back|chevron_right)\s+/i, '');
    return window.UN && UN.norm ? UN.norm(t) : t;
  }
  function wireNav(map) {
    map = map || ZONE_NAV;
    Array.prototype.slice.call(document.querySelectorAll('header nav a')).forEach(function (a) {
      if (a._saNav) return;
      var t = cleanNavText(a);
      var hit = null;
      Object.keys(map).forEach(function (txt) {
        if (!hit && t.indexOf(txt) >= 0) hit = txt;
      });
      if (hit) {
        a._saNav = true;
        a.setAttribute('href', map[hit]);
        a.style.cursor = 'pointer';
      }
    });
    // Red de seguridad: si algún enlace del nav superior sigue apuntando a
    // "#" al momento del clic, se resuelve por etiqueta y se navega igual.
    if (!wireNav._fb) {
      wireNav._fb = true;
      document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('header nav a') : null;
        if (!a || a._saNav) return;
        var h = a.getAttribute('href') || '';
        if (h && h !== '#' && h.charAt(0) !== '#') return;
        var t = cleanNavText(a);
        var dest = null;
        Object.keys(ZONE_NAV).forEach(function (txt) {
          if (!dest && t.indexOf(txt) >= 0) dest = ZONE_NAV[txt];
        });
        if (dest) { e.preventDefault(); location.href = dest; }
      }, true);
    }
    markActiveNav();
  }
  function markActiveNav() {
    try {
      var page = (location.pathname.split('/').pop() || '').toLowerCase();
      Array.prototype.slice.call(document.querySelectorAll('header nav a')).forEach(function (a) {
        var h = (a.getAttribute('href') || '').toLowerCase();
        // El estilo del activo vive en CSS ([aria-current="page"]): nada de
        // outlines raros por JS.
        if (h && page && h.indexOf(page) >= 0) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    } catch (e) { /* nunca romper el diseno */ }
  }
  // Header único SuperAdmin: los 5 diseños traían headers distintos
  // (fixed/sticky, paletas distintas) y se veía disparejo. Se impone uno solo,
  // el más limpio, vía JS para no tocar los diseños. Incluye chip de perfil
  // con id propio para que el mini-menú abra siempre.
  function fillHeaderUser() {
    try {
      var u = (window.UN && UN.getUser()) || {};
      var nm = document.getElementById('sa-user-name');
      if (nm && u.nombre) nm.textContent = u.nombre;
      var av = document.getElementById('sa-avatar-img');
      if (av) {
        var ini = String(u.nombre || 'SA').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || 'SA';
        var photoKey = u.email ? 'nerba_profile_photo::' + String(u.email).toLowerCase() : '';
        var savedPhoto = photoKey ? localStorage.getItem(photoKey) : '';
        var want = savedPhoto || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(ini) + '&background=b0000b&color=fff&bold=true');
        if (av.src !== want) av.src = want;
        av.alt = u.nombre || 'SuperAdmin';
      }
    } catch (e) { /* header decorativo: nada */ }
  }
  function ensureHeader() {
    // Header único global: mismo estilo en todos los roles. Cada zona
    // conserva sus links; el constructor vive en UN (unidos.js).
    if (window.UN && UN.ensureMenu) UN.ensureMenu('superadmin');
  }
  // Capa comun SuperAdmin: header único + CSS + nav + usuario + menú + badges.
  // Links del pie por zona (el header ya es único). Solo href="#" sin data-path.
  function wireFooters() {
    Array.prototype.slice.call(document.querySelectorAll('footer a')).forEach(function (a) {
      if ((a.getAttribute('href') || '') !== '#' || a.getAttribute('data-path')) return;
      var t = ((a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase());
      function set(h) { a.setAttribute('href', h); }
      if (t.indexOf('cotizaciones recibidas') >= 0 || t.indexOf('panel de cotizaciones') >= 0) set('/superadmin/cotizaciones.html');
      else if (t.indexOf('catálogo') >= 0 || t.indexOf('catalogo') >= 0) set('/superadmin/catalogo.html');
      else if (t.indexOf('usuarios') >= 0 || t.indexOf('matriz') >= 0) set('/superadmin/usuarios.html');
      else if (t.indexOf('calculador') >= 0) set('/superadmin/catalogo.html');
      else if (t.indexOf('auditor') >= 0) set('/superadmin/bitacora.html');
    });
  }
  function wireCommon(active) {
    try { ensureHeader(); } catch (e) {}
    try { ensureMobileCSS(); } catch (e) {}
    try { wireNav(); } catch (e) {}
    try { paintUser(); } catch (e) {}
    try { wireProfile(); } catch (e) {}
    try { wireFooters(); } catch (e) {}
    try { if (active) markActiveNav(); } catch (e) {}
    try { updateNavBadges(); } catch (e) {}
  }
  function ensureMobileCSS() {
    if (document.querySelector('link[data-sa-mobile]')) return;
    var l = document.createElement('link');
    l.setAttribute('rel', 'stylesheet');
    l.setAttribute('data-sa-mobile', '1');
    // Relativa a /superadmin/*.html y absoluta como respaldo.
    l.setAttribute('href', 'css/superadmin-mobile.css?v=1.0');
    l.onerror = function () { l.href = '/superadmin/css/superadmin-mobile.css?v=1.0'; };
    document.head.appendChild(l);
  }
  function wireProfile() {
    try {
      // Chip canónico primero (id propio, siempre funciona), luego el del
      // diseño de catálogo y al final la detección por texto.
      var chip = document.getElementById('sa-profile-chip') || document.getElementById('user-profile-menu-button');
      if (chip) { UN.profileMenu(chip, '/superadmin/perfil.html'); return; }
      // OJO: se busca de adentro hacia afuera. El primer match en orden de
      // documento suele ser el contenedor GRANDE del header (incluye el nav),
      // y eso hacía que cualquier clic en los botones abriera el mini-menú.
      var els = document.querySelectorAll('header div');
      for (var i = els.length - 1; i >= 0; i--) {
        var el = els[i];
        if (el.querySelector('nav')) continue; // contenedor grande: no
        if (el.closest('nav')) continue; // dentro del nav: no
        if (!el.querySelector('img')) continue;
        if (!/SUPER[\s-]?ADMIN/i.test(el.textContent || '')) continue;
        UN.profileMenu(el, '/superadmin/perfil.html');
        break;
      }
    } catch (e) { /* sin perfil: nada */ }
  }
  function toast(msg, title) {
    try {
      var t = document.getElementById('toast-feedback') || document.getElementById('toast-container');
      if (!t) { alert(msg); return; }
      var tm = document.getElementById('toast-message');
      var tt = document.getElementById('toast-title');
      if (tt && title) tt.textContent = title;
      if (tm) tm.textContent = msg;
      t.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
      clearTimeout(t._saT);
      t._saT = setTimeout(function () {
        t.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
      }, 3500);
    } catch (e) { try { alert(msg); } catch (_) {} }
  }
  // Actualiza los contadores del nav con datos reales, con caché de 60 s en
  // memoria para no pegarle al backend en cada navegación.
  var _badgeCache = { at: 0, users: null, quotes: null };
  function updateNavBadges(force) {
    // Sin badges en el header ya no hay nada que pintar: sin llamadas.
    if (!document.querySelector('[data-count]')) return;
    function setCount(key, n) {
      var done = false;
      // Header canónico: badges con data-count (no depende del texto).
      document.querySelectorAll('[data-count]').forEach(function (b) {
        if ((key === 'Usuarios' && b.getAttribute('data-count') === 'users') ||
            (key === 'Cotizaciones' && b.getAttribute('data-count') === 'quotes')) {
          b.textContent = n;
          done = true;
        }
      });
      if (done) return;
      // Respaldo (header original del diseño): match por texto limpio.
      Array.prototype.slice.call(document.querySelectorAll('header nav a')).forEach(function (a) {
        var t = cleanNavText(a);
        if (t.indexOf(key) < 0) return;
        var b = a.querySelector('.rounded-full, [data-badge]');
        if (!b) {
          // Estilos en línea a propósito: cada página trae una paleta
          // Tailwind distinta y las clases brand-* no existen en todas.
          b = document.createElement('span');
          b.setAttribute('data-badge', '1');
          b.style.cssText = 'margin-left:6px;padding:2px 7px;border-radius:9999px;font-size:11px;font-weight:800;background:#b0000b;color:#fff;line-height:1.4;';
          a.appendChild(b);
        }
        b.textContent = n;
      });
    }
    function paint() {
      if (_badgeCache.users && _badgeCache.users.length != null) {
        var vis = _badgeCache.users.filter(function (u) { return String(u.rol || '').toUpperCase() !== 'CLIENTE'; }).length;
        setCount('Usuarios', vis);
      }
      if (_badgeCache.quotes && _badgeCache.quotes.length != null) setCount('Cotizaciones', _badgeCache.quotes.length);
    }
    if (!force && Date.now() - _badgeCache.at < 60000 && (_badgeCache.users || _badgeCache.quotes)) { paint(); return; }
    Promise.all([UN.api('/api/users').catch(function () { return null; }), UN.api('/api/cotizaciones').catch(function () { return null; })]).then(function (r) {
      _badgeCache = { at: Date.now(), users: r[0], quotes: r[1] };
      paint();
    });
  }
  // Convierte tablas anchas en tarjetas en movil (<768px) sin tocar desktop:
  // etiqueta cada td con su th como data-label para el CSS .sa-responsive.
  function tableToCards(tableId) {
    var tb = document.getElementById(tableId);
    if (!tb) return;
    tb.classList.add('sa-responsive');
    var wrap = tb.closest('.overflow-x-auto, .overflow-auto');
    if (wrap) wrap.classList.add('sa-table-wrap');
    try {
      var heads = Array.prototype.slice.call(tb.querySelectorAll('thead th')).map(function (th) {
        return (th.textContent || '').trim();
      });
      if (!heads.length) return;
      Array.prototype.slice.call(tb.querySelectorAll('tbody tr')).forEach(function (tr) {
        if (tr._saLabeled) return;
        tr._saLabeled = true;
        Array.prototype.slice.call(tr.children).forEach(function (td, i) {
          if (td && !td.getAttribute('data-label') && heads[i]) td.setAttribute('data-label', heads[i]);
        });
      });
    } catch (e) { /* solo mejora visual */ }
  }
  function products() {
    return {
      list: function () { return UN.api('/api/productos'); },
      create: function (d) { return UN.api('/api/productos', { method: 'POST', body: d }); },
      update: function (id, d) { return UN.api('/api/productos/' + encodeURIComponent(id), { method: 'PUT', body: d }); },
      remove: function (id) { return UN.api('/api/productos/' + encodeURIComponent(id), { method: 'DELETE' }); },
    };
  }

  window.SA = {
    q: q, esc: esc, fmtFecha: fmtFecha, waLink: waLink,
    paintUser: paintUser, csvDownload: csvDownload, wireNav: wireNav, ZONE_NAV: ZONE_NAV,
    toast: toast, wireCommon: wireCommon, wireProfile: wireProfile, tableToCards: tableToCards, updateNavBadges: updateNavBadges,
    ensureHeader: ensureHeader, fillHeaderUser: fillHeaderUser,
    products: products,
    quotes: function () { return UN.api('/api/cotizaciones'); },
    setEstado: function (folio, estado) {
      return UN.api('/api/cotizaciones/' + encodeURIComponent(folio) + '/estado', { method: 'PUT', body: { estado: estado } });
    },
    delQuote: function (folio) {
      return UN.api('/api/cotizaciones/' + encodeURIComponent(folio), { method: 'DELETE' });
    },
    users: function () { return UN.api('/api/users'); },
    saveUser: function (email, data) {
      return UN.api('/api/users/' + encodeURIComponent(email), { method: 'PUT', body: data });
    },
    createUser: function (data) {
      return UN.api('/api/users', { method: 'POST', body: data });
    },
    deleteUser: function (email) {
      return UN.api('/api/users/' + encodeURIComponent(email), { method: 'DELETE' });
    },
    audit: function (params) {
      var qs = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      return UN.api('/api/auditoria' + (qs ? '?' + qs : ''));
    },
  };
})();
