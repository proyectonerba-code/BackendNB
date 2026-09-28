/* Grupo NERBA HIDALGO - Carrito de cotización (lista de productos por cotizar).
   Vive en localStorage para que el cliente pueda ir sumando desde el catálogo
   sin cambiar de interfaz, y el cotizador muestre lo mismo.
   Expone: window.Cotiza = { list, count, lines, add, setQty, remove, clear, onChange } */
(function () {
  if (window.Cotiza) return;
  var KEY = 'unidos_quote_cart';
  var subs = [];

  function read() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(function (x) { return x && x.nid; }).map(function (x) {
        return {
          nid: Number(x.nid) || 0,
          pid: String(x.pid || ''),
          title: String(x.title || ''),
          desc: String(x.desc || ''),
          img: String(x.img || ''),
          code: String(x.code || 'UN-CAT'),
          qty: Math.max(1, Math.min(99, Number(x.qty) || 1)),
        };
      });
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list || [])); } catch (e) {}
    emit();
  }
  function emit() {
    var l = read();
    subs.forEach(function (f) { try { f(l); } catch (e) {} });
  }
  function nextId() {
    var used = {}, n;
    read().forEach(function (x) { used[x.nid] = 1; });
    do { n = 90000 + Math.floor(Math.random() * 9000); } while (used[n]);
    return n;
  }
  window.Cotiza = {
    list: read,
    lines: function () { return read().length; },
    count: function () {
      return read().reduce(function (n, i) { return n + (Number(i.qty) || 1); }, 0);
    },
    // Devuelve 'nuevo' o 'sumo' para que la interfaz lo celebre.
    add: function (item) {
      item = item || {};
      var list = read();
      var pid = String(item.pid || item.title || '');
      var found = null;
      if (pid) list.forEach(function (x) { if (x.pid === pid) found = x; });
      if (found) {
        found.qty = Math.min(99, (Number(found.qty) || 1) + 1);
        write(list);
        return 'sumo';
      }
      list.push({
        nid: nextId(),
        pid: pid,
        title: String(item.title || 'Producto'),
        desc: String(item.desc || ''),
        img: String(item.img || ''),
        code: String(item.code || 'UN-CAT'),
        qty: 1,
      });
      write(list);
      return 'nuevo';
    },
    setQty: function (nid, qty) {
      var list = read();
      list.forEach(function (x) {
        if (x.nid === Number(nid)) x.qty = Math.max(1, Math.min(99, Number(qty) || 1));
      });
      write(list);
    },
    remove: function (nid) {
      var n = Number(nid);
      write(read().filter(function (x) { return x.nid !== n; }));
    },
    clear: function () { write([]); },
    onChange: function (fn) { if (typeof fn === 'function') { subs.push(fn); fn(read()); } },
  };
  // Otra pestaña del mismo navegador cotizó algo más.
  window.addEventListener('storage', function (e) {
    if (e && e.key === KEY) emit();
  });
})();
