'use server';

import { createClient } from '@/lib/supabase/server';
import { leerToken, COOKIE_SESION, PersonaAdmin } from '@/lib/session';
import { mensajeDeErrorAuth } from '@/lib/authErrors';
import { cookies } from 'next/headers';

/**
 * Administración del personal.
 *
 * Todas las acciones exigen el PIN de quien administra, no solo su sesión.
 * El motivo: la app se conecta a la base con la clave pública (visible desde
 * cualquier navegador), así que la base no puede fiarse de que una petición
 * venga de nuestro servidor. Exigir el PIN hace que tener la clave pública no
 * alcance para crear usuarios ni resetear PINes.
 *
 * La sesión se usa solo para saber QUIÉN dice ser; el PIN lo demuestra.
 */

/** Id de quien tiene la sesión abierta, si es administrador */
async function adminDeLaSesion() {
  const sesion = await leerToken((await cookies()).get(COOKIE_SESION)?.value);
  if (!sesion || sesion.rol !== 'admin') return null;
  return sesion;
}

export async function listarPersonal(adminPin: string) {
  const sesion = await adminDeLaSesion();
  if (!sesion) {
    return { success: false as const, error: 'Necesitas entrar como administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { data, error } = await supabase.rpc('listar_usuarios_admin', {
    p_admin_id: sesion.id,
    p_admin_pin: adminPin,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  return { success: true as const, personal: (data ?? []) as PersonaAdmin[] };
}

export async function crearPersona(
  adminPin: string,
  nombre: string,
  rol: string,
  pinTemporal: string
) {
  const sesion = await adminDeLaSesion();
  if (!sesion) {
    return { success: false as const, error: 'Necesitas entrar como administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { error } = await supabase.rpc('crear_usuario', {
    p_admin_id: sesion.id,
    p_admin_pin: adminPin,
    p_nombre: nombre,
    p_rol: rol,
    p_pin_temporal: pinTemporal,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  return { success: true as const };
}

export async function resetearPinDePersona(
  adminPin: string,
  usuarioId: number,
  pinTemporal: string
) {
  const sesion = await adminDeLaSesion();
  if (!sesion) {
    return { success: false as const, error: 'Necesitas entrar como administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { error } = await supabase.rpc('resetear_pin', {
    p_admin_id: sesion.id,
    p_admin_pin: adminPin,
    p_usuario_id: usuarioId,
    p_pin_temporal: pinTemporal,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  return { success: true as const };
}

export async function cambiarEstadoDePersona(
  adminPin: string,
  usuarioId: number,
  activo: boolean
) {
  const sesion = await adminDeLaSesion();
  if (!sesion) {
    return { success: false as const, error: 'Necesitas entrar como administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { error } = await supabase.rpc('cambiar_estado_usuario', {
    p_admin_id: sesion.id,
    p_admin_pin: adminPin,
    p_usuario_id: usuarioId,
    p_activo: activo,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  return { success: true as const };
}
