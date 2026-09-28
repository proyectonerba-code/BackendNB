/* Grupo NERBA HIDALGO - Zona Proyectos Especiales (conector compartido).
   Rol aparte del admin y del cliente; login compartido; el cierre de sesion
   siempre vuelve al index (UN.logout). No altera los disenos: solo datos. */
(function () {
  if (!window.UN) return;

  var FASES_TXT = [
    'Fase 1: Levantamiento Topográfico y Análisis de Factibilidad',
    'Fase 2: Tendido de Canalización, Fibra Óptica y Cableado',
    'Fase 3: Instalación de Equipamiento, Nodos y Domos PTZ',
    'Fase 4: Calibración de Sensores, Mapeo Radar y Telemetría SCADA',
    'Fase 5: Integración a Centro de Monitoreo / NOC y Entrega',
  ];

  // Igual que admin.js q(): comillas, backslash y saltos de linea escapados
  // para interpolar texto libre en onclick sin romper el HTML/JS.
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
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || 'Hola, coordinamos su proyecto especial.');
  }
  // slug de tipologia para el filtro de solicitudes (perimetral/cctv/accesos/automatizacion/general)
  function tipoSlug(c) {
    var t = UN.norm((c.producto || '') + ' ' + (c.descripcion || ''));
    if (/cerco|perimet|malla|concertina|radar/.test(t)) return 'perimetral';
    if (/c[aá]mara|cctv|t[eé]rmic|domo|ptz|detecci/.test(t)) return 'cctv';
    if (/biom|acceso|torniquete|credencial/.test(t)) return 'accesos';
    if (/port[oó]n|motor|automat|barrera/.test(t)) return 'automatizacion';
    return 'general';
  }
  function fasesOf(c) {
    var base = ['Por iniciar', 'Por iniciar', 'Por iniciar', 'Por iniciar', 'Por iniciar'];
    if (Array.isArray(c.fases)) {
      for (var i = 0; i < 5; i++) {
        if (c.fases[i] && c.fases[i].estado) base[i] = c.fases[i].estado;
        else if (typeof c.fases[i] === 'string') base[i] = c.fases[i];
      }
    }
    return base;
  }
  function avanceOf(c) {
    if (c.avance !== undefined && c.avance !== null && c.avance !== '') return Math.max(0, Math.min(100, parseInt(c.avance, 10) || 0));
    var arr = Array.isArray(c.fases) && c.fases.length ? c.fases : null;
    if (!arr) return 0;
    var done = arr.filter(function (f) { return (f && f.estado) === 'Completada' || f === 'Completada'; }).length;
    return Math.round((done / arr.length) * 100);
  }
  // Pinta el usuario real donde el diseno trae el demo (Ing. Roberto Silva).
  // Solo nodos de texto: no rompe listeners ni valores de formularios.
  function paintUser() {
    var u = UN.getUser() || {};
    var map = [];
    if (u.nombre) { map.push(['Ing. Roberto Silva', u.nombre], ['Roberto Silva', u.nombre]); }
    if (u.email) map.push(['roberto.silva@unidosnerba.pe', u.email]);
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

  function ensurePeHeader() {
    // Header único global: mismo estilo en todos los roles.
    if (window.UN && UN.ensureMenu) UN.ensureMenu('especiales');
  }

  window.ESP = {
    q: q, esc: esc, fmtFecha: fmtFecha, waLink: waLink, tipoSlug: tipoSlug,
    ensurePeHeader: ensurePeHeader,
    fasesOf: fasesOf, avanceOf: avanceOf, paintUser: paintUser, csvDownload: csvDownload,
    FASES_TXT: FASES_TXT,
    quotes: function () { return UN.api('/api/cotizaciones').then(function (list) { return (list || []).filter(function (c) { return c.area === 'PROYECTOS_ESPECIALES'; }); }); },
    setEstado: function (folio, estado) {
      return UN.api('/api/cotizaciones/' + encodeURIComponent(folio) + '/estado', { method: 'PUT', body: { estado: estado } });
    },
    saveProyecto: function (folio, data) {
      return UN.api('/api/cotizaciones/' + encodeURIComponent(folio) + '/proyecto', { method: 'PUT', body: data });
    },
  };
  // Header único en las 4 vistas (las páginas ya traen su guardia y datos).
  if (/^\/especiales\//.test(location.pathname)) {
    try { ensurePeHeader(); } catch (e) { /* header original como respaldo */ }
  }
})();
