/* Sustitutos mínimos de node:fs, node:fs/promises, node:path y node:url.
   En el navegador no hay disco: la base de datos vive en memoria. */
export function mkdirSync() {}
export function rmSync() {}
export async function readFile() { throw new Error('Sin sistema de archivos en el navegador'); }
export const join = (...parts) => parts.join('/').replace(/\/+/g, '/');
export const normalize = (p) => p;
export const dirname = (p) => String(p).replace(/\/[^/]*$/, '') || '.';
export const extname = (p) => (String(p).match(/\.[^./]*$/) || [''])[0];
export const fileURLToPath = (u) => String(u);
