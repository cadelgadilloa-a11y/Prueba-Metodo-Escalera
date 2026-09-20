// Prueba de humo: ejercita el flujo completo contra el servidor corriendo.
//   1) node src/server.js      (en otra terminal)
//   2) node pruebas/humo.mjs
//
// Usa el proveedor 'simulado', así que no gasta cuota de Gemini.

const BASE = process.env.BASE || 'http://localhost:3000';

const TEXTO_PRE = `Las redes sociales son una cosa muy importante hoy en dia. Sin embargo, hay muchos aspectos que se deben tener en cuenta porque el tema es complejo.

Sin embargo, tambien hay que decir que los jovenes las usan mucho. Sin embargo, esto genera problemas, resultando en una dependencia preocupante que afecta a muchas personas de distintas edades y que deberia ser estudiada con mucho mas detalle por parte de los investigadores que trabajan en esta area.`;

const TEXTO_POST = `Las redes sociales reconfiguraron la comunicacion juvenil. Este texto sostiene que la transformacion no es meramente tecnica: altera las normas de interaccion entre pares.

La evidencia respalda esa lectura. Los estudios longitudinales documentan un desplazamiento de la conversacion presencial hacia formatos asincronicos. Dado que ese formato premia la inmediatez, la argumentacion extensa pierde terreno frente al intercambio fragmentario.

No obstante, seria impreciso atribuir el fenomeno unicamente a la plataforma. Las practicas comunicativas responden a condiciones materiales previas. Por consiguiente, toda intervencion educativa debe considerar ambos planos antes de proponer correctivos.`;

async function pedir(metodo, ruta, cuerpo){
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const texto = await res.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  if (!res.ok) throw new Error(`${metodo} ${ruta} -> ${res.status}: ${texto.slice(0, 250)}`);
  return datos;
}

function seccion(titulo){ console.log(`\n--- ${titulo} ---`); }

const salud = await pedir('GET', '/api/salud');
seccion('SALUD');
console.log(salud);

const nombre = `Participante de Prueba ${Date.now()}`;
const resultados = {};

for (const [fase, texto] of [['pre', TEXTO_PRE], ['post', TEXTO_POST]]){
  seccion(`FASE ${fase.toUpperCase()}`);

  const sesion = await pedir('POST', '/api/sesiones', {
    nombre,
    ocupacion: 'Estudiante de Ingenieria de Sistemas',
    fase,
    tema: 'El impacto de las redes sociales en la comunicacion juvenil',
    modo: 'visible'   // en 'ciego' el servidor no devuelve el juicio, a proposito
  });
  console.log(`sesion ${sesion.sesionId}, codigo ${sesion.codigo}`);

  await pedir('PATCH', `/api/sesiones/${sesion.sesionId}/borrador`, {
    texto: texto.slice(0, 120), segundos: 45
  });
  await pedir('PATCH', `/api/sesiones/${sesion.sesionId}/borrador`, {
    texto, segundos: 180
  });
  console.log('borradores guardados: 2');

  const entrega = await pedir('POST', `/api/sesiones/${sesion.sesionId}/entregar`, {
    texto, segundos: 240
  });

  console.log(`nota global : ${entrega.notaGlobal}`);
  console.log(`error       : ${entrega.error || 'ninguno'}`);
  console.log('puntajes    :', entrega.puntajes);
  console.log('trazabilidad:', entrega.trazabilidad);

  resultados[fase] = { codigo: sesion.codigo, nota: entrega.notaGlobal };
}

seccion('COMPARACION PRE/POST');
const comparacion = await pedir('GET', `/api/participantes/${resultados.pre.codigo}/comparar`);
console.log(`pre  : ${comparacion.pre?.notaGlobal}`);
console.log(`post : ${comparacion.post?.notaGlobal}`);
console.log(`delta global : ${comparacion.delta?.notaGlobal}`);
console.log('delta por parametro:', comparacion.delta?.porParametro);
if (comparacion.advertencia) console.log('ADVERTENCIA:', comparacion.advertencia);

seccion('EXPORT CSV');
const csv = await (await fetch(BASE + '/api/export.csv')).text();
const lineas = csv.trim().split('\n');
console.log(`${lineas.length - 1} filas exportadas`);
console.log('encabezado:', lineas[0].slice(0, 160) + '...');

console.log('\nPrueba de humo completada sin errores.');
