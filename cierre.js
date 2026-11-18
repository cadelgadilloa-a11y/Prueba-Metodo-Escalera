// Fecha de cierre de la prueba publicada.
//
// Pasada esta fecha, la página redirige a cerrado.html. Es el respaldo del
// navegador: la regla principal está en .htaccess (servidor). Si cambias la
// fecha aquí, cámbiala también allá.
//
// Formato ISO con zona horaria de Colombia (-05:00).
const FECHA_CIERRE = '2026-11-25T23:59:59-05:00';

if (Date.now() >= new Date(FECHA_CIERRE).getTime()) {
  location.replace('cerrado.html');
}
