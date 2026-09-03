'use server';

import { createClient } from '@/lib/supabase/server';
import { confirmarPin } from './auth';
import { sesionConAcceso } from '@/lib/sesionServidor';

/**
 * Marca un pedido como listo (terminado en cocina).
 *
 * Pasa por el RPC `mark_order_ready` en vez de un UPDATE directo: la tabla
 * `pedidos` ya no acepta escrituras directas de la clave pública (ver
 * migración 20260902000000), así que un UPDATE aquí no haría nada.
 *
 * @param pedidoId ID numérico del pedido
 */
export async function markOrderAsReady(pedidoId: number) {
  if (!(await sesionConAcceso('/cocina'))) {
    return { success: false, error: 'Necesitas una sesión con acceso a Cocina.' };
  }

  try {
    const supabase = await createClient();

    // @ts-expect-error - Tipos generados sin los RPC nuevos
    const { error } = await supabase.rpc('mark_order_ready', { p_pedido_id: pedidoId });

    if (error) {
      console.error('Error al marcar pedido como listo:', error);

      if (error.message?.includes('PEDIDO_NO_PENDIENTE')) {
        return { success: false, error: 'Este pedido ya no está pendiente (alguien más ya lo marcó, lo anuló o lo modificó).' };
      }
      if (error.message?.includes('PEDIDO_NO_ENCONTRADO')) {
        return { success: false, error: 'El pedido ya no existe.' };
      }

      return { success: false, error: 'No se pudo marcar el pedido como listo.' };
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
 * Exige el PIN de quien anula, no basta con la sesión abierta: las tablets
 * quedan encendidas y pasan de mano en mano, así que sin el PIN el nombre
 * registrado no querría decir nada.
 *
 * @param pedidoId ID numérico del pedido
 * @param motivo Razón de la cancelación
 * @param usuarioId Quién dice ser
 * @param pin Su PIN, que lo demuestra
 */
export async function cancelOrder(
  pedidoId: number,
  motivo: string,
  usuarioId: number,
  pin: string
) {
  // Se usa desde dos pantallas distintas, así que basta con acceso a
  // cualquiera de las dos; el PIN de abajo ya identifica a la persona.
  const tieneAcceso =
    (await sesionConAcceso('/cocina')) || (await sesionConAcceso('/liquidacion'));
  if (!tieneAcceso) {
    return { success: false, error: 'Necesitas una sesión con acceso a Cocina o Liquidación.' };
  }

  try {
    const identidad = await confirmarPin(usuarioId, pin);
    if (!identidad.success) {
      return { success: false, error: identidad.error };
    }

    const supabase = await createClient();

    // @ts-expect-error - Tipos generados sin los RPC nuevos
    const { error } = await supabase.rpc('cancel_order', {
      p_pedido_id: pedidoId,
      p_motivo: motivo ?? null,
      p_cancelado_por: identidad.usuario.nombre,
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
