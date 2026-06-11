import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy de autenticación básica por cookie (Next.js 16).
 * Protege todas las rutas de la app excepto /login y archivos estáticos.
 * La cookie `auth_fgaf` se establece al hacer login en /app/actions/auth.ts.
 */
export function proxy(request: NextRequest) {
  const isAuth = request.cookies.has('auth_fgaf');
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Si no está autenticado y trata de acceder a rutas protegidas → redirigir al login
  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si ya está autenticado y trata de ir al login → redirigir al inicio
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/pedidos', request.url));
  }

  return NextResponse.next();
}

export default proxy;

// Aplicar a todas las rutas excepto _next (assets estáticos) y archivos de imagen pública
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|.*\\.ico$).*)'],
};
