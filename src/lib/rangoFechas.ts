import { createClient } from '@/lib/supabase/server';

/** Hoy en la zona horaria de Colombia, como 'YYYY-MM-DD' */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Calcula la ventana de tiempo para consultas por rango de fechas.
 *
 * Si el rango es exactamente "hoy" (un solo día, el de hoy) y hay un turno de
 * caja abierto, usa la hora de apertura del turno en vez de la medianoche —
 * así el corte coincide con el que la dueña usa para cuadrar caja. Para
 * cualquier otro rango (un día pasado, una semana, un mes) se usa el
 * calendario estricto: el turno abierto solo tiene sentido para "hoy".
 *
 * Vivía dentro de `actions/dashboard.ts`; se movió aquí porque
 * `actions/reportes.ts` (Fase 2, Módulo 8) necesita la misma ventana para
 * que sus cifras cuadren con las del dashboard.
 */
/** 'YYYY-MM-DD' real (no basta el formato: 2026-13-45 lo cumple) */
export function esFechaValida(valor: string | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/**
 * Deja un rango de fechas usable a partir de lo que llegue por la URL: lo que
 * no sea una fecha válida cae a hoy, y si el rango viene al revés se ordena.
 * Antes `/dashboard?from=abc` tumbaba la página con "Invalid time value".
 */
export function normalizarRango(fromStr?: string, toStr?: string): { from: string; to: string } {
  const hoy = hoyBogota();
  const from = esFechaValida(fromStr) ? fromStr : hoy;
  const to = esFechaValida(toStr) ? toStr : from;
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function getTimeWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromStr?: string,
  toStr?: string
) {
  const bogotaDateStr = hoyBogota();
  const { from, to } = normalizarRango(fromStr, toStr);
  const esSoloHoy = from === to && from === bogotaDateStr;

  if (esSoloHoy) {
    const { data: arqueo } = await supabase
      .from('arqueos_caja')
      .select('opened_at')
      .eq('estado', 'abierto')
      .maybeSingle();

    if (arqueo) {
      return {
        startOfDay: arqueo.opened_at,
        endOfDay: new Date().toISOString(),
      };
    }
  }

  return {
    startOfDay: new Date(`${from}T00:00:00-05:00`).toISOString(),
    endOfDay: new Date(`${to}T23:59:59.999-05:00`).toISOString(),
  };
}
