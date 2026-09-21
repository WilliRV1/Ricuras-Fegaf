'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { MENSAJE_ROL_NO_AUTORIZADO } from '@/lib/authErrors';
import type { Parametro } from '@/types';

/**
 * Cifras del negocio que cambian sin tocar el código (tabla `parametros`,
 * migración 20260921000000): tarifa y mínimo del domiciliario, minutos de
 * anticipación de los programados, categoría de bebidas.
 *
 * La tabla no está en database.types.ts: cliente sin tipar, como en recetas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteSinTipar = { from: (table: string) => any };

/** Todos los parámetros como { clave: valor }. Sin sesión devuelve {} (no revienta). */
export async function leerParametros(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const db = supabase as unknown as ClienteSinTipar;

  const { data, error } = await db.from('parametros').select('clave, valor');
  if (error) {
    console.error('Error leyendo parámetros:', error);
    return {};
  }

  const resultado: Record<string, number> = {};
  for (const fila of (data ?? []) as { clave: string; valor: number | string }[]) {
    resultado[fila.clave] = Number(fila.valor);
  }
  return resultado;
}

/** Listado completo para la pantalla de administración */
export async function listarParametros() {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  const db = supabase as unknown as ClienteSinTipar;

  const { data, error } = await db
    .from('parametros')
    .select('clave, valor, descripcion')
    .order('clave', { ascending: true });

  if (error) {
    console.error('Error listando parámetros:', error);
    return { success: false as const, error: 'No se pudieron cargar los parámetros.' };
  }

  const parametros: Parametro[] = ((data ?? []) as { clave: string; valor: number | string; descripcion: string }[]).map(
    (p) => ({ clave: p.clave, valor: Number(p.valor), descripcion: p.descripcion })
  );

  return { success: true as const, parametros };
}

export async function actualizarParametro(clave: string, valor: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  if (!Number.isFinite(valor) || valor < 0) {
    return { success: false as const, error: 'El valor no puede ser negativo.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('actualizar_parametro', { p_clave: clave, p_valor: valor });

  if (error) {
    if (error.message?.includes('ROL_NO_AUTORIZADO')) {
      return { success: false as const, error: MENSAJE_ROL_NO_AUTORIZADO };
    }
    if (error.message?.includes('PARAMETRO_NO_ENCONTRADO')) {
      return { success: false as const, error: 'Ese parámetro no existe.' };
    }
    return { success: false as const, error: 'No se pudo guardar el parámetro.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/reportes');
  revalidatePath('/cocina');
  return { success: true as const };
}
