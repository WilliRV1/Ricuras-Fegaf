'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sesionConAcceso } from '@/lib/sesionServidor';

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
