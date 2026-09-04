import { NextResponse } from 'next/server';
import { sesionActual } from '@/lib/sesionServidor';
import { crearTokenSupabase } from '@/lib/session';

/**
 * Le entrega al navegador un JWT que Supabase reconoce como "autenticado",
 * a partir de la sesión propia (la cookie httpOnly). El cliente de Supabase
 * del navegador (src/lib/supabase/client.ts) lo pide antes de conectarse en
 * tiempo real, para que las políticas de lectura puedan exigir sesión en vez
 * de dejar pasar a cualquiera con la clave pública del proyecto.
 *
 * Nadie puede pedir este token sin la cookie de sesión — por eso no hace
 * falta protegerlo aparte, ya lo protege el mismo mecanismo que protege el
 * resto de la app.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) {
    return NextResponse.json({ error: 'SIN_SESION' }, { status: 401 });
  }

  const token = await crearTokenSupabase(sesion);
  if (!token) {
    // Falta SUPABASE_JWT_SECRET en el entorno: no se puede firmar. El
    // cliente sigue funcionando como 'anon' — comportamiento de antes.
    return NextResponse.json({ error: 'JWT_SECRET_NO_CONFIGURADO' }, { status: 501 });
  }

  return NextResponse.json(
    { token, exp: sesion.exp },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
