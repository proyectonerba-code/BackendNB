/* Grupo NERBA HIDALGO - Gestión de catálogo integrada (staff autorizado por zona).
   Mismo estilo del index nuevo. El cliente no ve nada de esto.
   Alta/edición con hasta 4 fotos desde la PC, toggle de producto electrónico
   e imagen por categoría. CRUD contra /api/productos + /api/categorias. */
(function () {
  if (!window.UN) return;
  var u = UN.getUser() || {};
  var rol = String(u.rol || '').toUpperCase();
  var onElecPage = /^\/electronica\//.test(location.pathname);
  var okRole = (rol === 'ADMIN' || rol === 'SUPERADMIN') || (rol === 'PRODUCTOS_ELECTRONICOS' && onElecPage);
  if (!localStorage.getItem('unidos_token') || !okRole) return;
  function esc(s) { return UN.esc(s); }
  try {
    if (!document.getElementById('un-staff-css')) {
      var st = document.createElement('style');
      st.id = 'un-staff-css';
      st.textContent =
        '.un-staffbar{display:flex;justify-content:flex-end;margin:0 0 14px 0}' +
        '.un-btn-red{display:inline-flex;align-items:center;gap:8px;background:#d91b1b;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:11px 20px;border-radius:10px;border:0;cursor:pointer;box-shadow:0 4px 10px -2px rgba(217,27,27,.4);font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
        '.un-btn-red:hover{background:#b0000b}' +
        '.un-btn-ghost{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#334155;font-size:12px;font-weight:700;padding:9px 14px;border-radius:10px;border:1px solid #e2e8f0;cursor:pointer}' +
        '.un-btn-ghost:hover{border-color:#d91b1b;color:#d91b1b}' +
        '.un-staffrow{display:flex;gap:8px;padding:0 24px 20px 24px}' +
        '.un-modal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.6);padding:16px}' +
        '.un-modal.hidden{display:none}' +
        '.un-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 20px 40px -12px rgba(15,23,42,.25);width:100%;max-width:560px;max-height:92vh;overflow-y:auto}' +
        '.un-chead{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #f1f5f9}' +
        '.un-chead b{font-size:17px;color:#0f172a;font-family:\'Plus Jakarta Sans\',Inter,system-ui,sans-serif}' +
        '.un-cbody{padding:20px 22px;display:flex;flex-direction:column;gap:14px}' +
        '.un-cbody label.un-lab{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569;display:block;margin-bottom:6px}' +
        '.un-cbody input[type=text],.un-cbody select,.un-cbody textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px;color:#0f172a;background:#fff;box-sizing:border-box}' +
        '.un-cbody input:focus,.un-cbody select:focus,.un-cbody textarea:focus{outline:none;border-color:#d91b1b}' +
        '.un-cfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #f1f5f9}' +
        '.un-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}' +
        '.un-slot{position:relative;border:1px dashed #cbd5e1;border-radius:10px;overflow:hidden;background:#f8fafc;min-height:86px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px}' +
        '.un-slot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
        '.un-slot button{position:relative;z-index:2;font-size:10px;font-weight:800;padding:5px 9px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#334155;cursor:pointer}' +
        '.un-slot button:hover{border-color:#d91b1b;color:#d91b1b}' +
        '.un-slot .un-rm{position:absolute;z-index:3;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(2,6,23,.65);color:#fff;border:0;cursor:pointer;font-size:12px;line-height:1;padding:0}' +
        '.un-sw{width:44px;height:24px;border-radius:9999px;background:#cbd5e1;position:relative;transition:background .2s;flex-shrink:0;display:inline-block}' +
        '.un-knob{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}' +
        'input:checked + .un-sw{background:#d91b1b}' +
        'input:checked + .un-sw .un-knob{left:22px}' +
        '.un-catprev{display:flex;align-items:center;gap:10px;margin-top:8px}' +
        '.un-catprev img{width:52px;height:38px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}' +
        '.un-mrow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}' +
        '.un-mrow:last-child{border-bottom:0}' +
        '.un-mthumb{width:42px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#94a3b8;overflow:hidden}' +
        '.un-mtxt{min-width:0;flex:1}' +
        '.un-mtxt b{display:block;font-size:13px;color:#0f172a;line-height:1.3}' +
        '.un-mtxt span{display:block;font-size:11px;color:#64748b;margin-top:2px}' +
        '.un-btn-off{opacity:.45;cursor:not-allowed}' +
        '.un-mh{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569;margin:14px 0 2px}' +
        '.un-mh:first-child{margin-top:0}';
      document.head.appendChild(st);
    }
  } catch (e) {}
  function reload() {
    try { if (typeof window.__unReloadCatalog === 'function') window.__unReloadCatalog(); } catch (e) {}
    try { if (UN.notifyCatalog) UN.notifyCatalog(); } catch (e) {}
  }
  try {
    var pills = document.getElementById('category-cards-nav');
    if (pills && !document.getElementById('un-staffbar')) {
      var bar = document.createElement('div');
      bar.className = 'un-staffbar';
      bar.id = 'un-staffbar';
      bar.innerHTML = '<button type="button" class="un-btn-ghost" id="un-mgmt"><span class="material-symbols-outlined" style="font-size:18px">category</span><span>Marcas y tipos</span></button>' +
        '<button type="button" class="un-btn-red" id="un-add"><span class="material-symbols-outlined" style="font-size:18px">add_circle</span><span>Agregar publicación</span></button>';
      pills.parentNode.insertBefore(bar, pills);
      document.getElementById('un-add').addEventListener('click', function () { UNP.openCreate(); });
      document.getElementById('un-mgmt').addEventListener('click', function () { UNP.openManage(); });
    }
  } catch (e) {}
  function wireCards() {
    Array.prototype.slice.call(document.querySelectorAll('#catalog-grid .component-card[data-id]')).forEach(function (card) {
      if (card.querySelector('[data-unstaff]')) return;
      var id = card.getAttribute('data-id');
      var row = document.createElement('div');
      row.className = 'un-staffrow';
      row.setAttribute('data-unstaff', '1');
      row.innerHTML = '<button type="button" class="un-btn-ghost" data-edit style="flex:1;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">edit</span><span>Editar</span></button>' +
        '<button type="button" class="un-btn-ghost" data-del style="flex:1;justify-content:center;color:#b0000b"><span class="material-symbols-outlined" style="font-size:16px">delete</span><span>Eliminar</span></button>';
      card.appendChild(row);
      var editButton = row.querySelector('[data-edit]');
      var deleteButton = row.querySelector('[data-del]');
      editButton._unStaffBound = true;
      deleteButton._unStaffBound = true;
      editButton.addEventListener('click', function (ev) { ev.stopPropagation(); UNP.openEdit(id); });
      deleteButton.addEventListener('click', function (ev) { ev.stopPropagation(); UNP.askDelete(id); });
    });
  }
  try {
    var grid = document.getElementById('catalog-grid');
    // subtree: las tarjetas ahora viven dentro del acordeón de cada tipo.
    if (grid && window.MutationObserver) {
      new MutationObserver(function () { wireCards(); }).observe(grid, { childList: true, subtree: true });
    }
  } catch (e) {}
  wireCards();
  document.addEventListener('click', function (e) {
    var editButton = e.target && e.target.closest ? e.target.closest('#catalog-grid [data-edit]') : null;
    if (editButton && !editButton._unStaffBound) {
      e.preventDefault();
      e.stopPropagation();
      var editCard = editButton.closest('.component-card');
      if (editCard) UNP.openEdit(editCard.getAttribute('data-id'));
      return;
    }
    var deleteButton = e.target && e.target.closest ? e.target.closest('#catalog-grid [data-del]') : null;
    if (deleteButton && !deleteButton._unStaffBound) {
      e.preventDefault();
      e.stopPropagation();
      var deleteCard = deleteButton.closest('.component-card');
      if (deleteCard) UNP.askDelete(deleteCard.getAttribute('data-id'));
    }
  });
  /* ---- estado de fotos ---- */
  var photoSlots = [null, null, null, null];
  var catImg = '';
  var pickedCatImg = '';
  var brandImg = '';
  var pickedBrandImg = '';
  function validImageFile(file) {
    if (!file) return false;
    if (file.type && !/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) return false;
    if (file.size && file.size > 8 * 1024 * 1024) return false; // 8MB pre-compresión
    return true;
  }
  function fileToDataURL(file, maxDim, cb) {
    if (!validImageFile(file)) { cb(null); return; }
    try {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var s = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * s));
          c.height = Math.max(1, Math.round(img.height * s));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          cb(c.toDataURL('image/jpeg', 0.82));
        } catch (err) { URL.revokeObjectURL(url); cb(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
      img.src = url;
    } catch (err) { cb(null); }
  }
  function renderSlots() {
    for (var i = 0; i < 4; i++) {
      (function (k) {
        var box = document.getElementById('un-slot-' + k);
        if (!box) return;
        var src = photoSlots[k];
        box.innerHTML = '';
        if (src) {
          var im = document.createElement('img');
          im.src = src;
          im.alt = 'Foto ' + (k + 1);
          box.appendChild(im);
          var rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'un-rm';
          rm.textContent = '✕';
          rm.addEventListener('click', function () { photoSlots[k] = null; renderSlots(); });
          box.appendChild(rm);
        } else {
          var up = document.createElement('button');
          up.type = 'button';
          up.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;display:block">add_a_photo</span>Subir';
          up.addEventListener('click', function () {
            var inp = document.getElementById('un-file-' + k);
            if (inp) inp.click();
          });
          box.appendChild(up);
        }
      })(i);
    }
  }
  function renderCatImg() {
    var box = document.getElementById('un-catprev');
    if (!box) return;
    box.innerHTML = '';
    if (catImg) {
      var im = document.createElement('img');
      im.src = catImg;
      im.alt = 'Imagen de categoría';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'un-btn-ghost';
      rm.textContent = 'Quitar';
          rm.addEventListener('click', function () { catImg = ''; pickedCatImg = ''; renderCatImg(); });
      box.appendChild(im);
      box.appendChild(rm);
    }
  }
  function renderBrandImg() {
    var box = document.getElementById('un-brandprev');
    if (!box) return;
    box.innerHTML = '';
    if (brandImg) {
      var im = document.createElement('img');
      im.src = brandImg;
      im.alt = 'Imagen de marca';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'un-btn-ghost';
      rm.textContent = 'Quitar';
      rm.addEventListener('click', function () { brandImg = ''; pickedBrandImg = ''; renderBrandImg(); });
      box.appendChild(im);
      box.appendChild(rm);
    }
  }
  var modalHtml =
    '<div class="un-modal hidden" id="un-modal"><div class="un-card">' +
    '<div class="un-chead"><b id="un-mtitle">Nueva publicación</b><button type="button" class="un-btn-ghost" id="un-mx" style="padding:6px 10px">✕</button></div>' +
    '<form id="un-mform"><div class="un-cbody">' +
    '<input type="hidden" id="unp-id" value="">' +
    '<div><label class="un-lab">Título de la publicación *</label><input type="text" id="unp-title" required maxlength="120"></div>' +
    '<div><label class="un-lab">Marca *</label><select id="unp-brand"></select>' +
    '<div id="unp-newbrand-wrap" style="display:none"><label class="un-lab">Nombre de la nueva marca *</label>' +
    '<input type="text" id="unp-newbrand" maxlength="60" placeholder="Ej. HIKVISION"></div>' +
    '<p style="font-size:11px;color:#64748b;margin:6px 0 0">Es el nivel 1 del catálogo. Al elegir la marca se muestran debajo sus tipos.</p></div>' +
    '<div><label class="un-lab">Imagen de la marca (opcional, desde tu PC)</label>' +
    '<div style="display:flex;gap:8px;align-items:center"><button type="button" class="un-btn-ghost" id="un-brandbtn"><span class="material-symbols-outlined" style="font-size:16px">add_a_photo</span><span>Elegir imagen</span></button>' +
    '<input type="file" id="un-brandfile" accept="image/*" style="display:none"><div class="un-catprev" id="un-brandprev"></div></div></div>' +
    '<div><label class="un-lab">Tipo de producto *</label><select id="unp-cat"></select></div>' +
    '<div id="unp-newcat-wrap" style="display:none"><label class="un-lab">Nombre del nuevo tipo *</label><input type="text" id="unp-newcat" maxlength="60" placeholder="Ej. Cámaras"></div>' +
    '<div><label class="un-lab">Imagen del tipo (opcional, desde tu PC)</label>' +
    '<div style="display:flex;gap:8px;align-items:center"><button type="button" class="un-btn-ghost" id="un-catbtn"><span class="material-symbols-outlined" style="font-size:16px">add_a_photo</span><span>Elegir imagen</span></button>' +
    '<input type="file" id="un-catfile" accept="image/*" style="display:none"><div class="un-catprev" id="un-catprev"></div></div></div>' +
    '<div><label class="un-lab">Tipo de publicación</label>' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="unp-elec" checked style="display:none">' +
    '<span class="un-sw"><span class="un-knob"></span></span>' +
    '<span style="font-size:13px;font-weight:700;color:#0f172a">Producto electrónico <span style="font-weight:400;color:#64748b">(disponible para clientes)</span></span></label></div>' +
    '<div><label class="un-lab">Fotos de la publicación (hasta 4, desde tu PC)</label><div class="un-slots">' +
    '<div class="un-slot" id="un-slot-0"></div><div class="un-slot" id="un-slot-1"></div>' +
    '<div class="un-slot" id="un-slot-2"></div><div class="un-slot" id="un-slot-3"></div></div>' +
    '<input type="file" id="un-file-0" accept="image/*" style="display:none"><input type="file" id="un-file-1" accept="image/*" style="display:none">' +
    '<input type="file" id="un-file-2" accept="image/*" style="display:none"><input type="file" id="un-file-3" accept="image/*" style="display:none"></div>' +
    '<div><label class="un-lab">Descripción *</label><textarea id="unp-desc" rows="3" required></textarea></div>' +
    '<div><label class="un-lab">Ideal para (una por línea)</label><textarea id="unp-ideal" rows="2"></textarea></div>' +
    '</div><div class="un-cfoot"><button type="button" class="un-btn-ghost" id="un-mcancel">Cancelar</button>' +
    '<button type="submit" class="un-btn-red">Guardar publicación</button></div></form></div></div>' +
    '<div class="un-modal hidden" id="un-delmodal"><div class="un-card" style="max-width:420px"><div class="un-chead"><b>Eliminar publicación</b></div>' +
    '<div class="un-cbody"><p style="font-size:14px;color:#475569" id="un-deltext"></p></div>' +
    '<div class="un-cfoot"><button type="button" class="un-btn-ghost" id="un-delcancel">Cancelar</button>' +
    '<button type="button" class="un-btn-red" id="un-delok">Sí, eliminar</button></div></div></div>' +
    '<div class="un-modal hidden" id="un-mgmtmodal"><div class="un-card" style="max-width:520px"><div class="un-chead"><b>Marcas y tipos</b>' +
    '<button type="button" class="un-btn-ghost" id="un-mgmtx" style="padding:6px 10px">✕</button></div>' +
    '<div class="un-cbody" id="un-mgmtbody"></div>' +
    '<div class="un-cfoot"><button type="button" class="un-btn-ghost" id="un-mgmtclose">Cerrar</button></div></div></div>' +
    '<div class="un-modal hidden" id="un-quitmodal"><div class="un-card" style="max-width:460px"><div class="un-chead"><b id="un-quittitle">Quitar</b></div>' +
    '<div class="un-cbody"><p style="font-size:14px;color:#475569" id="un-quittext"></p><div id="un-quitbox"></div></div>' +
    '<div class="un-cfoot" style="flex-wrap:wrap"><button type="button" class="un-btn-ghost" id="un-quitcancel">Cancelar</button>' +
    '<button type="button" class="un-btn-ghost" id="un-quitdel" style="color:#b0000b;border-color:#fecaca"><span class="material-symbols-outlined" style="font-size:16px">delete_forever</span><span>Quitar y borrar sus publicaciones</span></button>' +
    '<button type="button" class="un-btn-red" id="un-quitmover"><span class="material-symbols-outlined" style="font-size:16px">drive_file_move</span><span>Mover y quitar</span></button></div></div></div>';
  var tmp = document.createElement('div');
  tmp.innerHTML = modalHtml;
  while (tmp.firstChild) document.body.appendChild(tmp.firstChild);
  function cats() {
    try { return window.__unCats && window.__unCats.length ? window.__unCats : []; }
    catch (e) { return []; }
  }
  function catMeta(code) {
    try {
      var m = window.__unCatMeta || {};
      return m[code] || null;
    } catch (e) { return null; }
  }
  function fillCats(selCode) {
    var sel = document.getElementById('unp-cat');
    if (!sel) return;
    sel.innerHTML = '';
    cats().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.code;
      o.textContent = c.label;
      if (c.code === selCode) o.selected = true;
      sel.appendChild(o);
    });
    var n = document.createElement('option');
    n.value = '__new__';
    n.textContent = '＋ Nuevo tipo…';
    sel.appendChild(n);
    if (selCode === '__new__') n.selected = true;
    var m = selCode && selCode !== '__new__' ? catMeta(selCode) : null;
    catImg = pickedCatImg || ((m && m.image) || '');
    renderCatImg();
    toggleNew();
  }
  function toggleNew() {
    var sel = document.getElementById('unp-cat');
    var w = document.getElementById('unp-newcat-wrap');
    if (sel && w) w.style.display = (sel.value === '__new__') ? '' : 'none';
  }
  function slug(s) {
    return String(UN.norm(s || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
  }
  // Marcas del catálogo: las que ya tienen publicaciones + "nueva marca".
  function brands() {
    var seen = {}, out = [];
    try { (window.__unBrands || []).forEach(function (b) { seen[b.code] = b.label; out.push(b.label); }); } catch (e) {}
    if (!out.length) {
      try { (window.__unProducts || []).forEach(function (p) { var b = String((p && p.brand) || '').trim(); if (b && !seen[b]) { seen[b] = 1; out.push(b); } }); } catch (e) {}
    }
    return out;
  }
  function fillBrands(value) {
    var sel = document.getElementById('unp-brand');
    if (!sel) return;
    sel.innerHTML = '';
    brands().forEach(function (b) {
      var o = document.createElement('option');
      o.value = b;
      o.textContent = b;
      if (b === value) o.selected = true;
      sel.appendChild(o);
    });
    var n = document.createElement('option');
    n.value = '__new__';
    n.textContent = '＋ Nueva marca…';
    if (value === '__new__') n.selected = true;
    sel.appendChild(n);
    if (value && value !== '__new__' && !brands().some(function (b) { return b === value; })) {
      // Marca que existe en el producto pero todavía no en la lista.
      var o2 = document.createElement('option');
      o2.value = value;
      o2.textContent = value;
      o2.selected = true;
      sel.insertBefore(o2, n);
    }
    toggleNewBrand();
    syncBrandImg();
  }
  function toggleNewBrand() {
    var sel = document.getElementById('unp-brand');
    var w = document.getElementById('unp-newbrand-wrap');
    if (sel && w) w.style.display = (sel.value === '__new__') ? '' : 'none';
  }
  function openModal() {
    document.getElementById('un-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    var t = document.getElementById('unp-title');
    if (t) setTimeout(function () { try { t.focus(); } catch (e) {} }, 60);
  }
  function closeModal() {
    document.getElementById('un-modal').classList.add('hidden');
    document.body.style.overflow = '';
  }
  document.getElementById('un-mx').addEventListener('click', closeModal);
  document.getElementById('un-mcancel').addEventListener('click', closeModal);
  document.getElementById('unp-cat').addEventListener('click', function () { fillCats(document.getElementById('unp-cat').value); });
  document.getElementById('unp-cat').addEventListener('change', toggleNew);
  document.getElementById('unp-brand').addEventListener('click', function () { fillBrands(document.getElementById('unp-brand').value); });
  document.getElementById('unp-brand').addEventListener('change', function () { toggleNewBrand(); syncBrandImg(); });
  for (var fi = 0; fi < 4; fi++) {
    (function (k) {
      var inp = document.getElementById('un-file-' + k);
      if (inp) inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        fileToDataURL(f, 1200, function (url) {
          if (url) { photoSlots[k] = url; renderSlots(); }
          else alert('No se pudo leer esa imagen. Prueba con JPG o PNG.');
        });
      });
    })(fi);
  }
  var catInp = document.getElementById('un-catfile');
  if (catInp) catInp.addEventListener('click', function () {});
  document.getElementById('un-catbtn').addEventListener('click', function () {
    var inp = document.getElementById('un-catfile');
    if (inp) inp.click();
  });
  if (catInp) catInp.addEventListener('change', function () {
    var f = catInp.files && catInp.files[0];
    catInp.value = '';
    if (!f) return;
    fileToDataURL(f, 800, function (url) {
      if (url) { catImg = url; pickedCatImg = url; renderCatImg(); }
      else alert('No se pudo leer esa imagen. Prueba con JPG o PNG.');
    });
  });
  var brandFile = document.getElementById('un-brandfile');
  var brandBtn = document.getElementById('un-brandbtn');
  if (brandBtn) brandBtn.addEventListener('click', function () { if (brandFile) brandFile.click(); });
  if (brandFile) brandFile.addEventListener('change', function () {
    var f = brandFile.files && brandFile.files[0];
    brandFile.value = '';
    if (!f) return;
    fileToDataURL(f, 800, function (url) {
      if (url) { brandImg = url; pickedBrandImg = url; renderBrandImg(); }
      else alert('No se pudo leer esa imagen. Prueba con JPG o PNG.');
    });
  });
  document.getElementById('un-delcancel').addEventListener('click', function () {
    document.getElementById('un-delmodal').classList.add('hidden');
  });
  // Salir tocando fuera del modal (backdrop). Solo el fondo, nunca el contenido.
  document.getElementById('un-modal').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'un-modal') closeModal();
  });
  document.getElementById('un-delmodal').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'un-delmodal') e.target.classList.add('hidden');
  });
  var delId = null;
  document.getElementById('un-delok').addEventListener('click', async function () {
    if (!delId) return;
    try {
      await UN.api('/api/productos/' + encodeURIComponent(delId), { method: 'DELETE' });
      delId = null;
      document.getElementById('un-delmodal').classList.add('hidden');
      closeModal();
      reload();
    } catch (err) { alert((err && err.message) || 'No se pudo eliminar'); }
  });
  async function saveCat(code, label) {
    if (!catImg) return;
    try {
      await UN.api('/api/categorias/' + encodeURIComponent(code), { method: 'PUT', body: { label: label, image: catImg } });
    } catch (err) { /* la publicación ya se guardó; la imagen se reintentará luego */ }
  }
  function brandMeta(label) {
    try { return (window.__unMarcasMeta || {})[brandSlug(label)] || null; } catch (e) { return null; }
  }
  // Al cambiar de marca se muestra su imagen (la que el staff subió).
  function syncBrandImg() {
    var sel = document.getElementById('unp-brand');
    if (!sel) return;
    var m = sel.value === '__new__' ? null : brandMeta(sel.value);
    brandImg = (m && m.image) || '';
    if (!pickedBrandImg) renderBrandImg();
  }
  async function saveBrand(label) {
    if (!pickedBrandImg) return;
    try {
      await UN.api('/api/marcas/' + encodeURIComponent(brandSlug(label)), { method: 'PUT', body: { label: label, image: pickedBrandImg } });
    } catch (err) { /* la publicación ya se guardó */ }
  }
  document.getElementById('un-mform').addEventListener('submit', async function (e) {
    e.preventDefault();
    function g(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var title = g('unp-title');
    var brand = g('unp-brand');
    var code = g('unp-cat');
    var label = '';
    if (brand === '__new__') {
      brand = g('unp-newbrand');
      if (!brand) { alert('Escribe el nombre de la nueva marca.'); return; }
    }
    if (code === '__new__') {
      label = g('unp-newcat');
      if (!label) { alert('Escribe el nombre del nuevo tipo.'); return; }
      code = slug(label);
    } else {
      var sel = document.getElementById('unp-cat');
      label = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : code;
    }
    if (!title) { alert('El título es obligatorio.'); return; }
    if (!brand) { alert('La marca es obligatoria: es la categoría principal del catálogo.'); return; }
    var ideal = g('unp-ideal').split(/[\n;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var imgs = photoSlots.filter(Boolean);
    var elec = !!document.getElementById('unp-elec').checked;
    var body = { title: title, brand: brand, description: g('unp-desc'), categoryCode: code, category: label, idealFor: ideal, images: imgs, electronico: elec };
    var id = g('unp-id');
    try {
      if (id) await UN.api('/api/productos/' + encodeURIComponent(id), { method: 'PUT', body: body });
      else await UN.api('/api/productos', { method: 'POST', body: body });
      await saveCat(code, label);
      await saveBrand(brand);
      closeModal();
      reload();
    } catch (err) { alert((err && err.message) || 'No se pudo guardar'); }
  });
  /* ---- quitar marcas y tipos ---- */
  function brandSlug(s) {
    return String(UN.norm(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'nerba';
  }
  function initialsOf(label) {
    var words = String(label || '').trim().split(/\s+/).filter(function (w) { return /[a-z0-9\u00c0-\u024F]/i.test(w); });
    if (!words.length) return '?';
    if (words.length > 1) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    var w = words[0].replace(/[^a-z0-9\u00C0-\u024F]/gi, '');
    return (w.length <= 4 ? w : w.charAt(0)).toUpperCase();
  }
  function guard(img, label) {
    var b = document.createElement(img ? 'img' : 'div');
    b.className = 'un-mthumb';
    if (img) { b.src = img; b.alt = ''; }
    else { b.textContent = initialsOf(label); }
    return b;
  }
  function fila(txt, sub, enabled, onclick) {
    var row = document.createElement('div');
    row.className = 'un-mrow';
    var box = document.createElement('div');
    box.className = 'un-mtxt';
    box.innerHTML = '<b>' + esc(txt) + '</b><span>' + esc(sub) + '</span>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'un-btn-ghost' + (enabled ? '' : ' un-btn-off');
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">delete</span><span>Quitar</span>';
    if (enabled) btn.addEventListener('click', onclick);
    else btn.title = 'Primero quita sus publicaciones';
    var hole = document.createComment('thumb');
    row.appendChild(hole);
    row.appendChild(box);
    row.appendChild(btn);
    return { row: row, hole: hole };
  }
  function renderMgmt() {
    var body = document.getElementById('un-mgmtbody');
    if (!body) return;
    body.innerHTML = '';
    var h1 = document.createElement('div');
    h1.className = 'un-mh';
    h1.textContent = 'Marcas';
    body.appendChild(h1);
    var marcas = [];
    try { marcas = window.__unMarcas || []; } catch (e) {}
    if (!marcas.length) {
      var e0 = document.createElement('p');
      e0.style.cssText = 'font-size:13px;color:#64748b;margin:0';
      e0.textContent = 'Todavía no hay marcas.';
      body.appendChild(e0);
    }
    marcas.forEach(function (b) {
      var n = Number(b.total || 0);
      var f = fila(b.label, n === 1 ? '1 publicación' : n + ' publicaciones', true, function () { askQuit('marca', b, n); });
      f.row.insertBefore(guard(b.image, b.label), f.hole);
      body.appendChild(f.row);
    });
    var h2 = document.createElement('div');
    h2.className = 'un-mh';
    h2.textContent = 'Tipos de producto';
    body.appendChild(h2);
    var tipos = [];
    try { tipos = window.__unCats || []; } catch (e) {}
    tipos.forEach(function (t) {
      var n = 0;
      try { (window.__unProducts || []).forEach(function (p) { if (String(p.categoryCode || '') === t.code) n++; }); } catch (e) {}
      var meta = null;
      try { meta = (window.__unCatMeta || {})[t.code] || null; } catch (e) {}
      var f = fila(t.label, n === 1 ? '1 publicación' : n + ' publicaciones', true, function () { askQuit('tipo', { code: t.code, label: t.label, image: meta && meta.image }, n); });
      f.row.insertBefore(guard(meta && meta.image, t.label), f.hole);
      body.appendChild(f.row);
    });
  }
  var pending = null;
  // Quitar una marca/tipo nunca se tops a medias: si tiene publicaciones se
  // ofrece moverlas a otro destino o eliminarlas.
  function askQuit(kind, item, n) {
    pending = { kind: kind, code: item.code, label: item.label, n: n };
    var esMarca = kind === 'marca';
    var t = document.getElementById('un-quittitle');
    var txt = document.getElementById('un-quittext');
    var box = document.getElementById('un-quitbox');
    t.textContent = esMarca ? 'Quitar marca' : 'Quitar tipo';
    txt.textContent = '"' + item.label + '" tiene ' + n + (n === 1 ? ' publicación' : ' publicaciones') + '. Elige qué hacer con ellas:';
    box.innerHTML = '';
    var sel = document.createElement('select');
    sel.id = 'un-quitdest';
    var otras = esMarca ? brands().filter(function (b) { return b !== item.label; }) : (function () {
      var o = [];
      try { (window.__unCats || []).forEach(function (x) { if (x.code !== item.code) o.push(x); }); } catch (e) {}
      return o;
    })();
    otras.forEach(function (b) {
      var o = document.createElement('option');
      o.value = esMarca ? b : b.code;
      o.textContent = b.label || b.code;
      sel.appendChild(o);
    });
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var lbl = document.createElement('label');
    lbl.className = 'un-lab';
    lbl.textContent = esMarca ? 'Mover las publicaciones a la marca:' : 'Mover las publicaciones al tipo:';
    var aviso = document.createElement('p');
    aviso.id = 'un-quitaviso';
    aviso.style.cssText = 'font-size:11px;color:#b91c1c;margin:0';
    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    wrap.appendChild(aviso);
    box.appendChild(wrap);
    var mv = document.getElementById('un-quitmover');
    var dl = document.getElementById('un-quitdel');
    mv.style.display = '';
    dl.style.display = '';
    mv.disabled = !otras.length;
    if (!otras.length) {
      aviso.textContent = 'No hay otro destino disponible: primero quita o renombra las publicaciones.';
    } else {
      aviso.textContent = '';
    }
    document.getElementById('un-quitmodal').classList.remove('hidden');
  }
  document.getElementById('un-quitcancel').addEventListener('click', function () {
    document.getElementById('un-quitmodal').classList.add('hidden');
  });
  document.getElementById('un-quitmodal').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'un-quitmodal') e.target.classList.add('hidden');
  });  function cerrarQuitar() {
    document.getElementById('un-quitmodal').classList.add('hidden');
  }
  async function quitarDefinitivo() {
    if (!pending) return;
    var path = pending.kind === 'marca' ? '/api/marcas/' : '/api/categorias/';
    try {
      await UN.api(path + encodeURIComponent(pending.code), { method: 'DELETE' });
      pending = null;
      cerrarQuitar();
      reload();
      setTimeout(function () { try { if (window.__unReloadCatalog) window.__unReloadCatalog(); } catch (e) {} renderMgmt(); }, 800);
    } catch (err) { alert((err && err.message) || 'No se pudo quitar'); }
  }
  // Mover las publicaciones a otro destino y luego quitar la marca/tipo.
    document.getElementById('un-quitmover').addEventListener('click', async function () {
    if (!pending) return;
    var sel = document.getElementById('un-quitdest');
    var dest = sel ? sel.value : '';
    if (!dest) { alert('Elige el destino de las publicaciones.'); return; }
    var nombre = pending.label;
    var body = { desde: pending.kind === 'marca' ? 'marca' : 'tipo', code: pending.code };
    if (pending.kind === 'marca') body.brand = dest;
    else {
      body.categoryCode = dest;
      body.category = (sel.options[sel.selectedIndex] || {}).textContent || dest;
    }
    this.disabled = true;
    try {
      var r = await UN.api('/api/productos/reasignar', { method: 'POST', body: body });
      await quitarDefinitivo();
      alert('Se movieron ' + ((r && r.movidas) || 0) + ' publicación(es) y se quitó "' + nombre + '".');
    } catch (err) {
      this.disabled = false;
      alert((err && err.message) || 'No se pudo mover');
    }
  });
  // Quitar la marca/tipo junto con sus publicaciones.
  document.getElementById('un-quitdel').addEventListener('click', async function () {
    if (!pending) return;
    if (!confirm('Se eliminará "' + pending.label + '" y sus ' + pending.n + ' publicación(es). ¿Continuar?')) return;
    var tok = localStorage.getItem('unidos_token');
    var ids = [];
    try {
      (window.__unProducts || []).forEach(function (p) {
        var mismo = pending.kind === 'marca'
          ? brandSlug(p.brand || 'NERBA') === pending.code
          : String(p.categoryCode || 'general') === pending.code;
        if (mismo) ids.push(p.id);
      });
    } catch (e) {}
    this.disabled = true;
    try {
      for (var i = 0; i < ids.length; i++) {
        await UN.api('/api/productos/' + encodeURIComponent(ids[i]), { method: 'DELETE' });
      }
      await quitarDefinitivo();
    } catch (err) {
      this.disabled = false;
      alert((err && err.message) || 'No se pudo eliminar');
    }
  });
  document.getElementById('un-mgmtx').addEventListener('click', function () { document.getElementById('un-mgmtmodal').classList.add('hidden'); });
  document.getElementById('un-mgmtclose').addEventListener('click', function () { document.getElementById('un-mgmtmodal').classList.add('hidden'); });
  document.getElementById('un-mgmtmodal').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'un-mgmtmodal') e.target.classList.add('hidden');
  });
  window.UNP = {
    openCreate: function () {
      document.getElementById('unp-id').value = '';
      document.getElementById('unp-title').value = '';
      document.getElementById('unp-desc').value = '';
      document.getElementById('unp-ideal').value = '';
      document.getElementById('unp-newcat').value = '';
      document.getElementById('unp-newbrand').value = '';
      pickedBrandImg = '';
      fillBrands('');
      photoSlots = [null, null, null, null];
      pickedCatImg = '';
      renderSlots();
      fillCats('');
      var ec = document.getElementById('unp-elec');
      if (ec) ec.checked = true;
      document.getElementById('un-mtitle').textContent = 'Nueva publicación';
      openModal();
    },
    openEdit: function (id) {
      var list = [];
      try { list = window.__unProducts || []; } catch (e) {}
      var p = null;
      list.forEach(function (x) { if (x.id === id) p = x; });
      if (!p) return;
      document.getElementById('unp-id').value = p.id;
      document.getElementById('unp-title').value = p.title || '';
      document.getElementById('unp-desc').value = p.description || '';
      document.getElementById('unp-ideal').value = (p.idealFor || []).join('\n');
      document.getElementById('unp-newcat').value = '';
      document.getElementById('unp-newbrand').value = '';
      fillBrands(String((p && p.brand) || '').trim());
      photoSlots = (p.images || []).slice(0, 4);
      while (photoSlots.length < 4) photoSlots.push(null);
      pickedCatImg = '';
      renderSlots();
      var ec = document.getElementById('unp-elec');
      if (ec) ec.checked = p.electronico !== false;
      fillCats(p.categoryCode);
      document.getElementById('un-mtitle').textContent = 'Editar publicación';
      openModal();
    },
    askDelete: function (id) {
      var list = [];
      try { list = window.__unProducts || []; } catch (e) {}
      var p = null;
      list.forEach(function (x) { if (x.id === id) p = x; });
      delId = id;
      document.getElementById('un-deltext').textContent = '¿Eliminar "' + (p ? p.title : id) + '" del catálogo? Esta acción no se puede deshacer.';
      document.getElementById('un-delmodal').classList.remove('hidden');
    },
    openManage: function () {
      renderMgmt();
      document.getElementById('un-mgmtmodal').classList.remove('hidden');
    },
    close: closeModal,
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('un-delmodal').classList.add('hidden');
      document.getElementById('un-mgmtmodal').classList.add('hidden');
      document.getElementById('un-quitmodal').classList.add('hidden');
      var dm = document.getElementById('un-dmodal');
      if (dm) dm.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
})();
