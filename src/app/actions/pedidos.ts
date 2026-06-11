'use server';

import { createClient } from '@/lib/supabase/server';
import { CartItem, OrderType, OrderDetails, MetodoPago } from '@/types';
import { ESTADOS_PEDIDO, TIPOS_ATENCION, METODOS_PAGO, RECARGO_DATAFONO } from '@/lib/constants';

export async function submitOrder(
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[],
  metodoPago: MetodoPago = null
) {
  if (!orderType || items.length === 0) {
    return { success: false, error: 'Faltan datos obligatorios o el carrito está vacío.' };
  }

  const supabase = createClient();

  // Calcular subtotal (suma de items)
  const subtotal = items.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);
  
  // Calcular recargo: 5% solo si es domicilio y el pago es con datáfono
  const aplicaRecargo = orderType === TIPOS_ATENCION.DOMICILIO && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? Math.round(subtotal * RECARGO_DATAFONO) : 0;
  
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
      metodo_pago: orderType === TIPOS_ATENCION.DOMICILIO ? metodoPago : null,
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
