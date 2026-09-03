import { cookies } from 'next/headers';
import { COOKIE_SESION, Sesion, leerToken, puedeVer } from '@/lib/session';

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

/**
 * Exige una sesión con acceso a `ruta`, para usar al principio de un server
 * action — no solo en la página.
 *
 * El proxy ya bloquea la navegación por rol (cocina no puede *abrir*
 * `/liquidacion`, por ejemplo), pero un server action es su propio punto de
 * entrada: si alguien logra invocarlo directamente sin pasar por la página,
 * el proxy no lo ve. Esta función reutiliza las mismas reglas de `puedeVer`
 * para que la protección sea la misma en los dos lugares y no se puedan
 * desincronizar.
 *
 * Devuelve la sesión si tiene acceso, o `null` si no hay sesión o el rol no
 * alcanza — quien llama decide qué mensaje mostrar.
 */
export async function sesionConAcceso(ruta: string): Promise<Sesion | null> {
  const sesion = await sesionActual();
  if (!sesion || !puedeVer(sesion.rol, ruta)) return null;
  return sesion;
}
