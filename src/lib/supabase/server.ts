import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { sesionActual } from '@/lib/sesionServidor'
import { crearTokenSupabase } from '@/lib/session'

/**
 * Cliente de Supabase para usar en server actions y páginas de servidor.
 *
 * Esta app no usa el sistema de autenticación de Supabase (el login es
 * propio, con PIN y cookie firmada aparte) — por eso se usa el cliente
 * "plano" de @supabase/supabase-js en vez de `createServerClient` de
 * @supabase/ssr: ese wrapper está pensado para apps que sí usan Supabase
 * Auth y engancha un listener (`auth.onAuthStateChange`) que es
 * incompatible con la opción `accessToken` que necesitamos aquí.
 *
 * Si hay sesión propia, se firma un JWT que Supabase reconoce como
 * 'authenticated' (ver session.ts:crearTokenSupabase), para que las
 * políticas de lectura de las tablas del negocio dejen de aceptar
 * cualquier petición anónima. Sin sesión (por ejemplo, en /login) se
 * conecta como 'anon', igual que antes.
 */
export async function createClient() {
  const sesion = await sesionActual();
  const token = sesion ? await crearTokenSupabase(sesion) : null;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      ...(token ? { accessToken: async () => token } : {}),
    }
  )
}
