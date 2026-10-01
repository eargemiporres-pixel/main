/* Sustituto de node:crypto para la demo en el navegador. Los datos viven solo
   en la memoria de la pestaña, así que el "hash" de contraseñas es un
   resumen sencillo (FNV-1a), suficiente para la demo y nunca para producción. */
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

export class Bytes {
  constructor(u8) { this.u8 = u8; this.length = u8.length; }
  toString(enc) {
    if (enc === 'base64url') return btoa(String.fromCharCode(...this.u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return hex(this.u8);
  }
  static fromHex(s) {
    const u8 = new Uint8Array(Math.floor(String(s).length / 2));
    for (let i = 0; i < u8.length; i++) u8[i] = parseInt(s.substr(i * 2, 2), 16);
    return new Bytes(u8);
  }
}

export function randomBytes(n) {
  return new Bytes(globalThis.crypto.getRandomValues(new Uint8Array(n)));
}

export function scryptSync(password, salt, len) {
  const text = `${password}|${salt}`;
  const out = new Uint8Array(len);
  let h = 2166136261;
  for (let r = 0; r < len; r++) {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= r;
    out[r] = h & 255;
  }
  return new Bytes(out);
}

export function timingSafeEqual(a, b) {
  return a.toString('hex') === b.toString('hex');
}
