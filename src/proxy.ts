import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  COOKIE_SESION,
  DURACION_SESION_SEGUNDOS,
  leerToken,
  puedeVer,
  renovarToken,
  rutaInicial,
  sesionNecesitaRevalidar,
} from '@/lib/session';
import { sesionSigueVigente } from '@/lib/sesionVigente';

/**
 * Control de acceso por sesión firmada (Next.js 16).
 *
 * La cookie se verifica de verdad —firma HMAC y vencimiento—, no solo se mira
 * si existe: una cookie inventada a mano no pasa de aquí.
 *
 * Además de dejar entrar o no, reparte por rol: cocina solo ve su tablero y el
 * dashboard es únicamente de administración.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Las rutas /api/* son JSON, no páginas: no tiene sentido "redirigirlas" a
  // /login o a la pantalla de inicio del rol. Cada una valida su propia
  // sesión y responde 401 si hace falta (ver /api/supabase-token).
  //
  // Bug real que esto corrige: como ninguna ruta de RUTAS_POR_ROL empieza con
  // '/api', `puedeVer` siempre devolvía false para /api/supabase-token y el
  // proxy lo redirigía (307) a la pantalla de inicio del rol — el navegador
  // seguía la redirección y recibía el HTML de esa página en vez del JSON del
  // token. `obtenerAccessToken()` interpretaba eso como "no hay token" y el
  // cliente de Supabase se quedaba en el rol 'anon', que ya no puede leer
  // pedidos — dejando el tablero de cocina y el de liquidación en tiempo real
  // vacíos para TODOS los roles, no solo cocina, desde que se cerró la
  // lectura pública (2026-09-04).
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const esLogin = pathname.startsWith('/login');

  let sesion = await leerToken(request.cookies.get(COOKIE_SESION)?.value);

  // Cada pocos minutos se le pregunta a la base si la persona sigue activa y
  // con la misma versión de sesión: así desactivarla o resetearle el PIN la
  // saca de verdad, en vez de dejarla entrar hasta que venza la cookie.
  let cookieRenovada: string | null = null;
  if (sesion && sesionNecesitaRevalidar(sesion)) {
    if (await sesionSigueVigente(sesion)) {
      sesion = { ...sesion, chk: Math.floor(Date.now() / 1000) };
      cookieRenovada = await renovarToken(sesion);
    } else {
      sesion = null;
    }
  }

  // Sin sesión válida: solo se puede estar en la pantalla de entrada
  if (!sesion) {
    if (esLogin) return NextResponse.next();

    const destino = new URL('/login', request.url);
    const respuesta = NextResponse.redirect(destino);
    // Si la cookie venía vencida, alterada o ya no vale, se limpia para no reintentar
    respuesta.cookies.delete(COOKIE_SESION);
    return respuesta;
  }

  let respuesta: NextResponse;

  if (esLogin) {
    // Con sesión abierta, el login sobra
    respuesta = NextResponse.redirect(new URL(rutaInicial(sesion.rol), request.url));
  } else if (!puedeVer(sesion.rol, pathname)) {
    // Cada rol a lo suyo
    respuesta = NextResponse.redirect(new URL(rutaInicial(sesion.rol), request.url));
  } else {
    respuesta = NextResponse.next();
  }

  if (cookieRenovada) {
    respuesta.cookies.set(COOKIE_SESION, cookieRenovada, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // La cookie conserva su vencimiento original (va dentro del token); el
      // maxAge solo evita que el navegador la trate como de sesión.
      maxAge: Math.max(sesion.exp - Math.floor(Date.now() / 1000), 0) || DURACION_SESION_SEGUNDOS,
      path: '/',
    });
  }

  return respuesta;
}

export default proxy;

// Aplicar a todas las rutas excepto _next (assets estáticos) y archivos de imagen pública
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|.*\\.ico$).*)'],
};
