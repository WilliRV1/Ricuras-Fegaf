/**
 * Pago al domiciliario como lo lleva el dueño (audio del 1/10/2026):
 *
 *   recaudo = unidades vendidas de productos que "aportan" × tarifa ($1.500)
 *   pago    = fijo por cada día trabajado ($40.000), o lo que se haya ajustado
 *   aporte  = pago − recaudo
 *
 * aporte > 0: lo que él pone de su ganancia para completar el pago.
 * aporte < 0: sobró; ese sobrante cubre los días flojos de la misma semana,
 * por eso los totales se suman con signo y no día por día.
 *
 * Día trabajado = día con alguna venta, salvo que tenga un ajuste (un ajuste
 * de 0 es "ese día no se le pagó").
 *
 * Función pura y sin imports: la usan las server actions y
 * scripts/test-domiciliario.mjs.
 */

export interface LineaVendida {
  /** Día de la venta en Bogotá, 'YYYY-MM-DD' */
  dia: string;
  cantidad: number;
  /** productos.aporta_domiciliario */
  aporta: boolean;
}

export interface LiquidacionDia {
  dia: string;
  unidades: number;
  recaudo: number;
  pago: number;
  aporte: number;
  /** El pago de ese día se fijó a mano (no es el fijo) */
  ajustado: boolean;
}

export interface TotalesLiquidacion {
  unidades: number;
  recaudo: number;
  pago: number;
  /** pago − recaudo. Positivo = puso de su ganancia; negativo = sobró. */
  aporte: number;
  /** Días con pago mayor que 0 */
  diasPagados: number;
}

export function calcularLiquidacion(
  lineas: LineaVendida[],
  cifras: { tarifa: number; pagoDia: number },
  /** Pago fijado a mano por día: { 'YYYY-MM-DD': pesos } */
  ajustes: Record<string, number> = {}
): TotalesLiquidacion & { dias: LiquidacionDia[] } {
  const unidadesPorDia = new Map<string, number>();

  for (const linea of lineas) {
    // Una venta de solo bebidas también hace del día un día trabajado.
    const previas = unidadesPorDia.get(linea.dia) ?? 0;
    unidadesPorDia.set(linea.dia, previas + (linea.aporta ? linea.cantidad : 0));
  }
  for (const dia of Object.keys(ajustes)) {
    if (!unidadesPorDia.has(dia)) unidadesPorDia.set(dia, 0);
  }

  const dias: LiquidacionDia[] = Array.from(unidadesPorDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, unidades]) => {
      const ajustado = dia in ajustes;
      const recaudo = unidades * cifras.tarifa;
      const pago = ajustado ? ajustes[dia] : cifras.pagoDia;
      return { dia, unidades, recaudo, pago, aporte: pago - recaudo, ajustado };
    });

  return { dias, ...sumar(dias) };
}

/** Totales de los días que caen en [from, to] (ambos inclusive) */
export function totalesEntre(dias: LiquidacionDia[], from: string, to: string): TotalesLiquidacion {
  return sumar(dias.filter((d) => d.dia >= from && d.dia <= to));
}

function sumar(dias: LiquidacionDia[]): TotalesLiquidacion {
  return dias.reduce<TotalesLiquidacion>(
    (acc, d) => ({
      unidades: acc.unidades + d.unidades,
      recaudo: acc.recaudo + d.recaudo,
      pago: acc.pago + d.pago,
      aporte: acc.aporte + d.aporte,
      diasPagados: acc.diasPagados + (d.pago > 0 ? 1 : 0),
    }),
    { unidades: 0, recaudo: 0, pago: 0, aporte: 0, diasPagados: 0 }
  );
}
