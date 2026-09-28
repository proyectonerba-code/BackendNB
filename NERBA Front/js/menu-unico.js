/* Grupo NERBA HIDALGO - Carga el CSS de botones de menú idénticos (zona cliente).
   Solo inyecta la hoja de estilos; no toca diseños. */
(function () {
  if (document.querySelector('link[data-menu-unico]')) return;
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.setAttribute('data-menu-unico', '1');
  l.href = '/css/menu-unico.css?v=2.1';
  document.head.appendChild(l);
})();
