'use server';

import { createClient } from '@/lib/supabase/server';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { getTimeWindow, hoyBogota } from '@/lib/rangoFechas';
import { getResumenDelDia } from '@/app/actions/dashboard';
import type { ComparativoMensual, ProductoRentable, ReporteUtilidad, ReporteUtilidadMensual } from '@/types';

/**
 * Fase 2 / Módulo 8 — Inteligencia Financiera y Reportes.
 *
 * La fórmula es literalmente la que ya escribe la dueña en la hoja Costeo
 * del Excel: `UTILIDAD = INGRESOS - (COSTOS + GASTOS)`.
 *   - INGRESOS: se reutiliza `ventaRealDelDia` de `getResumenDelDia`
 *     (dashboard.ts) en vez de recalcular la venta — es la misma cifra con
 *     la que ella cuadra caja, no puede haber dos versiones de "cuánto se
 *     vendió" en la app.
 *   - COSTOS: costo de los insumos de cada producto vendido, según su costo
 *     vigente en `vw_producto_costos` (Módulo 6).
 *   - GASTOS: lo registrado en `gastos` (Módulo 7) para el mismo período.
 *
 * `gastos`/`vw_producto_costos` son tablas/vista nuevas sin generar todavía
 * en database.types.ts — mismo motivo que en recetas.ts/gastos.ts para el
 * cliente sin tipar en vez de @ts-expect-error sobre una cadena
 * .from().select()...
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteSinTipar = { from: (table: string) => any };

/** Suma el costo (según receta vigente) de todo lo vendido y pagado en la ventana [startOfDay, endOfDay). */
async function costoProductosVendidosEnRango(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startOfDay: string,
  endOfDay: string
): Promise<number> {
  const db = supabase as unknown as ClienteSinTipar;

  const [detalleRes, costosRes] = await Promise.all([
    supabase
      .from('detalle_pedidos')
      .select('producto_id, cantidad, pedidos!inner(estado, created_at)')
      .eq('pedidos.estado', 'pagado')
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

  return (detalleRes.data ?? []).reduce((acc, linea) => {
    const costoUnitario = costoPorProducto.get(linea.producto_id) ?? 0;
    return acc + linea.cantidad * costoUnitario;
  }, 0);
}

/** Suma los gastos registrados entre `from` y `to` (fechas 'YYYY-MM-DD', ambas inclusive). */
async function gastosEnRango(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
): Promise<number> {
  const db = supabase as unknown as ClienteSinTipar;

  const { data, error } = await db.from('gastos').select('valor').gte('fecha', from).lte('fecha', to);

  if (error) {
    console.error('Error sumando gastos del período:', error);
    return 0;
  }

  return (data ?? []).reduce((acc: number, g: { valor: number }) => acc + g.valor, 0);
}

/** Utilidad neta real del período: ventas reales − costo de productos vendidos − gastos. */
export async function getUtilidadNetaReal(fromStr?: string, toStr?: string): Promise<ReporteUtilidad | null> {
  if (!(await sesionConAcceso('/dashboard'))) return null;

  const resumen = await getResumenDelDia(fromStr, toStr);
  if (!resumen) return null;

  const supabase = await createClient();
  const { startOfDay, endOfDay } = await getTimeWindow(supabase, fromStr, toStr);

  const bogotaHoy = hoyBogota();
  const from = fromStr || bogotaHoy;
  const to = toStr || from;

  const [costoProductos, gastos] = await Promise.all([
    costoProductosVendidosEnRango(supabase, startOfDay, endOfDay),
    gastosEnRango(supabase, from, to),
  ]);

  const ventas = resumen.ventaRealDelDia;

  return {
    from,
    to,
    ventas,
    costoProductos,
    gastos,
    utilidadNeta: ventas - costoProductos - gastos,
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

/** Productos vendidos y pagados en el período, ordenados por rentabilidad real (no solo cantidad). */
export async function getProductosMasRentables(fromStr?: string, toStr?: string): Promise<ProductoRentable[]> {
  if (!(await sesionConAcceso('/dashboard'))) return [];

  const supabase = await createClient();
  const db = supabase as unknown as ClienteSinTipar;
  const { startOfDay, endOfDay } = await getTimeWindow(supabase, fromStr, toStr);

  const [detalleRes, costosRes] = await Promise.all([
    supabase
      .from('detalle_pedidos')
      .select('producto_id, cantidad, precio_unitario, productos(nombre), pedidos!inner(estado, created_at)')
      .eq('pedidos.estado', 'pagado')
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
    const costoUnitario = costoPorProducto.get(linea.producto_id) ?? 0;
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
