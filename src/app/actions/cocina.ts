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
 * Cancela un pedido. Se usa desde cocina (pedidos pendientes) y desde
 * liquidación (pedidos ya marcados como listos que no se van a cobrar).
 *
 * El pedido no se borra: queda con estado 'cancelado' conservando sus
 * productos y su total, para que en el dashboard se pueda ver exactamente qué
 * se anuló, quién lo anuló y si se volvió a montar.
 *
 * @param pedidoId ID numérico del pedido
 * @param motivo Razón de la cancelación
 * @param canceladoPor Quién la está haciendo (lista `PERSONAL`)
 */
export async function cancelOrder(
  pedidoId: number,
  motivo?: string,
  canceladoPor?: string | null
) {
  try {
    const supabase = await createClient();

    // @ts-expect-error - Tipos generados sin los RPC nuevos
    const { error } = await supabase.rpc('cancel_order', {
      p_pedido_id: pedidoId,
      p_motivo: motivo ?? null,
      p_cancelado_por: canceladoPor?.trim() || null,
    });

    if (error) {
      console.error('Error al cancelar pedido:', error);

      if (error.message?.includes('PEDIDO_YA_PAGADO')) {
        return { success: false, error: 'Este pedido ya fue cobrado, no se puede cancelar.' };
      }
      if (error.message?.includes('PEDIDO_NO_ENCONTRADO')) {
        return { success: false, error: 'El pedido ya no existe.' };
      }

      return { success: false, error: 'No se pudo cancelar el pedido.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Excepción al cancelar pedido:', error);
    return { success: false, error: 'Ocurrió un error inesperado al procesar la solicitud.' };
  }
}
