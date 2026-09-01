/**
 * Sesión de la persona que está usando la terminal.
 *
 * La sesión viaja en una cookie httpOnly firmada con HMAC-SHA256. Firmarla
 * importa: sin firma, cualquiera podría escribir a mano una cookie diciendo
 * que es la administradora y entrar al dashboard.
 *
 * Se usa Web Crypto (no `node:crypto`) porque este módulo también corre en el
 * proxy de Next, que puede ejecutarse fuera de Node.
 */

export type Rol = 'cajero' | 'cocina' | 'admin';

export interface Sesion {
  id: number;
  nombre: string;
  rol: Rol;
  /** Vencimiento en segundos desde epoch */
  exp: number;
}

/** Persona tal como se muestra en la pantalla de entrada (sin datos sensibles) */
export interface UsuarioLogin {
  id: number;
  nombre: string;
  rol: Rol;
}

/** Fila del listado de administración de personal */
export interface PersonaAdmin {
  id: number;
  nombre: string;
  rol: Rol;
  activo: boolean;
  debe_cambiar_pin: boolean;
  bloqueado: boolean;
  ultimo_ingreso: string | null;
}

export const COOKIE_SESION = 'sesion_fgaf';

/** Duración de la sesión: un turno largo, sin obligar a entrar a media jornada */
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 16;

/**
 * Clave para firmar. En producción DEBE venir de la variable de entorno
 * SESSION_SECRET; sin ella la firma es previsible y la sesión se podría
 * falsificar. Se avisa una sola vez para no llenar los registros.
 */
let yaAvisado = false;

function secreto(): string {
  const desdeEntorno = process.env.SESSION_SECRET;
  if (desdeEntorno && desdeEntorno.length >= 16) return desdeEntorno;

  if (!yaAvisado) {
    yaAvisado = true;
    console.warn(
      '[sesion] Falta SESSION_SECRET (o es muy corta). Las sesiones se firman ' +
        'con una clave por defecto y se podrían falsificar. Define SESSION_SECRET ' +
        'en las variables de entorno.'
    );
  }
  return 'ricuras-fegaf-clave-por-defecto-cambiar';
}

/* ------------------------------------------------------------------
   base64url — la cookie no admite '+', '/' ni '=' sin escapar
   ------------------------------------------------------------------ */

function aBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function desdeBase64Url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(relleno);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

async function firmar(datos: string): Promise<string> {
  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    'raw',
    codificador.encode(secreto()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', clave, codificador.encode(datos));
  return aBase64Url(new Uint8Array(firma));
}

/** Comparación en tiempo constante: comparar con === filtra información */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

/* ------------------------------------------------------------------
   API
   ------------------------------------------------------------------ */

/** Arma el valor firmado que va en la cookie */
export async function crearToken(
  datos: Omit<Sesion, 'exp'>,
  duracionSegundos = DURACION_SESION_SEGUNDOS
): Promise<string> {
  const sesion: Sesion = {
    ...datos,
    exp: Math.floor(Date.now() / 1000) + duracionSegundos,
  };
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(sesion)));
  return `${cuerpo}.${await firmar(cuerpo)}`;
}

/**
 * Devuelve la sesión si el token es auténtico y no ha vencido.
 * Cualquier problema —firma inválida, formato raro, vencida— devuelve null.
 */
export async function leerToken(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;

  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;

  try {
    if (!igualesEnTiempoConstante(firma, await firmar(cuerpo))) return null;

    const sesion = JSON.parse(new TextDecoder().decode(desdeBase64Url(cuerpo))) as Sesion;

    if (typeof sesion.id !== 'number' || typeof sesion.nombre !== 'string') return null;
    if (!['cajero', 'cocina', 'admin'].includes(sesion.rol)) return null;
    if (sesion.exp < Math.floor(Date.now() / 1000)) return null;

    return sesion;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   Permisos por rol
   ------------------------------------------------------------------ */

/** Rutas que puede ver cada rol. El resto se redirige a su pantalla de inicio. */
const RUTAS_POR_ROL: Record<Rol, string[]> = {
  // Cocina solo ve su tablero: no tiene por qué entrar a la caja
  cocina: ['/cocina'],
  cajero: ['/', '/pedidos', '/cocina', '/liquidacion'],
  admin: ['/', '/pedidos', '/cocina', '/liquidacion', '/dashboard'],
};

/** Primera pantalla al entrar, según lo que hace cada quien */
export function rutaInicial(rol: Rol): string {
  if (rol === 'cocina') return '/cocina';
  if (rol === 'admin') return '/dashboard';
  return '/pedidos';
}

export function puedeVer(rol: Rol, ruta: string): boolean {
  return RUTAS_POR_ROL[rol].some((permitida) => {
    // '/' es la portada, no un prefijo: sin este caso aparte, `startsWith('/')`
    // daría por permitida cualquier ruta.
    if (permitida === '/') return ruta === '/';
    return ruta === permitida || ruta.startsWith(`${permitida}/`);
  });
}
