'use server';

import { createClient } from '@/lib/supabase/server';
import { CartItem, OrderType, OrderDetails, MetodoPago, PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO, TIPOS_ATENCION, METODOS_PAGO } from '@/lib/constants';
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

  // Costo de domicilio: lo escribe quien toma el pedido, no un valor fijo.
  // Se redondea y no se permite negativo por si llega algo raro del cliente.
  const costoDomicilio =
    orderType === TIPOS_ATENCION.DOMICILIO && orderDetails.costo_domicilio
      ? Math.max(0, Math.round(orderDetails.costo_domicilio))
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
  pagaCon: number | null = null,
  /**
   * Id del pedido cancelado que este pedido viene a reemplazar.
   * Deja constancia de que sí se volvió a montar, que es lo que antes se
   * olvidaba y descuadraba la caja.
   */
  rehacePedidoId: number | null = null
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

  // El enlace con el pedido cancelado es informativo: si falla, el pedido
  // nuevo ya quedó bien guardado y no tiene sentido devolver un error.
  if (rehacePedidoId) {
    // @ts-expect-error - Tipos generados sin los RPC nuevos
    const { error: linkError } = await supabase.rpc('link_rehecho', {
      p_cancelado_id: rehacePedidoId,
      p_nuevo_id: pedidoId as number,
    });
    if (linkError) {
      console.error('No se pudo enlazar el pedido rehecho:', linkError);
    }
  }

  return { success: true, pedidoId: pedidoId };
}

/**
 * Modifica un pedido que todavía no se ha cobrado.
 * Reescribe los productos y recalcula los totales en una sola transacción.
 *
 * Funciona tanto con pedidos pendientes en cocina como con pedidos ya listos
 * esperando el cobro — este último es el caso de "y me das una gaseosa"
 * cuando el cliente ya va a pagar.
 *
 * @param volverACocina Solo aplica si el pedido estaba listo: true lo devuelve
 *   al tablero de cocina (hay algo nuevo que preparar), false lo deja en
 *   liquidación con el total actualizado.
 */
export async function updateOrder(
  pedidoId: number,
  orderType: OrderType,
  orderDetails: OrderDetails,
  items: CartItem[],
  metodoPago: MetodoPago = null,
  pagaCon: number | null = null,
  volverACocina: boolean = true
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
    p_costo_domicilio: p.costoDomicilio,
    p_volver_a_cocina: volverACocina
  });

  if (rpcError) {
    console.error('Error modificando pedido via RPC:', rpcError);

    if (rpcError.message?.includes('PEDIDO_NO_EDITABLE')) {
      return {
        success: false,
        error: 'Este pedido ya se cobró, se anuló o quedó como deuda, así que no se puede modificar.',
      };
    }
    if (rpcError.message?.includes('PEDIDO_NO_ENCONTRADO')) {
      return { success: false, error: 'El pedido ya no existe.' };
    }

    return { success: false, error: 'No se pudo modificar el pedido.' };
  }

  return { success: true, pedidoId };
}

/**
 * Trae un pedido con sus productos para abrirlo en la pantalla de pedidos.
 *
 * Se usa cuando se llega a `/pedidos` con `?editar=` (agregar algo antes de
 * cobrar, desde liquidación) o con `?rehacer=` (volver a montar un pedido que
 * se canceló). En ambos casos hay que leer un pedido que no está en la lista
 * de pendientes que ya tiene cargada la pantalla.
 */
export async function getOrderById(pedidoId: number) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return { success: false as const, error: 'Pedido inválido.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pedidos')
    .select('*, detalle_pedidos(*, productos(nombre))')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error) {
    console.error('Error cargando el pedido:', error);
    return { success: false as const, error: 'No se pudo cargar el pedido.' };
  }

  if (!data) {
    return { success: false as const, error: 'El pedido ya no existe.' };
  }

  return { success: true as const, order: data as unknown as PedidoWithDetalles };
}
