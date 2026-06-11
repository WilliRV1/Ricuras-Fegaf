import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const isAuth = request.cookies.has('auth_fgaf');
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  // Si no está autenticado y trata de acceder a rutas protegidas
  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si ya está autenticado y trata de acceder al login, ir al inicio (pedidos)
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/pedidos', request.url));
  }

  return NextResponse.next();
}

// Proteger todas las rutas principales excepto login y _next (archivos estáticos)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
