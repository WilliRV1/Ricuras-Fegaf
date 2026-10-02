'use server';

import { createClient } from '@/lib/supabase/server';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { revalidatePath } from 'next/cache';
import type { CompraInsumo, InsumoConCosto, ProductoCosto, RecetaItem } from '@/types';
import { MENSAJE_ROL_NO_AUTORIZADO } from '@/lib/authErrors';

/**
 * Fase 2 / Módulo 6 — Constructor de Recetas y Costeo.
 *
 * Mismo criterio de acceso que el resto del dashboard (`sesionConAcceso`,
 * sin reconfirmar PIN): registrar insumos y armar recetas es trabajo diario
 * de administración, no una operación de alto riesgo como crear usuarios.
 *
 * La escritura pasa siempre por los RPC `SECURITY DEFINER` de la migración
 * 20260908000000 (crear_insumo, registrar_compra_insumo, guardar_receta):
 * las tablas nuevas no tienen política de INSERT/UPDATE para la clave
 * pública. Las tablas y vistas nuevas todavía no están en
 * database.types.ts: los RPC usan @ts-expect-error (igual que el resto del
 * código) y las consultas .from() de tablas/vistas nuevas pasan por un
 * cliente sin tipar, porque la cadena .from().select().eq()... hace que
 * @ts-expect-error deje de alinear con la línea exacta del error.
 */

function mensajeDeError(mensaje: string | undefined): string {
  if (!mensaje) return 'Error inesperado del servidor.';
  if (mensaje.includes('ROL_NO_AUTORIZADO')) return MENSAJE_ROL_NO_AUTORIZADO;
  if (mensaje.includes('INSUMO_REPETIDO')) return 'Hay un insumo repetido en la receta.';
  if (mensaje.includes('CANTIDAD_INVALIDA')) return 'Las cantidades de la receta deben ser mayores a cero.';
  if (mensaje.includes('NOMBRE_REQUERIDO')) return 'Escribe el nombre del insumo.';
  if (mensaje.includes('UNIDAD_REQUERIDA')) return 'Escribe la unidad del insumo.';
  if (mensaje.includes('INSUMO_NO_ENCONTRADO')) return 'Ese insumo ya no existe.';
  if (mensaje.includes('PRECIO_INVALIDO')) return 'El precio de compra debe ser mayor a cero.';
  if (mensaje.includes('RENDIMIENTO_INVALIDO')) return 'El rendimiento debe ser mayor a cero.';
  if (mensaje.includes('PRODUCTO_NO_ENCONTRADO')) return 'Ese producto ya no existe.';
  if (mensaje.includes('ITEMS_REQUERIDOS')) return 'Agrega al menos un insumo a la receta.';
  if (mensaje.includes('COMPRA_NO_ENCONTRADA')) return 'Esa compra ya no existe.';
  if (mensaje.includes('ENLACE_EN_CADENA')) {
    return 'No se puede: el insumo del que quieres tomar el precio ya toma el suyo de otro lado, o este insumo ya le da el precio a otro.';
  }
  if (mensaje.includes('ENLACE_CIRCULAR')) return 'No se puede: el enlace daría la vuelta sobre sí mismo.';
  if (mensaje.includes('FACTOR_INVALIDO')) return 'La cantidad por la que se multiplica debe ser mayor a cero.';
  if (mensaje.includes('UN_SOLO_ENLACE')) return 'Un insumo toma el precio de un solo lugar.';
  return 'No se pudo completar la operación.';
}

export async function listarInsumos() {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // Dos consultas en vez de un embed: vw_insumo_costo_actual es una vista,
  // no una tabla con FK, así que PostgREST no puede anidarla automáticamente
  // dentro de .select() como sí hace con relaciones reales (ver receta_items).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (table: string) => any };

  const [insumosRes, costosRes, enlazadosRes, usosRes] = await Promise.all([
    db
      .from('insumos')
      .select('id, nombre, unidad_base, activo, created_at, enlace_insumo_id, enlace_producto_id, enlace_factor, promedia')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
    db.from('vw_insumo_costo_actual').select('insumo_id, costo_unitario, origen, fecha_ultima_compra'),
    // Insumos que son "el producto mismo" (bebidas que se compran hechas)
    db.from('productos').select('insumo_id').not('insumo_id', 'is', null),
    db.from('receta_items').select('insumo_id'),
  ]);

  if (insumosRes.error) {
    console.error('Error listando insumos:', insumosRes.error);
    return { success: false as const, error: 'No se pudieron cargar los insumos.' };
  }

  type FilaCosto = {
    insumo_id: number;
    costo_unitario: number | null;
    origen: InsumoConCosto['origen'];
    fecha_ultima_compra: string | null;
  };
  const costoPorInsumo = new Map<number, FilaCosto>(
    ((costosRes.data ?? []) as FilaCosto[]).map((c) => [c.insumo_id, c])
  );

  const seCompranHechos = new Set<number>(
    (enlazadosRes.data ?? []).map((p: { insumo_id: number }) => p.insumo_id)
  );

  const usos = new Map<number, number>();
  for (const fila of (usosRes.data ?? []) as { insumo_id: number }[]) {
    usos.set(fila.insumo_id, (usos.get(fila.insumo_id) ?? 0) + 1);
  }

  const insumos: InsumoConCosto[] = (insumosRes.data ?? []).map((fila: Record<string, unknown>) => {
    const costo = costoPorInsumo.get(fila.id as number);
    return {
      id: fila.id as number,
      nombre: fila.nombre as string,
      unidad_base: fila.unidad_base as string,
      activo: fila.activo as boolean,
      created_at: fila.created_at as string,
      costo_unitario: costo?.costo_unitario != null ? Number(costo.costo_unitario) : null,
      se_compra_hecho: seCompranHechos.has(fila.id as number),
      origen: costo?.origen ?? 'compra',
      fecha_ultima_compra: costo?.fecha_ultima_compra ?? null,
      enlace_insumo_id: (fila.enlace_insumo_id as number | null) ?? null,
      enlace_producto_id: (fila.enlace_producto_id as number | null) ?? null,
      enlace_factor: Number(fila.enlace_factor ?? 1),
      promedia: Boolean(fila.promedia),
      usos: usos.get(fila.id as number) ?? 0,
    };
  });

  return { success: true as const, insumos };
}

export async function listarLotesDeInsumo(insumoId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (table: string) => any };

  const { data, error } = await db
    .from('compras_insumo')
    .select('id, insumo_id, precio_compra, rendimiento, fecha, created_at')
    .eq('insumo_id', insumoId)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .limit(12);

  if (error) {
    console.error('Error listando lotes de compra:', error);
    return { success: false as const, error: 'No se pudieron cargar las compras de ese insumo.' };
  }

  return { success: true as const, lotes: (data ?? []) as CompraInsumo[] };
}

export async function crearInsumo(nombre: string, unidadBase: string) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { data, error } = await supabase.rpc('crear_insumo', {
    p_nombre: nombre,
    p_unidad_base: unidadBase,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  return { success: true as const, insumoId: data as number };
}

export async function registrarCompraInsumo(
  insumoId: number,
  precioCompra: number,
  rendimiento: number,
  fecha?: string
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('registrar_compra_insumo', {
    p_insumo_id: insumoId,
    p_precio_compra: precioCompra,
    p_rendimiento: rendimiento,
    p_fecha: fecha ?? null,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  return { success: true as const };
}

/** Borra una compra mal escrita: el costo vuelve a salir de la compra anterior. */
export async function eliminarCompraInsumo(compraId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('eliminar_compra_insumo', { p_compra_id: compraId });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  revalidatePath('/dashboard/reportes');
  return { success: true as const };
}

/**
 * Hace que un insumo tome su precio de otro insumo o del costo de un producto
 * del menú, como las fórmulas del Excel. Los dos en null quita el enlace.
 */
export async function enlazarInsumo(
  insumoId: number,
  enlace: { insumoId: number | null; productoId: number | null; factor: number }
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('enlazar_insumo', {
    p_insumo_id: insumoId,
    p_enlace_insumo_id: enlace.insumoId,
    p_enlace_producto_id: enlace.productoId,
    p_factor: enlace.factor,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  revalidatePath('/dashboard/reportes');
  return { success: true as const };
}

/** Corrige nombre o unidad de un insumo y decide si su costo se promedia. */
export async function actualizarInsumo(insumoId: number, nombre: string, unidadBase: string, promedia: boolean) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('actualizar_insumo', {
    p_insumo_id: insumoId,
    p_nombre: nombre,
    p_unidad_base: unidadBase,
    p_promedia: promedia,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  return { success: true as const };
}

export async function listarRecetaDeProducto(productoId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (table: string) => any };

  const [itemsRes, costosRes] = await Promise.all([
    // insumos(nombre, unidad_base) sí se puede anidar: receta_items tiene FK real a insumos.
    db
      .from('receta_items')
      .select('insumo_id, cantidad_usada, insumos(nombre, unidad_base)')
      .eq('producto_id', productoId),
    db.from('vw_insumo_costo_actual').select('insumo_id, costo_unitario'),
  ]);

  if (itemsRes.error) {
    console.error('Error listando receta del producto:', itemsRes.error);
    return { success: false as const, error: 'No se pudo cargar la receta.' };
  }

  const costoPorInsumo = new Map<number, number>(
    (costosRes.data ?? []).map((c: { insumo_id: number; costo_unitario: number }) => [
      c.insumo_id,
      c.costo_unitario,
    ])
  );

  const items: RecetaItem[] = (itemsRes.data ?? []).map((fila: Record<string, unknown>) => {
    const insumo = fila.insumos as { nombre: string; unidad_base: string } | null;
    return {
      insumo_id: fila.insumo_id as number,
      cantidad_usada: fila.cantidad_usada as number,
      nombre: insumo?.nombre ?? '(insumo eliminado)',
      unidad_base: insumo?.unidad_base ?? '',
      costo_unitario: costoPorInsumo.get(fila.insumo_id as number) ?? null,
    };
  });

  return { success: true as const, items };
}

export async function guardarReceta(
  productoId: number,
  items: { insumo_id: number; cantidad_usada: number }[]
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('guardar_receta', {
    p_producto_id: productoId,
    p_items: items,
  });

  if (error) {
    return { success: false as const, error: mensajeDeError(error.message) };
  }

  revalidatePath('/dashboard/recetas');
  return { success: true as const };
}

export async function listarProductoCostos() {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (table: string) => any };

  const { data, error } = await db
    .from('vw_producto_costos')
    .select('producto_id, nombre, precio, costo_total, margen, insumos_en_receta, insumos_sin_costo, costo_manual, costo_receta')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error listando costos de productos:', error);
    return { success: false as const, error: 'No se pudieron cargar los costos.' };
  }

  return { success: true as const, costos: (data ?? []) as ProductoCosto[] };
}
