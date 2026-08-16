'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export interface PagoParcial {
  metodo: string;
  /** Parte del pedido que cubre este método (sin el recargo del datáfono) */
  monto: number;
}

/**
 * Cierra un pedido cobrando con uno o varios métodos de pago.
 * El recargo del 5% se calcula solo sobre la parte pagada con datáfono.
 * Los montos deben sumar exactamente el valor del pedido (productos + domicilio);
 * el servidor lo valida y rechaza el cobro si no cuadra.
 */
export async function closeOrderWithPayments(pedidoId: number, pagos: PagoParcial[]) {
  try {
    const supabase = await createClient();

    const pagosLimpios = pagos
      .map((p) => ({ metodo: p.metodo, monto: Math.round(p.monto) }))
      .filter((p) => p.monto > 0);

    if (pagosLimpios.length === 0) {
      return { success: false, error: 'Registra al menos un pago.' };
    }

    // @ts-expect-error - Tipos no actualizados con el nuevo RPC
    const { data: total, error } = await supabase.rpc('close_order_with_payments', {
      p_pedido_id: pedidoId,
      p_pagos: pagosLimpios,
    });

    if (error) {
      console.error('Error al cobrar con pagos divididos:', error);

      if (error.message?.includes('MONTOS_NO_CUADRAN')) {
        return { success: false, error: 'Los montos no suman el valor del pedido.' };
      }
      if (error.message?.includes('PEDIDO_YA_PAGADO')) {
        return { success: false, error: 'Este pedido ya fue cobrado.' };
      }
      if (error.message?.includes('PEDIDO_NO_ENCONTRADO')) {
        return { success: false, error: 'El pedido ya no existe.' };
      }

      return { success: false, error: 'No se pudo registrar el cobro.' };
    }

    return { success: true, total: total as number };
  } catch (error) {
    console.error('Excepción al cobrar con pagos divididos:', error);
    return { success: false, error: 'Ocurrió un error inesperado al registrar el cobro.' };
  }
}

/**
 * Marca un pedido como "debe" — el cliente se fue sin pagar.
 * No cuenta como ingreso hasta que se cobre más tarde.
 * @param pedidoId ID numérico del pedido
 */
export async function markOrderAsDebe(pedidoId: number) {
  try {
    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        estado: ESTADOS_PEDIDO.DEBE,
        closed_at: new Date().toISOString()
      })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('Error al marcar pedido como debe:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Excepción al marcar debe:', error);
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
