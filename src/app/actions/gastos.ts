'use server';

import { createClient } from '@/lib/supabase/server';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { revalidatePath } from 'next/cache';
import type { Gasto } from '@/types';

/**
 * Fase 2 / Módulo 7 — Control de Egresos Operativos.
 *
 * Mismo criterio que recetas.ts: sesión de administración sin PIN, escritura
 * solo por RPC `SECURITY DEFINER` (migración 20260908000001). `gastos` es
 * una tabla nueva, todavía sin generar en database.types.ts, de ahí el
 * cliente sin tipar en las consultas .from() (ver recetas.ts para el porqué
 * de no usar @ts-expect-error en cadenas .from().select().eq()...).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteSinTipar = { from: (table: string) => any };

function mensajeDeError(mensaje: string | undefined): string {
  if (!mensaje) return 'Error inesperado del servidor.';
  if (mensaje.includes('DESCRIPCION_REQUERIDA')) return 'Escribe una descripción del gasto.';
  if (mensaje.includes('CATEGORIA_REQUERIDA')) return 'Escribe la categoría del gasto.';
  if (mensaje.includes('TIPO_INVALIDO')) return 'El tipo debe ser fijo o variable.';
  if (mensaje.includes('VALOR_INVALIDO')) return 'El valor debe ser mayor a cero.';
  if (mensaje.includes('GASTO_NO_ENCONTRADO')) return 'Ese gasto ya no existe.';
  return 'No se pudo completar la operación.';
}

export async function listarGastos(fromStr?: string, toStr?: string) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  const db = supabase as unknown as ClienteSinTipar;

  const bogotaHoy = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const from = fromStr || `${bogotaHoy.slice(0, 7)}-01`; // por defecto, lo corrido del mes
  const to = toStr || from;

  const { data, error } = await db
    .from('gastos')
    .select('id, descripcion, categoria, tipo, valor, fecha, created_at')
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('Error listando gastos:', error);
    return { success: false as const, error: 'No se pudieron cargar los gastos.' };
  }

  return { success: true as const, gastos: (data ?? []) as Gasto[], from, to };
}

export async function crearGasto(
  descripcion: string,
  categoria: string,
  tipo: 'fijo' | 'variable',
  valor: number,
  fecha?: string
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('crear_gasto', {
    p_descripcion: descripcion,
    p_categoria: categoria,
    p_tipo: tipo,
    p_valor: valor,
    p_fecha: fecha ?? null,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/gastos');
  return { success: true as const };
}

export async function eliminarGasto(gastoId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('eliminar_gasto', { p_gasto_id: gastoId });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/gastos');
  return { success: true as const };
}
