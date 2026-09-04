'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCalendar } from '@/components/ui/Icons';
import styles from './DateRangeFilter.module.css';

interface DateRangeFilterProps {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
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

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

/** Lunes de la semana que contiene `fecha` */
function inicioDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const dia = d.getDay(); // 0 = domingo
  const offset = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/**
 * Filtro de fechas del Dashboard: atajos comunes (Hoy, Ayer, Esta semana,
 * Este mes) más un rango personalizado para comparar cualquier tramo.
 *
 * Cada botón navega a `/dashboard?from=...&to=...` — la página vuelve a
 * pedir los datos en el servidor, no hay estado que sincronizar aquí.
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ from, to }) => {
  const router = useRouter();
  const hoy = hoyBogota();
  const [rangoAbierto, setRangoAbierto] = useState(false);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const ir = (f: string, t: string) => router.push(`/dashboard?from=${f}&to=${t}`);

  const presets = [
    { etiqueta: 'Hoy', f: hoy, t: hoy },
    { etiqueta: 'Ayer', f: sumarDias(hoy, -1), t: sumarDias(hoy, -1) },
    { etiqueta: 'Esta semana', f: inicioDeSemana(hoy), t: hoy },
    { etiqueta: 'Este mes', f: inicioDeMes(hoy), t: hoy },
  ];

  const aplicarRango = () => {
    if (fromInput && toInput && fromInput <= toInput && toInput <= hoy) {
      ir(fromInput, toInput);
      setRangoAbierto(false);
    }
  };

  return (
    <div className={styles.contenedor}>
      <div className={styles.presets}>
        {presets.map((p) => (
          <button
            key={p.etiqueta}
            type="button"
            className={`${styles.presetBtn} ${from === p.f && to === p.t ? styles.activo : ''}`}
            onClick={() => ir(p.f, p.t)}
          >
            {p.etiqueta}
          </button>
        ))}
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
