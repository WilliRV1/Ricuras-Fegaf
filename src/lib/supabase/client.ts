import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

/**
 * Cachea el JWT firmado por el servidor (/api/supabase-token) en memoria de
 * la pestaña. Supabase llama a `accessToken` en cada conexión/reconexión de
 * Realtime y antes de cada request; sin este caché estaríamos pidiendo un
 * token nuevo constantemente por algo que dura toda la sesión (16h).
 */
let tokenCacheado: { valor: string; exp: number } | null = null;

async function obtenerAccessToken(): Promise<string | null> {
  const ahora = Math.floor(Date.now() / 1000);
  // Se renueva 60s antes de vencer, no justo al filo.
  if (tokenCacheado && tokenCacheado.exp - 60 > ahora) {
    return tokenCacheado.valor;
  }

  try {
    const res = await fetch('/api/supabase-token', { cache: 'no-store' });
    if (!res.ok) {
      tokenCacheado = null;
      return null;
    }
    const { token, exp } = (await res.json()) as { token: string; exp: number };
    tokenCacheado = { valor: token, exp };
    return token;
  } catch {
    tokenCacheado = null;
    return null;
  }
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: obtenerAccessToken,
    }
  )
}
