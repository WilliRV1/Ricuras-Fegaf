'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, RECARGO_DATAFONO } from '@/lib/constants';

/**
 * Cierra un pedido, registrando el método de pago y aplicando recargos si es necesario.
 * @param pedidoId ID numérico del pedido a cerrar
 * @param metodoPago Método de pago seleccionado (efectivo, nequi, datafono)
 */
export async function closeOrder(pedidoId: number, metodoPago: string) {
  try {
    const supabase = await createClient();

    // 1. Obtener los detalles del pedido actual para saber su subtotal y recargo actual
    const { data: pedidoData, error: fetchError } = await supabase
      .from('pedidos')
      .select('subtotal, recargo, total')
      .eq('id', pedidoId)
      .single();

    if (fetchError || !pedidoData) {
      console.error('Error al consultar pedido:', fetchError);
      return { success: false, error: 'No se pudo consultar el pedido.' };
    }

    let { subtotal, recargo, total } = pedidoData;

    // 2. Si el método de pago es Datáfono y no se había cobrado recargo aún, calcularlo
    // (En domicilios el recargo se puede calcular desde el carrito, por eso validamos si ya existe)
    if (metodoPago === METODOS_PAGO.DATAFONO && recargo === 0) {
      recargo = Math.round(subtotal * RECARGO_DATAFONO);
      total = subtotal + recargo;
    } 
    // Si cambiaron el método de Datáfono a otro en caja, quitar el recargo
    else if (metodoPago !== METODOS_PAGO.DATAFONO && recargo > 0) {
      recargo = 0;
      total = subtotal;
    }

    // 3. Actualizar la base de datos
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        estado: ESTADOS_PEDIDO.PAGADO,
        metodo_pago: metodoPago,
        recargo,
        total,
        closed_at: new Date().toISOString()
      })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('Error al cerrar pedido:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Excepción al cerrar pedido:', error);
    return { success: false, error: 'Ocurrió un error inesperado al procesar la liquidación.' };
  }
}
