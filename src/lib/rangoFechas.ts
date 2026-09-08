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
export async function getTimeWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromStr?: string,
  toStr?: string
) {
  const bogotaDateStr = hoyBogota();
  const from = fromStr || bogotaDateStr;
  const to = toStr || from;
  const esSoloHoy = from === to && from === bogotaDateStr;

  if (esSoloHoy) {
    const { data: arqueo } = await supabase
      .from('arqueos_caja')
      .select('opened_at')
      .eq('estado', 'abierto')
      .single();

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
