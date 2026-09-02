'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  COOKIE_SESION,
  DURACION_SESION_SEGUNDOS,
  Sesion,
  UsuarioLogin,
  crearToken,
  leerToken,
  rutaInicial,
} from '@/lib/session';
import { mensajeDeErrorAuth } from '@/lib/authErrors';

/** Los nombres que se muestran como botones en la pantalla de entrada */
export async function listarUsuarios() {
  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { data, error } = await supabase.rpc('listar_usuarios_activos');

  if (error) {
    console.error('Error listando usuarios:', error);
    return { success: false as const, error: 'No se pudo cargar la lista de personas.' };
  }

  return { success: true as const, usuarios: (data ?? []) as UsuarioLogin[] };
}

/** Deja la cookie de sesión firmada en el navegador */
async function abrirSesion(datos: Omit<Sesion, 'exp'>) {
  (await cookies()).set(COOKIE_SESION, await crearToken(datos), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION_SEGUNDOS,
    path: '/',
  });
}

/**
 * Entrar con nombre + PIN.
 *
 * Si la persona todavía tiene el PIN temporal que le puso administración, NO
 * se abre la sesión: se devuelve `debeCambiarPin` para que la app la obligue a
 * elegir el suyo primero.
 */
export async function iniciarSesion(usuarioId: number, pin: string) {
  if (!/^[0-9]{4}$/.test(pin)) {
    return { success: false as const, error: 'El PIN son 4 dígitos.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { data, error } = await supabase.rpc('iniciar_sesion', {
    p_usuario_id: usuarioId,
    p_pin: pin,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  const usuario = (data as (UsuarioLogin & { debe_cambiar_pin: boolean })[] | null)?.[0];
  if (!usuario) {
    return { success: false as const, error: 'PIN incorrecto.' };
  }

  if (usuario.debe_cambiar_pin) {
    return {
      success: true as const,
      debeCambiarPin: true as const,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    };
  }

  await abrirSesion({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });

  return {
    success: true as const,
    debeCambiarPin: false as const,
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    destino: rutaInicial(usuario.rol),
  };
}

/**
 * Elegir el PIN propio. Al terminar deja la sesión abierta, porque para
 * llegar acá hubo que demostrar que se conocía el PIN anterior.
 */
export async function cambiarPin(usuarioId: number, pinActual: string, pinNuevo: string) {
  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { error } = await supabase.rpc('cambiar_pin', {
    p_usuario_id: usuarioId,
    p_pin_actual: pinActual,
    p_pin_nuevo: pinNuevo,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { data } = await supabase.rpc('confirmar_pin', {
    p_usuario_id: usuarioId,
    p_pin: pinNuevo,
  });

  const usuario = (data as UsuarioLogin[] | null)?.[0];
  if (!usuario) {
    return { success: false as const, error: 'No se pudo abrir la sesión. Entra de nuevo.' };
  }

  await abrirSesion({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });

  return { success: true as const, destino: rutaInicial(usuario.rol) };
}

/**
 * Confirma el PIN sin abrir sesión, para las acciones delicadas.
 *
 * En una tablet compartida la sesión abierta no prueba quién está parado ahí
 * en ese momento: al anular un pedido se vuelve a pedir el PIN, y ese es el
 * nombre que queda registrado.
 */
export async function confirmarPin(usuarioId: number, pin: string) {
  if (!/^[0-9]{4}$/.test(pin)) {
    return { success: false as const, error: 'El PIN son 4 dígitos.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - Tipos generados sin los RPC de usuarios
  const { data, error } = await supabase.rpc('confirmar_pin', {
    p_usuario_id: usuarioId,
    p_pin: pin,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorAuth(error.message) };
  }

  const usuario = (data as UsuarioLogin[] | null)?.[0];
  if (!usuario) {
    return { success: false as const, error: 'PIN incorrecto.' };
  }

  return { success: true as const, usuario };
}

/** La sesión abierta en esta terminal, o null */
export async function getSesion(): Promise<Sesion | null> {
  return leerToken((await cookies()).get(COOKIE_SESION)?.value);
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_SESION);
  return { success: true as const };
}
