import { cookies } from 'next/headers';
import { COOKIE_SESION, Sesion, leerToken } from '@/lib/session';

/**
 * Lee la sesión desde la cookie, en el servidor.
 *
 * Vive aparte de `actions/auth.ts` porque ese archivo es `'use server'` y solo
 * puede exportar acciones; esto lo usan otras acciones por dentro.
 */
export async function sesionActual(): Promise<Sesion | null> {
  return leerToken((await cookies()).get(COOKIE_SESION)?.value);
}

/** Nombre de quien tiene la sesión abierta, para registrar quién hizo qué */
export async function nombreDeSesion(): Promise<string | null> {
  return (await sesionActual())?.nombre ?? null;
}
