'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, TIPOS_ATENCION } from '@/lib/constants';

/**
 * Calcula la ventana de tiempo para las consultas del Dashboard.
 * Si es "Hoy" y hay un turno abierto, usa la hora de apertura del turno.
 * De lo contrario, usa el día calendario estricto.
 */
async function getTimeWindow(supabase: any, dateStr?: string) {
  const bogotaDateStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const esHoy = !dateStr || dateStr === bogotaDateStr;
  const actualDateStr = dateStr || bogotaDateStr;

  if (esHoy) {
    // Buscar si hay turno abierto
    const { data: arqueo } = await supabase
      .from('arqueos_caja')
      .select('opened_at')
      .eq('estado', 'abierto')
      .single();

    if (arqueo) {
      return {
        startOfDay: arqueo.opened_at,
        endOfDay: new Date().toISOString()
      };
    }
  }

  // Fallback a día calendario
  return {
    startOfDay: new Date(`${actualDateStr}T00:00:00-05:00`).toISOString(),
    endOfDay: new Date(`${actualDateStr}T23:59:59.999-05:00`).toISOString()
  };
}

/**
 * Retorna el resumen de un día específico o el día actual.
 * @param dateStr Formato 'YYYY-MM-DD' opcional.
 */
export async function getResumenDelDia(dateStr?: string) {
  const supabase = await createClient();

  const { startOfDay, endOfDay } = await getTimeWindow(supabase, dateStr);

  // Consultar todos los pedidos del día para calcular todas las métricas
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, total, subtotal, recargo, costo_domicilio, metodo_pago, tipo, estado, closed_at, created_at, motivo_cancelacion, pagos_pedido(metodo, monto)')
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

  // Totales por método: si el pedido tiene pagos registrados (uno o varios) se
  // usan esos; los pedidos anteriores a los pagos divididos caen a metodo_pago.
  const porMetodoPago = {
    [METODOS_PAGO.EFECTIVO]: 0,
    [METODOS_PAGO.NEQUI]: 0,
    [METODOS_PAGO.DATAFONO]: 0,
    [METODOS_PAGO.BANCOLOMBIA]: 0,
  };

  for (const pedido of pagados) {
    const pagos = pedido.pagos_pedido ?? [];

    if (pagos.length > 0) {
      for (const pago of pagos) {
        if (pago.metodo in porMetodoPago) {
          porMetodoPago[pago.metodo as keyof typeof porMetodoPago] += Number(pago.monto) || 0;
        }
      }
    } else if (pedido.metodo_pago && pedido.metodo_pago in porMetodoPago) {
      porMetodoPago[pedido.metodo_pago as keyof typeof porMetodoPago] += pedido.total ?? 0;
    }
  }

  const porTipo = {
    mesa:      pagados.filter(p => p.tipo === TIPOS_ATENCION.MESA).length,
    domicilio: pagados.filter(p => p.tipo === TIPOS_ATENCION.DOMICILIO).length,
  };

  const totalRecargos = pagados.reduce((sum, p) => sum + (p.recargo ?? 0), 0);

  // Cobros por domicilio fuera del sector — lo que se le paga al domiciliario
  const domiciliosCobrados = pagados.filter(p => (p.costo_domicilio ?? 0) > 0);
  const totalDomicilios = domiciliosCobrados.reduce((sum, p) => sum + (p.costo_domicilio ?? 0), 0);
  const cantidadDomiciliosCobrados = domiciliosCobrados.length;

  // 1.5 Tiempo Promedio de Atención (en minutos)
  let tiempoPromedioMinutos = 0;
  const pagadosConTiempos = pagados.filter(p => p.created_at && p.closed_at);
  if (pagadosConTiempos.length > 0) {
    const totalMinutos = pagadosConTiempos.reduce((sum, p) => {
      const start = new Date(p.created_at).getTime();
      const end = new Date(p.closed_at as string).getTime();
      return sum + ((end - start) / 60000);
    }, 0);
    tiempoPromedioMinutos = Math.round(totalMinutos / pagadosConTiempos.length);
  }

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
    totalDomicilios,
    cantidadDomiciliosCobrados,
    porMetodoPago,
    porTipo,
    horaPico,
    cancelados,
    tiempoPromedioMinutos
  };
}

/**
 * Retorna los últimos N pedidos con sus detalles para la tabla histórica.
 */
export async function getPedidosRecientes(limit: number = 20, dateStr?: string) {
  const supabase = await createClient();

  const { startOfDay, endOfDay } = await getTimeWindow(supabase, dateStr);

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, estado, metodo_pago, subtotal, recargo, total, created_at, closed_at, pagos_pedido(metodo, monto)')
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

  const { startOfDay, endOfDay } = await getTimeWindow(supabase, dateStr);

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
