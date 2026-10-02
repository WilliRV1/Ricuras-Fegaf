'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCalendar } from '@/components/ui/Icons';
import { describirRango, lunesDe, rangoDeSemana, semanaDelAnio, semanaExacta, sumarDias } from '@/lib/semanas';
import styles from './DateRangeFilter.module.css';

interface DateRangeFilterProps {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
  /** Ruta a la que navegan los presets/el rango. Por defecto el dashboard principal. */
  basePath?: string;
}

/** Hoy en la zona horaria de Colombia, como 'YYYY-MM-DD' */
function hoyBogota(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/**
 * Filtro de fechas del Dashboard: atajos comunes (Hoy, Ayer, Este mes), las
 * semanas del año como las numera el dueño en su Excel, y un rango
 * personalizado para comparar cualquier tramo.
 *
 * Cada botón navega a `/dashboard?from=...&to=...` — la página vuelve a
 * pedir los datos en el servidor, no hay estado que sincronizar aquí.
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ from, to, basePath = '/dashboard' }) => {
  const router = useRouter();
  const hoy = hoyBogota();
  const [rangoAbierto, setRangoAbierto] = useState(false);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const ir = (f: string, t: string) => router.push(`${basePath}?from=${f}&to=${t}`);

  const presets = [
    { etiqueta: 'Hoy', f: hoy, t: hoy },
    { etiqueta: 'Ayer', f: sumarDias(hoy, -1), t: sumarDias(hoy, -1) },
    { etiqueta: 'Este mes', f: inicioDeMes(hoy), t: hoy },
  ];

  // El día 1 "Este mes" es el mismo rango que "Hoy": se marcaban los dos. Se
  // resalta solo el primero que coincida, que es el más específico.
  const presetActivo = presets.findIndex((p) => from === p.f && to === p.t);

  // La semana del selector es la de la fecha final de lo que se está mirando:
  // así las flechas avanzan desde donde uno está, no desde hoy.
  const { anio, semana } = semanaDelAnio(to);
  const rangoSemana = rangoDeSemana(anio, semana);
  // Un lunes, "Hoy" y la semana en curso son el mismo rango: gana "Hoy".
  const semanaActiva = presetActivo === -1 && semanaExacta(from, to, hoy) !== null;
  const haySiguiente = sumarDias(rangoSemana.from, 7) <= hoy;

  /** Va a la semana que empieza en `lunes`; la semana en curso llega hasta hoy */
  const irASemana = (lunes: string) => {
    const domingo = sumarDias(lunes, 6);
    ir(lunes, domingo > hoy ? hoy : domingo);
  };

  const aplicarRango = () => {
    if (fromInput && toInput && fromInput <= toInput && toInput <= hoy) {
      ir(fromInput, toInput);
      setRangoAbierto(false);
    }
  };

  return (
    <div className={styles.contenedor}>
      <div className={styles.presets}>
        {presets.map((p, i) => (
          <button
            key={p.etiqueta}
            type="button"
            className={`${styles.presetBtn} ${i === presetActivo ? styles.activo : ''}`}
            onClick={() => ir(p.f, p.t)}
          >
            {p.etiqueta}
          </button>
        ))}

        <div className={`${styles.semana} ${semanaActiva ? styles.semanaActiva : ''}`} role="group" aria-label="Semana del año">
          <button
            type="button"
            className={styles.semanaFlecha}
            onClick={() => irASemana(sumarDias(rangoSemana.from, -7))}
            aria-label="Semana anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.semanaBtn}
            onClick={() => irASemana(lunesDe(to))}
            aria-pressed={semanaActiva}
          >
            Semana {semana}
            {anio !== Number(hoy.slice(0, 4)) ? ` de ${anio}` : ''}
            <span className={styles.semanaFechas}>{describirRango(rangoSemana.from, rangoSemana.to)}</span>
          </button>
          <button
            type="button"
            className={styles.semanaFlecha}
            onClick={() => irASemana(sumarDias(rangoSemana.from, 7))}
            disabled={!haySiguiente}
            aria-label="Semana siguiente"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className={`${styles.presetBtn} ${rangoAbierto ? styles.activo : ''}`}
          onClick={() => setRangoAbierto((v) => !v)}
        >
          <IconCalendar size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
          Rango
        </button>
      </div>

      {rangoAbierto && (
        <div className={styles.rangoCaja}>
          <input
            type="date"
            value={fromInput}
            max={toInput || hoy}
            onChange={(e) => setFromInput(e.target.value)}
            className={styles.input}
            aria-label="Desde"
          />
          <span className={styles.rangoGuion}>a</span>
          <input
            type="date"
            value={toInput}
            min={fromInput}
            max={hoy}
            onChange={(e) => setToInput(e.target.value)}
            className={styles.input}
            aria-label="Hasta"
          />
          <button
            type="button"
            className={styles.aplicarBtn}
            onClick={aplicarRango}
            disabled={!fromInput || !toInput || fromInput > toInput}
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
};
