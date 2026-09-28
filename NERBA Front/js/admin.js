/* Grupo NERBA HIDALGO - Cableado de las vistas staff (/admin/).
   Las interfaces son los disenos del simulador tal cual; aqui solo se conectan
   datos reales, sesion y guardias. Deteccion automatica por pagina. */
(function () {
  var isElec = /^\/electronica\//.test(location.pathname);
  var BASE = isElec ? '/electronica' : '/admin';
  if (!/^\/admin\//.test(location.pathname) && !isElec) return;
  if (isElec) { if (!UN.requireElec(BASE + '/catalogo.html')) return; }
  else if (!UN.requireStaff(BASE + '/catalogo.html')) return;
  UN.rewriteLinks();
  var user = UN.getUser() || {};
  var esc = UN.esc;
  try { ensureAdminHeader(); } catch (e) { /* header original como respaldo */ }
  // En zona electrónica, los data-path de admin apuntan a su espejo.
  if (isElec) {
    try {
      var ZMAP = { 'admin-catalogo': '/electronica/catalogo.html', 'admin-cotizaciones': '/electronica/cotizaciones.html', 'admin-perfil': '/electronica/perfil.html', 'admin-panel': '/electronica/cotizaciones.html' };
      Object.keys(ZMAP).forEach(function (dp) {
        Array.prototype.slice.call(document.querySelectorAll('[data-path="' + dp + '"]')).forEach(function (a) { a.setAttribute('href', ZMAP[dp]); });
      });
    } catch (e) {}
  }
  // Links del pie por zona (el header ya es único). Solo href="#" sin data-path.
  try {
    Array.prototype.slice.call(document.querySelectorAll('footer a')).forEach(function (a) {
      if ((a.getAttribute('href') || '') !== '#' || a.getAttribute('data-path')) return;
      var t = ((a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase());
      function set(h) { a.setAttribute('href', h); }
      if (t.indexOf('cotizaciones recibidas') >= 0 || t.indexOf('expedientes') >= 0 || t.indexOf('inspecciones') >= 0) set(BASE + '/cotizaciones.html');
      else if (t.indexOf('catálogo') >= 0 || t.indexOf('catalogo') >= 0 || t.indexOf('equipos') >= 0) set(BASE + '/catalogo.html');
      else if (t.indexOf('mantenimiento') >= 0) set(isElec ? BASE + '/historial.html' : BASE + '/mantenimiento.html');
    });
  } catch (e) {}
  function q(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n'); }

  function setName(root, names) {
    if (!root || !user.nombre) return;
    names.forEach(function (n) {
      root.innerHTML = root.innerHTML.split(n).join(esc(user.nombre));
    });
  }

  function ensureAdminHeader() {
    // Header único global: mismo estilo en todos los roles (zona admin o electrónica).
    if (window.UN && UN.ensureMenu) UN.ensureMenu(isElec ? 'electronica' : 'admin');
  }

  /* ================= CATALOGO (gestion + CRUD) ================= */
  var grid = document.getElementById('catalog-grid');
  if (grid && typeof openEditProductModal === 'function') {
    (function () {
      var chip = document.getElementById('user-profile-menu-button');
      if (chip) {
        setName(chip, ['Ing. Carlos Mendoza', 'Carlos Mendoza']);
        UN.profileMenu(chip, BASE + '/perfil.html');
      }
    })();
    var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#e2e8f0"/><text x="400" y="225" font-size="28" text-anchor="middle" fill="#64748b" font-family="sans-serif">Sin fotografía</text></svg>');

    function syncProducts(list) {
      if (typeof PRODUCTS_DATA === 'undefined') return;
      Object.keys(PRODUCTS_DATA).forEach(function (k) { delete PRODUCTS_DATA[k]; });
      list.forEach(function (p) { PRODUCTS_DATA[p.id] = p; });
    }
    function resetFilter() {
      var btn = document.querySelector('button[onclick*="\'todos\'"]');
      if (btn && typeof filterCatalog === 'function') filterCatalog('todos', btn);
    }
    function paintIdeal(card, items) {
      var box = card.querySelector('div.space-y-2\\.5');
      if (!box) return;
      var tpl = box.querySelector('div.flex.items-start');
      box.innerHTML = '';
      (items && items.length ? items : ['Consultar disponibilidad y cobertura.']).forEach(function (t) {
        var row = tpl ? tpl.cloneNode(true) : document.createElement('div');
        var sp = row.querySelectorAll('span');
        var last = sp[sp.length - 1];
        if (last) last.textContent = t;
        else row.textContent = t;
        box.appendChild(row);
      });
    }
    function paintCard(card, p) {
      card.id = 'card-' + p.id;
      card.setAttribute('data-id', p.id);
      card.setAttribute('data-category', p.categoryCode || 'general');
      var img = card.querySelector('img');
      if (img) { img.src = (p.images && p.images[0]) || PLACEHOLDER; img.alt = p.title; }
      var cat = card.querySelector('span.text-label-caps');
      if (cat) cat.textContent = p.category;
      var h3 = card.querySelector('h3');
      if (h3) { h3.textContent = p.title; h3.setAttribute('onclick', "openProductModal('" + p.id + "')"); }
      var desc = card.querySelector('p.font-body-sm');
      if (desc) desc.textContent = p.description;
      paintIdeal(card, p.idealFor);
      card.querySelectorAll('[onclick]').forEach(function (el) {
        var o = el.getAttribute('onclick') || '';
        if (o.indexOf('openEditProductModal(') === 0) el.setAttribute('onclick', "openEditProductModal('" + p.id + "')");
        else if (o.indexOf('openDeleteConfirmModal(') === 0) el.setAttribute('onclick', "openDeleteConfirmModal('" + p.id + "', '" + q(p.title) + "')");
        else if (o.indexOf('openProductModal(') === 0) el.setAttribute('onclick', "openProductModal('" + p.id + "')");
      });
    }
    // Pills de filtro según categorías reales (las del index + las de seguridad).
    // Sin esto, lo nuevo que publique el admin quedaría sin pestaña.
    function repaintAdminPills(list) {
      var box = document.getElementById('filter-container');
      if (!box) return;
      var seen = {}, cats = [];
      (list || []).forEach(function (p) {
        var code = p.categoryCode || 'general';
        if (!seen[code]) { seen[code] = true; cats.push({ code: code, label: p.category || code }); }
      });
      Array.prototype.slice.call(box.querySelectorAll('button')).forEach(function (b) {
        var oc = b.getAttribute('onclick') || '';
        if (oc.indexOf("'todos'") >= 0) return;
        var hit = false;
        cats.forEach(function (c) { if (oc.indexOf("'" + c.code + "'") >= 0) hit = true; });
        if (!hit) b.parentNode.removeChild(b);
      });
      cats.forEach(function (c) {
        var exists = false;
        Array.prototype.slice.call(box.querySelectorAll('button')).forEach(function (b) {
          if ((b.getAttribute('onclick') || '').indexOf("'" + c.code + "'") >= 0) exists = true;
        });
        if (exists) return;
        var ref = box.querySelector('button');
        var b = document.createElement('button');
        b.className = ref ? ref.className : 'catalog-filter-btn';
        b.classList.remove('bg-primary', 'text-on-primary', 'font-bold');
        b.textContent = c.label;
        b.setAttribute('onclick', "filterCatalog('" + c.code.replace(/'/g, "\\'") + "', this)");
        box.appendChild(b);
      });
      var sel = document.getElementById('input-product-category');
      if (sel) {
        var have = {};
        Array.prototype.slice.call(sel.options).forEach(function (o) { have[o.value] = true; });
        var seen2 = {};
        (list || []).forEach(function (p) {
          var code = p.categoryCode || 'general';
          if (!seen2[code]) {
            seen2[code] = true;
            if (!have[code] && code !== '__add_new__') {
              var o = document.createElement('option');
              o.value = code;
              o.textContent = p.category || code;
              var anchor = sel.querySelector('option[value="__add_new__"]');
              if (anchor) sel.insertBefore(o, anchor);
              else sel.appendChild(o);
            }
          }
        });
      }
    }
    async function reconcile() {
      var list = await UN.api('/api/productos');
      syncProducts(list);
      var ids = {};
      list.forEach(function (p) { ids[p.id] = true; });
      var tpl = grid.querySelector('[data-id]');
      Array.prototype.slice.call(grid.children).forEach(function (card) {
        var id = card.getAttribute && card.getAttribute('data-id');
        if (id && !ids[id]) grid.removeChild(card);
      });
      list.forEach(function (p) {
        var card = grid.querySelector('[data-id="' + p.id + '"]');
        if (card) { paintCard(card, p); return; }
        if (!tpl) return;
        var el = tpl.cloneNode(true);
        paintCard(el, p);
        grid.appendChild(el);
      });
      repaintAdminPills(list);
      resetFilter();
    }
    function formPayload() {
      function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
      var sel = document.getElementById('input-product-category');
      var label = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : '';
      var custom = v('input-custom-category-name').trim();
      var code = v('input-product-category');
      if (code === '__add_new__' && custom) {
        code = custom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
        label = custom;
      }
      return {
        title: v('input-product-title'),
        description: v('input-product-desc'),
        categoryCode: code,
        category: label || code,
        idealFor: v('input-product-ideal'),
        images: (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA[v('form-product-id')] && PRODUCTS_DATA[v('form-product-id')].images) || [],
      };
    }
    // Eliminar categoria: quita la seleccionada (base del sistema protegidas).
    // Si tiene publicaciones, pide confirmacion y las elimina tambien.
    window.eliminarCategoria = async function () {
      var sel = document.getElementById('input-product-category');
      if (!sel) return;
      var code = sel.value;
      var label = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : code;
      var BASE = ['cctv', 'cerco', 'alarmas', 'portones', 'placas', 'potencia', 'sensores', 'energizadores'];
      if (!code || code === '__add_new__') { alert('Selecciona primero una categoría de la lista.'); return; }
      if (BASE.indexOf(code) >= 0) { alert('Las categorías base del sistema no se pueden eliminar.'); return; }
      try {
        var list = await UN.api('/api/productos');
        var mine = list.filter(function (p) { return p.categoryCode === code; });
        if (mine.length && !confirm('La categoría "' + label + '" tiene ' + mine.length + ' publicación(es). Se eliminarán también. ¿Continuar?')) return;
        if (!mine.length && !confirm('¿Eliminar la categoría "' + label + '"?')) return;
        for (var i = 0; i < mine.length; i++) {
          await UN.api('/api/productos/' + encodeURIComponent(mine[i].id), { method: 'DELETE', body: {} });
          delete PRODUCTS_DATA[mine[i].id];
        }
        for (var j = sel.options.length - 1; j >= 0; j--) {
          if (sel.options[j].value === code) sel.remove(j);
        }
        document.querySelectorAll('#filter-container button').forEach(function (b) {
          if (b.textContent.trim() === label) b.parentNode.removeChild(b);
        });
        await reconcile();
        if (window.UN && UN.notifyCatalog) UN.notifyCatalog();
        alert(mine.length ? 'Categoría y sus publicaciones eliminadas.' : 'Categoría eliminada.');
      } catch (err) { alert(err.message); }
    };
    window.handleProductFormSubmit = async function (e) {
      e.preventDefault();
      try {
        var idEl = document.getElementById('form-product-id');
        var id = idEl ? idEl.value : '';
        if (id) {
          var upd = await UN.api('/api/productos/' + encodeURIComponent(id), { method: 'PUT', body: formPayload() });
          PRODUCTS_DATA[id] = upd;
          var card = document.getElementById('card-' + id);
          if (card) paintCard(card, upd);
        } else {
          var created = await UN.api('/api/productos', { method: 'POST', body: formPayload() });
          PRODUCTS_DATA[created.id] = created;
          var tpl = grid.querySelector('[data-id]');
          if (tpl) {
            var el = tpl.cloneNode(true);
            paintCard(el, created);
            grid.appendChild(el);
          }
          alert('Publicación "' + created.title + '" creada en el catálogo.');
        }
        closeProductAdminModal();
        resetFilter();
        if (window.UN && UN.notifyCatalog) UN.notifyCatalog();
      } catch (err) { alert(err.message); }
    };
    var __origOpenDel = window.openDeleteConfirmModal;
    window.openDeleteConfirmModal = function (pid, ptitle) {
      window.__delId = pid;
      return __origOpenDel(pid, ptitle);
    };
    window.confirmDeleteCard = async function () {
      var id = window.__delId;
      if (!id) { closeDeleteConfirmModal(); return; }
      try {
        await UN.api('/api/productos/' + encodeURIComponent(id), { method: 'DELETE', body: {} });
        delete PRODUCTS_DATA[id];
        var card = document.getElementById('card-' + id);
        if (card) {
          card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          card.style.transform = 'scale(0.9) translateY(20px)';
          card.style.opacity = '0';
          setTimeout(function () { card.remove(); }, 300);
        }
        closeDeleteConfirmModal();
        if (window.UN && UN.notifyCatalog) UN.notifyCatalog();
      } catch (err) { alert(err.message); }
    };
    reconcile().catch(function (e) { alert(e.message); });
    return;
  }

  /* ================= COTIZACIONES RECIBIDAS ================= */
  var tbody = document.querySelector('tbody');
  if (tbody) tbody.style.display = 'none';
  var buscador = document.getElementById('buscador');
  if (tbody && buscador && typeof abrirModalRespuesta === 'function') {
    (function () {
      var els = document.querySelectorAll('header div');
      for (var i = els.length - 1; i >= 0; i--) {
        if (els[i].querySelector('nav')) continue;
        if (els[i].closest('nav')) continue;
        if (/ADMINISTRADOR/i.test(els[i].textContent) && els[i].querySelector('img')) {
          setName(els[i], ['Carlos Mendoza', 'Ing. Carlos Mendoza']);
          UN.profileMenu(els[i], BASE + '/perfil.html');
          break;
        }
      }
    })();
    var QUOTES = {};
    var MESES = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic' };
    function fechaCorta(iso) {
      var p = String(iso || '').split('-');
      return (p[2] || '') + ' ' + (MESES[p[1]] || '') + ' ' + (p[0] || '');
    }
    function setBadge(cell, estado) {
      estado = String(estado || 'PENDIENTE').toUpperCase();
      var map = {
        APROBADA: ['bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-emerald-500', 'Evaluación Aprobada'],
        RECHAZADA: ['bg-slate-200 text-slate-600 border-slate-300', 'bg-slate-400', 'Rechazada'],
        PENDIENTE: ['bg-amber-100 text-amber-800 border-amber-200', 'bg-amber-500', 'Pendiente Inspección'],
      };
      var m = map[estado] || map.PENDIENTE;
      var dot = cell.querySelector('.flex.items-center > span');
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full ' + (estado === 'APROBADA' ? 'bg-emerald-500' : (estado === 'RECHAZADA' ? 'bg-slate-400' : 'bg-amber-500'));
      var badge = null;
      cell.querySelectorAll('span').forEach(function (s) {
        if (!badge && /Pendiente|Aprobada|Rechazada|Evaluaci/.test(s.textContent)) badge = s;
      });
      if (badge) {
        badge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mt-1.5 ' + m[0];
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full mr-1 ' + m[1] + '"></span>' + m[2];
      }
    }
    function fillRow(tr, c) {
      c.estado = String(c.estado || 'PENDIENTE').toUpperCase();
      tr.setAttribute('data-estado', c.estado);
      tr.setAttribute('data-folio', c.folio);
      tr.className = tr.className.replace(/bg-(amber|emerald)-50\/15/g, '').trim();
      if (c.estado === 'PENDIENTE') tr.classList.add('bg-amber-50/15');
      if (c.estado === 'APROBADA') tr.classList.add('bg-emerald-50/15');
      var tds = tr.children;
      var folioEl = tds[0].querySelector('span.font-mono');
      if (folioEl) folioEl.textContent = c.folio;
      var fechaEl = tds[0].querySelector('div.text-slate-500');
      if (fechaEl) fechaEl.textContent = fechaCorta(c.fecha);
      setBadge(tds[0], c.estado);
      var cells1 = tds[1].querySelectorAll('div');
      if (cells1[0]) cells1[0].textContent = c.nombre;
      cells1.forEach(function (d) {
        if (/^\+[\d\s()+-]+$/.test(d.textContent.trim()) && d.querySelector('svg')) {
          d.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = ' ' + c.telefono; });
        }
        if (/@/.test(d.textContent)) d.textContent = c.email;
      });
      var tds2 = tds[2].querySelectorAll('div');
      if (tds2[1]) tds2[1].textContent = c.tipoInmueble;
      if (tds2[2]) tds2[2].textContent = c.direccion;
      var tds3 = tds[3];
      if (tds3) {
        tds3.querySelectorAll('div.w-12').forEach(function (d) { d.parentNode.removeChild(d); });
        var note = document.createElement('p');
        note.className = 'text-[10px] text-slate-400 italic';
        note.textContent = 'Sin fotos adjuntas.';
        tds3.appendChild(note);
      }
      var reqBox = tds[4].querySelector('div.bg-slate-50');
      if (reqBox) {
        reqBox.innerHTML = '';
        (String(c.descripcion || 'Sin detalle.').split('\n')).forEach(function (ln, i) {
          if (i > 0) reqBox.appendChild(document.createElement('br'));
          reqBox.appendChild(document.createTextNode(ln));
        });
      }
      var btns = tds[5] ? tds[5].querySelectorAll('button[onclick]') : [];
      btns.forEach(function (b) {
        var o = b.getAttribute('onclick') || '';
        var label = (b.textContent || '').trim();
        if (/^(Estatus de la solicitud|Cambiar Estado|Coordinar Visita|Agendar Inspección|Dar Respuesta)$/i.test(label)) b.setAttribute('data-role', 'status');
        if (o.indexOf('abrirModalPdfOficial(') === 0) {
          b.setAttribute('data-role', 'pdf');
          b.setAttribute('onclick', "abrirModalPdfOficial('" + q(c.folio) + "', '" + q(c.nombre) + "', '" + q(c.tipoInmueble) + "', '" + q(c.direccion) + "', '" + q(c.telefono) + "', '" + q(c.email) + "')");
        } else if (o.indexOf('abrirModalRespuesta(') === 0) {
          b.setAttribute('data-role', /whatsapp/i.test(label) ? 'whatsapp' : (/^(Estatus de la solicitud|Cambiar Estado|Coordinar Visita|Agendar Inspección|Dar Respuesta)$/i.test(label) ? 'status' : 'respuesta'));
          b.setAttribute('onclick', "abrirModalRespuesta('" + q(c.nombre) + "', '" + q(c.folio) + "', '" + q(c.telefono) + "', '" + q(c.descripcion) + "', '" + q(c.tipoInmueble) + "')");
        } else if (o.indexOf('eliminarCotizacion(') === 0) {
          b.setAttribute('data-role', 'eliminar');
          b.setAttribute('onclick', "eliminarCotizacion('" + q(c.folio) + "')");
        }
      });
      convertirEstatus(tr, c);
    }
    function convertirEstatus(tr, c) {
      var action = tr.children[5];
      if (!action) return;
      var btn = tr.querySelector('button[data-estatus-control]');
      if (!btn) {
        var buttons = action.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          var candidate = buttons[i];
          var text = (candidate.textContent || '').trim();
          var onclick = candidate.getAttribute('onclick') || '';
          if (candidate.getAttribute('data-role') === 'status' || (!/whatsapp/i.test(text) && /^(Coordinar Visita|Agendar Inspección|Dar Respuesta|Estatus de la solicitud|Cambiar Estado)$/i.test(text))) {
            btn = candidate;
            break;
          }
        }
        if (!btn) {
          for (var j = 0; j < buttons.length; j++) {
            var fallback = buttons[j];
            var fallbackText = (fallback.textContent || '').trim();
            var fallbackOnclick = fallback.getAttribute('onclick') || '';
            if (fallbackOnclick.indexOf('abrirModalRespuesta(') === 0 && !/whatsapp/i.test(fallbackText)) {
              btn = fallback;
              break;
            }
          }
        }
      }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        action.appendChild(btn);
      }
      btn.type = 'button';
      btn.className = 'w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-200 transition whitespace-nowrap';
      btn.setAttribute('data-role', 'status');
      btn.setAttribute('data-estatus-control', '1');
      btn.setAttribute('data-folio', c.folio);
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('onclick');
      btn.textContent = 'Estatus de la solicitud';
      if (btn._unEst) return;
      btn._unEst = true;
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleEstMenu(btn, QUOTES[c.folio] || c);
      });
    }
    var __estMenu = null;
    var __estCloser = null;
    function closeEstMenu() {
      if (__estMenu && __estMenu.parentNode) __estMenu.parentNode.removeChild(__estMenu);
      __estMenu = null;
      if (__estCloser) document.removeEventListener('click', __estCloser);
      __estCloser = null;
    }
    function toggleEstMenu(btn, c) {
      closeEstMenu();
      c = QUOTES[c.folio] || c;
      c.estado = String(c.estado || 'PENDIENTE').toUpperCase();
      var m = document.createElement('div');
      m.className = 'fixed z-[100] w-56 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden';
      m.setAttribute('role', 'menu');
      m.innerHTML = '<p class="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Estatus de ' + esc(c.folio) + '</p>' +
        ['PENDIENTE', 'APROBADA', 'RECHAZADA'].map(function (e) {
          var dot = e === 'APROBADA' ? 'bg-emerald-500' : (e === 'RECHAZADA' ? 'bg-slate-400' : 'bg-amber-500');
          var mark = e === c.estado ? ' ✓' : '';
          var label = e === 'PENDIENTE' ? 'Pendiente' : (e === 'APROBADA' ? 'Aprobada' : 'Rechazada');
          return '<button type="button" data-est="' + e + '" class="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">' +
            '<span class="w-2 h-2 rounded-full ' + dot + '"></span>' + label + mark + '</button>';
        }).join('');
      document.body.appendChild(m);
      var r = btn.getBoundingClientRect();
      var top = r.bottom + 6;
      if (top + m.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - m.offsetHeight - 6);
      m.style.top = top + 'px';
      m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left)) + 'px';
      __estMenu = m;
      btn.setAttribute('aria-expanded', 'true');
      m.querySelectorAll('[data-est]').forEach(function (op) {
        op.addEventListener('click', async function () {
          var est = op.getAttribute('data-est');
          closeEstMenu();
          try {
            var upd = await UN.api('/api/cotizaciones/' + encodeURIComponent(c.folio) + '/estado', { method: 'PUT', body: { estado: est } });
            upd.estado = String(upd.estado || est).toUpperCase();
            QUOTES[c.folio] = upd;
            var tr = btn.closest('tr');
            if (tr) fillRow(tr, upd);
            recount();
            if (typeof mostrarToast === 'function') mostrarToast('Estatus actualizado a ' + est.charAt(0) + est.slice(1).toLowerCase() + '.', 'emerald');
          } catch (err) {
            if (typeof mostrarToast === 'function') mostrarToast(err.message || 'No se pudo actualizar el estatus.', 'red');
            else alert(err.message);
          }
        });
      });
      __estCloser = function (ev) {
        if (__estMenu && !__estMenu.contains(ev.target) && !btn.contains(ev.target)) closeEstMenu();
      };
      setTimeout(function () { document.addEventListener('click', __estCloser); }, 0);
    }
    function recount() {
      var arr = Object.keys(QUOTES).map(function (k) { return QUOTES[k]; });
      var ap = arr.filter(function (x) { return x.estado === 'APROBADA'; }).length;
      var pe = arr.filter(function (x) { return x.estado === 'PENDIENTE'; }).length;
      var re = arr.filter(function (x) { return x.estado === 'RECHAZADA'; }).length;
      document.querySelectorAll('button').forEach(function (b) {
        var t = b.textContent.trim().toLowerCase();
        if (t.indexOf('pendiente') === 0) b.textContent = 'Pendientes (' + pe + ')';
        else if (t.indexOf('rechazada') === 0 || t.indexOf('respondida') === 0) b.textContent = 'Rechazadas (' + re + ')';
        else if (t.indexOf('aprobada') === 0) b.textContent = 'Aprobadas (' + ap + ')';
        else if (t.indexOf('todas') === 0) b.textContent = 'Todas (' + arr.length + ')';
      });
    }
    function paintStats(o) {
      var holder = document.getElementById('admin-stats');
      if (!holder) return;
      var cards = [
        ['description', 'Total recibidas', o.cotizaciones],
        ['pending', 'Pendientes', o.pendientes],
        ['verified', 'Aprobadas', o.aprobadas],
        ['group', 'Usuarios', o.usuarios],
      ];
      holder.innerHTML = cards.map(function (c) {
        var icons = {
          description: '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
          pending: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
          verified: '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
          group: '<path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>'
        };
        return '<div class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">' +
          '<span class="w-11 h-11 rounded-xl grid place-items-center shrink-0" style="background:rgba(217,27,27,.1)"><svg class="w-6 h-6 text-[#d91b1b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (icons[c[0]] || icons.description) + '</svg></span>' +
          '<div><p class="text-2xl font-extrabold leading-none">' + c[2] + '</p>' +
          '<p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">' + c[1] + '</p></div></div>';
      }).join('');
    }
    function paintFilters(o) {
      o = o || {};
      var btns = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        return /^(todos|pendientes|respondidas|aprobadas|rechazadas)/i.test(b.textContent.trim());
      });
      var ACTIVE = 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm transition';
      var rech = Object.keys(QUOTES).filter(function (k) { return QUOTES[k].estado === 'RECHAZADA'; }).length;
      btns.forEach(function (b) {
        if (!b._unCls) b._unCls = b.className;
        var t = b.textContent.trim().toLowerCase();
        var label = t.indexOf('pendiente') === 0 ? 'Pendientes' : (t.indexOf('aprobada') === 0 ? 'Aprobadas' : (t.indexOf('respondida') === 0 || t.indexOf('rechazada') === 0 ? 'Rechazadas' : 'Todas'));
        var n = label === 'Todas' ? (o.cotizaciones == null ? Object.keys(QUOTES).length : o.cotizaciones) : (label === 'Pendientes' ? (o.pendientes == null ? Object.keys(QUOTES).filter(function (k) { return QUOTES[k].estado === 'PENDIENTE'; }).length : o.pendientes) : (label === 'Aprobadas' ? (o.aprobadas == null ? Object.keys(QUOTES).filter(function (k) { return QUOTES[k].estado === 'APROBADA'; }).length : o.aprobadas) : rech));
        var mode = label === 'Todas' ? 'todas' : (label === 'Pendientes' ? 'PENDIENTE' : (label === 'Aprobadas' ? 'APROBADA' : 'RECHAZADA'));
        b.textContent = label + ' (' + n + ')';
        if (b.className.indexOf('bg-slate-900') < 0) b.className = b._unCls;
        b.onclick = function () {
          tbody.querySelectorAll('tr[data-folio]').forEach(function (r) {
            var est = r.getAttribute('data-estado') || '';
            var show = (mode === 'todas' || est === mode);
            r.dataset.quoteMatch = show ? '1' : '0';
            r.style.display = show ? '' : 'none';
          });
          btns.forEach(function (x) { x.className = x._unCls; });
          b.className = ACTIVE;
        };
      });
      paintQuotePager();
    }
    var quotePage = 1;
    function paintQuotePager() {
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-folio]'));
      rows.forEach(function (row) { if (row.dataset.quoteMatch == null) row.dataset.quoteMatch = '1'; });
      var matches = rows.filter(function (row) { return row.dataset.quoteMatch === '1'; });
      var pageSize = 10;
      var pages = matches.length ? Math.ceil(matches.length / pageSize) : 0;
      quotePage = Math.min(Math.max(1, quotePage), pages || 1);
      var start = (quotePage - 1) * pageSize;
      matches.forEach(function (row, index) { row.style.display = index >= start && index < start + pageSize ? '' : 'none'; });
      var label = document.getElementById('quote-pager-label');
      if (label) label.textContent = matches.length ? 'Mostrando ' + (start + 1) + ' a ' + Math.min(matches.length, start + pageSize) + ' de ' + matches.length + ' cotizaciones recibidas' : 'Mostrando 0 cotizaciones recibidas';
      var pager = document.getElementById('quote-pagination');
      if (!pager) return;
      pager.innerHTML = '';
      if (!pages) return;
      function add(labelText, target, disabled) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = labelText;
        button.className = 'px-3 py-1.5 rounded-lg ' + (target === quotePage ? 'bg-brand-600 text-white font-bold' : 'border border-slate-200 bg-white text-slate-600') + (disabled ? ' opacity-40 cursor-not-allowed' : '');
        button.disabled = !!disabled;
        if (!disabled) button.addEventListener('click', function () { quotePage = target; paintQuotePager(); });
        pager.appendChild(button);
      }
      add('Anterior', quotePage - 1, quotePage <= 1);
      for (var n = 1; n <= pages; n++) add(String(n), n, false);
      add('Siguiente', quotePage + 1, quotePage >= pages);
    }
    async function load() {
      var lista;
      try {
        lista = await UN.api('/api/cotizaciones');
        if (isElec) lista = (lista || []).filter(function (c) { return c.area === 'PRODUCTOS_ELECTRONICOS' || c.tipoInmueble === 'Productos Electrónicos'; });
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-sm text-red-700">No se pudieron cargar las cotizaciones. Verifica la sesión del administrador.</td></tr>';
        throw e;
      }
      var ov = { cotizaciones: lista.length, pendientes: 0, aprobadas: 0, usuarios: 0 };
      try {
        ov = await UN.api('/api/admin/overview');
      } catch (e) {}
      for (var k2 in QUOTES) delete QUOTES[k2];
      lista.forEach(function (c) { QUOTES[c.folio] = c; });
      var tpl = Array.prototype.slice.call(tbody.querySelectorAll('tr')).filter(function (row) { return row.children.length >= 6; })[0];
      tbody.innerHTML = '';
      if (!tpl) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-sm text-slate-500">Sin cotizaciones recibidas.</td></tr>';
      } else if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-sm text-slate-500">Sin cotizaciones recibidas.</td></tr>';
      } else {
        lista.forEach(function (c) {
          var tr = tpl.cloneNode(true);
          fillRow(tr, c);
          tbody.appendChild(tr);
        });
       }
       tbody.style.display = '';
       paintStats(ov);
       paintFilters(ov);
       paintQuotePager();
     }
    window.abrirEstatusCotizacion = async function (folio) {
      var btn = document.querySelector('tr[data-folio="' + folio + '"] button[data-estatus-control]');
      if (!btn) {
        var rows = Array.prototype.slice.call(document.querySelectorAll('tbody tr'));
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].textContent.indexOf(folio) < 0) continue;
          btn = Array.prototype.slice.call(rows[i].querySelectorAll('button')).filter(function (b) {
            return (b.textContent || '').trim() === 'Estatus de la solicitud';
          })[0];
          if (btn) break;
        }
      }
      if (!btn) return;
      var c = QUOTES[folio];
      if (!c) {
        try { c = await UN.api('/api/cotizaciones/' + encodeURIComponent(folio)); QUOTES[folio] = c; }
        catch (e) { if (typeof mostrarToast === 'function') mostrarToast(e.message || 'No se encontró la cotización.', 'red'); return; }
      }
      btn.setAttribute('data-estatus-control', '1');
      toggleEstMenu(btn, c);
    };
    tbody.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!b || b._unEst || b.getAttribute('data-estatus-control') !== '1') return;
      var tr = b.closest('tr');
      var folio = tr && (tr.getAttribute('data-folio') || (tr.textContent.match(/COT-[A-Z0-9-]+/i) || [])[0]);
      if (!folio) return;
      ev.preventDefault();
      ev.stopPropagation();
      window.abrirEstatusCotizacion(folio);
    }, true);
    window.descargarPDF = function (folio) {
      var c = QUOTES[folio];
      if (!c) { alert('Folio no encontrado en esta sesión.'); return; }
      // Cierra el modal del expediente primero: una sola ventana (print tab directo, sin visor encima)
      if (typeof cerrarModalPdfOficial === 'function') { try { cerrarModalPdfOficial(); } catch (e) {} }
      UN.downloadQuote(c);
    };
    window.eliminarCotizacion = async function (folio) {
      if (!confirm('¿Eliminar la cotización ' + folio + '? Esta acción no se puede deshacer.')) return;
      try {
        await UN.api('/api/cotizaciones/' + encodeURIComponent(folio), { method: 'DELETE' });
        delete QUOTES[folio];
        var tr = document.querySelector('tbody tr[data-folio="' + folio + '"]');
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
        recount();
        if (typeof mostrarToast === 'function') mostrarToast('Cotización ' + folio + ' eliminada.', 'emerald');
      } catch (err) { alert(err.message); }
    };
    window.actualizarLista = function () {
      load().then(function () { mostrarToast('Bandeja sincronizada con la central.', 'emerald'); }).catch(function (e) { alert(e.message); });
    };
    window.exportarReporte = function () {
      var rows = [['folio', 'fecha', 'cliente', 'email', 'telefono', 'inmueble', 'direccion', 'producto', 'estado', 'total']];
      Object.keys(QUOTES).forEach(function (k) {
        var c = QUOTES[k];
        rows.push([c.folio, c.fecha, c.nombre, c.email, c.telefono, c.tipoInmueble, c.direccion, c.producto, c.estado, c.total]);
      });
      var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'cotizaciones.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); }, 500);
      mostrarToast('Reporte CSV descargado.', 'emerald');
    };
    load().catch(function (e) { alert(e.message); });
    return;
  }

  /* Anti-bloqueo de scroll: Escape cierra cualquier modal admin y libera el scroll.
     Red de seguridad por si algun flujo deja el overflow trabado. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['product-admin-modal', 'delete-confirm-modal', 'product-detail-modal',
     'modal-respuesta', 'modal-pdf-oficial', 'modal-foto-preview', 'modal-mantenimiento'].forEach(function (id) {
      var m = document.getElementById(id);
      if (m && !m.classList.contains('hidden')) {
        m.classList.add('hidden');
        m.classList.remove('flex', 'modal-visible');
        m.classList.add('modal-hidden');
      }
    });
    document.body.style.overflow = '';
  });
  window.addEventListener('pageshow', function () { document.body.style.overflow = ''; });

    /* ================= MANTENIMIENTOS (diseno real) ================= */
  var mantTable = document.getElementById('maintenance-table');
  if (mantTable) {
    (function () {
      var els = document.querySelectorAll('header div');
      for (var i = els.length - 1; i >= 0; i--) {
        if (els[i].querySelector('nav')) continue;
        if (els[i].closest('nav')) continue;
        if (/ADMINISTRADOR/i.test(els[i].textContent) && els[i].querySelector('img')) {
          setName(els[i], ['Carlos Mendoza', 'Ing. Carlos Mendoza']);
          var nm = els[i].querySelector('span.text-sm, span.font-bold');
          void nm;
          UN.profileMenu(els[i], BASE + '/perfil.html');
          break;
        }
      }
    })();
    var MANTS = {};
    var fE = 'todas', fQ = '', fOrden = 'recientes', fPag = 1;
    var POR_PAG = 8;
    function setBadge(cell, estado) {
      var map = {
        REALIZADA: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-emerald-500', 'Realizada'],
        EN_PROCESO: ['bg-blue-50 text-blue-700 border-blue-200', 'bg-blue-500', 'En Proceso'],
        PENDIENTE: ['bg-amber-100 text-amber-800 border-amber-200', 'bg-amber-500', 'Pendiente Revisión'],
      };
      var m = map[estado] || map.PENDIENTE;
      var badge = null;
      cell.querySelectorAll('span').forEach(function (s) {
        if (/Pendiente|Proceso|Camino|Realizada|Revisi/.test(s.textContent)) badge = s;
      });
      if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 w-max px-2.5 py-0.5 rounded-full text-xs font-bold border ' + m[0];
        badge.innerHTML = '<span class="badge-dot ' + m[1] + '"></span> ' + m[2];
      }
    }
    function fechaLarga(iso) {
      var p = String(iso || '').split('-');
      return (p[2] || '') + '/' + (p[1] || '') + '/' + (p[0] || '');
    }
    function buildRow(tpl, c) {
      var tr = tpl.cloneNode(true);
      tr.setAttribute('data-estado', c.estado);
      var tds = tr.children;
      var f0 = tds[0].querySelector('span.font-extrabold');
      if (f0) f0.textContent = c.id;
      var fdate = tds[0].querySelector('div.text-slate-400');
      if (fdate) fdate.textContent = fechaLarga(c.fecha);
      setBadge(tds[0], c.estado);
      tds[0].querySelectorAll('span.text-slate-600').forEach(function (s) {
        if (/^COT-/.test(s.textContent.trim())) s.textContent = c.folio || '—';
      });
      var n0 = tds[1].querySelector('span.font-bold');
      if (n0) n0.textContent = c.nombre;
      tds[1].querySelectorAll('span').forEach(function (s) {
        if (/@/.test(s.textContent)) s.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = ' ' + c.email; });
      });
      var telOk = false;
      tds[1].querySelectorAll('span, div').forEach(function (d) {
        if (!telOk && /^\+[\d\s()+-]+$/.test(d.textContent.trim()) && d.querySelector('svg')) {
          d.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = ' ' + c.telefono; });
          telOk = true;
        }
      });
      var t2 = tds[2].querySelectorAll('span');
      if (t2[0]) {
        var keep = t2[0].querySelector('svg');
        t2[0].textContent = '';
        if (keep) t2[0].appendChild(keep);
        t2[0].appendChild(document.createTextNode(c.tipoInmueble || 'General'));
      }
      var dparts = tds[2].querySelectorAll('span.text-xs, div.text-xs');
      if (dparts[1]) dparts[1].textContent = c.direccion || '—';
      var refs = tds[2].querySelectorAll('span.text-\\[11px\\], div.text-\\[11px\\]');
      if (refs[0]) {
        if (c.folio) { refs[0].style.display = ''; refs[0].textContent = 'Ref: ' + c.folio; }
        else { refs[0].style.display = 'none'; }
      }
      var det = tds[3].querySelector('p');
      if (det) {
        det.innerHTML = '';
        String(c.descripcion || 'Sin detalle.').split('\n').forEach(function (ln, i) {
          if (i > 0) det.appendChild(document.createElement('br'));
          det.appendChild(document.createTextNode(ln));
        });
      }
      var tags = tds[3].querySelector('div.mt-2');
      if (tags) tags.parentNode.removeChild(tags);
      var acc = tds[4];
      acc.querySelectorAll('button, a').forEach(function (b) { b.parentNode.removeChild(b); });
      var box = acc.querySelector('div') || acc;
      while (box.firstChild) box.removeChild(box.firstChild);
      function mkBtn(cls, label, fn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
      }
      async function setEst(est) {
        try {
          var upd = await UN.api('/api/mantenimiento/' + encodeURIComponent(c.id), { method: 'PUT', body: { estado: est } });
          MANTS[upd.id] = upd;
          render();
        } catch (e) { alert(e.message); }
      }
      if (c.estado === 'PENDIENTE') {
        box.appendChild(mkBtn('w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition', 'Coordinar Visita', function () { setEst('EN_PROCESO'); }));
      }
      if (c.estado !== 'REALIZADA') {
        box.appendChild(mkBtn('w-full inline-flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition', 'Marcar Realizada', function () { setEst('REALIZADA'); }));
      }
      if (c.estado !== 'PENDIENTE') {
        box.appendChild(mkBtn('w-full inline-flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition', 'Regresar a Pendiente', function () { setEst('PENDIENTE'); }));
      }
      var wa = document.createElement('a');
      wa.className = 'w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition';
      wa.textContent = 'WhatsApp';
      var tel = String(c.telefono || '').replace(/\D/g, '');
      if (tel && tel[0] !== '5') tel = '52' + tel;
      wa.href = 'https://wa.me/' + tel + '?text=' + encodeURIComponent('Hola ' + c.nombre + ', sobre tu solicitud ' + c.id + ': ');
      wa.target = '_blank';
      box.appendChild(wa);
      var pdf = document.createElement('button');
      pdf.type = 'button';
      pdf.className = 'w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      pdf.textContent = 'Ficha PDF';
      pdf.addEventListener('click', function () { UN.downloadMant(c, true); });
      box.appendChild(pdf);
      return tr;
    }
    function listaFiltrada() {
      var arr = Object.keys(MANTS).map(function (k) { return MANTS[k]; });
      arr = arr.filter(function (m) {
        return (fE === 'todas' || m.estado === fE) &&
          (!fQ || UN.matches(m.id + ' ' + m.nombre + ' ' + (m.email || ''), fQ));
      });
      arr.sort(function (a, b) {
        if (fOrden === 'antiguas') return String(a.fecha).localeCompare(String(b.fecha));
        if (fOrden === 'prioridad') {
          var w = { PENDIENTE: 0, EN_PROCESO: 1, REALIZADA: 2 };
          return (w[a.estado] == null ? 9 : w[a.estado]) - (w[b.estado] == null ? 9 : w[b.estado]);
        }
        return String(b.fecha).localeCompare(String(a.fecha));
      });
      return arr;
    }
    function paintStats() {
      var arr = Object.keys(MANTS).map(function (k) { return MANTS[k]; });
      var vals = { total: arr.length,
        pe: arr.filter(function (x) { return x.estado === 'PENDIENTE'; }).length,
        ep: arr.filter(function (x) { return x.estado === 'EN_PROCESO'; }).length,
        re: arr.filter(function (x) { return x.estado === 'REALIZADA'; }).length };
      document.querySelectorAll('main span.text-3xl, section span.text-3xl').forEach(function (sp) {
        var box = sp.parentElement && sp.parentElement.parentElement;
        var label = box ? box.textContent : '';
        if (/Total Solicitudes/i.test(label)) sp.textContent = vals.total;
        else if (/Pendientes/i.test(label)) sp.textContent = vals.pe;
        else if (/Revisi|Proceso/i.test(label)) sp.textContent = vals.ep;
        else if (/Realizada/i.test(label)) sp.textContent = vals.re;
      });
      var badge = document.getElementById('mant-nav-count');
      if (badge) badge.textContent = vals.pe;
      recount(vals);
    }
    function recount(v) {
      v = v || (function () {
        var arr = Object.keys(MANTS).map(function (k) { return MANTS[k]; });
        return { todas: arr.length,
          pendientes: arr.filter(function (x) { return x.estado === 'PENDIENTE'; }).length,
          proceso: arr.filter(function (x) { return x.estado === 'EN_PROCESO'; }).length,
          realizadas: arr.filter(function (x) { return x.estado === 'REALIZADA'; }).length };
      })();
      document.querySelectorAll('button').forEach(function (b) {
        var t = b.textContent.trim().toLowerCase();
        if (t.indexOf('todas') === 0) b.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = 'Todas (' + v.todas + ') '; });
        else if (t.indexOf('pendiente') === 0) b.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = 'Pendientes (' + v.pendientes + ') '; });
        else if (t.indexOf('en proceso') === 0) b.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = 'En Proceso (' + v.proceso + ') '; });
        else if (t.indexOf('realizada') === 0) b.childNodes.forEach(function (n) { if (n.nodeType === 3) n.nodeValue = 'Realizadas (' + v.realizadas + ') '; });
      });
    }
    function paintFilters() {
      var btns = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        return /^(todas|pendientes|en proceso|realizadas)/i.test(b.textContent.trim());
      });
      var ACTIVE = 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm transition';
      btns.forEach(function (b) {
        if (!b._unCls) b._unCls = b.className;
        b.onclick = function () {
          var t = b.textContent.trim().toLowerCase();
          fE = t.indexOf('pendiente') === 0 ? 'PENDIENTE' : (t.indexOf('en proceso') === 0 ? 'EN_PROCESO' : (t.indexOf('realizada') === 0 ? 'REALIZADA' : 'todas'));
          fPag = 1;
          render();
          btns.forEach(function (x) { x.className = x._unCls; });
          b.className = ACTIVE;
        };
      });
    }
    function paintPagin(total) {
      var pages = Math.max(1, Math.ceil(total / POR_PAG));
      if (fPag > pages) fPag = pages;
      var box = document.querySelector('[data-purpose="pagination-controls"]');
      if (!box) return;
      var spans = box.querySelectorAll('span');
      if (spans[0]) {
        var ini = total ? (fPag - 1) * POR_PAG + 1 : 0;
        var fin = Math.min(total, fPag * POR_PAG);
        spans[0].innerHTML = 'Mostrando <b>' + ini + '</b> a <b>' + fin + '</b> de <b>' + total + '</b> solicitudes registradas';
      }
      var nums = box.querySelectorAll('button');
      var holder = nums.length ? nums[0].parentNode : null;
      nums.forEach(function (b) {
        var t = b.textContent.trim().toLowerCase();
        if (t !== 'anterior' && t !== 'siguiente' && !/^\d+$/.test(t)) return;
        if (t === 'anterior') b.onclick = function () { if (fPag > 1) { fPag--; render(); } };
        else if (t === 'siguiente') b.onclick = function () {
          if (fPag < pages) { fPag++; render(); }
        };
      });
      if (holder) {
        Array.prototype.slice.call(holder.children).forEach(function (b) {
          if (/^\d+$/.test(b.textContent.trim())) holder.removeChild(b);
        });
        var prev = null;
        Array.prototype.slice.call(holder.children).forEach(function (b) {
          if (b.textContent.trim().toLowerCase() === 'anterior') prev = b;
        });
        var show = Math.min(pages, 12);
        for (var pg = 1; pg <= show; pg++) {
          (function (pg) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = String(pg);
            var active = pg === fPag;
            b.className = active
              ? 'w-8 h-8 rounded-lg bg-brand-600 text-white text-xs font-bold shadow-sm'
              : 'w-8 h-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold bg-white transition';
            b.onclick = function () { fPag = pg; render(); };
            if (prev && prev.nextSibling) holder.insertBefore(b, prev.nextSibling);
            else holder.appendChild(b);
            prev = b;
          })(pg);
        }
      }
    }
    var POR_PAG = 8;
    var tplRow = null;
    function render() {
      var lista = listaFiltrada();
      var tbody = document.querySelector('#maintenance-table tbody');
      if (!tplRow) {
        var first = tbody.querySelector('tr');
        if (first) tplRow = first.cloneNode(true);
      }
      tbody.innerHTML = '';
      var slice = lista.slice((fPag - 1) * POR_PAG, fPag * POR_PAG);
      slice.forEach(function (c) { tbody.appendChild(buildRow(tplRow, c)); });
      if (!slice.length) {
        var tr0 = document.createElement('tr');
        tr0.innerHTML = '<td colspan="5" class="text-center text-slate-500 py-6">Sin solicitudes.</td>';
        tbody.appendChild(tr0);
      }
      paintPagin(lista.length);
    }
    async function load() {
      var lista = await UN.api('/api/mantenimiento');
      for (var k in MANTS) delete MANTS[k];
      lista.forEach(function (m) { MANTS[m.id] = m; });
      render();
      paintStats();
      paintFilters();
      recount();
    }
    (function () {
      var q = document.querySelector('input[placeholder*="Buscar por folio"]');
      if (q) q.addEventListener('input', function (e) { fQ = e.target.value.trim(); fPag = 1; render(); });
      var sels = document.querySelectorAll('select');
      sels.forEach(function (s) {
        var has = false;
        Array.prototype.slice.call(s.options || []).forEach(function (o) {
          if (/reciente|antigua|prioridad/i.test(o.text)) has = true;
        });
        if (has) s.addEventListener('change', function () {
          var v = s.value.toLowerCase();
          fOrden = v.indexOf('antigua') >= 0 ? 'antiguas' : (v.indexOf('prioridad') >= 0 ? 'prioridad' : 'recientes');
          fPag = 1;
          render();
        });
      });
      document.querySelectorAll('button').forEach(function (b) {
        var t = b.textContent.trim();
        if (t === 'Exportar CSV') b.addEventListener('click', function () {
          var rows = [['id', 'folio', 'fecha', 'cliente', 'email', 'telefono', 'direccion', 'descripcion', 'estado']];
          Object.keys(MANTS).forEach(function (k) {
            var m = MANTS[k];
            rows.push([m.id, m.folio, m.fecha, m.nombre, m.email, m.telefono, m.direccion, m.descripcion, m.estado]);
          });
          var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' }));
          a.download = 'mantenimientos.csv';
          document.body.appendChild(a); a.click();
          setTimeout(function () { document.body.removeChild(a); }, 500);
        });
        if (t === 'Sincronizar') b.addEventListener('click', function () { load().catch(function (e) { alert(e.message); }); });
      });
    })();
    load().catch(function (e) { alert(e.message); });
    return;
  }


  /* ================= PERFIL ADMIN ================= */
  var seccion = document.getElementById('seccion-contacto');
  if (seccion && document.getElementById('btn-save-master')) {
    var bc = document.getElementById('breadcrumb-home');
    if (bc) {
      var nc = bc.cloneNode(true);
      nc.setAttribute('href', BASE + (isElec ? '/historial.html' : '/mantenimiento.html'));
      nc.removeAttribute('id');
      bc.parentNode.replaceChild(nc, bc);
    }
    UN.api('/api/me').then(function (me) {
      UN.setSession(localStorage.getItem('unidos_token'), me);
      var fi = function (id, v) { var el = document.getElementById(id); if (el && v !== undefined) el.value = v; return el ? el.value : ''; };
      fi('input-fullname', me.nombre || '');
      fi('input-email', me.email || '');
      fi('input-phone', me.telefono || '');
      fi('input-phone2', me.telefonoSec || '');
      fi('input-company', me.empresa || '');
      var h3 = seccion.querySelector('h3');
      if (h3 && me.nombre) h3.textContent = me.nombre;
      // el nombre tambien abre el mini-menu (igual que en las demas interfaces)
      if (h3) UN.profileMenu(h3, BASE + '/perfil.html');
      var rolChip = Array.prototype.slice.call(seccion.querySelectorAll('span')).filter(function (s) {
        return /VERIFICADO|ADMINISTRADOR/.test(s.textContent) && s.textContent.length < 30;
      })[0];
      if (rolChip && me.rol) rolChip.textContent = me.rol + ' VERIFICADO';
      var chip2 = document.getElementById('user-profile-menu-button');
      if (chip2) {
        var nm = chip2.querySelector('div.hidden span, span.font-bold');
        if (nm && me.nombre) nm.textContent = me.nombre;
        UN.profileMenu(chip2, BASE + '/perfil.html');
      } else {
        // sin chip en esta vista: el avatar abre el mismo mini-menu (perfil/salir)
        var av = seccion.querySelector('div.relative.group');
        if (av) UN.profileMenu(av, BASE + '/perfil.html');
      }
    }).catch(function (e) {
      if (e && (e.status === 401 || e.status === 403)) location.href = '/login.html?next=' + encodeURIComponent(BASE + '/perfil.html');
    });
    var btnSave = document.getElementById('btn-save-master');
    if (btnSave) btnSave.addEventListener('click', async function () {
      function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
      try {
        // El diseno no tiene input-address: la direccion no se toca desde aqui.
        var body = {
          nombre: v('input-fullname').trim(),
          telefono: v('input-phone').trim(),
          telefonoSec: v('input-phone2').trim(),
          empresa: v('input-company').trim(),
        };
        if (!body.nombre) { alert('Escribe tu nombre completo.'); return; }
        var me = await UN.api('/api/me', { method: 'PUT', body: body });
        UN.setSession(localStorage.getItem('unidos_token'), me);
        if (typeof showToast === 'function') showToast('Datos actualizados.', 'Perfil Actualizado');
        else alert('Perfil actualizado.');
      } catch (e) { alert(e.message); }
    });

  }
})();
