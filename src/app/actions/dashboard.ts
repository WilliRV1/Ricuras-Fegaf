'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, TIPOS_ATENCION } from '@/lib/constants';

/**
 * Retorna el resumen del día:
 * - Total pedidos pagados
 * - Total facturado
 * - Desglose por método de pago (efectivo, nequi, datáfono)
 * - Pedidos por tipo (mesa / domicilio)
 */
export async function getResumenDelDia() {
  const supabase = await createClient();

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, total, subtotal, recargo, metodo_pago, tipo, estado, closed_at, created_at')
    .eq('estado', ESTADOS_PEDIDO.PAGADO)
    .gte('closed_at', startOfDay)
    .lt('closed_at', endOfDay);

  if (error) {
    console.error('Error al obtener resumen del día:', error);
    return null;
  }

  const pedidos = data ?? [];

  const totalFacturado = pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0);
  const totalPedidos = pedidos.length;

  const porMetodoPago = {
    efectivo: pedidos.filter(p => p.metodo_pago === METODOS_PAGO.EFECTIVO).reduce((s, p) => s + (p.total ?? 0), 0),
    nequi:    pedidos.filter(p => p.metodo_pago === METODOS_PAGO.NEQUI).reduce((s, p) => s + (p.total ?? 0), 0),
    datafono: pedidos.filter(p => p.metodo_pago === METODOS_PAGO.DATAFONO).reduce((s, p) => s + (p.total ?? 0), 0),
  };

  const porTipo = {
    mesa:      pedidos.filter(p => p.tipo === TIPOS_ATENCION.MESA).length,
    domicilio: pedidos.filter(p => p.tipo === TIPOS_ATENCION.DOMICILIO).length,
  };

  const totalRecargos = pedidos.reduce((sum, p) => sum + (p.recargo ?? 0), 0);

  return {
    totalPedidos,
    totalFacturado,
    totalRecargos,
    porMetodoPago,
    porTipo,
  };
}

/**
 * Retorna los últimos N pedidos con sus detalles para la tabla histórica.
 * Incluye todos los estados (pagado, cancelado, pendiente, listo).
 */
export async function getPedidosRecientes(limit: number = 20) {
  const supabase = await createClient();

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, estado, metodo_pago, subtotal, recargo, total, created_at, closed_at')
    .gte('created_at', startOfDay)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error al obtener pedidos recientes:', error);
    return [];
  }

  return data ?? [];
}
