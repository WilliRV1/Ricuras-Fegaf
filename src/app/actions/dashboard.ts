'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, TIPOS_ATENCION } from '@/lib/constants';

/**
 * Retorna el resumen de un día específico o el día actual.
 * @param dateStr Formato 'YYYY-MM-DD' opcional.
 */
export async function getResumenDelDia(dateStr?: string) {
  const supabase = await createClient();

  const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const actualDateStr = dateStr || bogotaDateStr;

  const startOfDay = new Date(`${actualDateStr}T00:00:00-05:00`).toISOString();
  const endOfDay = new Date(`${actualDateStr}T23:59:59.999-05:00`).toISOString();

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

  const porMetodoPago = {
    efectivo: pagados.filter(p => p.metodo_pago === METODOS_PAGO.EFECTIVO).reduce((s, p) => s + (p.total ?? 0), 0),
    nequi:    pagados.filter(p => p.metodo_pago === METODOS_PAGO.NEQUI).reduce((s, p) => s + (p.total ?? 0), 0),
    datafono: pagados.filter(p => p.metodo_pago === METODOS_PAGO.DATAFONO).reduce((s, p) => s + (p.total ?? 0), 0),
    bancolombia: pagados.filter(p => p.metodo_pago === METODOS_PAGO.BANCOLOMBIA).reduce((s, p) => s + (p.total ?? 0), 0),
  };

  const porTipo = {
    mesa:      pagados.filter(p => p.tipo === TIPOS_ATENCION.MESA).length,
    domicilio: pagados.filter(p => p.tipo === TIPOS_ATENCION.DOMICILIO).length,
  };

  const totalRecargos = pagados.reduce((sum, p) => sum + (p.recargo ?? 0), 0);

  // 2. Hora Pico (calculada con hora de Colombia)
  const horas = todosPedidos.reduce((acc: Record<string, number>, p) => {
    const bogotaHourStr = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hour12: false
    }).format(new Date(p.created_at));
    const hora = parseInt(bogotaHourStr, 10);
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

  // 3. Cancelados (con hora de Colombia)
  const cancelados = todosPedidos
    .filter(p => p.estado === ESTADOS_PEDIDO.CANCELADO)
    .map(p => {
      const horaStr = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(p.created_at));
      return {
        id: p.id,
        motivo: p.motivo_cancelacion || 'Sin motivo',
        hora: horaStr
      };
    });

  return {
    totalPedidos: totalPedidosPagados,
    totalFacturado,
    totalRecargos,
    porMetodoPago,
    porTipo,
    horaPico,
    cancelados
  };
}

/**
 * Retorna los últimos N pedidos con sus detalles para la tabla histórica.
 */
export async function getPedidosRecientes(limit: number = 20, dateStr?: string) {
  const supabase = await createClient();

  const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const actualDateStr = dateStr || bogotaDateStr;

  const startOfDay = new Date(`${actualDateStr}T00:00:00-05:00`).toISOString();
  const endOfDay = new Date(`${actualDateStr}T23:59:59.999-05:00`).toISOString();

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

/**
 * Retorna un resumen de los productos vendidos en el día, agrupados por nombre.
 * Solo incluye pedidos con estado 'pagado'.
 */
export async function getProductosVendidosDelDia(dateStr?: string) {
  const supabase = await createClient();

  const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const actualDateStr = dateStr || bogotaDateStr;

  const startOfDay = new Date(`${actualDateStr}T00:00:00-05:00`).toISOString();
  const endOfDay = new Date(`${actualDateStr}T23:59:59.999-05:00`).toISOString();

  // Traer todos los detalle_pedidos de pedidos pagados en el día
  const { data, error } = await supabase
    .from('detalle_pedidos')
    .select('cantidad, precio_unitario, productos(nombre), pedidos!inner(estado, created_at)')
    .eq('pedidos.estado', 'pagado')
    .gte('pedidos.created_at', startOfDay)
    .lt('pedidos.created_at', endOfDay);

  if (error) {
    console.error('Error al obtener productos vendidos:', error);
    return [];
  }

  // Agrupar por nombre de producto
  const agrupado: Record<string, { nombre: string; cantidad: number; total: number }> = {};

  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombre = (row.productos as any)?.nombre ?? 'Producto eliminado';
    if (!agrupado[nombre]) {
      agrupado[nombre] = { nombre, cantidad: 0, total: 0 };
    }
    agrupado[nombre].cantidad += row.cantidad;
    agrupado[nombre].total += row.precio_unitario * row.cantidad;
  }

  return Object.values(agrupado).sort((a, b) => b.cantidad - a.cantidad);
}
