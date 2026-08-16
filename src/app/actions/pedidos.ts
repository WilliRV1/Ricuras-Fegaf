'use server';

import { createClient } from '@/lib/supabase/server';
import { CartItem, OrderType, OrderDetails, MetodoPago } from '@/types';
import {
  ESTADOS_PEDIDO,
  TIPOS_ATENCION,
  METODOS_PAGO,
  COSTO_DOMICILIO_FUERA_SECTOR,
} from '@/lib/constants';
import { calcularRecargoDatafono } from '@/lib/utils';

/**
 * Calcula los montos y arma el payload que espera el RPC.
 * Lo comparten crear y modificar pedido para que un pedido editado quede
 * exactamente igual que si se hubiera digitado de nuevo.
 */
function construirPayload(
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[],
  metodoPago: MetodoPago,
  pagaCon: number | null
) {
  // Subtotal (suma de líneas)
  const subtotal = items.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  // Cobro por salir del sector — solo en domicilios
  const costoDomicilio =
    orderType === TIPOS_ATENCION.DOMICILIO && orderDetails.fuera_sector
      ? COSTO_DOMICILIO_FUERA_SECTOR
      : 0;

  // Recargo: 5% solo si es domicilio y el pago es con datáfono
  const aplicaRecargo = orderType === TIPOS_ATENCION.DOMICILIO && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? calcularRecargoDatafono(subtotal, costoDomicilio) : 0;

  const total = subtotal + costoDomicilio + recargo;

  // Número de mesa solo aplica en mesa
  const numeroMesa = orderType === TIPOS_ATENCION.MESA && orderDetails.numero_mesa
    ? parseInt(orderDetails.numero_mesa, 10)
    : null;

  // hora_entrega llega como 'HH:MM' y se combina con la fecha de hoy en Colombia
  let horaEntregaISO: string | null = null;
  if (orderDetails.hora_entrega) {
    const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    horaEntregaISO = new Date(`${bogotaDateStr}T${orderDetails.hora_entrega}:00-05:00`).toISOString();
  }

  // El monto en efectivo solo se guarda si el pago es en efectivo y cubre el total
  const esEfectivo = metodoPago === METODOS_PAGO.EFECTIVO;
  const pagaConFinal =
    esEfectivo && pagaCon !== null && pagaCon >= total ? Math.round(pagaCon) : null;

  // Cada línea del carrito viaja por separado: dos veces el mismo producto con
  // observaciones distintas genera dos filas en detalle_pedidos.
  const detallesJson = items.map(item => ({
    producto_id: item.producto.id,
    cantidad: item.cantidad,
    precio_unitario: item.producto.precio,
    notas: item.notas || null
  }));

  return {
    subtotal,
    costoDomicilio,
    recargo,
    total,
    numeroMesa,
    horaEntregaISO,
    pagaConFinal,
    detallesJson,
    metodoPagoFinal: orderType === TIPOS_ATENCION.DOMICILIO ? metodoPago : null,
  };
}

export async function submitOrder(
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[],
  metodoPago: MetodoPago = null,
  /** Monto en efectivo con el que paga el cliente — para alistar la vuelta */
  pagaCon: number | null = null
) {
  if (!orderType || items.length === 0) {
    return { success: false, error: 'Faltan datos obligatorios o el carrito está vacío.' };
  }

  const supabase = await createClient();
  const p = construirPayload(orderType, orderDetails, items, metodoPago, pagaCon);

  // Llamar al RPC transaccional
  // @ts-expect-error - Tipos no actualizados con el nuevo RPC
  const { data: pedidoId, error: rpcError } = await supabase.rpc('create_order_with_details', {
    p_tipo: orderType,
    p_numero_mesa: p.numeroMesa,
    p_cliente_nombre: orderDetails.cliente_nombre || null,
    p_cliente_telefono: orderDetails.cliente_telefono || null,
    p_cliente_direccion: orderDetails.cliente_direccion || null,
    p_estado: ESTADOS_PEDIDO.PENDIENTE,
    p_metodo_pago: p.metodoPagoFinal,
    p_subtotal: p.subtotal,
    p_recargo: p.recargo,
    p_total: p.total,
    p_detalles: p.detallesJson,
    p_hora_entrega: p.horaEntregaISO,
    p_paga_con: p.pagaConFinal,
    p_costo_domicilio: p.costoDomicilio
  });

  if (rpcError || !pedidoId) {
    console.error('Error insertando pedido via RPC:', rpcError);
    return { success: false, error: 'No se pudo crear el pedido de forma segura.' };
  }

  return { success: true, pedidoId: pedidoId };
}

/**
 * Modifica un pedido que todavía está pendiente en cocina.
 * Reescribe los productos y recalcula los totales en una sola transacción.
 * Si cocina ya lo marcó como listo, la operación se rechaza.
 */
export async function updateOrder(
  pedidoId: number,
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[],
  metodoPago: MetodoPago = null,
  pagaCon: number | null = null
) {
  if (!orderType || items.length === 0) {
    return { success: false, error: 'El pedido debe tener al menos un producto.' };
  }

  const supabase = await createClient();
  const p = construirPayload(orderType, orderDetails, items, metodoPago, pagaCon);

  // @ts-expect-error - Tipos no actualizados con el nuevo RPC
  const { error: rpcError } = await supabase.rpc('update_order_with_details', {
    p_pedido_id: pedidoId,
    p_numero_mesa: p.numeroMesa,
    p_cliente_nombre: orderDetails.cliente_nombre || null,
    p_cliente_telefono: orderDetails.cliente_telefono || null,
    p_cliente_direccion: orderDetails.cliente_direccion || null,
    p_metodo_pago: p.metodoPagoFinal,
    p_subtotal: p.subtotal,
    p_recargo: p.recargo,
    p_total: p.total,
    p_detalles: p.detallesJson,
    p_hora_entrega: p.horaEntregaISO,
    p_paga_con: p.pagaConFinal,
    p_costo_domicilio: p.costoDomicilio
  });

  if (rpcError) {
    console.error('Error modificando pedido via RPC:', rpcError);

    if (rpcError.message?.includes('PEDIDO_NO_EDITABLE')) {
      return {
        success: false,
        error: 'Cocina ya marcó este pedido como listo, así que no se puede modificar. Anúlalo desde liquidación si hay que rehacerlo.',
      };
    }
    if (rpcError.message?.includes('PEDIDO_NO_ENCONTRADO')) {
      return { success: false, error: 'El pedido ya no existe.' };
    }

    return { success: false, error: 'No se pudo modificar el pedido.' };
  }

  return { success: true, pedidoId };
}
