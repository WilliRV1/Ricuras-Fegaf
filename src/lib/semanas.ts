/**
 * Semanas del año como las numera el dueño en su Excel ("SEMANA 37"): semana
 * ISO, de lunes a domingo. La semana 1 es la que tiene el primer jueves del año.
 *
 * Todo con fechas 'YYYY-MM-DD' y aritmética en UTC, para que el resultado no
 * dependa de la zona horaria de quien lo calcule (servidor o navegador).
 * Sin imports: lo usan componentes de cliente, server actions y los scripts
 * de prueba.
 */

const DIA_MS = 86_400_000;

function aUTC(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return aTexto(new Date(aUTC(fecha).getTime() + dias * DIA_MS));
}

/** Lunes de la semana que contiene `fecha` */
export function lunesDe(fecha: string): string {
  const dia = aUTC(fecha).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/** Año y número de la semana ISO de `fecha`. El 1/1 puede caer en la 52 o 53 del año anterior. */
export function semanaDelAnio(fecha: string): { anio: number; semana: number } {
  // El jueves de la semana decide a qué año pertenece.
  const jueves = aUTC(sumarDias(lunesDe(fecha), 3));
  const anio = jueves.getUTCFullYear();
  const primerDia = Date.UTC(anio, 0, 1);
  const semana = Math.floor((jueves.getTime() - primerDia) / (7 * DIA_MS)) + 1;
  return { anio, semana };
}

/** Lunes y domingo de la semana `semana` del año `anio` */
export function rangoDeSemana(anio: number, semana: number): { from: string; to: string } {
  // El 4 de enero siempre está en la semana 1.
  const lunesSemana1 = lunesDe(`${anio}-01-04`);
  const from = sumarDias(lunesSemana1, (semana - 1) * 7);
  return { from, to: sumarDias(from, 6) };
}

/** "21 al 27 de sep" o, si cruza de mes, "28 de sep al 4 de oct" */
export function describirRango(from: string, to: string, mes: 'short' | 'long' = 'short'): string {
  const nombreMes = (fecha: string) =>
    new Intl.DateTimeFormat('es-CO', { month: mes, timeZone: 'UTC' }).format(aUTC(fecha)).replace('.', '');
  const dia = (fecha: string) => Number(fecha.slice(8, 10));

  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${dia(from)} al ${dia(to)} de ${nombreMes(to)}`;
  }
  return `${dia(from)} de ${nombreMes(from)} al ${dia(to)} de ${nombreMes(to)}`;
}

/**
 * Si [from, to] es una semana de lunes a domingo, devuelve cuál. También vale
 * la semana en curso cortada en `hoy` (lunes a hoy): es lo que se ve al elegir
 * la semana actual.
 */
export function semanaExacta(
  from: string,
  to: string,
  hoy?: string
): { anio: number; semana: number } | null {
  if (lunesDe(from) !== from) return null;
  const domingo = sumarDias(from, 6);
  const enCurso = !!hoy && to === hoy && hoy <= domingo;
  if (to !== domingo && !enCurso) return null;
  return semanaDelAnio(from);
}
