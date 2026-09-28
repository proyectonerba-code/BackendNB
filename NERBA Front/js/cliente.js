/* Grupo NERBA HIDALGO - Cableado compartido zona cliente (index, catalogo, cotizador,
   productos-electronicos, mis-cotizaciones, perfil, nosotros).
   Pinta usuario real, cablea menús de cuenta y navs por etiqueta.
   No altera diseños: solo datos y hrefs. Los data-path los sigue dueñando UN. */
(function () {
  if (!window.UN) return;
  var DIACR = new RegExp('[\\u0300-\\u036f]', 'g');
  function norm(s) {
    return window.UN && UN.norm ? UN.norm(s) : ((s || '').replace(/\s+/g, ' ').trim().toLowerCase()).normalize('NFD').replace(DIACR, '');
  }
  function paintChip() {
    var u = UN.getUser() || {};
    if (!u.nombre) return;
    try {
      var head = document.querySelector('header');
      if (!head) return;
      head.innerHTML = head.innerHTML.split('Ing. Carlos Mendoza').join(UN.esc(u.nombre));
      head.innerHTML = head.innerHTML.split('>CLIENTE<').join('>' + UN.esc(u.rol || 'CLIENTE') + '<');
    } catch (e) { /* visual intacto */ }
  }
  function wireAcct(scope) {
    Array.prototype.slice.call((scope || document).querySelectorAll('a')).forEach(function (a) {
      if (a._unAcct) return;
      var t = norm(a.textContent);
      if (t.indexOf('mi perfil') >= 0) { a._unAcct = true; a.setAttribute('href', '/perfil.html'); }
      else if (t.indexOf('mis cotizaciones') >= 0) { a._unAcct = true; a.setAttribute('href', '/mis-cotizaciones.html'); }
      else if (t.indexOf('ver historial de cotizaciones') >= 0) { a._unAcct = true; a.setAttribute('href', '/mis-cotizaciones.html'); }
      else if (t.indexOf('cerrar sesi') >= 0) {
        a._unAcct = true;
        a.setAttribute('href', 'javascript:void(0)');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          UN.requestLogout(e);
        });
      }
    });
  }
  function wireNavLabels() {
    Array.prototype.slice.call(document.querySelectorAll('header a')).forEach(function (a) {
      if (a._unNav || a.getAttribute('data-path')) return; // data-path lo dueña UN
      var t = norm(a.textContent);
      function set(href) { a._unNav = true; a.setAttribute('href', href); }
      if (t === 'catalogo') set('/index.html#seccion-catalogo');
      else if (t === 'productos electronicos' || t === 'electronica y refacciones') set('/productos-electronicos.html');
      else if (t === 'cotizador online') set('/cotizador.html');
      else if (t === 'nosotros') set('/nosotros.html');
      else if (t.indexOf('volver al cat') >= 0) set('/index.html#seccion-catalogo');
      else if (t.indexOf('unidos nerba') === 0 && t.length < 60) set('/index.html');
    });
  }
  function wireFooter() {
    Array.prototype.slice.call(document.querySelectorAll('footer a')).forEach(function (a) {
      if (a._unF || a.getAttribute('data-path')) return;
      if ((a.getAttribute('href') || '') !== '#') return;
      var t = norm(a.textContent);
      if (!t || t.length < 4) return;
      if (/kits de cercos|camaras ip|domos ptz|motores para portones|diagramas|firmware|mesa de ayuda|protocolos de puesta|telemetria|predictivo|banco de pruebas|automatizacion|microcontroladores|modulos de potencia|sensores|optoelectronica|soldadura|integridad|obsolescencia|trazabilidad|autenticidad|ensayo/.test(t)) {
        a._unF = true;
        a.setAttribute('href', '/index.html#seccion-catalogo');
      }
    });
  }
  window.UNCliente = {
    norm: norm,
    paintChip: paintChip,
    wireAcct: wireAcct,
    wireNavLabels: wireNavLabels,
    ensure: function () {
      // Header único global (mismo estilo en todos los roles) + links del cuerpo.
      try {
        var u = UN.getUser() || {};
        var logged = !!localStorage.getItem('unidos_token') && !!u.nombre;
        if (window.UN && UN.ensureMenu) UN.ensureMenu(logged ? 'cliente' : 'out');
      } catch (e) {}
      try { wireAcct(document); } catch (e) {}
      try { wireFooter(); } catch (e) {}
    },
  };
})();
