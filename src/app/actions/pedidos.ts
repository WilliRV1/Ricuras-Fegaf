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

  // Calcular subtotal (suma de items)
  const subtotal = items.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

  // Cobro por salir del sector — solo en domicilios
  const costoDomicilio =
    orderType === TIPOS_ATENCION.DOMICILIO && orderDetails.fuera_sector
      ? COSTO_DOMICILIO_FUERA_SECTOR
      : 0;

  // Calcular recargo: 5% solo si es domicilio y el pago es con datáfono
  const aplicaRecargo = orderType === TIPOS_ATENCION.DOMICILIO && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? calcularRecargoDatafono(subtotal, costoDomicilio) : 0;

  // Total final
  const total = subtotal + costoDomicilio + recargo;

  // Formatear numero de mesa si aplica
  const numero_mesa = orderType === TIPOS_ATENCION.MESA && orderDetails.numero_mesa
    ? parseInt(orderDetails.numero_mesa, 10)
    : null;

  // Construir hora_entrega como TIMESTAMPTZ si se proporcionó
  // El campo viene como 'HH:MM' y debemos combinarlo con la fecha actual (Colombia)
  let horaEntregaISO: string | null = null;
  if (orderDetails.hora_entrega) {
    const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    // Crear la fecha en Colombia con esa hora
    horaEntregaISO = new Date(`${bogotaDateStr}T${orderDetails.hora_entrega}:00-05:00`).toISOString();
  }

  // El monto en efectivo solo se guarda si el pago es en efectivo y cubre el total
  const esEfectivo = metodoPago === METODOS_PAGO.EFECTIVO;
  const pagaConFinal =
    esEfectivo && pagaCon !== null && pagaCon >= total ? Math.round(pagaCon) : null;

  // Mapear items a formato JSONB para el RPC
  // Cada línea del carrito viaja por separado: dos veces el mismo producto con
  // observaciones distintas genera dos filas en detalle_pedidos.
  const detallesJson = items.map(item => ({
    producto_id: item.producto.id,
    cantidad: item.cantidad,
    precio_unitario: item.producto.precio,
    notas: item.notas || null
  }));

  // Llamar al RPC transaccional
  // @ts-expect-error - Tipos no actualizados con el nuevo RPC
  const { data: pedidoId, error: rpcError } = await supabase.rpc('create_order_with_details', {
    p_tipo: orderType,
    p_numero_mesa: numero_mesa,
    p_cliente_nombre: orderDetails.cliente_nombre || null,
    p_cliente_telefono: orderDetails.cliente_telefono || null,
    p_cliente_direccion: orderDetails.cliente_direccion || null,
    p_estado: ESTADOS_PEDIDO.PENDIENTE,
    p_metodo_pago: orderType === TIPOS_ATENCION.DOMICILIO ? metodoPago : null,
    p_subtotal: subtotal,
    p_recargo: recargo,
    p_total: total,
    p_detalles: detallesJson,
    p_hora_entrega: horaEntregaISO,
    p_paga_con: pagaConFinal,
    p_costo_domicilio: costoDomicilio
  });

  if (rpcError || !pedidoId) {
    console.error('Error insertando pedido via RPC:', rpcError);
    return { success: false, error: 'No se pudo crear el pedido de forma segura.' };
  }

  return { success: true, pedidoId: pedidoId };
}
