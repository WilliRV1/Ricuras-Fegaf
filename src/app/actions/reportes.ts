'use server';

import { createClient } from '@/lib/supabase/server';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { getTimeWindow, hoyBogota, normalizarRango } from '@/lib/rangoFechas';
import { getLiquidacionDomiciliario, getResumenDelDia } from '@/app/actions/dashboard';
import type { ComparativoMensual, ProductoRentable, ReporteUtilidad, ReporteUtilidadMensual } from '@/types';

/**
 * Fase 2 / Módulo 8 — Inteligencia Financiera y Reportes.
 *
 * Utilidad neta real = ventas − costo de productos vendidos − lo que el dueño
 * tuvo que poner para completarle el pago al domiciliario. Así lo lleva en su
 * Excel (audio del 1/10/2026):
 *   - VENTAS: se reutiliza `ventaRealDelDia` de `getResumenDelDia`
 *     (dashboard.ts) en vez de recalcular la venta — es la misma cifra con
 *     la que ella cuadra caja, no puede haber dos versiones de "cuánto se
 *     vendió" en la app.
 *   - COSTOS: costo de cada producto vendido según `vw_producto_costos`
 *     (Módulo 6): el costo manual si lo tiene, si no el de su receta. Ese
 *     costo YA incluye la línea "Pago auxiliares" ($1.500 por producto): es
 *     la plata que cada venta deja para el domiciliario.
 *   - DOMICILIARIO: como el costo ya trae lo recaudado, aquí solo se resta
 *     la diferencia (pago − recaudo). Antes se restaba el pago completo y el
 *     recaudo quedaba descontado dos veces. Si en el período sobró, esa
 *     diferencia es negativa y vuelve a la utilidad.
 *
 * El Módulo 7 (gastos operativos) se quitó: mezclaba gastos del negocio con
 * gastos personales de la dueña en el Excel original, y no correspondía
 * llevarlo en esta app.
 *
 * `vw_producto_costos` es una vista nueva sin generar todavía en
 * database.types.ts — de ahí el cliente sin tipar en vez de @ts-expect-error
 * sobre una cadena .from().select()...
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteSinTipar = { from: (table: string) => any };

/**
 * Suma el costo (según receta vigente) de todo lo vendido en la ventana
 * [startOfDay, endOfDay). Cuenta lo pagado Y lo fiado: `ventaRealDelDia`
 * (la cifra de ventas contra la que se resta) incluye el fiado del día, así
 * que dejar su costo por fuera inflaba la utilidad cada día con deudas.
 */
async function costoProductosVendidosEnRango(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startOfDay: string,
  endOfDay: string
): Promise<number> {
  const db = supabase as unknown as ClienteSinTipar;

  const [detalleRes, costosRes] = await Promise.all([
    supabase
      .from('detalle_pedidos')
      .select('producto_id, cantidad, costo_unitario, pedidos!inner(estado, created_at)')
      .in('pedidos.estado', ['pagado', 'debe'])
      .gte('pedidos.created_at', startOfDay)
      .lt('pedidos.created_at', endOfDay),
    db.from('vw_producto_costos').select('producto_id, costo_total'),
  ]);

  if (detalleRes.error) {
    console.error('Error calculando costo de productos vendidos:', detalleRes.error);
    return 0;
  }

  const costoPorProducto = new Map<number, number>(
    (costosRes.data ?? []).map((c: { producto_id: number; costo_total: number }) => [
      c.producto_id,
      c.costo_total,
    ])
  );

  // Manda el costo que tenía el producto cuando se vendió (la foto de la
  // línea): así subir el queso hoy no cambia la utilidad del mes pasado. Si
  // la línea no tiene foto (el producto no tenía costo ese día), el de hoy.
  return (detalleRes.data ?? []).reduce((acc, linea) => {
    const costoUnitario = linea.costo_unitario ?? costoPorProducto.get(linea.producto_id) ?? 0;
    return acc + linea.cantidad * Number(costoUnitario);
  }, 0);
}

/** Utilidad neta real del período: ventas reales − costo de productos vendidos − aporte al domiciliario. */
export async function getUtilidadNetaReal(fromStr?: string, toStr?: string): Promise<ReporteUtilidad | null> {
  if (!(await sesionConAcceso('/dashboard'))) return null;

  const resumen = await getResumenDelDia(fromStr, toStr);
  if (!resumen) return null;

  const supabase = await createClient();
  const { startOfDay, endOfDay } = await getTimeWindow(supabase, fromStr, toStr);

  const { from, to } = normalizarRango(fromStr, toStr);

  const [costoProductos, domiciliario] = await Promise.all([
    costoProductosVendidosEnRango(supabase, startOfDay, endOfDay),
    getLiquidacionDomiciliario(fromStr, toStr),
  ]);
  const ventas = resumen.ventaRealDelDia;
  const aporteDomiciliario = domiciliario?.aporte ?? 0;

  return {
    from,
    to,
    ventas,
    costoProductos,
    recaudoDomiciliario: domiciliario?.recaudo ?? 0,
    pagoDomiciliario: domiciliario?.pago ?? 0,
    aporteDomiciliario,
    utilidadNeta: ventas - costoProductos - aporteDomiciliario,
  };
}

/** Primer y último día de un mes 'YYYY-MM', como 'YYYY-MM-DD'. */
function rangoDelMes(mes: string): { from: string; to: string } {
  const [anio, mesNum] = mes.split('-').map(Number);
  const ultimoDia = new Date(anio, mesNum, 0).getDate();
  return { from: `${mes}-01`, to: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

/** El mes anterior a `mes` ('YYYY-MM'), cruzando de año si hace falta. */
function mesAnteriorDe(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fecha = new Date(anio, mesNum - 2, 1); // mesNum es 1-indexado; -2 retrocede un mes en Date (0-indexado)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function etiquetaDeMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(
    new Date(anio, mesNum - 1, 1)
  );
}

/** Utilidad neta real del mes dado (o el actual) comparada contra el mes anterior. */
export async function getComparativoMensual(mesStr?: string): Promise<ComparativoMensual | null> {
  if (!(await sesionConAcceso('/dashboard'))) return null;

  const mesActual = mesStr || hoyBogota().slice(0, 7);
  const mesAnterior = mesAnteriorDe(mesActual);

  const rangoActual = rangoDelMes(mesActual);
  const rangoAnterior = rangoDelMes(mesAnterior);

  const [utilidadActual, utilidadAnterior] = await Promise.all([
    getUtilidadNetaReal(rangoActual.from, rangoActual.to),
    getUtilidadNetaReal(rangoAnterior.from, rangoAnterior.to),
  ]);

  if (!utilidadActual || !utilidadAnterior) return null;

  const conEtiqueta = (mes: string, u: ReporteUtilidad): ReporteUtilidadMensual => ({
    ...u,
    mes,
    etiqueta: etiquetaDeMes(mes),
  });

  return {
    mesActual: conEtiqueta(mesActual, utilidadActual),
    mesAnterior: conEtiqueta(mesAnterior, utilidadAnterior),
  };
}

/**
 * Productos vendidos (pagados y fiados) en el período, ordenados por
 * rentabilidad real (no solo cantidad). Cuenta lo mismo que la utilidad.
 */
export async function getProductosMasRentables(fromStr?: string, toStr?: string): Promise<ProductoRentable[]> {
  if (!(await sesionConAcceso('/dashboard'))) return [];

  const supabase = await createClient();
  const db = supabase as unknown as ClienteSinTipar;
  const { startOfDay, endOfDay } = await getTimeWindow(supabase, fromStr, toStr);

  const [detalleRes, costosRes] = await Promise.all([
    supabase
      .from('detalle_pedidos')
      .select('producto_id, cantidad, precio_unitario, costo_unitario, productos(nombre), pedidos!inner(estado, created_at)')
      .in('pedidos.estado', ['pagado', 'debe'])
      .gte('pedidos.created_at', startOfDay)
      .lt('pedidos.created_at', endOfDay),
    db.from('vw_producto_costos').select('producto_id, costo_total'),
  ]);

  if (detalleRes.error) {
    console.error('Error listando productos más rentables:', detalleRes.error);
    return [];
  }

  const costoPorProducto = new Map<number, number>(
    (costosRes.data ?? []).map((c: { producto_id: number; costo_total: number }) => [
      c.producto_id,
      c.costo_total,
    ])
  );

  const agrupado = new Map<number, ProductoRentable>();

  for (const linea of detalleRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombre = (linea.productos as any)?.nombre ?? 'Producto eliminado';
    const costoUnitario = Number(linea.costo_unitario ?? costoPorProducto.get(linea.producto_id) ?? 0);
    const ingresos = linea.precio_unitario * linea.cantidad;
    const costoTotal = costoUnitario * linea.cantidad;

    const acumulado = agrupado.get(linea.producto_id);
    if (acumulado) {
      acumulado.cantidad += linea.cantidad;
      acumulado.ingresos += ingresos;
      acumulado.costoTotal += costoTotal;
    } else {
      agrupado.set(linea.producto_id, {
        productoId: linea.producto_id,
        nombre,
        cantidad: linea.cantidad,
        ingresos,
        costoTotal,
        margenTotal: 0,
        margenPorcentaje: null,
      });
    }
  }

  const productos = Array.from(agrupado.values()).map((p) => ({
    ...p,
    margenTotal: p.ingresos - p.costoTotal,
    margenPorcentaje: p.ingresos > 0 ? (p.ingresos - p.costoTotal) / p.ingresos : null,
  }));

  return productos.sort((a, b) => b.margenTotal - a.margenTotal);
}
