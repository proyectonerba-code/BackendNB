/* Grupo NERBA HIDALGO - Catálogo dinámico del index (index + admin + súper).
   Render desde /api/productos + /api/categorias. Sin red: diseño demo intacto. */
  // Catálogo del index conectado al backend (lo gestionan admin/superadmin).
  // Sin red o vacío: se conserva el diseño demo intacto.
  (function () {
    if (!window.UN) return;
    var grid = document.getElementById('catalog-grid');
    var pills = document.getElementById('category-cards-nav');
    if (!grid || !pills) return;
    // El header fijo tapaba el contenido al hacer scroll: margen de anclaje.
    try {
      if (!document.getElementById('un-idx-fix')) {
        var __st = document.createElement('style');
        __st.id = 'un-idx-fix';
        __st.textContent = '#seccion-catalogo{scroll-margin-top:76px}#catalog-drawer{scroll-margin-top:76px}';
        document.head.appendChild(__st);
      }
    } catch (e) {}
    // Estilos de la animacion "agregado": chispas, onda y la miniatura que vuela.
    try {
      if (!document.getElementById('un-fly-css')) {
        var __fs = document.createElement('style');
        __fs.id = 'un-fly-css';
        __fs.textContent =
          '.unfly-dot{position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;' +
          'background:radial-gradient(circle at 35% 35%,#ff6b6b,#d91b1b 70%);z-index:9000;pointer-events:none;' +
          'box-shadow:0 4px 14px rgba(217,27,27,.55)}' +
          '.unfly-thumb{position:fixed;left:0;top:0;object-fit:cover;border-radius:12px;border:3px solid #fff;' +
          'box-shadow:0 12px 30px rgba(217,27,27,.4);z-index:9000;pointer-events:none}' +
          '.unfly-bit{position:fixed;left:0;top:0;border-radius:50%;z-index:9000;pointer-events:none}' +
          '.unfly-ring{position:fixed;border:3px solid rgba(217,27,27,.5);border-radius:50%;z-index:8999;pointer-events:none}' +
          '@media (prefers-reduced-motion:reduce){.unfly-bit,.unfly-ring,.unfly-thumb{animation:none}}';
        document.head.appendChild(__fs);
      }
    } catch (e) {}
    var OLD_CATS = ['cctv', 'cerco', 'alarmas', 'portones'];
    var first = true;
    var canQuote = true;
    // Jerarquía del catálogo: MARCA (nivel 1) -> TIPO/CATEGORÍA (nivel 2) -> producto.
    var DEFAULT_BRAND = 'NERBA';
    var cardTpl = grid.querySelector('.component-card');
    var pillsTpl = pills.querySelector('[data-category]');
    var catMetaAll = {};
    var marcasMetaAll = {};
    var activeBrand = null;
    var curGroups = {}, curOrder = [], curType = null;
    var hierCss = false;
  try {
    var __u0 = (window.UN && UN.getUser()) || {};
    var __r0 = String(__u0.rol || '').toUpperCase();
    canQuote = !localStorage.getItem('unidos_token') || !__r0 || __r0 === 'CLIENTE';
  } catch (e) {}
  function paintIdeal(box, items) {
      var ul = box.querySelector('ul');
      if (!ul) return;
      var li0 = ul.querySelector('li');
      ul.innerHTML = '';
      (items && items.length ? items : ['Consultar disponibilidad y cobertura.']).slice(0, 3).forEach(function (t) {
        var li = li0 ? li0.cloneNode(true) : document.createElement('li');
        var spans = li.querySelectorAll('span');
        var last = spans[spans.length - 1];
        if (last) last.textContent = t;
        else li.textContent = t;
        ul.appendChild(li);
      });
    }
    function cardFor(p) {
      var tpl = cardTpl || grid.querySelector('.component-card');
      if (!tpl) return null;
      var el = tpl.cloneNode(true);
      el.removeAttribute('style');
      el.setAttribute('data-id', p.id || '');
      el.setAttribute('data-category', p.categoryCode || 'general');
      el.setAttribute('data-brand', brandSlug(brandOf(p)));
      var img = el.querySelector('img');
      if (img && p.images && p.images[0]) { img.src = p.images[0]; img.alt = p.title; }
      var chip = el.querySelector('.absolute.top-4 span');
      if (chip) chip.textContent = (p.category || '').toUpperCase();
      var h3 = el.querySelector('h3');
      if (h3) h3.textContent = p.title;
      var desc = el.querySelector('p.text-sm');
      if (desc) desc.textContent = p.description;
      var box = el.querySelector('.bg-neutral-50');
      if (box) paintIdeal(box, p.idealFor);
      var price = el.querySelector('.absolute.bottom-4.right-4');
      if (price && price.parentNode) price.parentNode.removeChild(price);
      // Limpieza pedida: fuera el chip de esquina (IOT CORE y así).
      var corner = el.querySelector('.absolute.top-4');
      if (corner && corner.parentNode) corner.parentNode.removeChild(corner);
      Array.prototype.slice.call(el.querySelectorAll('button')).forEach(function (b) {
        var bt = (b.textContent || '').toUpperCase();
        if (bt.indexOf('COTIZAR') >= 0) {
          // Solo los productos electrónicos muestran Cotizar; el resto
          // (automatización/instalación) es solo Saber más. El staff no
          // cotiza: su botón queda inerte, sin redirigir a ningún lado.
          if (p.electronico === false || !canQuote) {
            if (b.parentNode) b.parentNode.removeChild(b);
          } else {
            b.setAttribute('onclick', "window.__unCotizar && window.__unCotizar('" + String(p.id || '').replace(/'/g, '') + "', this)");
          }
        } else if (bt.indexOf('SABER') >= 0) {
          b.setAttribute('onclick', "window.__unDetail && window.__unDetail('" + String(p.id || '').replace(/'/g, '') + "')");
        }
      });
      return el;
    }
    function brandOf(p) { return String((p && p.brand) || '').trim() || DEFAULT_BRAND; }
    function typeOf(p) { return String((p && p.category) || '').trim() || 'General'; }
    function typeCodeOf(p) { return String((p && p.categoryCode) || '').trim() || 'general'; }
    function brandSlug(s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nerba';
    }
    function esc(s) { try { return UN.esc(s); } catch (e) { return String(s == null ? '' : s); } }
    function ensureHierCss() {
      if (hierCss) return;
      hierCss = true;
      var st = document.createElement('style');
      st.id = 'un-hier-css';
      st.textContent =
        // El contenedor del diseño es un grid de 2 columnas: en modo jerárquico
        // los cuadritos de tipo y los productos se apilan a lo ancho completo.
        '#catalog-grid.un-hier{display:block}' +
        '.un-types-nav{display:grid;grid-template-columns:1fr;gap:16px;margin:0 0 24px}' +
        '@media (min-width:640px){.un-types-nav{grid-template-columns:repeat(2,1fr)}}' +
        '@media (min-width:1024px){.un-types-nav{grid-template-columns:repeat(3,1fr)}}' +
        '.un-type-card>div:first-child{height:104px}' +
        // Sin foto propia: iniciales sobre fondo neutro (nunca la imagen de un producto).
        '.un-ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif;font-weight:800;font-size:30px;' +
        'letter-spacing:.04em;color:#94a3b8;background:linear-gradient(135deg,#f1f5f9,#e2e8f0)}' +
        '.category-card.is-active .un-ini{color:#ffb4aa;background:linear-gradient(135deg,#1c1c24,#0b0b11)}' +
        'html.dark-mode .un-ini,html.dark .un-ini{color:#64748b;background:linear-gradient(135deg,#15151d,#0b0b11)}' +
        // El diseño pinta la tarjeta activa en negro: su texto va en claro.
        '.category-card.is-active h3,.category-card.is-active p{color:#fff!important;transition:none!important}' +
        '.category-card.is-active .category-arrow{color:#ffb4aa!important}' +
        '.un-type-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 16px;padding:0 2px}' +
        '.un-type-dot{width:10px;height:10px;border-radius:50%;background:#d91b1b;flex-shrink:0}' +
        '.un-type-name{font-size:15px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#0f172a}' +
        '.un-type-count{font-size:11px;font-weight:800;color:#b91c1c;background:#fef2f2;border:1px solid #fee2e2;border-radius:9999px;padding:3px 9px;white-space:nowrap}' +
        'html.dark-mode .un-type-name,html.dark .un-type-name{color:#eaf1ff}' +
        '.un-type-grid{display:grid;grid-template-columns:1fr;gap:24px}' +
        '@media (min-width:768px){.un-type-grid{grid-template-columns:repeat(2,1fr)}}' +
        '.un-type-grid .component-card{display:flex!important;animation:unTypeIn .28s ease}' +
        // Solo desplazamiento: la animación nunca oculta las tarjetas.
        '@keyframes unTypeIn{from{transform:translateY(8px)}to{transform:none}}' +
        '@media (prefers-reduced-motion:reduce){.un-type-grid .component-card{animation:none}}' +
        '.un-type-empty{font-size:13px;color:#64748b;padding:18px 2px;margin:0}';
      document.head.appendChild(st);
    }
    // Agrupa la lista de productos por marca y, dentro de cada marca, por tipo.
    // La imagen es la que el staff subió para esa marca, no la de un producto.
    function computeBrands(list, marcasMeta) {
      var map = {}, out = [];
      (list || []).forEach(function (p) {
        var name = brandOf(p), code = brandSlug(name);
        if (!map[code]) {
          var meta = (marcasMeta || {})[code] || null;
          map[code] = { code: code, label: name, types: {}, n: 0, image: (meta && meta.image) || '' };
          out.push(map[code]);
        }
        map[code].types[typeCodeOf(p)] = true;
        map[code].n++;
      });
      out.forEach(function (b) {
        var t = Object.keys(b.types).length;
        b.sub = t + (t === 1 ? ' tipo · ' : ' tipos · ') + b.n + (b.n === 1 ? ' producto' : ' productos');
      });
      return out;
    }
    // Sin imagen propia se muestran las iniciales: nunca la foto de un producto.
    function initialsOf(label) {
      var words = String(label || '').trim().split(/\s+/)
        .filter(function (w) { return /[a-z0-9\u00c0-\u024f]/i.test(w); });
      if (!words.length) return '?';
      if (words.length > 1) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
      var w = words[0].replace(/[^a-z0-9\u00c0-\u024f]/gi, '');
      return (w.length <= 4 ? w : w.charAt(0)).toUpperCase();
    }
    function putImage(el, label, image) {
      var box = el.querySelector('img');
      if (!box) return;
      if (image) { box.src = image; box.alt = label; return; }
      var ini = document.createElement('div');
      ini.className = 'un-ini';
      ini.setAttribute('aria-hidden', 'true');
      ini.textContent = initialsOf(label);
      if (box.parentNode) box.parentNode.replaceChild(ini, box);
    }
    // Un cuadrito del diseño (imagen + nombre + bajada), igual para marcas y tipos.
    function buildCard(attr, code, label, sub, image, action) {
      var el = pillsTpl.cloneNode(true);
      el.classList.remove('is-active');
      el.removeAttribute('style');
      el.removeAttribute('data-category');
      el.setAttribute(attr, code);
      el.setAttribute('onclick', action + "('" + String(code).replace(/'/g, "\\'") + "', this)");
      Array.prototype.slice.call(el.querySelectorAll('.category-badge')).forEach(function (x) {
        if (x.parentNode) x.parentNode.removeChild(x);
      });
      putImage(el, label, image);
      var h3 = el.querySelector('h3');
      if (h3) h3.textContent = label;
      var p = el.querySelector('p');
      if (p) p.textContent = sub;
      var ar = el.querySelector('.category-arrow span');
      if (ar) ar.textContent = 'arrow_forward';
      return el;
    }
    // Las tarjetas de arriba son las marcas; dentro de cada una, los tipos.
    function buildBrandCards(list) {
      if (!pillsTpl) return false;
      pills.innerHTML = '';
      list.forEach(function (b) {
        pills.appendChild(buildCard('data-brand', b.code, b.label, b.sub, b.image, 'openBrand'));
      });
      return true;
    }
    function sizeDrawer() {
      var d = document.getElementById('catalog-drawer');
      if (!d || !activeBrand) return;
      d.style.maxHeight = Math.max(2000, d.scrollHeight + 80) + 'px';
    }
    // Dentro de la marca activa: un acordeón por tipo, con los productos debajo.
    // Dentro de la marca activa: cuadritos de tipo y, abajo, los productos
    // del tipo que se elija.
    function renderGroups(brandCode) {
      var list = [];
      try { list = window.__unProducts || []; } catch (e) {}
      ensureHierCss();
      grid.classList.add('un-hier');
      var groups = {}, order = [];
      list.forEach(function (p) {
        if (brandSlug(brandOf(p)) !== brandCode) return;
        var c = typeCodeOf(p);
        if (!groups[c]) { groups[c] = { code: c, label: typeOf(p), items: [], image: '' }; order.push(c); }
        groups[c].items.push(p);
      });
      curGroups = groups; curOrder = order;
      grid.innerHTML = '';
      if (!order.length) {
        var e0 = document.createElement('p');
        e0.className = 'un-type-empty';
        e0.textContent = 'Esta marca todavía no tiene publicaciones.';
        grid.appendChild(e0);
        return;
      }
      var nav = document.createElement('div');
      nav.className = 'un-types-nav';
      grid.appendChild(nav);
      var box = document.createElement('div');
      box.id = 'un-type-prods';
      box.innerHTML = '<div class="un-type-top"><span class="un-type-dot"></span>' +
        '<span class="un-type-name" id="un-type-name"></span>' +
        '<span class="un-type-count" id="un-type-count"></span></div>' +
        '<div class="un-type-grid" id="un-type-grid"></div>';
      grid.appendChild(box);
      order.forEach(function (c) {
        var g = groups[c];
        g.image = (catMetaAll[c] && catMetaAll[c].image) || '';
        var n = g.items.length;
        var el = buildCard('data-type', c, g.label, n + (n === 1 ? ' producto' : ' productos'), g.image, 'openType');
        el.classList.add('un-type-card');
        nav.appendChild(el);
      });
      // El tipo elegido se mantiene al recargar; si ya no existe, el primero.
      var keep = (curOrder.indexOf(curType) >= 0) ? curType : order[0];
      openType(keep, nav.querySelector('[data-type="' + String(keep).replace(/"/g, '\\"') + '"]'));
    }
    function openType(code, btn) {
      var g = (curGroups || {})[code];
      if (!g) return;
      curType = code;
      Array.prototype.slice.call(grid.querySelectorAll('[data-type]')).forEach(function (c) {
        c.classList.remove('is-active');
      });
      if (btn) btn.classList.add('is-active');
      var name = document.getElementById('un-type-name');
      if (name) name.textContent = g.label;
      var cnt = document.getElementById('un-type-count');
      if (cnt) cnt.textContent = g.items.length + (g.items.length === 1 ? ' producto' : ' productos');
      var inner = document.getElementById('un-type-grid');
      if (!inner) return;
      inner.innerHTML = '';
      g.items.forEach(function (p) {
        var el = cardFor(p);
        if (el) inner.appendChild(el);
      });
      sizeDrawer();
    }
    function brandLabel(code) {
      var list = [];
      try { list = window.__unBrands || []; } catch (e) {}
      for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i].label;
      return code;
    }
    function markBrand(code, btn) {
      Array.prototype.slice.call(pills.querySelectorAll('[data-brand]')).forEach(function (c) {
        c.classList.remove('is-active');
      });
      if (btn) btn.classList.add('is-active');
      var t = document.getElementById('active-category-title');
      if (t) t.textContent = brandLabel(code);
    }
    function openBrand(code, btn) {
      if (activeBrand === code) { closeDrawer(); return; }
      ensureHierCss();
      activeBrand = code;
      markBrand(code, btn);
      renderGroups(code);
      var d = document.getElementById('catalog-drawer');
      if (d) { d.style.maxHeight = '2000px'; d.style.opacity = '1'; }
      setTimeout(sizeDrawer, 60);
      // Mismo resguardo para el cajón: si su animación no corre, se fija el alto.
      setTimeout(function () {
        if (activeBrand !== code) return;
        var dd = document.getElementById('catalog-drawer');
        if (!dd || dd.getBoundingClientRect().height >= 20) return;
        dd.style.transition = 'none';
        requestAnimationFrame(function () {
          dd.style.maxHeight = Math.max(2000, dd.scrollHeight + 80) + 'px';
          requestAnimationFrame(function () { dd.style.transition = ''; });
        });
      }, 640);
      setTimeout(function () {
        try { if (d) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      }, 220);
    }
    function closeDrawer() {
      activeBrand = null;
      Array.prototype.slice.call(pills.querySelectorAll('[data-brand]')).forEach(function (c) {
        c.classList.remove('is-active');
      });
      var d = document.getElementById('catalog-drawer');
      if (d) { d.style.maxHeight = '0px'; d.style.opacity = '0'; }
    }
    // El diseño trae toggleCategory/closeCatalogDrawer del catálogo por
    // categorías; aquí se sustituyen por la navegación marca -> tipo -> producto.
    function installOverrides() {
      window.openBrand = function (code, btn) { openBrand(String(code || ''), btn); };
      window.openType = function (code, btn) { openType(String(code || ''), btn); };
      window.toggleCategory = window.openBrand;
      window.closeCatalogDrawer = function () { closeDrawer(); };
    }
    function readCache() {
      try {
        var c = JSON.parse(localStorage.getItem('unidos_cat_cache') || 'null');
        if (c && (Date.now() - (c.t || 0)) < 10 * 60 * 1000 && Array.isArray(c.mine) && c.mine.length) return c;
      } catch (e) {}
      return null;
    }
    function writeCache(mine, meta) {
      try {
        localStorage.setItem('unidos_cat_cache', JSON.stringify({ t: Date.now(), mine: mine, meta: meta || {} }));
      } catch (e) {}
    }
    function renderAll(mine, meta, marcasMeta) {
      var seen = {}, cats = [];
      mine.forEach(function (p) {
        var code = p.categoryCode || 'general';
        if (!seen[code]) { seen[code] = true; cats.push({ code: code, label: p.category || code }); }
      });
      // Tipos que quedaron guardados aunque ya no tengan publicaciones: el
      // staff los ve en el panel para poder quitarlos.
      catMetaAll = meta || {};
      Object.keys(catMetaAll).forEach(function (code) {
        if (seen[code] || OLD_CATS.indexOf(code) >= 0) return;
        seen[code] = true;
        cats.push({ code: code, label: (catMetaAll[code] && catMetaAll[code].label) || code });
      });
      var brands = computeBrands(mine, marcasMeta);
      marcasMetaAll = marcasMeta || {};
      try {
        window.__unCats = cats;
        window.__unProducts = mine.slice();
        window.__unCatMeta = catMetaAll;
        window.__unMarcasMeta = marcasMetaAll;
        window.__unBrands = brands;
      } catch (e) {}
      if (!buildBrandCards(brands)) return false;
      try {
        if (typeof categoryInfo !== 'undefined') {
          cats.forEach(function (c) {
            if (!categoryInfo[c.code]) categoryInfo[c.code] = { title: c.label };
          });
        }
      } catch (e) {}
      installOverrides();
      // Recarga con una marca abierta: se repinta ese cajón y se re-ajusta el alto.
      if (activeBrand) {
        var still = brands.some(function (b) { return b.code === activeBrand; });
        if (still) { renderGroups(activeBrand); setTimeout(sizeDrawer, 40); return true; }
        closeDrawer();
      }
      grid.innerHTML = '';
      if (first) { first = false; closeDrawer(); }
      return true;
    }
    async function load() {
      var cached = readCache();
      var list = null, meta = {}, marcas = {};
      try {
        var res = await Promise.all([
          UN.api('/api/productos').catch(function () { return null; }),
          UN.api('/api/categorias').catch(function () { return []; }),
          UN.api('/api/marcas').catch(function () { return []; }),
        ]);
        list = res[0];
        (res[1] || []).forEach(function (c) { meta[c.code] = c; });
        (res[2] || []).forEach(function (m) { marcas[m.code] = m; });
        try { window.__unMarcas = res[2] || []; } catch (e) {}
      } catch (e) {
        if (cached) { try { renderAll(cached.mine, cached.meta, marcas); } catch (e2) {} }
        return;
      }
      if (!list) {
        if (cached) { try { renderAll(cached.mine, cached.meta, marcas); } catch (e2) {} }
        return;
      }
      var mine = list.filter(function (p) { return OLD_CATS.indexOf(p.categoryCode) < 0; });
      if (!mine.length) {
        window.__unProducts = [];
        window.__unCats = [];
        grid.innerHTML = '';
        return;
      }
      if (renderAll(mine, meta, marcas)) writeCache(mine, meta);
    }
    /* ---- Modal detalle Saber más con carrusel de fotos ---- */
    var dIdx = 0, dImgs = [], dId = null;
    function ensureDetail() {
      if (document.getElementById('un-dmodal')) return;
      var w = document.createElement('div');
      w.innerHTML =
        '<div class="un-modal hidden" id="un-dmodal" style="position:fixed;inset:0;z-index:95;align-items:center;justify-content:center;background:rgba(2,6,23,.65);padding:16px;display:none">' +
        '<div class="un-card" style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 20px 40px -12px rgba(15,23,42,.35)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">' +
        '<div><span id="un-dcat" style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#d91b1b"></span>' +
        '<h3 id="un-dtitle" style="font-size:19px;font-weight:800;color:#0f172a;margin-top:2px"></h3></div>' +
        '<button type="button" id="un-dx" style="border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 10px;cursor:pointer">✕</button></div>' +
        '<div style="padding:18px 20px">' +
        '<div style="position:relative;border-radius:12px;overflow:hidden;background:#0f172a">' +
        '<img id="un-dimg" alt="" style="width:100%;height:300px;object-fit:cover;display:block">' +
        '<button type="button" id="un-dprev" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.92);border:0;cursor:pointer;font-weight:800">‹</button>' +
        '<button type="button" id="un-dnext" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.92);border:0;cursor:pointer;font-weight:800">›</button>' +
        '<span id="un-dcount" style="position:absolute;right:10px;bottom:10px;background:rgba(2,6,23,.7);color:#fff;font-size:11px;font-weight:700;border-radius:9999px;padding:2px 10px"></span></div>' +
        '<div id="un-dthumbs" style="display:flex;gap:8px;margin-top:10px"></div>' +
        '<p id="un-ddesc" style="font-size:14px;color:#475569;line-height:1.65;margin-top:14px"></p>' +
        '<ul id="un-dideal" style="margin:12px 0 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px"></ul>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #f1f5f9">' +
        '<button type="button" id="un-dclose" style="background:#fff;color:#334155;font-size:12px;font-weight:700;padding:10px 16px;border-radius:10px;border:1px solid #e2e8f0;cursor:pointer">Cerrar</button>' +
        '<button type="button" id="un-dcotizar" style="background:#d91b1b;color:#fff;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:10px 20px;border-radius:10px;border:0;cursor:pointer">Cotizar</button>' +
        '</div></div></div>';
      while (w.firstChild) document.body.appendChild(w.firstChild);
      document.getElementById('un-dx').addEventListener('click', closeDetail);
      document.getElementById('un-dclose').addEventListener('click', closeDetail);
      document.getElementById('un-dprev').addEventListener('click', function () { showD((dIdx - 1 + dImgs.length) % Math.max(1, dImgs.length)); });
      document.getElementById('un-dnext').addEventListener('click', function () { showD((dIdx + 1) % Math.max(1, dImgs.length)); });
      document.getElementById('un-dcotizar').addEventListener('click', function () {
        if (dId) cotizarProducto(dId, this);
      });    document.getElementById('un-dmodal').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'un-dmodal') closeDetail();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDetail();
    });
    }
    function showD(n) {
      dIdx = n;
      var im = document.getElementById('un-dimg');
      if (im) {
        im.src = dImgs[dIdx] || '';
        im.style.display = dImgs[dIdx] ? '' : 'none';
      }
      var c = document.getElementById('un-dcount');
      if (c) c.textContent = dImgs.length ? ((dIdx + 1) + ' / ' + dImgs.length) : '';
      Array.prototype.slice.call(document.querySelectorAll('#un-dthumbs img')).forEach(function (t, k) {
        t.style.outline = k === dIdx ? '2px solid #d91b1b' : '2px solid transparent';
      });
    }
  function closeDetail() {
    var m = document.getElementById('un-dmodal');
    if (m) {
      m.classList.add('hidden');
      m.style.display = 'none';
    }
    document.body.style.overflow = '';
  }
    function openDetailData(p) {
      if (!p) return;
      ensureDetail();
      dImgs = (p.images || []).filter(Boolean).slice(0, 4);
      dId = p.id || null;
      document.getElementById('un-dcat').textContent = p.category || '';
      document.getElementById('un-dtitle').textContent = p.title || '';
      document.getElementById('un-ddesc').textContent = p.description || '';
      var ul = document.getElementById('un-dideal');
      ul.innerHTML = '';
      (p.idealFor || []).slice(0, 4).forEach(function (t) {
        var li = document.createElement('li');
        li.style.cssText = 'font-size:13px;color:#475569;display:flex;gap:8px;align-items:flex-start';
        var check = document.createElement('span');
        check.style.color = '#d91b1b';
        check.style.fontWeight = '800';
        check.textContent = '✓';
        var tx = document.createElement('span');
        tx.textContent = t;
        li.appendChild(check);
        li.appendChild(tx);
        ul.appendChild(li);
      });
      var th = document.getElementById('un-dthumbs');
      th.innerHTML = '';
      dImgs.forEach(function (src, k) {
        var im = document.createElement('img');
        im.src = src;
        im.alt = '';
        im.style.cssText = 'width:64px;height:48px;object-fit:cover;border-radius:8px;cursor:pointer;outline:2px solid transparent';
        im.addEventListener('click', function () { showD(k); });
        th.appendChild(im);
      });
    var cot = document.getElementById('un-dcotizar');
     if (cot) cot.style.display = (p.electronico === false || !canQuote) ? 'none' : '';
    showD(0);
    var __dm = document.getElementById('un-dmodal');
    __dm.classList.remove('hidden');
    __dm.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
    function openDetail(id) {
      var list = [];
      try { list = window.__unProducts || []; } catch (e) {}
      var p = null;
      list.forEach(function (x) { if (x.id === id) p = x; });
      if (p) openDetailData(p);
    }
    window.__unDetail = openDetail;
    /* ---- Cotizar: suma a la lista y se queda en el catálogo ---- */
    var pill = null, toast = null;
    function ensureCartUi() {
      if (pill || !canQuote) return;
      if (!document.getElementById('un-cart-css')) {
        var st = document.createElement('style');
        st.id = 'un-cart-css';
        st.textContent =
          '#un-cart-pill{position:fixed;left:16px;bottom:16px;z-index:70;display:flex;align-items:center;gap:10px;' +
          'background:#fff;border:1px solid #e5e7eb;border-radius:9999px;padding:8px 8px 8px 14px;cursor:pointer;' +
          'box-shadow:0 12px 30px -8px rgba(15,23,42,.28);font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif;' +
          'transform:translateY(20px);opacity:0;transition:transform .28s ease,opacity .28s ease;max-width:calc(100vw - 32px)}' +
          '#un-cart-pill.on{transform:translateY(0);opacity:1}' +
          '#un-cart-pill:hover{border-color:#d91b1b}' +
          '.un-cart-txt{font-size:12px;font-weight:800;color:#0f172a;white-space:nowrap}' +
          '.un-cart-n{background:#d91b1b;color:#fff;font-size:11px;font-weight:800;border-radius:9999px;padding:2px 8px}' +
          '.un-cart-go{background:#d91b1b;color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;' +
          'border-radius:9999px;padding:7px 12px;white-space:nowrap}' +
          '#un-cart-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);z-index:95;opacity:0;' +
          'background:#0f172a;color:#fff;font-size:13px;font-weight:700;border-radius:9999px;padding:11px 18px;' +
          'display:flex;align-items:center;gap:9px;box-shadow:0 14px 30px -10px rgba(2,6,23,.5);' +
          'font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif;transition:transform .25s ease,opacity .25s ease;pointer-events:none}' +
          '#un-cart-toast.on{transform:translate(-50%,0);opacity:1}' +
          '#un-cart-toast .un-tick{width:20px;height:20px;border-radius:50%;background:#22c55e;color:#fff;display:flex;' +
          'align-items:center;justify-content:center;font-size:13px;flex-shrink:0}' +
          '@media (max-width:640px){#un-cart-pill{left:12px;right:12px;bottom:12px;max-width:none}' +
          '#un-cart-toast{bottom:84px;width:max-content;max-width:calc(100vw - 24px)}}';
        document.head.appendChild(st);
      }
      pill = document.createElement('div');
      pill.id = 'un-cart-pill';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.innerHTML = '<span class="un-cart-txt">En tu cotización</span><span class="un-cart-n">0</span><span class="un-cart-go">Ver lista</span>';
      pill.addEventListener('click', function () { location.href = '/productos-electronicos.html'; });
      pill.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = '/productos-electronicos.html'; } });
      document.body.appendChild(pill);
      toast = document.createElement('div');
      toast.id = 'un-cart-toast';
      toast.innerHTML = '<span class="un-tick">✓</span><span class="un-cart-msg">Agregado a tu cotización</span>';
      document.body.appendChild(toast);
      if (window.Cotiza && Cotiza.onChange) Cotiza.onChange(paintPill);
    }
    function paintPill(list) {
      if (!pill) return;
      var n = (list || []).reduce(function (a, i) { return a + (Number(i.qty) || 1); }, 0);
      var k = pill.querySelector('.un-cart-n');
      if (k) k.textContent = String(n);
      pill.classList.toggle('on', n > 0);
    }
    // --- Al sumar un producto, su miniatura vuela hasta el contador ---
    var motionCache = null;
    function motionOK() {
      if (motionCache === null) {
        try { motionCache = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (e) { motionCache = true; }
      }
      // Sin WAAPI no hay animacion confiable: se dibuja solo el estado final.
      return motionCache && typeof Element !== 'undefined' && !!(Element.prototype && Element.prototype.animate);
    }
    function centerOf(el) {
      try {
        if (!el || !el.getBoundingClientRect) return null;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      } catch (e) { return null; }
    }
    // La foto que viaja: la del producto al que pertenece el boton.
    function thumbNear(el) {
      try {
        var box = el && el.closest ? (el.closest('.component-card') || el.closest('#un-dmodal') || el.parentNode) : null;
        var im = box ? box.querySelector('img[src]') : null;
        if (!im) return '';
        return im.currentSrc || im.src || '';
      } catch (e) { return ''; }
    }
    // Destino del vuelo: el numerito rojo del contador, no toda la pastilla.
    function cartAnchor() {
      var pil = document.getElementById('un-cart-pill');
      if (!pil) return null;
      return centerOf(pil.querySelector('.un-cart-n') || pil);
    }
    // Lluvia roja y onda expansiva al confirmar (WAAPI, se autodestruyen).
    function burst(x, y) {
      if (!motionOK()) return;
      var colors = ['#d91b1b', '#ff6b6b', '#b0000b', '#e85d5d'];
      for (var i = 0; i < 10; i++) (function (k) {
        var s = 4 + Math.random() * 6;
        var bit = document.createElement('span');
        bit.className = 'unfly-bit';
        bit.style.cssText = 'width:' + s + 'px;height:' + s + 'px;margin:' + (-s / 2) + 'px 0 0 ' + (-s / 2) +
          'px;background:' + colors[k % colors.length] + ';transform:translate(' + x + 'px,' + y + 'px)';
        document.body.appendChild(bit);
        var ang = (Math.PI * 2 * k) / 10 + Math.random() * 0.4;
        var dist = 42 + Math.random() * 48;
        var bye = function () { if (bit.parentNode) bit.parentNode.removeChild(bit); };
        try {
          bit.animate([
            { transform: 'translate(' + x + 'px,' + y + 'px) scale(1)', opacity: 1 },
            { transform: 'translate(' + (x + Math.cos(ang) * dist) + 'px,' + (y + Math.sin(ang) * dist + 22) + 'px) scale(.4)', opacity: 0 }
          ], { duration: 480 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = bye;
        } catch (e) { bye(); }
        setTimeout(bye, 900);
      })(i);
      var ring = document.createElement('span');
      ring.className = 'unfly-ring';
      ring.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:20px;height:20px;margin:-10px 0 0 -10px';
      document.body.appendChild(ring);
      var bye2 = function () { if (ring.parentNode) ring.parentNode.removeChild(ring); };
      try {
        ring.animate([{ transform: 'scale(.4)', opacity: .85 }, { transform: 'scale(2.4)', opacity: 0 }],
          { duration: 460, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = bye2;
      } catch (e) { bye2(); }
      setTimeout(bye2, 750);
    }
    // Arco de la miniatura (o de un punto rojo si el producto no trae foto)
    // hasta el contador; al aterrizar, el contador rebota.
    function flyToCart(from, src) {
      var to = from ? cartAnchor() : null;
      if (!to || !motionOK()) { bouncePill(); return; }
      burst(from.x, from.y);
      var size = 44, half = size / 2, el;
      if (src) {
        el = document.createElement('img');
        el.className = 'unfly-thumb';
        el.src = src;
        el.alt = '';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
      } else {
        el = document.createElement('span');
        el.className = 'unfly-dot';
        half = 9;
      }
      var at = function (x, y) { return 'translate(' + (x - half) + 'px,' + (y - half) + 'px)'; };
      el.style.transform = at(from.x, from.y);
      document.body.appendChild(el);
      var landed = false;
      function land() {
        if (landed) return;
        landed = true;
        if (el.parentNode) el.parentNode.removeChild(el);
        bouncePill();
      }
      var dx = to.x - from.x, dy = to.y - from.y;
      var rot = Math.round(Math.random() * 20 - 10);
      try {
        el.animate([
          { transform: at(from.x, from.y) + ' scale(1) rotate(0deg)', opacity: 1 },
          { transform: at(from.x + dx * 0.5, from.y + dy * 0.5 - 46) + ' scale(.82) rotate(' + rot + 'deg)', opacity: 1, offset: 0.55 },
          { transform: at(to.x, to.y) + ' scale(.18) rotate(' + (rot * 2) + 'deg)', opacity: .75 }
        ], { duration: 640, easing: 'cubic-bezier(.32,.72,.28,1)', fill: 'forwards' }).onfinish = land;
      } catch (e) { land(); }
      setTimeout(land, 900);
    }

    function bouncePill() {
      if (!pill) return;
      pill.animate
        ? pill.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' })
        : null;
    }
    var toastT = null;
    function showToast(msg) {
      if (!toast) return;
      var m = toast.querySelector('.un-cart-msg');
      if (m) m.textContent = msg;
      toast.classList.add('on');
      clearTimeout(toastT);
      toastT = setTimeout(function () { toast.classList.remove('on'); }, 1900);
    }
    // El botón delCotizar se transforma en "Agregado" un instante.
    function markButton(btn, yaEstaba) {
      if (!btn) return;
      if (btn._unMarcado) return;
      btn._unMarcado = true;
      var old = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">check</span><span>Agregado</span>';
      btn.style.background = '#16a34a';
      btn.style.borderColor = '#16a34a';
      setTimeout(function () {
        btn.innerHTML = old;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn._unMarcado = false;
      }, 1500);
      showToast(yaEstaba ? 'Sumaste otra unidad' : 'Agregado a tu cotización');
      bouncePill();
    }
    function findCotizarBtn(id) {
      var card = null;
      try { card = document.querySelector('#catalog-grid .component-card[data-id="' + String(id).replace(/"/g, '') + '"]'); } catch (e) {}
      if (!card) return null;
      var out = null;
      Array.prototype.slice.call(card.querySelectorAll('button')).forEach(function (b) {
        if ((b.textContent || '').toUpperCase().indexOf('COTIZAR') >= 0) out = b;
      });
      return out;
    }
    // Cotizar suma a la lista del cotizador sin sacar al cliente del catálogo.
    function cotizarProducto(id, btn) {
      if (!canQuote) return;
      var list = [];
      try { list = window.__unProducts || []; } catch (e) {}
      var p = null;
      list.forEach(function (x) { if (x.id === id) p = x; });
      if (!p) return;
      ensureCartUi();
      // Se mide antes de marcar el boton: al cambiar de texto se mueve.
      var origen = centerOf(btn) || centerOf(findCotizarBtn(id));
      var miniatura = thumbNear(btn);
      var r = 'nuevo';
      if (window.Cotiza) {
        r = Cotiza.add({
          pid: p.id || p.title,
          title: p.title,
          desc: p.description,
          img: (p.images || [])[0] || '',
          code: (p.categoryCode || 'cat').toUpperCase(),
        });
      }
      markButton(btn || findCotizarBtn(id), r === 'sumo');
      flyToCart(origen, miniatura);
    }
    window.__unCotizar = cotizarProducto;
  // Tarjetas estáticas (sin red): Saber más con sus propios datos del DOM.
  function wireStatic() {
    Array.prototype.slice.call(document.querySelectorAll('.category-badge')).forEach(function (bd) {
      if (bd.parentNode) bd.parentNode.removeChild(bd);
    });
    Array.prototype.slice.call(grid.querySelectorAll('.component-card')).forEach(function (card) {
      if (card.getAttribute('data-id')) return;
      var corner0 = card.querySelector('.absolute.top-4');
      if (corner0 && corner0.parentNode) corner0.parentNode.removeChild(corner0);
        Array.prototype.slice.call(card.querySelectorAll('button')).forEach(function (b) {
          var text = (b.textContent || '').toUpperCase();
          if (!canQuote && text.indexOf('COTIZAR') >= 0) {
            if (b.parentNode) b.parentNode.removeChild(b);
            return;
          }
          if (text.indexOf('SABER') < 0 || b._unD) return;
          b._unD = true;
          b.addEventListener('click', function () {
            var h3 = card.querySelector('h3');
            var desc = card.querySelector('p.text-sm');
            var img = card.querySelector('img');
            var ideal = [];
            Array.prototype.slice.call(card.querySelectorAll('ul li span:last-child')).forEach(function (s) {
              if (s.textContent.trim()) ideal.push(s.textContent.trim());
            });
            openDetailData({
              id: null,
              title: h3 ? h3.textContent : '',
              description: desc ? desc.textContent : '',
              images: img && img.src ? [img.src] : [],
              idealFor: ideal,
              category: '',
              electronico: true,
            });
          });
        });
      });
    }
    wireStatic();
    installOverrides();
    // Si ya había productos cotizados, se muestra el contador al entrar.
    try { if (canQuote && window.Cotiza && Cotiza.count() > 0) { ensureCartUi(); paintPill(Cotiza.list()); } } catch (e) {}
    load();
    try { window.__unReloadCatalog = load; } catch (e) {}
    // El alto del cajón se recalcula al abrir marca, al desplegar un tipo y al
    // redimensionar la ventana, para que nunca corte contenido.
    window.addEventListener('resize', function () {
      if (!activeBrand) return;
      sizeDrawer();
    });
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('unidos-catalogo').onmessage = function () { load(); };
      }
    } catch (e) {}
    window.addEventListener('storage', function (e) { if (e && e.key === 'unidos_catalog_ping') load(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  })();
