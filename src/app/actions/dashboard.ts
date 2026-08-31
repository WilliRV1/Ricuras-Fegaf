'use server';

import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO, TIPOS_ATENCION } from '@/lib/constants';

/**
 * Venta que le queda al restaurante de un pedido.
 *
 * El cobro por domicilio fuera del sector es plata del domiciliario, no del
 * negocio, así que se descuenta. Se usa el mismo criterio en facturación,
 * fiado y cartera para que las cifras se puedan sumar entre sí.
 */
function ventaNeta(pedido: { total: number | null; costo_domicilio: number | null }) {
  return (pedido.total ?? 0) - (pedido.costo_domicilio ?? 0);
}

/**
 * Calcula la ventana de tiempo para las consultas del Dashboard.
 * Si es "Hoy" y hay un turno abierto, usa la hora de apertura del turno.
 * De lo contrario, usa el día calendario estricto.
 */
async function getTimeWindow(supabase: Awaited<ReturnType<typeof createClient>>, dateStr?: string) {
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

  // Tres consultas independientes:
  //  1. Los pedidos del día (la venta de hoy).
  //  2. Toda la cartera pendiente, sin filtro de fecha: las deudas se arrastran
  //     de días anteriores hasta que se cobran.
  //  3. Los pedidos viejos que se cobraron HOY. Su plata entró hoy a la caja
  //     pero su `created_at` es de otro día, así que no aparece en la venta de
  //     ningún día si no se cuenta aparte.
  const [
    { data, error },
    { data: carteraData, error: carteraError },
    { data: cobrosViejosData, error: cobrosViejosError },
  ] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, total, subtotal, recargo, costo_domicilio, metodo_pago, tipo, estado, closed_at, created_at, motivo_cancelacion, pagos_pedido(metodo, monto)')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay),
    supabase
      .from('pedidos')
      .select('total, costo_domicilio')
      .eq('estado', ESTADOS_PEDIDO.DEBE),
    supabase
      .from('pedidos')
      .select('total, costo_domicilio')
      .eq('estado', ESTADOS_PEDIDO.PAGADO)
      .gte('closed_at', startOfDay)
      .lt('closed_at', endOfDay)
      .lt('created_at', startOfDay),
  ]);

  if (error) {
    console.error('Error al obtener resumen del día:', error);
    return null;
  }
  if (carteraError) {
    console.error('Error al obtener la cartera pendiente:', carteraError);
  }
  if (cobrosViejosError) {
    console.error('Error al obtener los cobros de deudas viejas:', cobrosViejosError);
  }

  const todosPedidos = data ?? [];

  // 1. Filtrar pagados
  const pagados = todosPedidos.filter(p => p.estado === ESTADOS_PEDIDO.PAGADO);
  
  // El cobro de domicilio es plata del domiciliario, no venta del negocio:
  // se resta de la facturación para no inflar los ingresos del restaurante.
  const totalCobradoBruto = pagados.reduce((sum, p) => sum + (p.total ?? 0), 0);
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

  // Facturación real del restaurante (sin el dinero del domiciliario)
  const totalFacturado = totalCobradoBruto - totalDomicilios;

  // ── Fiado: lo que se vendió hoy pero todavía no se ha cobrado ──
  // Se mide con el mismo criterio que la facturación (sin el domicilio) para
  // que las dos cifras se puedan sumar sin mezclar plata del domiciliario.
  const fiadosDelDia = todosPedidos.filter(p => p.estado === ESTADOS_PEDIDO.DEBE);
  const totalFiadoHoy = fiadosDelDia.reduce((sum, p) => sum + ventaNeta(p), 0);
  const cantidadFiadoHoy = fiadosDelDia.length;

  // La venta real del día: lo que entró a la caja más lo que quedó fiado.
  // Es la cifra con la que ella cuadra al cerrar.
  const ventaRealDelDia = totalFacturado + totalFiadoHoy;

  // ── Cartera: TODO lo que le deben, venga del día que venga ──
  const cartera = carteraData ?? [];
  const carteraTotal = cartera.reduce((sum, p) => sum + ventaNeta(p), 0);
  const carteraCantidad = cartera.length;

  // ── Deudas de días anteriores que se cobraron hoy ──
  const cobrosViejos = cobrosViejosData ?? [];
  const totalCobrosDeudasViejas = cobrosViejos.reduce((sum, p) => sum + ventaNeta(p), 0);
  const cantidadCobrosDeudasViejas = cobrosViejos.length;

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

  // 3. Cancelados — solo los contadores; el detalle lo trae
  //    `getCancelacionesDelDia`, que es lo que alimenta la tabla.
  const canceladosDelDia = todosPedidos.filter(p => p.estado === ESTADOS_PEDIDO.CANCELADO);
  const cantidadCancelados = canceladosDelDia.length;
  const montoCancelado = canceladosDelDia.reduce((sum, p) => sum + ventaNeta(p), 0);

  return {
    totalPedidos: totalPedidosPagados,
    totalFacturado,
    totalRecargos,
    totalDomicilios,
    cantidadDomiciliosCobrados,
    porMetodoPago,
    porTipo,
    horaPico,
    cantidadCancelados,
    montoCancelado,
    totalFiadoHoy,
    cantidadFiadoHoy,
    ventaRealDelDia,
    carteraTotal,
    carteraCantidad,
    totalCobrosDeudasViejas,
    cantidadCobrosDeudasViejas,
    tiempoPromedioMinutos
  };
}

/**
 * Cartera pendiente por cobrar: TODOS los pedidos en estado 'debe',
 * sin importar de qué día sean.
 *
 * Es la lista que responde "¿quién me debe y cuánto?" — por eso trae el
 * nombre del deudor y los productos, no solo el número del pedido.
 */
export async function getCarteraPendiente() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, deudor_nombre, deudor_telefono, total, costo_domicilio, created_at, detalle_pedidos(cantidad, productos(nombre))')
    .eq('estado', ESTADOS_PEDIDO.DEBE)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error al obtener la cartera pendiente:', error);
    return [];
  }

  return (data ?? []).map(p => ({
    id: p.id,
    // Los pedidos marcados como deuda antes de que existiera el campo no
    // tienen deudor: se cae al nombre del domicilio y, si tampoco hay, se
    // deja explícito que quedó sin registrar.
    nombre: p.deudor_nombre || p.cliente_nombre || 'Sin nombre registrado',
    telefono: p.deudor_telefono,
    origen:
      p.tipo === TIPOS_ATENCION.MESA && p.numero_mesa != null
        ? `Mesa ${p.numero_mesa}`
        : 'Domicilio',
    monto: ventaNeta(p),
    fecha: p.created_at,
    productos: resumirProductos(p.detalle_pedidos),
  }));
}

/**
 * Pedidos cancelados del día, con lo que contenían y quién los canceló.
 *
 * Cancelar no borra el pedido: queda todo guardado. Esta consulta es la que
 * permite reconstruir una venta que alguien anuló y no volvió a montar.
 */
export async function getCancelacionesDelDia(dateStr?: string) {
  const supabase = await createClient();

  const { startOfDay, endOfDay } = await getTimeWindow(supabase, dateStr);

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, total, costo_domicilio, motivo_cancelacion, cancelado_por, rehecho_en, created_at, detalle_pedidos(cantidad, productos(nombre))')
    .eq('estado', ESTADOS_PEDIDO.CANCELADO)
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener las cancelaciones:', error);
    return [];
  }

  return (data ?? []).map(p => ({
    id: p.id,
    hora: new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(p.created_at)),
    motivo: p.motivo_cancelacion || 'Sin motivo',
    canceladoPor: p.cancelado_por,
    origen:
      p.tipo === TIPOS_ATENCION.MESA && p.numero_mesa != null
        ? `Mesa ${p.numero_mesa}`
        : p.cliente_nombre || 'Domicilio',
    monto: ventaNeta(p),
    /** Id del pedido que lo reemplazó. Null = nunca se volvió a montar. */
    rehechoEn: p.rehecho_en,
    productos: resumirProductos(p.detalle_pedidos),
  }));
}

/** Convierte las líneas de un pedido en "2x Salchipapa · 1x Coca-Cola" */
function resumirProductos(
  detalles: { cantidad: number; productos: { nombre: string } | null }[] | null
) {
  if (!detalles || detalles.length === 0) return 'Sin productos';
  return detalles
    .map(d => `${d.cantidad}x ${d.productos?.nombre ?? 'Producto eliminado'}`)
    .join(' · ');
}

/**
 * Retorna los últimos N pedidos con sus detalles para la tabla histórica.
 */
export async function getPedidosRecientes(limit: number = 20, dateStr?: string) {
  const supabase = await createClient();

  const { startOfDay, endOfDay } = await getTimeWindow(supabase, dateStr);

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, tipo, numero_mesa, cliente_nombre, deudor_nombre, estado, metodo_pago, subtotal, recargo, total, created_at, closed_at, pagos_pedido(metodo, monto)')
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
