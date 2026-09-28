/* Grupo NERBA HIDALGO - Conector con el backend real (Node.js :8080).
   No altera los disenos: solo reescribe enlaces, sesion y datos. */
(function () {
  var API = localStorage.getItem('unidos_api') || (location.origin && location.origin !== 'null' ? location.origin : 'http://localhost:8080');
  var BRAND_NAME = 'Grupo NERBA HIDALGO';
  var BRAND_SUBTITLE = 'Grupo empresarial Nerba s.a de c.v';
  var BRAND_ALT = BRAND_NAME + ' Logo';
  function normalizeText(value) {
    var text = String(value == null ? '' : value);
    try { text = text.normalize('NFKD'); } catch (e) {}
    return text
      .replace(/ß/g, 'ss')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function compactText(value) { return normalizeText(value).replace(/\s+/g, ''); }
  function searchableText(value) {
    if (Array.isArray(value)) return value.map(searchableText).join(' ');
    if (value && typeof value === 'object') return Object.keys(value).map(function (key) { return searchableText(value[key]); }).join(' ');
    return normalizeText(value);
  }
  function matchesText(value, query) {
    var needle = normalizeText(query);
    if (!needle) return true;
    var hay = searchableText(value);
    var compactHay = hay.replace(/\s+/g, '');
    if (hay.indexOf(needle) >= 0 || compactHay.indexOf(compactText(needle)) >= 0) return true;
    return needle.split(/\s+/).filter(Boolean).every(function (token) {
      return hay.indexOf(token) >= 0 || compactHay.indexOf(compactText(token)) >= 0;
    });
  }
  var BRAND_REPLACEMENTS = [
    'UNIDOS NERBA S.A. de C.V.',
    'UNIDOS NERBA S.A.C.',
    'UNIDOS NERBA INGENIERÍA',
    'Unidos Nerba Seguridad Integral S.A. de C.V.',
    'Unidos Nerba S.A. de C.V.',
    'Unidos Nerba S.A.C.',
    'UNIDOS NERBA',
    'Unidos Nerba',
    'Grupo Nerba',
    'Grupo nerba',
    'Nerba Smart Space & Hardware Control',
    'Nerba Logo',
    'SuperAdmin Nerba',
    'Admin Nerba',
  ];
  var BRAND_SUBTITLES = {
    'Seguridad Integral': BRAND_SUBTITLE,
    'seguridad Integral': BRAND_SUBTITLE,
    'seguridad INTEGRAL': BRAND_SUBTITLE,
    'COMPONENTES & HARDWARE': BRAND_SUBTITLE,
    'Componentes & Hardware': BRAND_SUBTITLE,
    'Ingeniería & Seguridad Integral': BRAND_SUBTITLE,
    'Ingenieria & Seguridad Integral': BRAND_SUBTITLE,
    'INGENIERÍA & SEGURIDAD INTEGRAL': BRAND_SUBTITLE,
    'Seguridad Integral & Videovigilancia': BRAND_SUBTITLE,
    'Seguridad Integral para Infraestructuras Estratégicas': BRAND_SUBTITLE,
    'una extension de Grupo nerba': BRAND_SUBTITLE,
  };
  var TEXT_REPAIRS = [
    ['L�deres', 'Líderes'], ['ingenier�a', 'ingeniería'], ['electr�nica', 'electrónica'], ['electr�nicos', 'electrónicos'], ['tecnolog�a', 'tecnología'],
    ['CERTIFICACI�N', 'CERTIFICACIÓN'], ['Informaci�n', 'Información'], ['informaci�n', 'información'], ['Configuraci�n', 'Configuración'], ['configuraci�n', 'configuración'],
    ['navegaci�n', 'navegación'], ['validaci�n', 'validación'], ['supervisi�n', 'supervisión'], ['Edici�n', 'Edición'], ['edici�n', 'edición'], ['Descripci�n', 'Descripción'],
    ['Publicaci�n', 'Publicación'], ['Sesi�n', 'Sesión'], ['sesi�n', 'sesión'], ['Contrase�a', 'Contraseña'], ['contrase�a', 'contraseña'], ['contrasena', 'contraseña'], ['Contrasena', 'Contraseña'], ['M�ximo', 'Máximo'], ['m�ximo', 'máximo'], ['M�nimo', 'Mínimo'], ['m�nimo', 'mínimo'],
    ['Fotograf�a', 'Fotografía'], ['fotograf�a', 'fotografía'], ['Funci�n', 'Función'], ['bot�n', 'botón'], ['Est�ndar', 'Estándar'], ['Visi�n', 'Visión'], ['ergon�micos', 'ergonómicos'], ['crom�tico', 'cromático'], ['Dise�o', 'Diseño'], ['dise�o', 'diseño'],
    ['t�cnico', 'técnico'], ['t�cnica', 'técnica'], ['T�cnico', 'Técnico'], ['T�cnica', 'Técnica'], ['operaci�n', 'operación'], ['Operaci�n', 'Operación'], ['p�blico', 'público'], ['P�blico', 'Público'],
    ['Protanop�a', 'Protanopía'], ['Deuteranop�a', 'Deuteranopía'], ['Tritanop�a', 'Tritanopía'], ['d�ficit', 'déficit'], ['Din�micas', 'Dinámicas'], ['criptogr�fica', 'criptográfica'], ['criptogr�fico', 'criptográfico'], ['Administraci�n', 'Administración'], ['atenci�n', 'atención'], ['protecci�n', 'protección'], ['autenticaci�n', 'autenticación'], ['identificaci�n', 'identificación'], ['selecci�n', 'selección'],
    ['par�metros', 'parámetros'], ['seg�n', 'según'], ['recepci�n', 'recepción'], ['Tama�o', 'Tamaño'], ['tama�o', 'tamaño'], ['iluminaci�n', 'iluminación'], ['m�vil', 'móvil'], ['Raz�n', 'Razón'], ['Tel�fono', 'Teléfono'], ['Electr�nico', 'Electrónico'], ['animaci�n', 'animación'], ['Tipogr�fica', 'Tipográfica'], ['n�meros', 'números'], ['matr�cula', 'matrícula'], ['Peque�o', 'Pequeño'], ['PREVISUALIZACI�N', 'PREVISUALIZACIÓN'], ['Previsualizaci�n', 'Previsualización'], ['leer�n', 'leerán'], ['bit�coras', 'bitácoras'], ['detecci�n', 'detección'], ['el�ctrico', 'eléctrico'], ['El�ctrico', 'Eléctrico'], ['Crom�tica', 'Cromática'], ['cr�ticas', 'críticas'], ['r�pida', 'rápida'], ['discriminaci�n', 'discriminación'], ['D�ficit', 'Déficit'], ['Navegaci�n', 'Navegación'], ['cin�ticas', 'cinéticas'], ['acci�n', 'acción'], ['Sincronizaci�n', 'Sincronización'], ['autom�tica', 'automática'], ['D�AS', 'DÍAS'], ['Biom�trico', 'Biométrico'], ['Automatizaci�n', 'Automatización'], ['Telemetr�a', 'Telemetría'], ['Qui�nes', 'Quiénes'], ['L�NEA', 'LÍNEA'], ['Ju�rez', 'Juárez'], ['M�xico', 'México'], ['M�xi', 'Méxi'], ['AI � Zona', 'AI · Zona'], ['� 2025', '© 2025'], ['� 2026', '© 2026'], ['�Desea', '¿Desea'], ['�rea', 'Área'], ['As�', 'Así'], ['�mbar', 'Ámbar'], ['�ndice', 'Índice'], ['Cat�logo', 'Catálogo'], ['cat�logo', 'catálogo'], ['L�deres', 'Líderes'], ['administraci�n', 'administración'], ['Administraci�n', 'Administración'], ['emisi�n', 'emisión'], ['sincronizaci�n', 'sincronización'], ['auditor�a', 'auditoría'], ['Auditor�a', 'Auditoría'], ['Per�', 'Perú'], ['visualizar�n', 'visualizarán'], ['instalaci�n', 'instalación'], ['cr�tica', 'crítica'], ['comunicaci�n', 'comunicación'], ['generaci�n', 'generación'], ['gesti�n', 'gestión'], ['l�nea', 'línea'], ['L�nea', 'Línea'], ['recepci�n', 'recepción'], ['protecci�n', 'protección'], ['supervisi�n', 'supervisión'], ['SUPERVISI�N', 'SUPERVISIÓN'], ['tecnolog�a', 'tecnología'], ['el�ctrica', 'eléctrica'], ['El�ctrica', 'Eléctrica']
  ];
  function repairText(value) {
    var text = String(value == null ? '' : value);
    TEXT_REPAIRS.forEach(function (item) { text = text.split(item[0]).join(item[1]); });
    return text;
  }
  function wrapTextApis() {
    ['alert', 'confirm', 'prompt'].forEach(function (name) {
      if (typeof window[name] !== 'function') return;
      var original = window[name];
      window[name] = function () {
        var args = Array.prototype.slice.call(arguments).map(repairText);
        return original.apply(window, args);
      };
    });
    if (typeof window.showToast === 'function') {
      var originalToast = window.showToast;
      window.showToast = function (message, title) { return originalToast.call(this, repairText(message), repairText(title)); };
    }
  }
  function brandText(value) {
    var text = repairText(value);
    text = text.replace(/\bGRUPO NERBA\b(?! HIDALGO)/gi, BRAND_NAME);
    BRAND_REPLACEMENTS.forEach(function (item) {
      text = text.split(item).join(BRAND_NAME);
    });
    return text;
  }
  function applyBrand() {
    if (!document.body) return;
    (function walk(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 3) {
          var value = child.nodeValue;
          var normalized = value.replace(/\s+/g, ' ').trim();
          var replacement = BRAND_SUBTITLES[normalized];
          if (normalized === 'NERBA' || normalized === 'Nerba') value = BRAND_NAME;
          else if (replacement) value = value.replace(normalized, replacement);
          var branded = brandText(value);
          if (branded !== value) child.nodeValue = branded;
        } else if (child.nodeType === 1 && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE' && child.tagName !== 'NOSCRIPT') {
          ['alt', 'aria-label', 'title', 'placeholder'].forEach(function (attribute) {
            if (!child.hasAttribute(attribute)) return;
            var current = child.getAttribute(attribute);
            var nextValue = brandText(current);
            if (nextValue !== current) child.setAttribute(attribute, nextValue);
          });
          walk(child);
        }
        child = next;
      }
    })(document.body);
    document.title = 'GRUPO NERBA HIDALGO';
    ['alt', 'aria-label', 'title', 'placeholder'].forEach(function (attribute) {
      var el = document.querySelector('[' + attribute + ']');
      if (el) el.setAttribute(attribute, brandText(el.getAttribute(attribute)));
    });
  }
  function watchBrand() {
    if (window.__unBrandObserver || !window.MutationObserver || !document.body) return;
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; applyBrand(); }, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__unBrandObserver = observer;
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = localStorage.getItem('unidos_token');
    if (t) headers['Authorization'] = 'Bearer ' + t;
    var res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      var err = new Error(data.error || ('Error ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function getUser() {
    try {
      var user = JSON.parse(localStorage.getItem('unidos_user') || 'null');
      if (user && user.lastLogin) {
        user.lastLogin = { fecha: user.lastLogin.fecha || '', hora: user.lastLogin.hora || '' };
      }
      return user;
    } catch (e) { return null; }
  }
  function setSession(token, u) {
    if (token) localStorage.setItem('unidos_token', token);
    if (u) localStorage.setItem('unidos_user', JSON.stringify(u));
    // Hereda el tema de LA CUENTA desde el servidor: solo en login fresco
    // o si aun no hay preferencia local. Nunca pisa un toggle reciente
    // con un dato viejo del servidor.
    try {
      if (u && (u.tema === 'dark' || u.tema === 'light') && window.UN_TEMA) {
        var fresh = false;
        try {
          fresh = sessionStorage.getItem('un_fresh_login') === '1';
          sessionStorage.removeItem('un_fresh_login');
        } catch (e0) {}
        var has = false;
        try { has = !!localStorage.getItem(UN_TEMA.key()); } catch (e1) {}
        if (fresh || !has) UN_TEMA.set(u.tema);
      }
    } catch (e) {}
  }
  function profilePhotoKey(user) {
    var u = user || getUser() || {};
    return u && u.email ? 'nerba_profile_photo::' + String(u.email).toLowerCase() : '';
  }
  function profileInitials(user) {
    return String((user && user.nombre) || 'UN').trim().split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0); }).join('').toUpperCase() || 'UN';
  }
  function paintProfileAvatars() {
    var u = getUser() || {};
    var key = profilePhotoKey(u);
    var photo = '';
    try { photo = key ? (localStorage.getItem(key) || '') : ''; } catch (e) {}
    var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profileInitials(u)) + '&background=b0000b&color=fff&bold=true';
    Array.prototype.slice.call(document.querySelectorAll('#unZh-avatar, #profile-photo')).forEach(function (img) {
      img.src = photo || fallback;
      img.alt = u.nombre || 'Usuario';
    });
  }
  function getProfilePhoto() {
    var key = profilePhotoKey();
    if (!key) return '';
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function setProfilePhoto(value) {
    var key = profilePhotoKey();
    if (!key || typeof value !== 'string' || value.indexOf('data:image/') !== 0) return false;
    try { localStorage.setItem(key, value); } catch (e) { return false; }
    paintProfileAvatars();
    return true;
  }
  function clearProfilePhoto() {
    var key = profilePhotoKey();
    if (key) { try { localStorage.removeItem(key); } catch (e) {} }
    paintProfileAvatars();
  }
  function clearLocalSession() {
    try {
      localStorage.removeItem('unidos_token');
      localStorage.removeItem('unidos_user');
      sessionStorage.removeItem('un_fresh_login');
    } catch (e) {}
    try {
      document.documentElement.classList.remove('dark', 'dark-mode');
      if (document.body) document.body.classList.remove('dark-mode');
    } catch (e) {}
  }
  var loggingOut = false;
  var logoutModalOpen = false;
  function confirmLogout() {
    if (logoutModalOpen) return Promise.resolve(false);
    logoutModalOpen = true;
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var dark = document.documentElement.classList.contains('dark');
      var oldOverflow = document.body ? document.body.style.overflow : '';
      var overlay = document.createElement('div');
      overlay.id = 'un-logout-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'un-logout-title');
      overlay.setAttribute('aria-describedby', 'un-logout-description');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;background:rgba(8,15,28,.62);backdrop-filter:blur(5px);opacity:1;transition:opacity .16s ease';
      var dialog = document.createElement('div');
      dialog.setAttribute('tabindex', '-1');
      dialog.style.cssText = 'width:min(100%,420px);padding:24px;border:1px solid ' + (dark ? '#334155' : '#e2e8f0') + ';border-radius:18px;background:' + (dark ? '#111827' : '#ffffff') + ';color:' + (dark ? '#f8fafc' : '#0f172a') + ';box-shadow:0 24px 70px rgba(2,6,23,.32);transition:transform .16s ease,opacity .16s ease';
      dialog.innerHTML = '<div style="display:flex;align-items:flex-start;gap:14px">' +
        '<img src="/assets/nerba-isotipo.svg" width="46" height="46" alt="NERBA" style="display:block;width:46px;height:46px;object-fit:contain;border-radius:13px;background:#fff;flex-shrink:0">' +
        '<div style="flex:1;min-width:0"><div style="display:inline-flex;align-items:center;padding:3px 7px;border-radius:5px;background:#fef2f2;color:#b91c1c;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Sesión segura</div>' +
        '<h2 id="un-logout-title" style="margin:0;font-size:20px;line-height:1.2;font-weight:800;letter-spacing:-.02em">¿Cerrar sesión?</h2>' +
        '<p id="un-logout-description" style="margin:7px 0 0;font-size:13px;line-height:1.5;color:' + (dark ? '#cbd5e1' : '#64748b') + '">Se cerrará tu sesión actual de forma segura en este dispositivo.</p></div>' +
        '<button type="button" id="un-logout-x" aria-label="Cerrar" style="width:32px;height:32px;border:0;border-radius:9px;background:' + (dark ? '#1e293b' : '#f1f5f9') + ';color:' + (dark ? '#cbd5e1' : '#64748b') + ';font-size:20px;line-height:1;cursor:pointer;flex-shrink:0">×</button></div>' +
        '<div style="display:flex;flex-direction:column;gap:9px;margin-top:22px">' +
        '<button type="button" id="un-logout-cancel" style="width:100%;padding:11px 14px;border:1px solid ' + (dark ? '#334155' : '#cbd5e1') + ';border-radius:10px;background:' + (dark ? '#0b1220' : '#f8fafc') + ';color:' + (dark ? '#e2e8f0' : '#334155') + ';font:800 12px Inter,system-ui,sans-serif;cursor:pointer">Cancelar</button>' +
        '<button type="button" id="un-logout-confirm" style="width:100%;padding:11px 14px;border:0;border-radius:10px;background:#b0000b;color:#fff;font:800 12px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 14px rgba(176,0,11,.2)">Cerrar sesión</button></div>';
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      var cancel = document.getElementById('un-logout-cancel');
      var accept = document.getElementById('un-logout-confirm');
      var close = function (result) {
        if (!overlay.parentNode) return;
        overlay.style.opacity = '0';
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = oldOverflow;
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 160);
        logoutModalOpen = false;
        resolve(!!result);
        if (result && opener && opener.focus) opener.focus();
      };
      var onKey = function (event) { if (event.key === 'Escape') close(false); };
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      cancel.addEventListener('click', function () { close(false); });
      accept.addEventListener('click', function () { close(true); });
      overlay.addEventListener('click', function (event) { if (event.target === overlay) close(false); });
      window.setTimeout(function () { accept.focus(); }, 30);
    });
  }
  async function logout(skipConfirm) {
    if (loggingOut) return;
    if (!skipConfirm) {
      var confirmed = await confirmLogout();
      if (!confirmed) return;
    }
    loggingOut = true;
    var token = localStorage.getItem('unidos_token');
    clearLocalSession();
    if (token) {
      try {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
        await fetch(API + '/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: '{}', keepalive: true, signal: controller ? controller.signal : undefined });
        if (timer) clearTimeout(timer);
      } catch (e) {}
    }
    location.replace('/index.html');
  }
  function requestLogout(event) {
    if (loggingOut) return;
    var control = event && event.currentTarget;
    confirmLogout().then(function (confirmed) {
      if (!confirmed) return;
      if (control) {
        control.disabled = true;
        control.setAttribute('aria-busy', 'true');
      }
      logout(true);
    });
  }
  function requireAuth(next) {
    if (!localStorage.getItem('unidos_token')) {
      location.href = '/login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
      return false;
    }
    return true;
  }
  function requireStaff(next) {
    var u = getUser();
    if (!localStorage.getItem('unidos_token')) {
      location.href = '/login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
      return false;
    }
    if (!u || (u.rol !== 'ADMIN' && u.rol !== 'SUPERADMIN')) {
      location.href = '/index.html';
      return false;
    }
    return true;
  }
  // Zona de SuperAdmin: rol aparte con interfaces propias (bitacora, usuarios...).
  // Comparte login; el cierre de sesion siempre vuelve al index.
  function requireSuperAdmin(next) {
    var u = getUser();
    if (!localStorage.getItem('unidos_token')) {
      location.href = '/login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
      return false;
    }
    if (!u || u.rol !== 'SUPERADMIN') {
      var back = '/index.html';
      if (u && u.rol === 'ADMIN') back = '/admin/catalogo.html';
      else if (u && u.rol === 'PROYECTOS_ESPECIALES') back = '/especiales/gestion.html';
      location.href = back;
      return false;
    }
    return true;
  }
  // Zona de Proyectos Especiales: rol aparte del admin y del cliente.
  // El login es compartido; el cierre de sesion siempre vuelve al index.
  function requireEspeciales(next) {
    var u = getUser();
    if (!localStorage.getItem('unidos_token')) {
      location.href = '/login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
      return false;
    }
    if (!u || (u.rol !== 'PROYECTOS_ESPECIALES' && u.rol !== 'SUPERADMIN')) {
      location.href = (u && u.rol === 'ADMIN') ? '/admin/catalogo.html' : ((u && u.rol === 'SUPERADMIN') ? '/superadmin/catalogo.html' : '/index.html');
      return false;
    }
    return true;
  }
  // Zona de Productos Electrónicos: espejo del admin, pero su bandeja trae
  // únicamente cotizaciones de productos electrónicos. Login compartido.
  function requireElec(next) {
    var u = getUser();
    if (!localStorage.getItem('unidos_token')) {
      location.href = '/login.html' + (next ? '?next=' + encodeURIComponent(next) : '');
      return false;
    }
    if (!u || (u.rol !== 'PRODUCTOS_ELECTRONICOS' && u.rol !== 'SUPERADMIN')) {
      location.href = (u && u.rol === 'ADMIN') ? '/admin/catalogo.html' : ((u && u.rol === 'PROYECTOS_ESPECIALES') ? '/especiales/gestion.html' : '/index.html');
      return false;
    }
    return true;
  }
  function money(n) {
    return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Descarga real del presupuesto como documento imprimible (se puede guardar como PDF desde el navegador)
  var UN_LOGO = 'data:image/png;base64,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';
  function fechaDoc(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '—');
  }
  // Al imprimir desde la pagina (no desde el PDF) solo sale el documento:
  // sin menus, sin footer, sin chatbot y sin repetir el fondo. Solo aplica
  // cuando hay un visor de cotizacion abierto (si no, la pagina imprime normal).
  function installPrintGuard() {
    if (document.getElementById('un-print-guard')) return;
    // [selector del visor, selector de "esta abierto"]
    var visores = [
      ['#un-quote-viewer', '#un-quote-viewer'],
      ['#pdfModal', '#pdfModal:not(.pointer-events-none)'],
      ['#modal-pdf-oficial', '#modal-pdf-oficial:not(.hidden)'],
      ['#modal-pdf', '#modal-pdf:not(.hidden)'],
      ['#un-print-area', '#un-print-area'],
    ];
    var plano = 'display:block!important;position:static!important;inset:auto!important;padding:0!important;' +
      'margin:0!important;background:#fff!important;backdrop-filter:none!important;box-shadow:none!important;' +
      'max-height:none!important;height:auto!important;overflow:visible!important;width:100%!important;border:0!important';
    var css = '@media print{html,body{background:#fff!important}';
    visores.forEach(function (v) {
      css += 'body:has(' + v[1] + ')>*:not(' + v[0] + '){display:none!important}' +
        'body:has(' + v[1] + ') ' + v[0] + '{' + plano + '}' +
        'body:has(' + v[1] + ') ' + v[0] + ' button,body:has(' + v[1] + ') ' + v[0] + ' [data-x],' +
        'body:has(' + v[1] + ') ' + v[0] + ' [data-dl],body:has(' + v[1] + ') ' + v[0] + ' [data-print]{display:none!important}';
    });
    css += '}';
    var st = document.createElement('style');
    st.id = 'un-print-guard';
    st.textContent = css;
    document.head.appendChild(st);
  }
  // Documento oficial con formato profesional (el que ven todos los PDF).
  // Hoja A4 real: cabe en 1-2 páginas, sin elementos de la web (chat, menús).
  function quoteDoc(c) {
    var f = fechaDoc(c.fecha);
    var items = Array.isArray(c.items) && c.items.length ? c.items : [];
    var totalU = items.reduce(function (n, i) { return n + (parseInt(i && i.qty, 10) || 1); }, 0);
    var detalle = String(c.descripcion || '').trim();
    // Si los productos ya van en tabla, la primera linea se repite en el texto.
    var filas = items.map(function (it, i) {
      var q = parseInt(it && it.qty, 10) || 1;
      var nom = String((it && it.title) || 'Componente').trim();
      var desc = String((it && it.desc) || '').trim();
      return '<tr><td class="c-n">' + (i + 1) + '</td><td><b>' + esc(nom) + '</b>' +
        (desc ? '<span class="c-d">' + esc(desc) + '</span>' : '') + '</td>' +
        '<td class="c-q">' + q + '</td><td class="c-q">' + (q === 1 ? 'unid.' : 'unid.') + '</td></tr>';
    }).join('');
    var tabla = filas
      ? '<table class="tb"><thead><tr><th class="c-n">#</th><th>Componente / producto solicitado</th><th class="c-q">Cant.</th><th class="c-u">Unidad</th></tr></thead><tbody>' + filas + '</tbody></table>' +
        '<div class="tfoot">Total de artículos: <b>' + items.length + '</b> · Total de unidades: <b>' + totalU + '</b></div>'
      : '<div class="box">' + esc(detalle || '—') + '</div>';
    var soloTexto = '';
    if (items.length) {
      var nt = String(c.notas || '').trim();
      if (nt) soloTexto = '<div class="sec"><h3>4. Notas y observaciones</h3><div class="box">' + esc(nt) + '</div></div>';
    }
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(c.folio) + ' - ' + esc(BRAND_NAME) + '</title>' +
      '<style>' +
      '@page{size:A4;margin:13mm 12mm}' +
      '*{box-sizing:border-box}' +
      'html,body{margin:0;padding:0;background:#fff;color:#0f172a}' +
      'body{font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.sheet{width:100%;max-width:186mm;margin:0 auto}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}' +
      '.brand{display:flex;align-items:center;gap:9px}' +
      '.brand img{height:34px;width:auto;object-fit:contain}' +
      '.brand b{display:block;font-size:14px;color:#0b1c30;letter-spacing:.3px;line-height:1.15}' +
      '.brand small{display:block;font-size:8px;color:#b0000b;letter-spacing:1.6px;font-weight:700;text-transform:uppercase}' +
      '.req{text-align:right;flex-shrink:0}' +
      '.pill{display:inline-block;border:1px solid #f0c4bf;background:#fef4f3;color:#b0000b;border-radius:5px;padding:3px 10px;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase}' +
      '.folio{font-size:15px;font-weight:800;color:#0b1c30;margin-top:5px;letter-spacing:.3px}' +
      '.fem{font-size:9.5px;color:#64748b;margin-top:2px}' +
      '.rule{border:none;border-top:2px solid #b0000b;margin:9px 0 12px}' +
      '.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;break-inside:avoid}' +
      '.card{border:1px solid #e2e8f0;border-radius:7px;padding:9px 11px;background:#fbfcfe}' +
      '.card h4{margin:0 0 7px;font-size:9px;letter-spacing:1.1px;color:#b0000b;font-weight:800;text-transform:uppercase}' +
      '.kv{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;padding:2.5px 0;border-bottom:1px dotted #e2e8f0}' +
      '.kv:last-child{border-bottom:0}' +
      '.kv i{font-style:normal;color:#64748b;flex-shrink:0}' +
      '.kv b{color:#0b1c30;font-weight:700;text-align:right;word-break:break-word}' +
      '.sec{margin:0 0 12px;break-inside:avoid}' +
      '.sec h3{font-size:9.5px;margin:0 0 7px;padding:5px 9px;background:#f1f5f9;border-left:3px solid #b0000b;border-radius:0 5px 5px 0;letter-spacing:.9px;text-transform:uppercase;color:#0b1c30}' +
      '.box{border:1px solid #e2e8f0;border-radius:7px;padding:9px 11px;font-size:10.5px;line-height:1.6;white-space:pre-line;background:#f8fafc}' +
      '.tb{width:100%;border-collapse:collapse;font-size:10.5px}' +
      '.tb th{background:#0f172a;color:#fff;font-size:8.5px;letter-spacing:.8px;text-transform:uppercase;padding:6px 8px;text-align:left}' +
      '.tb th.c-n{width:8mm}.tb th.c-q{width:16mm}.tb th.c-u{width:16mm}' +
      '.tb td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}' +
      '.tb tbody tr:nth-child(even) td{background:#f8fafc}' +
      '.tb td.c-n,.tb td.c-q{text-align:center;color:#64748b}' +
      '.c-d{display:block;font-size:9px;color:#64748b;margin-top:1px}' +
      '.tfoot{text-align:right;font-size:9.5px;color:#64748b;margin-top:5px;padding-right:2px}' +
      '.foot{margin-top:14px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;font-size:8.5px;color:#94a3b8;break-inside:avoid}' +
      '@media print{body{font-size:10.5px}.sheet{max-width:none}}' +
      '</style></head><body><div class="sheet">' +
      '<div class="head"><div class="brand"><img src="' + UN_LOGO + '" alt="' + esc(BRAND_ALT) + '">' +
      '<div><b>' + esc(BRAND_NAME) + '</b><small>' + esc(BRAND_SUBTITLE) + '</small></div></div>' +
      '<div class="req"><span class="pill">Solicitud de cotización</span>' +
      '<div class="folio">' + esc(c.folio) + '</div>' +
      '<div class="fem">Fecha de emisión: <b>' + esc(f) + '</b>' + (c.validez ? ' · Válida hasta ' + esc(fechaDoc(c.validez)) : '') + '</div></div></div>' +
      '<hr class="rule">' +
      '<div class="cards">' +
      '<div class="card"><h4>Datos del solicitante</h4>' +
      '<div class="kv"><i>Titular</i><b>' + esc(c.nombre || '—') + '</b></div>' +
      '<div class="kv"><i>Teléfono</i><b>' + esc(c.telefono || '—') + '</b></div>' +
      '<div class="kv"><i>Correo</i><b>' + esc(c.email || '—') + '</b></div>' +
      (c.telefonoSec ? '<div class="kv"><i>Teléfono alt.</i><b>' + esc(c.telefonoSec) + '</b></div>' : '') +
      '</div>' +
      '<div class="card"><h4>Ubicación del inmueble</h4>' +
      '<div class="kv"><i>Tipo</i><b>' + esc(c.tipoInmueble || '—') + '</b></div>' +
      '<div class="kv"><i>Distrito / Ciudad</i><b>' + esc(c.distrito || '—') + '</b></div>' +
      '<div class="kv"><i>Dirección</i><b>' + esc(c.direccion || '—') + '</b></div>' +
      '<div class="kv"><i>Referencia</i><b>' + esc(c.referencia || '—') + '</b></div>' +
      '</div></div>' +
      '<div class="sec"><h3>' + (items.length ? '3. Artículos y componentes cotizados' : '3. Especificación técnica solicitada') + '</h3>' + tabla + '</div>' +
      soloTexto +
      '<div class="foot"><span>Documento generado por ' + esc(BRAND_NAME) + '. No válido para situación fiscal.</span>' +
      '<span>' + esc(c.folio) + ' · ' + esc(f) + '</span></div>' +
      '</div><script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script></body></html>';
  }
  // Ficha imprimible de solicitud de mantenimiento
  function downloadMant(m, viewOnly) {
    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(m.id) + ' - ' + esc(BRAND_NAME) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;max-width:720px;margin:32px auto;color:#0b1c30;padding:0 16px}' +
      'h1{color:#b0000b}.box{background:#f4f6fb;border-radius:10px;padding:16px;margin:16px 0}</style></head><body>' +
      '<h1>' + esc(BRAND_NAME) + ' · Ficha de mantenimiento</h1>' +
      '<div class="box"><b>Folio:</b> ' + esc(m.id) + ' &nbsp;·&nbsp; <b>Fecha:</b> ' + esc(m.fecha) +
      ' &nbsp;·&nbsp; <b>Estado:</b> ' + esc(m.estado) + (m.folio ? ' &nbsp;·&nbsp; <b>Ref:</b> ' + esc(m.folio) : '') + '</div>' +
      '<div class="box"><b>Solicitante:</b> ' + esc(m.nombre) + ' (' + esc(m.email) + ') · ' + esc(m.telefono || '—') +
      (m.direccion ? '<br><b>Dirección:</b> ' + esc(m.direccion) : '') +
      '<br><b>Detalle:</b> ' + esc(m.descripcion || '—') + '</div>' +
      '<p><small>Documento generado por el backend ' + esc(BRAND_NAME) + '. Para PDF: imprimir y elegir "Guardar como PDF".</small></p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    // Siempre vista de impresion: el PDF real se obtiene con "Guardar como PDF".
    window.open(url, '_blank');
  }
  function downloadQuote(c, viewOnly) {
    printQuote(c);
  }
  function printQuote(c) {
    var blob = new Blob([quoteDoc(c)], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    // Vista de impresion: el PDF real se obtiene con "Guardar como PDF".
    window.open(url, '_blank');
  }
  // Visor oficial dentro de la pagina (el de la imagen de referencia).
  // Al abrir cierra cualquier otro modal de expediente para que nunca se apilen.
  function closeQuoteViewer() {
    var x = document.getElementById('un-quote-viewer');
    if (x) x.parentNode.removeChild(x);
    document.querySelectorAll('[id^="modal-cot-"], #pdfModal, #modal-pdf-oficial').forEach(function (el) {
      el.classList.add('hidden');
      el.classList.remove('flex');
    });
    document.body.style.overflow = '';
  }
  function viewQuote(c) {
    if (!c) return;
    closeQuoteViewer();
    document.body.style.overflow = 'hidden';
    var f = fechaDoc(c.fecha);
    var m = document.createElement('div');
    m.id = 'un-quote-viewer';
    m.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6';
    m.innerHTML =
      '<div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">' +
      '<div class="bg-slate-900 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">' +
      '<div class="flex items-center gap-2.5 min-w-0"><span class="bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-1 rounded-md shrink-0">PDF</span>' +
      '<div class="min-w-0"><p class="text-white text-sm font-bold truncate">' + esc(c.folio) + '.pdf <span class="ml-1 align-middle text-[10px] font-semibold bg-white/10 text-slate-300 px-2 py-0.5 rounded">Documento Oficial</span></p>' +
      '<p class="text-[11px] text-slate-400 truncate">Vista previa digital lista para descarga e impresión</p></div></div>' +
      '<div class="flex items-center gap-2 shrink-0">' +
      '<button class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition" data-dl>Descargar PDF</button>' +
      '<button class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition" data-print>Imprimir</button>' +
      '<button class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition" data-x>✕</button>' +
      '</div></div>' +
      '<div class="overflow-y-auto p-4 sm:p-6 bg-slate-200/70"><div class="bg-white rounded-xl shadow p-5 sm:p-8 max-w-[700px] mx-auto">' +
      '<div class="flex items-start justify-between gap-4"><div class="flex items-center gap-2.5">' +
      '<img src="/assets/logo.png" alt="' + esc(BRAND_ALT) + '" style="height:36px;width:auto;object-fit:contain">' +
      '<div><p class="font-extrabold text-slate-900 tracking-tight leading-none">' + esc(BRAND_NAME) + '</p>' +
      '<p class="text-[9px] font-bold tracking-[0.2em] text-red-700">' + esc(BRAND_SUBTITLE) + '</p></div></div>' +
      '<div class="text-right shrink-0"><span class="inline-block border border-red-200 text-red-700 rounded-md px-3 py-1 text-[11px] font-bold tracking-wide">SOLICITUD DE COTIZACIÓN</span>' +
      '<p class="text-[11px] text-slate-500 mt-1">Fecha de Emisión: <b class="text-slate-800">' + esc(f) + '</b></p></div></div>' +
      '<hr style="border:none;border-top:2px solid #b0000b;margin:14px 0 16px">' +
      '<h3 style="font-size:12px;margin:0 0 8px;padding:6px 10px;background:#f1f5f9;border-left:4px solid #b0000b;border-radius:0 6px 6px 0">1. INFORMACIÓN DEL SOLICITANTE</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12.5px;margin-bottom:14px">' +
      '<div><span style="color:#64748b">Titular / Razón Social: </span><b>' + esc(c.nombre) + '</b></div>' +
      '<div><span style="color:#64748b">Teléfono de Contacto: </span><b>' + esc(c.telefono) + '</b></div>' +
      '<div style="grid-column:1/-1"><span style="color:#64748b">Correo Notificaciones: </span>' + esc(c.email) + '</div>' +
      '<div><span style="color:#64748b">Teléfono Secundario: </span>' + esc(c.telefonoSec || '—') + '</div>' +
      '</div>' +
      '<h3 style="font-size:12px;margin:0 0 8px;padding:6px 10px;background:#f1f5f9;border-left:4px solid #b0000b;border-radius:0 6px 6px 0">2. UBICACIÓN E INMUEBLE A PROTEGER</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12.5px;margin-bottom:14px">' +
      '<div><span style="color:#64748b">Tipo de Inmueble: </span>' + esc(c.tipoInmueble) + '</div>' +
      '<div><span style="color:#64748b">Distrito / Ciudad: </span>' + esc(c.distrito || '—') + '</div>' +
      '<div style="grid-column:1/-1"><span style="color:#64748b">Dirección Exacta: </span>' + esc(c.direccion) + '</div>' +
      '<div style="grid-column:1/-1"><span style="color:#64748b">Referencia de Acceso: </span>' + esc(c.referencia || '—') + '</div>' +
      '</div>' +
      '<h3 style="font-size:12px;margin:0 0 8px;padding:6px 10px;background:#f1f5f9;border-left:4px solid #b0000b;border-radius:0 6px 6px 0">3. ESPECIFICACIÓN TÉCNICA SOLICITADA POR EL CLIENTE</h3>' +
      '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.65;white-space:pre-line;background:#f8fafc;margin-bottom:14px">' + esc(c.descripcion || '—') + '</div>' +
      '<h3 style="font-size:12px;margin:0 0 8px;padding:6px 10px;background:#f1f5f9;border-left:4px solid #b0000b;border-radius:0 6px 6px 0">4. REGISTRO DE FOTOS DE REFERENCIA</h3>' +
      '<p style="font-size:12px;color:#94a3b8">Sin fotografías adjuntas en el expediente digital.</p>' +
      '</div></div>' +
      '<div class="px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">' +
      '<p class="text-[11px] text-slate-400 flex items-center gap-1.5">Documento no válido para situación fiscal.</p>' +
      '<div class="flex items-center gap-2 shrink-0">' +
      '<button class="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-bold transition" data-x>Cerrar Visor</button>' +
      '<button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow" data-dl>Descargar PDF Ahora</button>' +
      '</div></div></div>';
    document.body.appendChild(m);
    window.__lastViewQuote = c;
    function shut() { closeQuoteViewer(); }
    m.addEventListener('click', function (e) { if (e.target === m) shut(); });
    m.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', shut); });
    m.querySelectorAll('[data-dl], [data-print]').forEach(function (b) { b.addEventListener('click', function () { printQuote(window.__lastViewQuote); }); });
    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape') { shut(); document.removeEventListener('keydown', esc2); }
    });
  }

  // Sincroniza el catalogo visible con lo publicado por el admin.
  // Clona tarjetas exactas del diseno; si no hay red, el diseno queda intacto.
  async function syncCatalog(preloaded) {
    if (typeof PRODUCTS_DATA === 'undefined') return;
    var grid = document.getElementById('catalog-grid');
    if (!grid) return;
    var list;
    try { list = preloaded || await api('/api/productos'); } catch (e) { return; }
    // Sin respuesta no se toca nada (el diseno queda intacto); con respuesta
    // (aunque venga vacia) el visible debe ser espejo exacto del admin.
    if (!list) return;
    Object.keys(PRODUCTS_DATA).forEach(function (k) { delete PRODUCTS_DATA[k]; });
    list.forEach(function (p) { PRODUCTS_DATA[p.id] = p; });
    __catSig = catSignature(list);
    function norm(s) { return normalizeText(s); }
    var cards = Array.prototype.slice.call(grid.children).filter(function (el) {
      return el.querySelector && el.querySelector('h3');
    });
    var used = {};
    cards.forEach(function (card) {
      if (card.getAttribute('data-id')) { used[card.getAttribute('data-id')] = card; return; }
      var t = card.querySelector('h3') ? norm(card.querySelector('h3').textContent) : '';
      var hit = null;
      list.forEach(function (p) { if (!hit && norm(p.title) === t) hit = p; });
      if (hit && !used[hit.id]) { card.setAttribute('data-id', hit.id); used[hit.id] = card; }
    });
    var byId = {};
    list.forEach(function (p) { byId[p.id] = p; });
    // Filtro activo actual (para no regresarlo a "todos" en cada actualizacion)
    var keepCat = 'todos';
    if (typeof filterCatalog === 'function') {
      var fbtns = document.querySelectorAll('.catalog-filter-btn');
      for (var fi = 0; fi < fbtns.length; fi++) {
        if (fbtns[fi].classList && fbtns[fi].classList.contains('bg-primary')) {
          var mo = String(fbtns[fi].getAttribute('onclick') || '').match(/filterCatalog\('([^']+)'/);
          if (mo) keepCat = mo[1];
          break;
        }
      }
    }
    // Se retira todo lo que el admin quito: con data-id huerfano, sin match
    // por titulo, o duplicado del mismo producto (el primero gana).
    cards.forEach(function (card) {
      var id = card.getAttribute('data-id');
      if (id) { if (!byId[id]) grid.removeChild(card); return; }
      var t = card.querySelector('h3') ? norm(card.querySelector('h3').textContent) : '';
      var hit = null;
      list.forEach(function (p) { if (!hit && norm(p.title) === t) hit = p; });
      if (!hit || (used[hit.id] && used[hit.id] !== card)) grid.removeChild(card);
    });
    var tpl = grid.querySelector('[data-id]') || cards[0];
    list.forEach(function (p) {
      var card = grid.querySelector('[data-id="' + p.id + '"]');
      if (card) { paintCard(card, p); return; }
      if (!tpl) return;
      var el = tpl.cloneNode(true);
      paintCard(el, p);
      el.removeAttribute('style');
      grid.appendChild(el);
    });
    // Se reaplica el filtro que tenia el usuario (o todos si su categoria ya no existe)
    if (typeof filterCatalog === 'function') {
      var kbtn = document.querySelector('.catalog-filter-btn[onclick*="\'' + keepCat + '\'"]');
      if (kbtn) filterCatalog(keepCat, kbtn);
      else {
        var tbtn = document.querySelector('button[onclick*="\'todos\'"]');
        if (tbtn) filterCatalog('todos', tbtn);
      }
    }
    function paintCard(card, p) {
      card.setAttribute('data-id', p.id);
      if (p.categoryCode) card.setAttribute('data-category', p.categoryCode);
      var img = card.querySelector('img');
      if (img) {
        if (p.images && p.images[0]) img.src = p.images[0];
        img.alt = p.title;
        img.setAttribute('data-alt', p.title);
      }
      var cat = card.querySelector('span.text-label-caps');
      if (cat) cat.textContent = p.category;
      var h3 = card.querySelector('h3');
      if (h3) { h3.textContent = p.title; h3.setAttribute('onclick', "openProductModal('" + p.id + "')"); }
      var desc = card.querySelector('p.font-body-sm');
      if (desc) desc.textContent = p.description;
      var box = card.querySelector('div.space-y-2\\.5');
      if (box) {
        var row = box.querySelector('div.flex.items-start');
        box.innerHTML = '';
        (p.idealFor && p.idealFor.length ? p.idealFor : ['Consultar disponibilidad y cobertura.']).forEach(function (t) {
          var r = row ? row.cloneNode(true) : document.createElement('div');
          var spans = r.querySelectorAll('span');
          var last = spans[spans.length - 1];
          if (last) last.textContent = t;
          else r.textContent = t;
          box.appendChild(r);
        });
      }
      card.querySelectorAll('[onclick]').forEach(function (el2) {
        var o = el2.getAttribute('onclick') || '';
        if (o.indexOf('openProductModal(') === 0) el2.setAttribute('onclick', "openProductModal('" + p.id + "')");
      });
    }
  }

  // Actualizacion automatica del catalogo: cuando el admin publica, edita o
  // quita algo, index/catalogo se actualizan solas sin recargar la pagina.
  // - Aviso instantaneo entre pestanas de la misma maquina.
  // - Poll cada 15s como red de seguridad (otras maquinas).
  // Nunca interrumpe: respeta pestana oculta, modales abiertos y filtro activo.
  var __catSig = null, __catWatch = false, __catBC = null;
  function catSignature(list) {
    return (list || []).map(function (p) {
      return [p.id, p.title, p.description, p.category, p.categoryCode].join('|');
    }).join('~');
  }
  async function checkCatalog() {
    if (typeof PRODUCTS_DATA === 'undefined') return;
    if (!document.getElementById('catalog-grid')) return;
    if (document.hidden) return;
    if (document.querySelector('.modal-visible')) return;
    var list;
    try { list = await api('/api/productos'); } catch (e) { return; }
    if (!list) return;
    var sig = catSignature(list);
    if (sig !== __catSig) { __catSig = sig; await syncCatalog(list); }
  }
  function watchCatalog() {
    if (typeof PRODUCTS_DATA === 'undefined') return;
    if (!document.getElementById('catalog-grid')) return;
    if (__catWatch) return;
    __catWatch = true;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        __catBC = new BroadcastChannel('unidos-catalogo');
        __catBC.onmessage = function () { checkCatalog(); };
      }
    } catch (e) { __catBC = null; }
    window.addEventListener('storage', function (e) {
      if (e && e.key === 'unidos_catalog_ping') checkCatalog();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkCatalog();
    });
    setInterval(checkCatalog, 30000);
  }
  // Lo llama el admin tras crear/editar/eliminar para avisar a las demas pestanas.
  function notifyCatalog() {
    try { localStorage.setItem('unidos_catalog_ping', String(Date.now())); } catch (e) {}
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        (new BroadcastChannel('unidos-catalogo')).postMessage({ t: Date.now() });
      }
    } catch (e) {}
  }


  // Reescribe los enlaces del simulador (data-path / #) a las paginas reales.
  // Rutas absolutas: zona cliente en raiz, zona admin en /admin/ (independientes, solo datos).
  function rewriteLinks() {
    var logged = !!localStorage.getItem('unidos_token');
    var u0 = getUser();
    var staff = !!(u0 && (u0.rol === 'ADMIN' || u0.rol === 'SUPERADMIN'));
    var pe = !!(u0 && u0.rol === 'PROYECTOS_ESPECIALES');
    var home = !logged ? '/index.html' : (u0 && u0.rol === 'SUPERADMIN' ? '/superadmin/catalogo.html' : (staff ? '/admin/catalogo.html' : (pe ? '/especiales/gestion.html' : ((u0 && u0.rol === 'PRODUCTOS_ELECTRONICOS') ? '/electronica/catalogo.html' : '/index.html'))));
    // En zona admin todo se queda en zona admin. La zona de Proyectos
    // Especiales es aparte: tambien se queda en su zona. Igual SuperAdmin.
    var isAdminPage = /^\/admin\//.test(location.pathname);
    var isEspecialesPage = /^\/especiales\//.test(location.pathname);
    var isSuperPage = /^\/superadmin\//.test(location.pathname);
    var isElecPage = /^\/electronica\//.test(location.pathname);
    // Contacto/Nosotros bajan a la sección DE LA PAGINA ACTUAL (nunca te sacan de tu sesion).
    // Si la pagina no trae esa seccion, Nosotros va a su página; Contacto al pie del index.
    var contactoHref = document.getElementById('contacto') ? '#contacto' : '/index.html#contacto';
    var nosotrosHref = document.getElementById('nosotros') ? '#nosotros' : '/nosotros.html';
    // El catalogo respeta zona y rol: el cliente va al catálogo del index
    // nuevo; cada staff se queda en su zona. Sin sesión, a la presentación.
    var catalogoHref = (!logged || (u0 && u0.rol === 'CLIENTE')) ? '/index.html#seccion-catalogo'
      : (u0 && u0.rol === 'SUPERADMIN' ? '/superadmin/catalogo.html'
      : (u0 && u0.rol === 'ADMIN' ? '/admin/catalogo.html'
      : (u0 && u0.rol === 'PRODUCTOS_ELECTRONICOS' ? '/electronica/catalogo.html'
      : (pe ? '/especiales/gestion.html' : '/index.html#seccion-catalogo'))));
    var MAP = {
      'mis-cotizaciones': '/mis-cotizaciones.html',
      'perfil': '/perfil.html',
      'iniciar-sesion': '/login.html',
      'catalogo-de-servicios': catalogoHref,
      'catalogo-y-soluciones': catalogoHref,
      'catalogo': catalogoHref,
      'contacto': contactoHref,
      'nosotros': nosotrosHref,
      'planes-y-paquetes': catalogoHref,
      'registro-cuenta': '/registro.html',
      'registrarse-ahora': '/registro.html',
      'admin-panel': '/admin/mantenimiento.html',
      'admin-catalogo': '/admin/catalogo.html',
      'admin-cotizaciones': '/admin/cotizaciones.html',
      'admin-perfil': '/admin/perfil.html',
      'proyectos-especiales': '/especiales/gestion.html',
      'proyectos-recibidos': '/especiales/solicitudes.html',
      'historial-de-proyectos': '/especiales/historial.html',
    };
    document.querySelectorAll('[data-path]').forEach(function (a) {
      var dp = a.getAttribute('data-path');
      if (dp === 'cotizador-online' || dp === 'cotizador' || dp === 'productos-electronicos') return; // se maneja abajo
      if (dp === 'catalogo') {
        // El index nuevo trae su propio catálogo en la página: se respeta el
        // scroll interno en vez de sacarte a otra página.
        var href0 = a.getAttribute('href') || '';
        if (href0.charAt(0) === '#' && href0.length > 1) {
          try { if (document.querySelector(href0)) return; } catch (e) {}
        }
      }
      if (a._unRenamed) return; // un renombrado manual tiene prioridad y no se pisa
      var t = MAP[dp];
      if (t) a.setAttribute('href', t);
    });
    // Cotizador y Productos Electrónicos: la decision se toma AL CLIC, no al
    // cargar (asi un token vencido jamas te deja sin la ventana emergente).
    // CON sesion entra directo; SIN sesion abre el aviso original del diseno.
    var GATED = {
      'cotizador-online': '/cotizador.html',
      'cotizador': '/cotizador.html',
      'productos-electronicos': '/productos-electronicos.html',
    };
    Object.keys(GATED).forEach(function (dp) {
      document.querySelectorAll('[data-path="' + dp + '"]').forEach(function (a) {
        if (a._unCot) return;
        a._unCot = true;
        a.removeAttribute('onclick');
        a.setAttribute('href', 'javascript:void(0)');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var uu = getUser();
          var installCta = (a.textContent || '').indexOf('COTIZAR INSTALACIÓN') === 0;
          if (installCta) {
            if (uu && (uu.rol === 'PRODUCTOS_ELECTRONICOS' || uu.rol === 'PROYECTOS_ESPECIALES')) {
              a.style.display = 'none';
              a.setAttribute('aria-disabled', 'true');
              return;
            }
            if (localStorage.getItem('unidos_token')) { location.href = '/cotizador.html'; return; }
            location.href = '/login.html?next=/cotizador.html';
            return;
          }
          if (uu && (uu.rol === 'PRODUCTOS_ELECTRONICOS' || uu.rol === 'PROYECTOS_ESPECIALES')) {
            a.style.display = 'none';
            a.setAttribute('aria-disabled', 'true');
            return;
          }
          if (isElecPage || isEspecialesPage) {
            a.style.display = 'none';
            a.setAttribute('aria-disabled', 'true');
            return;
          }
          var target = GATED[dp];
          if (isAdminPage) { location.href = '/admin/cotizaciones.html'; return; }
          if (isSuperPage) { location.href = '/superadmin/catalogo.html'; return; }
          if (uu && uu.rol === 'SUPERADMIN') { location.href = '/superadmin/catalogo.html'; return; }
          if (uu && uu.rol === 'ADMIN') { location.href = '/admin/cotizaciones.html'; return; }
          if (localStorage.getItem('unidos_token')) { location.href = target; return; }
          if (typeof openAuthPromptModal === 'function') { openAuthPromptModal(); return; }
          location.href = '/login.html?next=' + target;
        });
      });
    });
    // "Inicio" lleva al inicio segun sesion: catalogo (con sesion) o presentacion (sin sesion)
    document.querySelectorAll('[data-path="inicio"]').forEach(function (a) { a.setAttribute('href', home); });
    // Sin sesion el boton "Contacto" del nav se llama "Nosotros" y abre la pagina
    // Nosotros. Solo el del nav (no el "Soporte Tecnico" del footer). Con sesion
    // se queda como ancla de contacto (comportamiento anterior).
    if (!logged && !isAdminPage) {
      document.querySelectorAll('a.nav-link-item[data-path="contacto"]').forEach(function (a) {
        if ((a.textContent || '').trim() !== 'Contacto') return;
        (function walk(n) {
          if (n.nodeType === 3) {
            if (n.nodeValue.indexOf('Contacto') >= 0) { n.nodeValue = n.nodeValue.replace('Contacto', 'Nosotros'); }
            return;
          }
          var c = n.firstChild;
          while (c) { var nx = c.nextSibling; walk(c); c = nx; }
        })(a);
        a._unRenamed = true;
        a.setAttribute('href', '/nosotros.html');
      });
    }
    // El boton "Nosotros" ahora se llama "Catálogo" y regresa directo al catálogo.
    // En admin se llama "Mantenimientos" y va a sus solicitudes. A prueba de
    // repeticiones y tolerante a iconos pegados al texto.
    // Solo reconoce el ya renombrado si trae data-path="nosotros" (no toca otros "Catálogo").
    (function () {
      // Las zonas con nav propio no se tocan.
      if (/^\/(especiales|superadmin)\//.test(location.pathname)) return;
      // La IA nueva (index, cotizador, productos) SÍ tiene página Nosotros:
      // sus links data-path="nosotros" no se renombran a Catálogo.
      var isNewIA = /^\/(index\.html)?$/.test(location.pathname) || /^\/(cotizador|productos-electronicos|nosotros)\.html$/.test(location.pathname);
      var isAdmin = /^\/admin\//.test(location.pathname);
      var isAdminZone = isAdmin || isElecPage;
      function baseText(a) { return ((a.textContent || '').trim().replace(/^[a-z_]+/, '').trim()); }
      function retitle(a, label) {
        (function walk(n) {
          if (n.nodeType === 3) {
            if (n.nodeValue.indexOf('Nosotros') >= 0) { n.nodeValue = n.nodeValue.replace('Nosotros', label); }
            return;
          }
          var c = n.firstChild;
          while (c) { var nx = c.nextSibling; walk(c); c = nx; }
        })(a);
      }
      document.querySelectorAll('a').forEach(function (a) {
        if (a._unRenamed) return; // renombrado manual (ej. Contacto->Nosotros sin sesion)
        if (a.getAttribute('data-path') === 'contacto') return; // el Contacto del nav lo maneja su propio bloque
        if (a.getAttribute('data-path') === 'nosotros' && isNewIA) return; // IA nueva: Nosotros existe
        if (a.getAttribute('aria-current') === 'page') return; // marcador de pagina actual (ej. Nosotros en nosotros.html)
        var dpn = a.getAttribute('data-path') === 'nosotros';
        var t = baseText(a);
        var esNos = t === 'Nosotros' || (dpn && (t === 'Catálogo' || t === 'Panel' || t === 'Mantenimientos'));
        if (!esNos) return;
        retitle(a, isAdminZone ? 'Mantenimientos' : 'Catálogo');
        // retitula tambien un posible texto ya renombrado antes
        (function walk2(n) {
          if (n.nodeType === 3) {
            if (n.nodeValue.indexOf('Panel') >= 0 && isAdminZone) { n.nodeValue = n.nodeValue.replace('Panel', 'Mantenimientos'); }
            return;
          }
          var c = n.firstChild;
          while (c) { var nx = c.nextSibling; walk2(c); c = nx; }
        })(a);
        a._unRenamed = true;
        a.setAttribute('href', isAdminZone ? ((isElecPage ? '/electronica/historial.html' : '/admin/mantenimiento.html')) : catalogoHref);
      });
    })();
    document.querySelectorAll('a[href="#registro"]').forEach(function (a) { a.href = '/registro.html'; });
    document.querySelectorAll('a[href="#iniciar-sesion"]').forEach(function (a) { a.href = '/login.html'; });
    // Anclas del catalogo: van al catálogo que corresponde a tu zona/rol
    // (el nuevo index para cliente) y no recargan si ya estas en la pagina.
    (function () {
      var isIndex = /index\.html$|\/$/.test(location.pathname);
      var isCatalogo = /catalogo\.html$/.test(location.pathname);
      var hasNewCat = !!document.getElementById('seccion-catalogo');
      var target = !logged ? (hasNewCat ? '#seccion-catalogo' : '/index.html#seccion-catalogo')
        : (isCatalogo ? '#catalogo-servicios'
        : (isSuperPage ? '/superadmin/catalogo.html'
        : (isAdminPage ? '/admin/catalogo.html'
        : (isEspecialesPage ? '/especiales/gestion.html' : (hasNewCat ? '#seccion-catalogo' : '/index.html#seccion-catalogo')))));
      ['#catalogo', '#catalogo-servicios', '#catalogo-de-servicios'].forEach(function (h) {
        document.querySelectorAll('a[href="' + h + '"]').forEach(function (a) { a.href = target; });
      });
    })();
    // Solo etiquetas exactas conocidas (nada de adivinanzas por palabras sueltas).
    // En zona admin todo se queda en zona admin.
    document.querySelectorAll('a[href="#"]').forEach(function (a) {
      var t = (a.textContent || '').trim().toLowerCase();
      if (t.indexOf('iniciar ses') >= 0) a.href = '/login.html';
      else if (t.indexOf('crear cuenta') >= 0 || t === 'registrarse' || t === 'registrarse en nerba') a.href = '/registro.html';
      else if (t.indexOf('volver al cat') >= 0) a.href = isAdminPage ? '/admin/catalogo.html' : (isElecPage ? '/electronica/catalogo.html' : (logged ? '/index.html#seccion-catalogo' : '/index.html'));
      else if (t.indexOf('mis cotizaciones') >= 0) a.href = isAdminPage ? '/admin/cotizaciones.html' : (isElecPage ? '/electronica/cotizaciones.html' : '/mis-cotizaciones.html');
      else if (t === 'cotizador online') {
        if (isElecPage || isEspecialesPage) {
          a.removeAttribute('href');
          a.setAttribute('aria-disabled', 'true');
        } else a.href = isAdminPage ? '/admin/cotizaciones.html' : '/cotizador.html';
      }
      else if (t === 'mi perfil' || t === 'mi cuenta') a.href = isAdminPage ? '/admin/perfil.html' : (isEspecialesPage ? '/especiales/perfil.html' : (isElecPage ? '/electronica/perfil.html' : '/perfil.html'));
      else if (t === '' && a.querySelector('img')) a.href = home; // logo sin texto: al inicio
      else if (t === 'inicio') a.href = home;
      else if (t === 'portal de clientes') a.href = (u0 && u0.rol === 'ADMIN') ? '/admin/catalogo.html' : ((u0 && u0.rol === 'SUPERADMIN') ? '/superadmin/catalogo.html' : ((u0 && u0.rol === 'PRODUCTOS_ELECTRONICOS') ? '/electronica/catalogo.html' : '/index.html'));
      else if (t === 'términos de servicio' || t === 'términos del servicio' || t.indexOf('términos de garant') >= 0 || t === 'términos') a.href = '/terminos.html';
      else if (t === 'política de privacidad' || t === 'políticas de privacidad' || t === 'privacidad' || t.indexOf('aviso de privacidad') >= 0 || t.indexOf('privacidad') === 0) a.href = '/privacidad.html';
      else if (t === 'libro de reclamaciones') a.href = '/terminos.html#libro';
      else if (t.indexOf('cumplimiento normativo') >= 0 || t === 'cumplimiento') a.href = '/terminos.html';
      else if (t === 'portal de proveedores') a.href = catalogoHref;
    });
    // Entrada a Mantenimientos: solo visible para ADMIN/SUPERADMIN fuera de /admin/,
    // con el estilo del nav existente. Dentro de admin ya existe su navegacion.
    try {
      var __u = getUser();
      if (__u && (__u.rol === 'ADMIN' || __u.rol === 'SUPERADMIN') && !isAdminPage && !isEspecialesPage && !isSuperPage && !isElecPage) {
        var __nav = document.querySelector('header nav');
        if (__nav && !document.getElementById('nav-staff-link')) {
          var __ref = __nav.querySelector('a');
          var __a = document.createElement('a');
          __a.id = 'nav-staff-link';
          __a.href = '/admin/mantenimiento.html';
          __a.textContent = 'Mantenimientos';
          if (__ref) __a.className = __ref.className;
          __nav.appendChild(__a);
        }
      }
    } catch (e) { /* sin sesion: nada */ }
    // "Olvidaste tu contrasena": mensaje claro (demo local sin correo SMTP)
    document.querySelectorAll('a[href="#recuperar"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        alert('Para restablecer tu contraseña escríbenos a contacto@unidosnerba.mx o pide apoyo al administrador en esta demo local.');
      });
    });
  }

  // Mini-menu del perfil: "Mi perfil y configuracion" + "Cerrar sesion".
  // Mismo componente en todas las interfaces (sin iconos externos para que jale en todas).
  function profileMenu(anchor, perfilHref) {
    if (!anchor || anchor._unMenu) return;
    anchor._unMenu = true;
    anchor.style.cursor = 'pointer';
    var user = getUser() || {};
    var menu = document.createElement('div');
    menu.className = 'hidden fixed z-[60] w-60 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden un-profile-menu';
    menu.innerHTML =
      '<div class="px-4 py-3 border-b border-slate-100 bg-slate-50/70 un-pm-head">' +
      '<p class="text-sm font-bold text-slate-900 truncate un-pm-name">' + esc(user.nombre || '') + '</p>' +
      '<p class="text-xs text-slate-500 truncate un-pm-mail">' + esc(user.email || '') + '</p></div>' +
      '<a href="' + (perfilHref || '/perfil.html') + '" class="un-pm-link block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Mi perfil y configuración</a>' +
      '<button type="button" class="un-logout-btn un-pm-out un-secure-logout w-full text-left px-4 py-2.5 text-sm font-bold text-[#b0000b] hover:bg-red-50 border-t border-slate-100" aria-label="Cerrar sesión de forma segura">' + secureLogoutMarkup() + '</button>';
    document.body.appendChild(menu);
    menu.querySelector('.un-logout-btn').addEventListener('click', function (e) {
      requestLogout(e);
    });
    function close() { menu.classList.add('hidden'); }
    anchor.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.classList.contains('hidden')) {
        var r = anchor.getBoundingClientRect();
        menu.style.top = (r.bottom + 8) + 'px';
        menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
        menu.classList.remove('hidden');
      } else close();
    });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function preferenceKey(name) {
    var u = getUser();
    return (u && u.email) ? name + '::' + String(u.email).toLowerCase() : name;
  }
  function preferenceGet(name, fallback) {
    try {
      var value = localStorage.getItem(preferenceKey(name));
      if (value !== null) return value;
      if (getUser() && getUser().email) return fallback;
      value = localStorage.getItem(name);
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }
  function preferenceSet(name, value) {
    try {
      var u = getUser();
      localStorage.setItem(preferenceKey(name), value);
      if (u && u.email) localStorage.removeItem(name);
    } catch (e) {}
  }
  function migrateAccountPreferences() {
    var u = getUser();
    if (!u || !u.email) return;
    ['nerba_font_scale', 'nerba_color_filter', 'nerba_reduce_motion', 'nerba_highlight_links'].forEach(function (name) {
      var key = preferenceKey(name);
      try {
        if (localStorage.getItem(key) === null && localStorage.getItem(name) !== null) localStorage.setItem(key, localStorage.getItem(name));
        if (localStorage.getItem(name) !== null) localStorage.removeItem(name);
      } catch (e) {}
    });
  }
  // Tema oscuro global "Razer NOC" + accesibilidad en TODAS las interfaces.
  // El interruptor vive en el Perfil (nerba_theme dark/light) y se propaga
  // a index, catálogo, cotizador, nosotros, login, admin, superadmin,
  // especiales y electrónica. Por defecto todo queda claro.
  function applyA11yLogged() {
    // Normaliza el dialecto de escala al de la pagina actual ANTES de que corran
    // los controles nativos (perfil usa 14/16/18/20, cotizador/historial sm/md/lg/xl).
    (function () {
      var raw = preferenceGet('nerba_font_scale', null);
      if (raw == null) return;
      var toNum = { sm: '14', md: '16', lg: '18', xl: '20' };
      var toNamed = { '14': 'sm', '16': 'md', '18': 'lg', '20': 'xl' };
      var want = /\/perfil\.html$/.test(location.pathname) ? toNum[String(raw)] : toNamed[String(raw)];
      if (want && want !== String(raw)) preferenceSet('nerba_font_scale', want);
    })();
    var root = document.documentElement, body = document.body;
    var dark = themeGet() === 'dark';
    root.classList.toggle('dark', dark);
    root.classList.toggle('dark-mode', dark);
    try { root.style.colorScheme = dark ? 'dark' : 'light'; } catch (e) {}
    if (body) body.classList.toggle('dark-mode', dark);
    // Adaptador oscuro heredado (catálogo claro) + bandera global Razer
    if (dark && /\/catalogo\.html$/.test(location.pathname)) root.setAttribute('data-un-dark', '');
    else root.removeAttribute('data-un-dark');
    if (dark) root.setAttribute('data-un-dark-razor', '');
    else root.removeAttribute('data-un-dark-razor');
    // Escala: unifica sistema numerico (perfil) y nombrado (cotizador/historial)
    var raw = null;
    try { raw = preferenceGet('nerba_font_scale', '16'); } catch (e) { raw = '16'; }
    var lvl = ({ '14': 'sm', '16': 'md', '18': 'lg', '20': 'xl', sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' })[String(raw)] || 'md';
    ['font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl',
     'font-scale-sm', 'font-scale-md', 'font-scale-lg', 'font-scale-xl'].forEach(function (c) {
      if (body) body.classList.remove(c); root.classList.remove(c);
    });
    if (body) body.classList.add('font-size-' + lvl, 'font-scale-' + lvl);
    root.classList.add('font-scale-' + lvl);
    root.style.fontSize = ({ sm: 14, md: 16, lg: 18, xl: 20 })[lvl] + 'px';
    // Daltonismo/contraste con las clases de cada diseno
    var f = 'none';
    try {
      f = preferenceGet('nerba_color_filter', 'none');
      if (String(f).toLowerCase() === 'normal' || String(f).toLowerCase() === 'none') f = 'none';
    } catch (e) {}
    ['filter-protanopia', 'filter-deuteranopia', 'filter-tritanopia', 'filter-achromatopsia',
     'color-filter-protanopia', 'color-filter-deuteranopia', 'color-filter-tritanopia',
     'color-filter-high-contrast'].forEach(function (c) { if (body) body.classList.remove(c); });
    if (['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'].indexOf(f) >= 0) {
      if (body) body.classList.add('filter-' + f);
      if (f !== 'achromatopsia' && body) body.classList.add('color-filter-' + f);
    }
    if ((f === 'high-contrast' || f === 'contraste') && body) body.classList.add('color-filter-high-contrast');
    try {
      var highlight = preferenceGet('nerba_highlight_links', null);
      if (highlight !== null && body) body.classList.toggle('highlight-links-enabled', highlight !== 'false');
      var reduce = preferenceGet('nerba_reduce_motion', null);
      if (reduce !== null && body) body.classList.toggle('reduce-motion-enabled', reduce === 'true');
      var filterValue = String(preferenceGet('nerba_color_filter', 'none') || 'none').toLowerCase();
      if (filterValue === 'normal') filterValue = 'none';
      Array.prototype.slice.call(document.querySelectorAll('.filter-card')).forEach(function (card) {
        var active = card.getAttribute('data-filter') === filterValue || (filterValue === 'none' && (card.getAttribute('data-filter') || '').toLowerCase() === 'normal');
        card.classList.toggle('ring-2', active);
        card.classList.toggle('ring-primary', active);
        card.classList.toggle('shadow-sm', active);
        card.classList.toggle('bg-surface-container', active);
        card.classList.toggle('bg-surface-container-low', !active);
        var dot = card.querySelector('.filter-dot');
        if (dot) dot.classList.toggle('hidden', !active);
      });
      var themeValue = themeGet();
      Array.prototype.slice.call(document.querySelectorAll('.theme-option')).forEach(function (card) {
        var active = card.getAttribute('data-theme') === themeValue;
        card.classList.toggle('ring-2', active);
        card.classList.toggle('ring-primary', active);
        card.classList.toggle('shadow-sm', active);
        var badge = card.querySelector('.theme-badge');
        if (badge) badge.classList.toggle('hidden', !active);
      });
      var reduceInput = document.getElementById('toggle-reduce-motion');
      if (reduceInput) reduceInput.checked = reduce === 'true';
      var highlightInput = document.getElementById('toggle-highlight-links');
      if (highlightInput) highlightInput.checked = highlight !== 'false';
      var scaleValue = String(preferenceGet('nerba_font_scale', '16'));
      Array.prototype.slice.call(document.querySelectorAll('.font-btn')).forEach(function (button) {
        var value = button.getAttribute('data-font') || button.getAttribute('data-scale') || '';
        if (value) button.classList.toggle('active', value === scaleValue || value === ({ sm: '14', md: '16', lg: '18', xl: '20' })[scaleValue]);
      });
    } catch (e) {}
  }
  function resetA11yFilter() {
    var classes = ['color-filter-protanopia', 'color-filter-deuteranopia', 'color-filter-tritanopia', 'color-filter-high-contrast', 'filter-protanopia', 'filter-deuteranopia', 'filter-tritanopia', 'filter-achromatopsia'];
    classes.forEach(function (name) { document.body.classList.remove(name); });
    var preview = document.getElementById('live-preview-box');
    if (preview) classes.forEach(function (name) { preview.classList.remove(name); });
    try {
      preferenceSet('nerba_color_filter', 'none');
      preferenceSet('nerba_font_scale', '16');
      preferenceSet('nerba_reduce_motion', 'false');
      preferenceSet('nerba_highlight_links', 'true');
    } catch (e) {}
    applyA11yLogged();
  }
  try {
    installPrintGuard();
  } catch (e) {}
  try {
    var resetButton = document.getElementById('btn-reset-accessibility');
    if (resetButton && !resetButton._unResetBound) {
      resetButton._unResetBound = true;
      resetButton.addEventListener('click', function () { setTimeout(resetA11yFilter, 50); });
    }
  } catch (e) {}
  document.addEventListener('click', function (e) {
    var reset = e.target && e.target.closest ? e.target.closest('#btn-reset-accessibility') : null;
    if (reset) setTimeout(resetA11yFilter, 0);
    var filterCard = e.target && e.target.closest ? e.target.closest('.filter-card') : null;
    if (filterCard) {
      var value = filterCard.getAttribute('data-filter') || 'none';
      if (String(value).toLowerCase() === 'normal') value = 'none';
      try { preferenceSet('nerba_color_filter', value); } catch (err) {}
    }
    var fontButton = e.target && e.target.closest ? e.target.closest('.font-btn, #btn-font-inc, #btn-font-dec') : null;
    if (fontButton) {
      var fontValue = localStorage.getItem('nerba_font_scale');
      if (fontValue !== null) preferenceSet('nerba_font_scale', fontValue);
    }
  });
  document.addEventListener('change', function (e) {
    if (!e.target) return;
    if (e.target.id === 'toggle-reduce-motion') preferenceSet('nerba_reduce_motion', e.target.checked ? 'true' : 'false');
    if (e.target.id === 'toggle-highlight-links') preferenceSet('nerba_highlight_links', e.target.checked ? 'true' : 'false');
  });
  // Tema por CUENTA: lectura con clave por email (ver UN_TEMA).
  // Si el loader temprano no esta, resuelve igual sin romper nada.
  function themeGet() {
    try { if (window.UN_TEMA) return UN_TEMA.get(); } catch (e) {}
    try {
      var u = getUser();
      var k = (u && u.email) ? 'nerba_theme::' + String(u.email).toLowerCase() : 'nerba_theme';
      var v = localStorage.getItem(k);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) {}
    return 'light';
  }
  // Setter del tema (lo usa el Perfil y cualquier toggle futuro).
  // Guarda en la cuenta, pinta al instante, avisa a las demas pestanas
  // y lo sube al servidor para que viaje con la cuenta a otros equipos.
  function themeSet(mode, opts) {
    mode = mode === 'dark' ? 'dark' : 'light';
    opts = opts || {};
    try {
      if (window.UN_TEMA) UN_TEMA.set(mode);
      else {
        var u = getUser();
        var k = (u && u.email) ? 'nerba_theme::' + String(u.email).toLowerCase() : 'nerba_theme';
        localStorage.setItem(k, mode);
        if (!u || !u.email) localStorage.setItem('nerba_theme', mode);
        localStorage.setItem('unidos_theme_ping', String(Date.now()));
      }
    } catch (e) {}
    applyA11yLogged();
    if (!opts.nosync) {
      try {
        if (localStorage.getItem('unidos_token')) {
          api('/api/me', { method: 'PUT', body: { tema: mode } }).then(function (me) {
            try { setSession(localStorage.getItem('unidos_token'), me); } catch (e2) {}
          }).catch(function () {});
        }
      } catch (e) {}
    }
    return mode;
  }
  function setThemeMode(mode) { return themeSet(mode); }
  // Sincronización en vivo: si cambias el tema en Perfil, las demás
  // pestañas/ventanas lo aplican sin recargar.
  function watchTheme() {
    window.addEventListener('storage', function (e) {
      if (!e) return;
      var u = getUser();
      var key = (u && u.email) ? 'nerba_theme::' + String(u.email).toLowerCase() : 'nerba_theme';
      if (e.key === 'nerba_theme' && key !== 'nerba_theme') return;
      if (e.key && e.key.indexOf('nerba_theme::') === 0 && e.key !== key) return;
      if (e.key === 'nerba_theme' || e.key === 'unidos_theme_ping' || e.key === key) applyA11yLogged();
    });
  }
  // Inyecta la hoja Razer global si la página aún no la trae (todas las zonas).
  function injectRazerCSS() {
    try {
      if (document.querySelector('link[data-razor-dark]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.setAttribute('data-razor-dark', '1');
      l.href = /^\/(admin|superadmin|especiales|electronica)\//.test(location.pathname)
        ? '/css/tema-oscuro-razor.css?v=3.0' : 'css/tema-oscuro-razor.css?v=3.0';
      l.onerror = function () {
        if (l.getAttribute('href').charAt(0) !== '/') l.href = '/css/tema-oscuro-razor.css?v=3.0';
      };
      document.head.appendChild(l);
    } catch (e) {}
  }
  // Activos de accesibilidad para paginas cuyo diseno no los trae (catalogo).
  // Copia exacta de las reglas de los disenos con accesibilidad; solo actuan
  // cuando el usuario las activa (zona con sesion).
  function injectA11yAssets() {
    if (!document.getElementById('filter-protanopia')) {
      var svg = document.createElement('div');
      svg.innerHTML = '<svg style="position:absolute;height:0;width:0;overflow:hidden" version="1.1" xmlns="http://www.w3.org/2000/svg"><defs>' +
        '<filter id="filter-protanopia"><feColorMatrix in="SourceGraphic" type="matrix" values="0.567, 0.433, 0, 0, 0 0.558, 0.442, 0, 0, 0 0, 0.242, 0.758, 0, 0 0, 0, 0, 1, 0"/></filter>' +
        '<filter id="filter-deuteranopia"><feColorMatrix in="SourceGraphic" type="matrix" values="0.625, 0.375, 0, 0, 0 0.7, 0.3, 0, 0, 0 0, 0.3, 0.7, 0, 0 0, 0, 0, 1, 0"/></filter>' +
        '<filter id="filter-tritanopia"><feColorMatrix in="SourceGraphic" type="matrix" values="0.95, 0.05, 0, 0, 0 0, 0.433, 0.567, 0, 0 0, 0.475, 0.525, 0, 0 0, 0, 0, 1, 0"/></filter>' +
        '</defs></svg>';
      document.body.appendChild(svg);
    }
    if (document.getElementById('un-a11y-css')) return;
    var st = document.createElement('style');
    st.id = 'un-a11y-css';
    st.textContent =
      "body.filter-protanopia{filter:url('#filter-protanopia') !important}" +
      "body.filter-deuteranopia{filter:url('#filter-deuteranopia') !important}" +
      "body.filter-tritanopia{filter:url('#filter-tritanopia') !important}" +
      "body.filter-achromatopsia{filter:grayscale(100%) contrast(110%) !important}" +
      "body.highlight-links-enabled a:not(.no-highlight),body.highlight-links-enabled button:not(.no-highlight){outline:2px dashed #b0000b !important;outline-offset:2px !important}" +
      "body.reduce-motion-enabled *,body.reduce-motion-enabled *::before,body.reduce-motion-enabled *::after{animation-duration:0.001ms !important;animation-iteration-count:1 !important;transition-duration:0.001ms !important}";
    document.head.appendChild(st);
  }
  function injectCatalogoDark() {
    if (document.getElementById('un-dark-adapter')) return;
    var st = document.createElement('style');
    st.id = 'un-dark-adapter';
    // Tema oscuro real con la paleta del sistema (los rojos de marca NO se tocan)
    st.textContent =
      'html[data-un-dark] body{background:#0b1120;color:#eaf1ff}' +
      'html[data-un-dark] .bg-surface{background:#0b1120}' +
      'html[data-un-dark] .bg-surface\\/80{background:rgba(11,17,32,.88)}' +
      'html[data-un-dark] .bg-surface-container-lowest{background:#161e2e}' +
      'html[data-un-dark] .bg-surface-container-lowest\\/90{background:rgba(22,30,46,.94)}' +
      'html[data-un-dark] .bg-surface-container-low{background:#0f172a}' +
      'html[data-un-dark] .bg-surface-container{background:#1e293b}' +
      'html[data-un-dark] .border-surface-container{border-color:#2d3748}' +
      'html[data-un-dark] .border-surface-container-high{border-color:#2d3748}' +
      'html[data-un-dark] .text-on-surface{color:#eaf1ff}' +
      'html[data-un-dark] .text-on-surface-variant{color:#c3cede}' +
      'html[data-un-dark] .text-secondary{color:#9fb0c9}' +
      'html[data-un-dark] .un-profile-menu{background:#161e2e;border-color:#2d3748}' +
      'html[data-un-dark] .un-profile-menu .un-pm-head{background:#0f172a;border-color:#2d3748}' +
      'html[data-un-dark] .un-profile-menu .un-pm-name{color:#eaf1ff}' +
      'html[data-un-dark] .un-profile-menu .un-pm-mail{color:#9fb0c9}' +
      'html[data-un-dark] .un-profile-menu .un-pm-link{color:#eaf1ff}' +
      'html[data-un-dark] .un-profile-menu .un-pm-link:hover{background:#0f172a}' +
      'html[data-un-dark] .un-profile-menu .un-pm-out{color:#ff7b7b}' +
      'html[data-un-dark] .un-profile-menu .un-pm-out:hover{background:rgba(217,27,27,.12)}';
    document.head.appendChild(st);
  }

  // CSS del header único de zonas staff (admin / proyectos especiales).
  // Solo pinta header.unZh (inyectado por zona); al resto no lo toca.
  function injectZoneHeadCSS() {
    if (document.getElementById('un-zh-css')) return;
    var st = document.createElement('style');
    st.id = 'un-zh-css';
    st.textContent =
      'html,body{overflow-x:hidden;overscroll-behavior:auto !important}' +
      'header.unZh{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 1px 6px rgba(2,6,23,.06)}' +
      '.unZh-in{max-width:80rem;margin:0 auto;padding:0 16px;height:68px;display:flex;align-items:center;gap:14px}' +
      '.unZh-brand{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}' +
      '.unZh-brand img{height:34px;width:auto;object-fit:contain}' +
      '.unZh-brand b{display:block;font-size:14px;font-weight:800;letter-spacing:.01em;color:#0b1c30;line-height:1.1;white-space:nowrap;text-transform:uppercase;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
      '.unZh-brand small{display:block;font-size:8px;font-weight:800;letter-spacing:.08em;color:#b0000b;white-space:nowrap}' +
      '.unZh-nav{display:flex;align-items:center;gap:6px;margin:0 auto;overflow-x:auto;scrollbar-width:none}' +
      '.unZh-nav::-webkit-scrollbar{display:none}' +
      '.unZh-nav a{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;text-decoration:none;white-space:nowrap;border:1px solid transparent;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
      '.unZh-nav a svg{width:16px;height:16px;flex-shrink:0}' +
      '.unZh-nav a:hover{background:rgba(176,0,11,.08);color:#b0000b}' +
      '.unZh-nav a:active{transform:scale(.97)}' +
      '.unZh-nav a[aria-current=page]{background:rgba(176,0,11,.1);border-color:rgba(176,0,11,.3);color:#b0000b;font-weight:800}' +
      '.unZh-count{background:#b0000b;color:#fff;border-radius:9999px;font-size:11px;font-weight:800;padding:1px 7px;line-height:1.5}' +
      '.unZh-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:5px 10px 5px 5px;cursor:pointer;flex-shrink:0}' +
      '.unZh-chip:hover{background:#f8fafc}' +
      '.unZh-av{position:relative;width:34px;height:34px;flex-shrink:0}' +
      '.unZh-av img{width:34px;height:34px;border-radius:50%;object-fit:cover;display:block}' +
      '.unZh-dot{position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff}' +
      '.unZh-who{display:flex;flex-direction:column;align-items:flex-start;line-height:1.25}' +
      '.unZh-who b{font-size:13px;color:#0b1c30;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
      '.unZh-role{font-size:9px;font-weight:800;letter-spacing:.08em;background:#b0000b;color:#fff;border-radius:5px;padding:2px 6px;margin-top:2px}' +
      '.unZh-chev{width:16px;height:16px;color:#94a3b8;flex-shrink:0}' +
      '.unZh-chipwrap{position:relative;flex-shrink:0}' +
      '.unZh-drop{position:absolute;right:0;top:calc(100% + 8px);width:232px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(2,6,23,.14);padding:6px;z-index:60}' +
      '.unZh-drop.hidden{display:none}' +
      '.unZh-drop a,.unZh-drop button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#334155;text-decoration:none;background:none;border:0;cursor:pointer;text-align:left;font-family:Inter,system-ui,sans-serif}' +
      '.unZh-drop a:hover,.unZh-drop button:hover{background:#f1f5f9;color:#0b1c30}' +
      '.unZh-drop a svg,.unZh-drop button svg{width:16px;height:16px;color:#64748b;flex-shrink:0}' +
      '.un-secure-logout{display:flex!important;align-items:center;gap:10px;width:100%;padding:10px 11px!important;margin:6px 2px 2px;border:1px solid #fecaca!important;border-radius:10px!important;background:#fff7f7!important;color:#b0000b!important;box-shadow:0 4px 10px rgba(176,0,11,.06);font:800 12px/1.2 Inter,system-ui,sans-serif!important;text-align:left;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease}' +
      '.un-secure-logout:hover{background:#fee2e2!important;border-color:#fca5a5!important;transform:translateY(-1px);box-shadow:0 7px 16px rgba(176,0,11,.12)}' +
      '.un-secure-logout:active{transform:translateY(0) scale(.98)}' +
      '.un-secure-logout:focus-visible{outline:3px solid rgba(217,27,27,.28)!important;outline-offset:2px}' +
      '.un-secure-logout-icon{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;border-radius:9px;background:#fee2e2;color:#b0000b}' +
      '.un-secure-logout-icon svg{width:17px;height:17px;stroke-width:2.2}' +
      '.un-secure-logout-copy{display:flex;flex-direction:column;gap:3px;min-width:0}' +
      '.un-secure-logout-copy strong{font-size:12px;line-height:1.1;font-weight:800}' +
      '.un-secure-logout-copy small{font-size:9px;line-height:1.1;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9f1239}' +
      'html.dark-mode .un-secure-logout,html.dark .un-secure-logout{background:#2a1418!important;border-color:#7f1d1d!important;color:#ffb4ab!important}' +
      'html.dark-mode .un-secure-logout:hover,html.dark .un-secure-logout:hover{background:#451a21!important;border-color:#ef4444!important}' +
      'html.dark-mode .un-secure-logout-icon,html.dark .un-secure-logout-icon{background:#4c1d24!important;color:#ffb4ab!important}' +
      'html.dark-mode .un-secure-logout-copy small,html.dark .un-secure-logout-copy small{color:#fca5a5!important}' +
      '.unZh-drop hr{border:0;border-top:1px solid #e5e7eb;margin:6px 4px}' +
      '.unZh-auth{display:flex;align-items:center;gap:10px;flex-shrink:0}' +
      '.unZh-login{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;text-decoration:none;padding:9px 6px;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
      '.unZh-login:hover{color:#b0000b}' +
      '.unZh-reg{background:#d91b1b;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;padding:10px 18px;border-radius:8px;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
      '.unZh-reg:hover{background:#b0000b}' +
      '@media(max-width:900px){.unZh-who{display:none}.unZh-in{gap:10px}}' +
      '@media(max-width:720px){.unZh-in{flex-wrap:wrap;height:auto;padding:10px 12px;row-gap:8px}.unZh-nav{order:3;flex-basis:100%;margin:0}.unZh-chip{margin-left:auto}}';
    document.head.appendChild(st);
  }
  // Header único para TODAS las zonas y roles (mismo estilo del index nuevo:
  // barra blanca, botones píldora en mayúsculas, chip de perfil con dropdown).
  // Cada zona conserva SUS links; solo se unifica el look. Sin "Preferencias".
  function zhIcon(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  var ZH_DOC = '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>';
  var ZH_GRID = '<path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>';
  var ZH_USERS = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
  var ZH_CLIP = '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h6"/>';
  var ZH_GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  var ZH_LAYERS = '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>';
  var ZH_INBOX = '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>';
  var ZH_CLOCK = '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>';
  var ZH_CHEV = '<path d="M19 9l-7 7-7-7"/>';
  var ZH_PERSON = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
  var ZH_FILE = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>';
  var ZH_OUT = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>';
  function secureLogoutMarkup() {
    return '<span class="un-secure-logout-icon">' + zhIcon(ZH_OUT) + '</span><span class="un-secure-logout-copy"><strong>Cerrar sesión</strong><small>Sesión segura</small></span>';
  }
  function zhNavLink(href, icon, label, extra) {
    return '<a href="' + href + '"' + (extra || '') + '>' + zhIcon(icon) + '<span>' + label + '</span></a>';
  }
  function zhHTML(zone) {
    var brandHome = zone === 'admin' ? '/admin/catalogo.html'
      : (zone === 'superadmin' ? '/superadmin/catalogo.html'
      : (zone === 'especiales' ? '/especiales/gestion.html'
      : (zone === 'electronica' ? '/electronica/catalogo.html' : '/index.html')));
    var nav = '';
    if (zone === 'out') {
      nav = zhNavLink('/index.html#seccion-catalogo', ZH_GRID, 'Catálogo', ' data-path="catalogo"')
        + zhNavLink('/cotizador.html', ZH_DOC, 'Cotizador', ' data-path="cotizador"')
        + zhNavLink('/nosotros.html', ZH_USERS, 'Nosotros', ' data-path="nosotros"');
    } else if (zone === 'cliente') {
      nav = zhNavLink('/index.html#seccion-catalogo', ZH_GRID, 'Catálogo', ' data-path="catalogo"')
        + zhNavLink('/productos-electronicos.html', ZH_GRID, 'Electrónica y refacciones', ' data-path="productos-electronicos"')
        + zhNavLink('/cotizador.html', ZH_DOC, 'Cotizador', ' data-path="cotizador"')
        + zhNavLink('/mis-cotizaciones.html', ZH_FILE, 'Mis Cotizaciones');
    } else if (zone === 'admin') {
      nav = zhNavLink('/admin/cotizaciones.html', ZH_DOC, 'Cotizaciones Recibidas')
        + zhNavLink('/admin/historial.html', ZH_CLOCK, 'Historial general')
        + zhNavLink('/admin/catalogo.html', ZH_GRID, 'Catálogo')
        + zhNavLink('/admin/mantenimiento.html', ZH_GEAR, 'Mantenimientos');
    } else if (zone === 'electronica') {
      nav = zhNavLink('/electronica/cotizaciones.html', ZH_DOC, 'Cotizaciones Recibidas')
        + zhNavLink('/electronica/catalogo.html', ZH_GRID, 'Catálogo')
        + zhNavLink('/electronica/historial.html', ZH_CLOCK, 'Historial');
    } else if (zone === 'superadmin') {
      nav = zhNavLink('/superadmin/cotizaciones.html', ZH_DOC, 'Cotizaciones Recibidas')
        + zhNavLink('/superadmin/catalogo.html', ZH_GRID, 'Catálogo')
        + zhNavLink('/superadmin/usuarios.html', ZH_USERS, 'Usuarios')
        + zhNavLink('/superadmin/bitacora.html', ZH_CLIP, 'Bitácora');
    } else if (zone === 'especiales') {
      nav = zhNavLink('/especiales/gestion.html', ZH_LAYERS, 'Proyectos Especiales')
        + zhNavLink('/especiales/solicitudes.html', ZH_INBOX, 'Proyectos Recibidos')
        + zhNavLink('/especiales/historial.html', ZH_CLOCK, 'Historial');
    }
    var right = '';
    if (zone === 'out') {
      right = '<div class="unZh-auth"><a class="unZh-login" href="/login.html">Iniciar Sesión</a>' +
        '<a class="unZh-reg" href="/registro.html">Registrarse</a></div>';
    } else {
      right = '<div class="unZh-chipwrap"><button type="button" class="unZh-chip" id="unZh-chip">' +
        '<span class="unZh-av"><img id="unZh-avatar" src="https://ui-avatars.com/api/?name=UN&background=b0000b&color=fff&bold=true" alt="perfil"><i class="unZh-dot"></i></span>' +
        '<span class="unZh-who"><b id="unZh-name">Usuario</b><span class="unZh-role" id="unZh-role">ROL</span></span>' +
        zhIcon(ZH_CHEV).replace('<svg', '<svg class="unZh-chev"') +
        '</button><div class="unZh-drop hidden" id="unZh-drop"></div></div>';
    }
    return '<div class="unZh-in">' +
      '<a class="unZh-brand" href="' + brandHome + '">' +
      '<img src="/assets/logo.png" alt="' + esc(BRAND_ALT) + '" onerror="this.style.display=\'none\'">' +
      '<span><b>' + esc(BRAND_NAME) + '</b><small>' + esc(BRAND_SUBTITLE) + '</small></span></a>' +
      '<nav class="unZh-nav">' + nav + '</nav>' + right + '</div>';
  }
  function zhPaint(header) {
    var u = getUser() || {};
    try {
      var nm = header.querySelector('#unZh-name');
      if (nm && u.nombre) nm.textContent = u.nombre;
      var rl = header.querySelector('#unZh-role');
      if (rl) rl.textContent = String(u.rol || '').replace(/_/g, ' ') || 'USUARIO';
      paintProfileAvatars();
    } catch (e) { /* decorativo */ }
  }
  function zhDrop(header, zone) {
    var chip = header.querySelector('#unZh-chip');
    var drop = header.querySelector('#unZh-drop');
    if (!chip || !drop) return;
    var perfil = zone === 'admin' ? '/admin/perfil.html'
      : (zone === 'superadmin' ? '/superadmin/perfil.html'
      : (zone === 'especiales' ? '/especiales/perfil.html'
      : (zone === 'electronica' ? '/electronica/perfil.html' : '/perfil.html')));
    var items = '<a href="' + perfil + '">' + zhIcon(ZH_PERSON) + '<span>Mi Perfil</span></a>';
    items += '<hr><button type="button" class="un-secure-logout unZh-out" data-logout aria-label="Cerrar sesión de forma segura">' + secureLogoutMarkup() + '</button>';
    drop.innerHTML = items;
    var out = drop.querySelector('[data-logout]');
    if (out) out.addEventListener('click', function (e) {
      drop.classList.add('hidden');
      requestLogout(e);
    });
    if (chip._unZh) return;
    chip._unZh = true;
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      drop.classList.toggle('hidden');
    });
  document.addEventListener('click', function (e) {
      if (!drop.classList.contains('hidden') && !chip.contains(e.target)) drop.classList.add('hidden');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') drop.classList.add('hidden');
    });
  }
  function zhActive(header) {
    try {
      var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      Array.prototype.slice.call(header.querySelectorAll('nav a')).forEach(function (a) {
        var h = (a.getAttribute('href') || '').toLowerCase().split(/[?#]/)[0];
        var f = h.split('/').pop();
        if (f && f === page) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    } catch (e) {}
  }
  function syncMobileNavVisibility() {
    var fab = document.getElementById('un-mnav-fab');
    if (!fab) return;
    var mobile = window.innerWidth <= 767;
    var unified = !!document.querySelector('header.unZh');
    fab.style.display = unified || !mobile ? 'none' : 'flex';
    document.body.classList.toggle('un-mobile-nav-active', !unified && mobile);
    if (!window.__unMnavResize) {
      window.__unMnavResize = true;
      window.addEventListener('resize', syncMobileNavVisibility);
    }
  }
  function ensureMenu(zone) {
    zone = zone || 'out';
    var header = document.querySelector('header');
    if (!header) return false;
    if (header._unZh && header._unZhZone === zone) {
      try { zhPaint(header); } catch (e) {}
      return true;
    }
    var wasFixed = false;
    try { wasFixed = getComputedStyle(header).position === 'fixed'; } catch (e) {}
    header._unZh = true;
    header._unZhZone = zone;
    header.className = 'unZh';
    header.innerHTML = zhHTML(zone);
    syncMobileNavVisibility();
    zhPaint(header);
    zhDrop(header, zone);
    zhActive(header);
    if (wasFixed) {
      var m = document.querySelector('main');
      if (m) {
        try {
          var pt = parseFloat(getComputedStyle(m).paddingTop) || 0;
          if (pt >= 64) m.style.paddingTop = Math.max(0, pt - 68) + 'px';
        } catch (e) {}
      }
    }
    try { rewriteLinks(); } catch (e) {}
    return true;
  }
  // Sidebar movil compartido: en telefonos el nav de los disenos se oculta,
  // asi que se inyecta hamburguesa + drawer con los enlaces de cada rol/zona.
  // Solo CSS propio (cero dependencias) y solo visible bajo 768px.
  function injectMobileNav() {
    if (document.getElementById('un-mnav-fab')) return;
    var logged = !!localStorage.getItem('unidos_token');
    var u = getUser() || {};
    var rol = u.rol || '';
    var path = location.pathname;
    function isStaffR() { return rol === 'ADMIN' || rol === 'SUPERADMIN'; }
    var L;
    if (!logged) {
      L = [
        ['Inicio', '/index.html'], ['Catálogo', '/index.html#seccion-catalogo'],
        ['Cotizador', '/cotizador.html'], ['Electrónica y refacciones', '/productos-electronicos.html'],
        ['Nosotros', '/nosotros.html'],
        ['Contacto', '/index.html#contacto'], ['Iniciar Sesión', '/login.html'],
        ['Registrarse', '/registro.html'],
      ];
    } else if (rol === 'SUPERADMIN') {
      L = [
        ['Cotizaciones', '/superadmin/cotizaciones.html'], ['Catálogo', '/superadmin/catalogo.html'],
        ['Usuarios', '/superadmin/usuarios.html'], ['Bitácora', '/superadmin/bitacora.html'],
        ['Mi Perfil', '/superadmin/perfil.html'],
      ];
    } else if (isStaffR()) {
      L = [
        ['Catálogo', '/admin/catalogo.html'], ['Cotizaciones', '/admin/cotizaciones.html'],
        ['Mantenimientos', '/admin/mantenimiento.html'], ['Mi Perfil', '/admin/perfil.html'],
      ];
      if (rol === 'ADMIN') L.splice(2, 0, ['Historial general', '/admin/historial.html']);
    } else if (rol === 'PROYECTOS_ESPECIALES') {
      L = [
        ['Solicitudes', '/especiales/solicitudes.html'], ['Gestión', '/especiales/gestion.html'],
        ['Historial', '/especiales/historial.html'], ['Mi Perfil', '/especiales/perfil.html'],
      ];
    } else if (rol === 'PRODUCTOS_ELECTRONICOS') {
      L = [
        ['Cotizaciones', '/electronica/cotizaciones.html'], ['Catálogo', '/electronica/catalogo.html'],
        ['Historial', '/electronica/historial.html'], ['Mi Perfil', '/electronica/perfil.html'],
      ];
    } else {
      L = [
        ['Catálogo', '/index.html#seccion-catalogo'], ['Cotizador', '/cotizador.html'],
        ['Electrónica y refacciones', '/productos-electronicos.html'],
        ['Mis Cotizaciones', '/mis-cotizaciones.html'], ['Mi Perfil', '/perfil.html'],
      ];
    }
    var css = '@media(max-width:767px){body.un-mobile-nav-active{padding-bottom:76px}}' +
      '#un-mnav-fab{position:fixed;right:16px;bottom:16px;width:56px;height:56px;border-radius:50%;' +
      'background:#b0000b;color:#fff;border:none;box-shadow:0 8px 20px rgba(0,0,0,.3);z-index:65;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;padding:0}' +
      '#un-mnav-fab span{display:block;width:22px;height:2.5px;background:#fff;border-radius:2px}' +
      '@media(min-width:768px){#un-mnav-fab{display:none}}' +
      '#un-mnav-ovl{position:fixed;inset:0;background:rgba(2,6,23,.6);z-index:74;opacity:0;pointer-events:none;transition:opacity .25s}' +
      '#un-mnav-ovl.open{opacity:1;pointer-events:auto}' +
      '#un-mnav-panel{position:fixed;top:0;right:0;height:100vh;height:100dvh;width:min(300px,84vw);background:#fff;z-index:75;' +
      'transform:translateX(105%);transition:transform .28s ease;display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,.18)}' +
      '#un-mnav-panel.open{transform:none}' +
      '@media(min-width:768px){#un-mnav-ovl,#un-mnav-panel{display:none}}' +
      '#un-mnav-panel .hd{background:#b0000b;color:#fff;padding:18px 16px}' +
      '#un-mnav-panel .hd b{display:block;font-size:15px;letter-spacing:.5px;text-transform:uppercase}' +
      '#un-mnav-panel .hd small{display:block;font-size:11px;opacity:.85;margin-top:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#un-mnav-panel nav{flex:1;overflow-y:auto;padding:10px}' +
      '#un-mnav-panel nav a{display:flex;align-items:center;gap:10px;padding:12px 12px;border-radius:10px;' +
      'color:#0b1c30;text-decoration:none;font-size:14px;font-weight:600;border-left:4px solid transparent}' +
      '#un-mnav-panel nav a.on{background:#fef2f2;border-left-color:#b0000b;color:#b0000b}' +
      '#un-mnav-panel nav a:active{background:#f1f5f9}' +
      '#un-mnav-panel .ft{padding:12px 16px;border-top:1px solid #e2e8f0}' +
      '#un-mnav-panel .ft button{width:100%;padding:12px;border:none;border-radius:10px;background:#0b1c30;color:#fff;' +
      'font-size:14px;font-weight:700;cursor:pointer}' +
      'body.un-menu-leaving{opacity:.92;transition:opacity .12s ease;pointer-events:none}' +
      '#un-mnav-load{position:fixed;inset:0;background:#fff;z-index:90;display:none;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:20px;color:#334155;opacity:0;pointer-events:none;transition:opacity .14s ease}' +
      '#un-mnav-load.open{display:flex;opacity:1;pointer-events:auto}' +
      '#un-mnav-load .mark{width:80px;height:80px;object-fit:contain;background:#fff;display:block}' +
      '#un-mnav-load .line{position:relative;width:150px;height:6px;border-radius:999px;overflow:hidden;background:#b0000b;box-shadow:0 0 12px rgba(217,27,27,.4);animation:un-load-line-pulse 1.2s ease-in-out infinite}' +
      '#un-mnav-load .line::before{content:\'\';position:absolute;top:-3px;bottom:-3px;left:0;width:28px;border-radius:999px;background:#fff;opacity:.45;filter:blur(2px);animation:un-load-line-sheen 1.35s ease-in-out infinite}' +
      '#un-mnav-load .line i{position:relative;z-index:1;display:block;width:48%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.25) 25%,#fff 50%,rgba(255,255,255,.25) 75%,transparent 100%);box-shadow:0 0 8px rgba(255,255,255,.55);animation:un-load-line .8s cubic-bezier(.4,0,.2,1) infinite;animation-delay:-.25s}' +
      '@keyframes un-load-line{0%{transform:translateX(-190%)}100%{transform:translateX(360%)}}' +
      '@keyframes un-load-line-sheen{0%{transform:translateX(-50px);opacity:0}20%{opacity:.6}80%{opacity:.6}100%{transform:translateX(180px);opacity:0}}' +
      '@keyframes un-load-line-pulse{0%,100%{box-shadow:0 0 8px rgba(217,27,27,.25)}50%{box-shadow:0 0 16px rgba(217,27,27,.6)}}' +
      '@media (prefers-reduced-motion: reduce){#un-mnav-load .line{animation:none;box-shadow:none}#un-mnav-load .line::before{display:none}#un-mnav-load .line i{width:100%;transform:none;animation:none;box-shadow:none;background:rgba(255,255,255,.25)}}' +
      'html.dark #un-mnav-load{background:#fff}' +
      'html.dark #un-mnav-panel{background:#0f172a;box-shadow:-8px 0 24px rgba(0,0,0,.35)}' +
      'html.dark #un-mnav-panel nav a{color:#cbd5e1}' +
      'html.dark #un-mnav-panel nav a.on{background:#2a1418;color:#ffb4ab}' +
      'html.dark #un-mnav-panel nav a:active{background:#1e293b}' +
      'html.dark #un-mnav-panel .ft{border-color:#334155}' +
      'html.dark #un-mnav-panel .ft button{background:#b0000b}' +
      'html.dark #un-mnav-load .line{background:#b0000b}' ;
    var st = document.createElement('style');
    st.id = 'un-mnav-css';
    st.textContent = css;
    document.head.appendChild(st);
    var fab = document.createElement('button');
    fab.id = 'un-mnav-fab';
    fab.setAttribute('aria-label', 'Abrir menú de navegación');
    fab.innerHTML = '<span></span><span></span><span></span>';
    var ovl = document.createElement('div');
    ovl.id = 'un-mnav-ovl';
    var panel = document.createElement('div');
    panel.id = 'un-mnav-panel';
    var who = logged
      ? '<b>' + esc(BRAND_NAME) + '</b><small>' + esc(BRAND_SUBTITLE + ' · ' + (u.nombre || '') + (rol ? ' · ' + rol : '')) + '</small>'
      : '<b>' + esc(BRAND_NAME) + '</b><small>' + esc(BRAND_SUBTITLE) + '</small>';
    var links = L.map(function (it) {
      var on = path === it[1].split('#')[0] ? ' on' : '';
      return '<a class="' + on.trim() + '" href="' + it[1] + '">' + esc(it[0]) + '</a>';
    }).join('');
    panel.innerHTML = '<div class="hd">' + who + '</div><nav>' + links + '</nav>' +
      '<div class="ft">' + (logged ? '<button type="button" class="un-secure-logout" data-act="logout" aria-label="Cerrar sesión de forma segura">' + secureLogoutMarkup() + '</button>' : '<button type="button" data-act="login">Iniciar sesión</button>') + '</div>';
    // Estos enlaces son manuales: que rewriteLinks nunca los toque ni renombre
    panel.querySelectorAll('nav a').forEach(function (x) { x._unRenamed = true; });
    document.body.appendChild(fab);
    syncMobileNavVisibility();
    document.body.appendChild(ovl);
    document.body.appendChild(panel);
    // Pantalla de carga: al navegar se muestra al instante para que no se
    // perciba parpadeo ni la interfaz anterior a medias.
    var load = document.createElement('div');
    load.id = 'un-mnav-load';
    load.innerHTML = '<img class="mark" src="/assets/nerba-isotipo.svg" alt="" aria-hidden="true"><div class="line"><i></i></div>';
    document.body.appendChild(load);
    function go() {
      close();
      document.body.classList.add('un-menu-leaving');
      load.classList.add('open');
    }
    load.addEventListener('click', function () { load.classList.remove('open'); });
    function open() {
      ovl.classList.add('open'); panel.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      ovl.classList.remove('open'); panel.classList.remove('open');
      document.body.style.overflow = '';
    }
    fab.addEventListener('click', open);
    ovl.addEventListener('click', close);
    var act = panel.querySelector('[data-act]');
    if (act) act.addEventListener('click', function (e) {
      go();
      if (act.getAttribute('data-act') === 'logout') requestLogout(e);
      else location.href = '/login.html';
    });
    panel.querySelectorAll('nav a').forEach(function (x) { x.addEventListener('click', go); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  // Respaldo global de imagenes: si una imagen remota del simulador muere
  // (enlaces temporales), se sustituye por un placeholder de marca en vez
  // del icono roto. Solo actua una vez por imagen.
  var UN_IMG_PH = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#16233f"/><stop offset="1" stop-color="#0b1c30"/></linearGradient></defs>' +
    '<rect width="800" height="450" fill="url(#g)"/>' +
    '<g fill="#b0000b"><rect x="352" y="180" width="10" height="44" rx="2"/><rect x="368" y="172" width="10" height="60" rx="2"/>' +
    '<rect x="384" y="172" width="10" height="60" rx="2"/><rect x="400" y="180" width="10" height="44" rx="2"/></g>' +
    '<text x="400" y="270" text-anchor="middle" font-family="Arial" font-size="26" font-weight="bold" fill="#ffffff">' + esc(BRAND_NAME) + '</text>' +
    '<text x="400" y="296" text-anchor="middle" font-family="Arial" font-size="13" letter-spacing="1" fill="#e7bdb7">' + esc(BRAND_SUBTITLE) + '</text></svg>');
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.src && t.src.indexOf('googleusercontent.com/aida/') >= 0 && !t._unFb) {
      t._unFb = true;
      t.src = UN_IMG_PH;
    }
  }, true);
  // Las que ya fallaron antes de atar el listener (carga del parser)
  try {
    document.querySelectorAll('img').forEach(function (im) {
      if (im.complete && im.naturalWidth === 0 && im.src && im.src.indexOf('googleusercontent.com/aida/') >= 0 && !im._unFb) {
        im._unFb = true;
        im.src = UN_IMG_PH;
      }
    });
  } catch (e) { /* nunca romper el arranque */ }

  function openPasswordModal() {
    var existing = document.getElementById('un-password-modal');
    var opener = document.activeElement;
    var dark = document.documentElement.classList.contains('dark');
    var overlay = existing || document.createElement('div');
    if (existing) {
      opener = document.activeElement;
      overlay.style.display = 'flex';
      var reopen = overlay._open;
      if (reopen) reopen();
      return;
    }
    overlay.id = 'un-password-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'un-password-title');
    overlay.setAttribute('aria-describedby', 'un-password-description');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;background:rgba(8,15,28,.62);backdrop-filter:blur(5px);opacity:1;transition:opacity .16s ease';
    var dialog = document.createElement('div');
    dialog.setAttribute('tabindex', '-1');
    dialog.style.cssText = 'width:min(100%,440px);max-height:calc(100vh - 32px);overflow:auto;padding:24px;border:1px solid ' + (dark ? '#334155' : '#e2e8f0') + ';border-radius:18px;background:' + (dark ? '#111827' : '#ffffff') + ';color:' + (dark ? '#f8fafc' : '#0f172a') + ';box-shadow:0 24px 70px rgba(2,6,23,.32);transition:transform .16s ease,opacity .16s ease';
    dialog.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px"><div><div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:#fef2f2;color:#b91c1c;font-size:16px;letter-spacing:2px;font-weight:800;margin-bottom:12px">•••</div><h2 id="un-password-title" style="margin:0;font-size:20px;line-height:1.2;font-weight:800;letter-spacing:-.02em">Actualizar contraseña</h2><p id="un-password-description" style="margin:7px 0 0;font-size:13px;line-height:1.5;color:' + (dark ? '#cbd5e1' : '#64748b') + '">Usa una contraseña nueva de al menos 6 caracteres.</p></div><button type="button" id="un-password-close" aria-label="Cerrar" style="width:32px;height:32px;border:0;border-radius:9px;background:' + (dark ? '#1e293b' : '#f1f5f9') + ';color:' + (dark ? '#cbd5e1' : '#64748b') + ';font-size:20px;line-height:1;cursor:pointer">×</button></div><form id="un-password-form" novalidate><label for="un-password-current" style="display:block;margin:0 0 7px;font-size:12px;font-weight:750;color:' + (dark ? '#e2e8f0' : '#334155') + '">Contraseña actual</label><div style="position:relative;margin-bottom:15px"><input id="un-password-current" type="password" autocomplete="current-password" style="box-sizing:border-box;width:100%;padding:12px 76px 12px 13px;border:1px solid ' + (dark ? '#334155' : '#cbd5e1') + ';border-radius:11px;background:' + (dark ? '#0b1220' : '#f8fafc') + ';color:' + (dark ? '#f8fafc' : '#0f172a') + ';font-size:14px;outline:none"><button type="button" data-password-toggle="un-password-current" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;border-radius:7px;padding:6px 8px;background:transparent;color:#64748b;font-size:11px;font-weight:700;cursor:pointer">Mostrar</button></div><label for="un-password-new" style="display:block;margin:0 0 7px;font-size:12px;font-weight:750;color:' + (dark ? '#e2e8f0' : '#334155') + '">Nueva contraseña</label><div style="position:relative;margin-bottom:15px"><input id="un-password-new" type="password" autocomplete="new-password" style="box-sizing:border-box;width:100%;padding:12px 76px 12px 13px;border:1px solid ' + (dark ? '#334155' : '#cbd5e1') + ';border-radius:11px;background:' + (dark ? '#0b1220' : '#f8fafc') + ';color:' + (dark ? '#f8fafc' : '#0f172a') + ';font-size:14px;outline:none"><button type="button" data-password-toggle="un-password-new" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;border-radius:7px;padding:6px 8px;background:transparent;color:#64748b;font-size:11px;font-weight:700;cursor:pointer">Mostrar</button></div><label for="un-password-confirm" style="display:block;margin:0 0 7px;font-size:12px;font-weight:750;color:' + (dark ? '#e2e8f0' : '#334155') + '">Confirmar nueva contraseña</label><div style="position:relative"><input id="un-password-confirm" type="password" autocomplete="new-password" style="box-sizing:border-box;width:100%;padding:12px 76px 12px 13px;border:1px solid ' + (dark ? '#334155' : '#cbd5e1') + ';border-radius:11px;background:' + (dark ? '#0b1220' : '#f8fafc') + ';color:' + (dark ? '#f8fafc' : '#0f172a') + ';font-size:14px;outline:none"><button type="button" data-password-toggle="un-password-confirm" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;border-radius:7px;padding:6px 8px;background:transparent;color:#64748b;font-size:11px;font-weight:700;cursor:pointer">Mostrar</button></div><p id="un-password-error" role="alert" aria-live="polite" style="display:none;margin:14px 0 0;padding:10px 12px;border-radius:9px;background:#fef2f2;color:#b91c1c;font-size:12px;line-height:1.4"></p><div style="display:flex;justify-content:flex-end;gap:9px;margin-top:22px"><button type="button" id="un-password-cancel" style="padding:10px 15px;border:1px solid ' + (dark ? '#475569' : '#cbd5e1') + ';border-radius:10px;background:transparent;color:' + (dark ? '#cbd5e1' : '#475569') + ';font-size:13px;font-weight:700;cursor:pointer">Cancelar</button><button type="submit" id="un-password-submit" style="padding:10px 16px;border:0;border-radius:10px;background:#b0000b;color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 5px 14px rgba(176,0,11,.2)">Actualizar contraseña</button></div></form>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    var form = document.getElementById('un-password-form');
    var current = document.getElementById('un-password-current');
    var next = document.getElementById('un-password-new');
    var confirm = document.getElementById('un-password-confirm');
    var error = document.getElementById('un-password-error');
    var submit = document.getElementById('un-password-submit');
    var oldOverflow = '';
    function setError(message) {
      error.textContent = message || '';
      error.style.display = message ? 'block' : 'none';
    }
    function close() {
      overlay.style.display = 'none';
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
      form.reset();
      overlay.querySelectorAll('[data-password-toggle]').forEach(function (button) {
        var input = document.getElementById(button.getAttribute('data-password-toggle'));
        if (input) input.type = 'password';
        button.textContent = 'Mostrar';
      });
      setError('');
      if (opener && opener.focus) opener.focus();
    }
    function onKey(event) {
      if (event.key === 'Escape') close();
    }
    overlay._open = function () {
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      setError('');
      window.setTimeout(function () { current.focus(); }, 30);
    };
    overlay._open();
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.getElementById('un-password-close').addEventListener('click', close);
    document.getElementById('un-password-cancel').addEventListener('click', close);
    overlay.querySelectorAll('[data-password-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = document.getElementById(button.getAttribute('data-password-toggle'));
        var visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        button.textContent = visible ? 'Mostrar' : 'Ocultar';
        button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      });
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var currentValue = current.value;
      var nextValue = next.value;
      var confirmValue = confirm.value;
      if (!currentValue || !nextValue || !confirmValue) { setError('Completa los tres campos para continuar.'); return; }
      if (nextValue.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
      if (nextValue !== confirmValue) { setError('Las contraseñas nuevas no coinciden.'); return; }
      submit.disabled = true;
      submit.textContent = 'Guardando…';
      setError('');
      try {
        await api('/api/me', { method: 'PUT', body: { currentPassword: currentValue, newPassword: nextValue } });
        close();
        if (typeof window.showToast === 'function') window.showToast('Contraseña actualizada correctamente.', 'Seguridad');
        else if (window.SA && typeof window.SA.toast === 'function') window.SA.toast('Contraseña actualizada correctamente.', 'Seguridad');
      } catch (errorValue) {
        setError(repairText(errorValue && errorValue.message ? errorValue.message : 'No se pudo actualizar la contraseña.'));
        submit.disabled = false;
        submit.textContent = 'Actualizar contraseña';
      }
    });
  }

  window.addEventListener('storage', function (event) {
    if (!event) return;
    if (event.key === 'unidos_user' || event.key === profilePhotoKey()) paintProfileAvatars();
    if (event.key === 'unidos_token' && !event.newValue) {
      clearLocalSession();
      if (location.pathname !== '/index.html') location.replace('/index.html');
    }
  });
  window.UN = { API: API, api: api, getUser: getUser, setSession: setSession, logout: logout, requestLogout: requestLogout, getProfilePhoto: getProfilePhoto, setProfilePhoto: setProfilePhoto, clearProfilePhoto: clearProfilePhoto, paintProfileAvatars: paintProfileAvatars, requireAuth: requireAuth, requireStaff: requireStaff, requireEspeciales: requireEspeciales, requireElec: requireElec, requireSuperAdmin: requireSuperAdmin, money: money, esc: esc, norm: normalizeText, search: searchableText, matches: matchesText, compact: compactText, repair: repairText, downloadQuote: downloadQuote, printQuote: printQuote, quoteDocHTML: quoteDoc, viewQuote: viewQuote, closeQuoteViewer: closeQuoteViewer, downloadMant: downloadMant, syncCatalog: syncCatalog, watchCatalog: watchCatalog, notifyCatalog: notifyCatalog, rewriteLinks: rewriteLinks, profileMenu: profileMenu, openPasswordModal: openPasswordModal, ensureMenu: ensureMenu, setThemeMode: setThemeMode, applyBrand: applyBrand, brand: { name: BRAND_NAME, subtitle: BRAND_SUBTITLE }, theme: { get: themeGet, set: themeSet } };
  // NOTA: cada diseno conserva su comportamiento original; el conector solo
  // reescribe enlaces, refleja sesion y sincroniza tema/accesibilidad global.
  wrapTextApis();
  applyBrand();
  watchBrand();
  rewriteLinks();
  injectMobileNav();
  injectZoneHeadCSS();
  injectCatalogoDark();
  injectRazerCSS();
  injectA11yAssets();
  migrateAccountPreferences();
  applyA11yLogged();
  watchTheme();
  (function revealZone() {
    var reveal = function () { if (window.UN_ZONE_BOOT && UN_ZONE_BOOT.remove) UN_ZONE_BOOT.remove(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal, { once: true });
    else reveal();
    setTimeout(reveal, 600);
  })();
  // Valida la sesion guardada: si el token ya no sirve (ej. datos reiniciados),
  // se limpia en silencio para no confundir. Solo ante 401/403, nunca por red caida.
  (function validateSession() {
    var token = localStorage.getItem('unidos_token');
    if (!token) return;
    api('/api/me').then(function (me) {
      if (localStorage.getItem('unidos_token') === token) setSession(token, me);
    }).catch(function (e) {
      if (e && (e.status === 401 || e.status === 403) && localStorage.getItem('unidos_token') === token) {
        localStorage.removeItem('unidos_token');
        localStorage.removeItem('unidos_user');
      }
    });
  })();
})();
