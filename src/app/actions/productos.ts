'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sesionConAcceso } from '@/lib/sesionServidor';
import type { Categoria } from '@/types';

/**
 * Gestión del menú: crear, editar y borrar productos, y listar categorías
 * para el selector. Igual que `toggle_producto_activo`, la escritura pasa
 * por RPC `SECURITY DEFINER` (migración 20260908000002) — `productos` nunca
 * tuvo política de INSERT/UPDATE/DELETE para la clave pública.
 */

function mensajeDeErrorProducto(mensaje: string | undefined): string {
  if (!mensaje) return 'Error inesperado del servidor.';
  if (mensaje.includes('NOMBRE_REQUERIDO')) return 'Escribe el nombre del producto.';
  if (mensaje.includes('PRECIO_INVALIDO')) return 'El precio debe ser mayor a cero.';
  if (mensaje.includes('CATEGORIA_NO_ENCONTRADA')) return 'Esa categoría ya no existe.';
  if (mensaje.includes('PRODUCTO_NO_ENCONTRADO')) return 'Ese producto ya no existe.';
  if (mensaje.includes('PRODUCTO_CON_HISTORIAL'))
    return 'Ese producto ya aparece en pedidos anteriores: no se puede borrar sin romper ese historial. Desactívalo en su lugar.';
  return 'No se pudo completar la operación.';
}

function mensajeDeErrorCategoria(mensaje: string | undefined): string {
  if (!mensaje) return 'Error inesperado del servidor.';
  if (mensaje.includes('NOMBRE_REQUERIDO')) return 'Escribe el nombre de la categoría.';
  if (mensaje.includes('CATEGORIA_REPETIDA')) return 'Ya existe una categoría con ese nombre.';
  if (mensaje.includes('CATEGORIA_NO_ENCONTRADA')) return 'Esa categoría ya no existe.';
  return 'No se pudo completar la operación.';
}

export async function crearCategoria(nombre: string, orden: number | null) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { data, error } = await supabase.rpc('crear_categoria', {
    p_nombre: nombre,
    p_orden: orden,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorCategoria(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const, categoriaId: data as number };
}

export async function actualizarCategoria(categoriaId: number, nombre: string, orden: number | null) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('actualizar_categoria', {
    p_categoria_id: categoriaId,
    p_nombre: nombre,
    p_orden: orden,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorCategoria(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const };
}

export async function eliminarCategoria(categoriaId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('eliminar_categoria', { p_categoria_id: categoriaId });

  if (error) {
    return { success: false as const, error: mensajeDeErrorCategoria(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const };
}

export async function listarCategorias() {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('categorias').select('*').order('orden', { ascending: true });

  if (error) {
    console.error('Error listando categorías:', error);
    return { success: false as const, error: 'No se pudieron cargar las categorías.' };
  }

  return { success: true as const, categorias: (data ?? []) as Categoria[] };
}

export async function crearProducto(
  nombre: string,
  precio: number,
  categoriaId: number | null,
  esAdicion: boolean
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { data, error } = await supabase.rpc('crear_producto', {
    p_nombre: nombre,
    p_precio: precio,
    p_categoria_id: categoriaId,
    p_es_adicion: esAdicion,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorProducto(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const, productoId: data as number };
}

export async function actualizarProducto(
  productoId: number,
  nombre: string,
  precio: number,
  categoriaId: number | null
) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('actualizar_producto', {
    p_producto_id: productoId,
    p_nombre: nombre,
    p_precio: precio,
    p_categoria_id: categoriaId,
  });

  if (error) {
    return { success: false as const, error: mensajeDeErrorProducto(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const };
}

export async function eliminarProducto(productoId: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false as const, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('eliminar_producto', { p_producto_id: productoId });

  if (error) {
    return { success: false as const, error: mensajeDeErrorProducto(error.message) };
  }

  revalidatePath('/dashboard');
  revalidatePath('/pedidos');
  return { success: true as const };
}

/**
 * Marca un producto disponible o agotado.
 *
 * Pasa por el RPC `toggle_producto_activo` en vez de un UPDATE directo: la
 * tabla `productos` nunca tuvo política de escritura para la clave pública,
 * así que el UPDATE directo devolvía éxito sin cambiar nada (0 filas
 * afectadas, sin error) — el toast decía "actualizado" y el producto seguía
 * disponible en el menú. Ver migración 20260902000000.
 */
export async function toggleProductStatus(productoId: number, isActive: boolean) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false, error: 'Necesitas una sesión de administración.' };
  }

  const supabase = await createClient();

  try {
    // @ts-expect-error - Tipos generados sin los RPC nuevos
    const { error } = await supabase.rpc('toggle_producto_activo', {
      p_producto_id: productoId,
      p_activo: isActive,
    });

    if (error) {
      console.error('Error toggling product status:', error);

      if (error.message?.includes('PRODUCTO_NO_ENCONTRADO')) {
        return { success: false, error: 'Ese producto ya no existe.' };
      }

      return { success: false, error: 'No se pudo actualizar el estado del producto.' };
    }

    // Revalidate the paths where products are shown so they update
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    console.error('Unexpected error toggling product:', error);
    return { success: false, error: 'Error inesperado del servidor.' };
  }
}
