'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, TIPOS_ATENCION } from '@/lib/constants';

/**
 * Retorna el resumen de un día específico o el día actual.
 * @param dateStr Formato 'YYYY-MM-DD' opcional.
 */
export async function getResumenDelDia(dateStr?: string) {
  const supabase = await createClient();

  const targetDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toISOString();
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1).toISOString();

  // Consultar todos los pedidos del día para calcular todas las métricas
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, total, subtotal, recargo, metodo_pago, tipo, estado, closed_at, created_at, motivo_cancelacion')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);

  if (error) {
    console.error('Error al obtener resumen del día:', error);
    return null;
  }

  const todosPedidos = data ?? [];

  // 1. Filtrar pagados
  const pagados = todosPedidos.filter(p => p.estado === ESTADOS_PEDIDO.PAGADO);
  
  const totalFacturado = pagados.reduce((sum, p) => sum + (p.total ?? 0), 0);
  const totalPedidosPagados = pagados.length;
  
  const ticketPromedio = totalPedidosPagados > 0 ? (totalFacturado / totalPedidosPagados) : 0;

  const porMetodoPago = {
    efectivo: pagados.filter(p => p.metodo_pago === METODOS_PAGO.EFECTIVO).reduce((s, p) => s + (p.total ?? 0), 0),
    nequi:    pagados.filter(p => p.metodo_pago === METODOS_PAGO.NEQUI).reduce((s, p) => s + (p.total ?? 0), 0),
    datafono: pagados.filter(p => p.metodo_pago === METODOS_PAGO.DATAFONO).reduce((s, p) => s + (p.total ?? 0), 0),
  };

  const porTipo = {
    mesa:      pagados.filter(p => p.tipo === TIPOS_ATENCION.MESA).length,
    domicilio: pagados.filter(p => p.tipo === TIPOS_ATENCION.DOMICILIO).length,
  };

  const totalRecargos = pagados.reduce((sum, p) => sum + (p.recargo ?? 0), 0);

  // 2. Hora Pico
  const horas = todosPedidos.reduce((acc: Record<string, number>, p) => {
    const hora = new Date(p.created_at).getHours();
    acc[hora] = (acc[hora] || 0) + 1;
    return acc;
  }, {});

  let maxPedidos = 0;
  let horaPico = 'N/A';
  for (const [hora, cantidad] of Object.entries(horas)) {
    if (cantidad > maxPedidos) {
      maxPedidos = cantidad;
      horaPico = `${hora}:00 - ${parseInt(hora) + 1}:00`;
    }
  }

  // 3. Cancelados
  const cancelados = todosPedidos
    .filter(p => p.estado === ESTADOS_PEDIDO.CANCELADO)
    .map(p => ({
      id: p.id,
      motivo: p.motivo_cancelacion || 'Sin motivo',
      hora: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

  return {
    totalPedidos: totalPedidosPagados,
    totalFacturado,
    totalRecargos,
    porMetodoPago,
    porTipo,
    ticketPromedio,
    horaPico,
    cancelados
  };
}

/**
 * Retorna los últimos N pedidos con sus detalles para la tabla histórica.
 */
export async function getPedidosRecientes(limit: number = 20, dateStr?: string) {
  const supabase = await createClient();

  const targetDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toISOString();
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1).toISOString();

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, estado, metodo_pago, subtotal, recargo, total, created_at, closed_at')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error al obtener pedidos recientes:', error);
    return [];
  }

  return data ?? [];
}
