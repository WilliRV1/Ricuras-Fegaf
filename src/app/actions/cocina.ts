'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO } from '@/lib/constants';

/**
 * Marca un pedido como listo (terminado en cocina).
 * @param pedidoId ID numérico del pedido
 */
export async function markOrderAsReady(pedidoId: number) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: ESTADOS_PEDIDO.LISTO })
      .eq('id', pedidoId);

    if (error) {
      console.error('Error al marcar pedido como listo:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Excepción al marcar pedido como listo:', error);
    return { success: false, error: 'Ocurrió un error inesperado al procesar la solicitud.' };
  }
}

/**
 * Cancela un pedido directamente desde cocina.
 * @param pedidoId ID numérico del pedido
 * @param motivo Opcional, razón de la cancelación
 */
export async function cancelOrder(pedidoId: number, motivo?: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado: ESTADOS_PEDIDO.CANCELADO,
        motivo_cancelacion: motivo || null
      } as any)
      .eq('id', pedidoId);

    if (error) {
      console.error('Error al cancelar pedido:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Excepción al cancelar pedido:', error);
    return { success: false, error: 'Ocurrió un error inesperado al procesar la solicitud.' };
  }
}
