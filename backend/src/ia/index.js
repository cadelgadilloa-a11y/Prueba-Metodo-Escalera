// Selector de proveedor. Cambiar de IA es cambiar IA_PROVEEDOR en el .env;
// ningún otro archivo del backend sabe qué proveedor está en uso.

import { config } from '../config.js';
import * as simulado from './simulado.js';
import * as gemini from './gemini.js';

const PROVEEDORES = { simulado, gemini };

export function obtenerProveedor(nombre = config.ia.proveedor){
  const proveedor = PROVEEDORES[nombre];
  if (!proveedor){
    throw new Error(`Proveedor de IA desconocido: "${nombre}". Opciones: ${Object.keys(PROVEEDORES).join(', ')}`);
  }
  return { nombre, ...proveedor };
}
