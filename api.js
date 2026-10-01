// Capa de comunicación con el backend.
//
// Si el backend corre en otro puerto o en otra máquina, este es el único
// lugar que hay que tocar.

const API_BASE = 'http://localhost:3000';

const API = {
  base: API_BASE,

  async _pedir(metodo, ruta, cuerpo, señal){
    const res = await fetch(API_BASE + ruta, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: señal
    });

    const texto = await res.text();
    let datos;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }

    if (!res.ok){
      const err = new Error(datos?.error || `El servidor respondió ${res.status}`);
      err.status = res.status;
      err.datos = datos;
      throw err;
    }
    return datos;
  },

  salud(){
    return this._pedir('GET', '/api/salud');
  },

  rubrica(){
    return this._pedir('GET', '/api/rubrica');
  },

  crearSesion({ nombre, ocupacion, fase, tema, modo }){
    return this._pedir('POST', '/api/sesiones', { nombre, ocupacion, fase, tema, modo });
  },

  sesion(sesionId){
    return this._pedir('GET', `/api/sesiones/${sesionId}`);
  },

  guardarBorrador(sesionId, { texto, segundos }){
    return this._pedir('PATCH', `/api/sesiones/${sesionId}/borrador`, { texto, segundos });
  },

  analizar(sesionId, texto, señal){
    return this._pedir('POST', `/api/sesiones/${sesionId}/analizar`, { texto }, señal);
  },

  entregar(sesionId, { texto, segundos }){
    return this._pedir('POST', `/api/sesiones/${sesionId}/entregar`, { texto, segundos });
  },

  recalificar(sesionId){
    return this._pedir('POST', `/api/sesiones/${sesionId}/recalificar`);
  },

  comparar(codigo){
    return this._pedir('GET', `/api/participantes/${encodeURIComponent(codigo)}/comparar`);
  }
};
