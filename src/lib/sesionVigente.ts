import { Sesion, crearTokenSupabase } from '@/lib/session';

/**
 * Pregunta a la base si la sesión de la cookie sigue valiendo.
 *
 * La cookie es autocontenida: la firma prueba que la emitió este servidor,
 * pero no puede saber si después administración desactivó a la persona o le
 * reseteó el PIN. Para eso cada usuario tiene `usuarios.sesion_version`; la
 * cookie guarda la versión con la que entró y aquí se comparan.
 *
 * Se usa `fetch` directo contra PostgREST en vez del cliente de Supabase
 * porque también corre en el proxy, que tiene que ser liviano. Se llama solo
 * cuando `sesionNecesitaRevalidar` lo pide (cada pocos minutos).
 *
 * Ante cualquier fallo de red o configuración devuelve `true`: cortarle la
 * sesión a todo el local porque Supabase tardó en responder sería peor que
 * dejar pasar unos minutos más a una cuenta recién desactivada.
 */
export async function sesionSigueVigente(sesion: Sesion): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return true;

  try {
    const token = (await crearTokenSupabase(sesion)) ?? anonKey;
    const res = await fetch(`${url}/rest/v1/rpc/sesion_vigente`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_usuario_id: sesion.id, p_version: sesion.v }),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[sesion] No se pudo comprobar la sesión:', res.status, await res.text());
      return true;
    }

    const vigente = (await res.json()) as unknown;
    return vigente !== false;
  } catch (error) {
    console.error('[sesion] Error comprobando la sesión:', error);
    return true;
  }
}
