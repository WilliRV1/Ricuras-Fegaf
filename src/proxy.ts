import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_SESION, leerToken, puedeVer, rutaInicial } from '@/lib/session';

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
  const esLogin = pathname.startsWith('/login');

  const sesion = await leerToken(request.cookies.get(COOKIE_SESION)?.value);

  // Sin sesión válida: solo se puede estar en la pantalla de entrada
  if (!sesion) {
    if (esLogin) return NextResponse.next();

    const destino = new URL('/login', request.url);
    const respuesta = NextResponse.redirect(destino);
    // Si la cookie venía vencida o alterada, se limpia para no reintentar
    respuesta.cookies.delete(COOKIE_SESION);
    return respuesta;
  }

  // Con sesión abierta, el login sobra
  if (esLogin) {
    return NextResponse.redirect(new URL(rutaInicial(sesion.rol), request.url));
  }

  // Cada rol a lo suyo
  if (!puedeVer(sesion.rol, pathname)) {
    return NextResponse.redirect(new URL(rutaInicial(sesion.rol), request.url));
  }

  return NextResponse.next();
}

export default proxy;

// Aplicar a todas las rutas excepto _next (assets estáticos) y archivos de imagen pública
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|.*\\.ico$).*)'],
};
