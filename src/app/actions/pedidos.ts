'use server';

import { createClient } from '@/lib/supabase/server';
import { CartItem, OrderType, OrderDetails } from '@/types';
import { ESTADOS_PEDIDO, TIPOS_ATENCION } from '@/lib/constants';

export async function submitOrder(
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[]
) {
  if (!orderType || items.length === 0) {
    return { success: false, error: 'Faltan datos obligatorios o el carrito está vacío.' };
  }

  const supabase = createClient();

  // Calcular subtotal (suma de items)
  const subtotal = items.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);
  
  // Calcular recargo (Día 3: asumiendo 0 por ahora, luego se puede integrar lógica de envío/datáfono)
  const recargo = 0;
  
  // Total final
  const total = subtotal + recargo;

  // Formatear numero de mesa si aplica
  const numero_mesa = orderType === TIPOS_ATENCION.MESA && orderDetails.numero_mesa
    ? parseInt(orderDetails.numero_mesa, 10)
    : null;

  // Insertar en tabla `pedidos`
  const { data: pedidoData, error: pedidoError } = await (await supabase)
    .from('pedidos')
    .insert({
      tipo: orderType,
      numero_mesa,
      cliente_nombre: orderDetails.cliente_nombre || null,
      cliente_telefono: orderDetails.cliente_telefono || null,
      cliente_direccion: orderDetails.cliente_direccion || null,
      estado: ESTADOS_PEDIDO.PENDIENTE,
      metodo_pago: null, // Aún no se ha pagado
      subtotal,
      recargo,
      total,
    })
    .select()
    .single();

  if (pedidoError || !pedidoData) {
    console.error('Error insertando pedido:', pedidoError);
    return { success: false, error: 'No se pudo crear el pedido principal.' };
  }

  // Mapear items a formato `detalle_pedidos`
  const detallesToInsert = items.map(item => ({
    pedido_id: pedidoData.id,
    producto_id: item.producto.id,
    cantidad: item.cantidad,
    precio_unitario: item.producto.precio,
    notas: item.notas || null
  }));

  // Insertar masivo en `detalle_pedidos`
  const { error: detallesError } = await (await supabase)
    .from('detalle_pedidos')
    .insert(detallesToInsert);

  if (detallesError) {
    console.error('Error insertando detalles:', detallesError);
    // Idealmente manejaríamos rollback aquí, pero Supabase RPC / transaction sería mejor.
    return { success: false, error: 'Pedido creado, pero hubo un error guardando los productos.' };
  }

  return { success: true, pedidoId: pedidoData.id };
}
