'use client';

import React, { useEffect } from 'react';
import { IconBackspace, IconCheck } from '@/components/ui/Icons';
import styles from './PinPad.module.css';

interface PinPadProps {
  /** Dígitos escritos hasta ahora */
  valor: string;
  onChange: (valor: string) => void;
  /** Se dispara al completar los 4 dígitos o al tocar el botón de confirmar */
  onCompleto: (pin: string) => void;
  longitud?: number;
  disabled?: boolean;
  /** Vacía los puntos y deja el teclado listo (ej. tras un PIN errado) */
  autoFocus?: boolean;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado numérico para PIN.
 *
 * Botones grandes y solo números: en una tablet de cocina, con las manos
 * ocupadas, escribir una contraseña con el teclado del sistema es lento y se
 * equivoca. Acepta también el teclado físico, para poder usarlo desde un PC.
 */
export const PinPad: React.FC<PinPadProps> = ({
  valor,
  onChange,
  onCompleto,
  longitud = 4,
  disabled = false,
  autoFocus = true,
}) => {
  const escribir = (digito: string) => {
    if (disabled || valor.length >= longitud) return;
    const siguiente = valor + digito;
    onChange(siguiente);
    if (siguiente.length === longitud) onCompleto(siguiente);
  };

  const borrar = () => {
    if (disabled) return;
    onChange(valor.slice(0, -1));
  };

  // Teclado físico: útil para probar desde un computador
  useEffect(() => {
    if (!autoFocus) return;

    const alPulsar = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        escribir(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrar();
      } else if (e.key === 'Enter' && valor.length === longitud) {
        e.preventDefault();
        onCompleto(valor);
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  });

  return (
    <div className={styles.contenedor}>
      <div className={styles.puntos} aria-label={`${valor.length} de ${longitud} dígitos`}>
        {Array.from({ length: longitud }).map((_, i) => (
          <span
            key={i}
            className={`${styles.punto} ${i < valor.length ? styles.puntoLleno : ''}`}
          />
        ))}
      </div>

      <div className={styles.teclado}>
        {TECLAS.map((tecla) => (
          <button
            key={tecla}
            type="button"
            className={styles.tecla}
            onClick={() => escribir(tecla)}
            disabled={disabled}
          >
            {tecla}
          </button>
        ))}

        <button
          type="button"
          className={`${styles.tecla} ${styles.teclaAccion}`}
          onClick={borrar}
          disabled={disabled || valor.length === 0}
          aria-label="Borrar"
        >
          <IconBackspace size={22} />
        </button>

        <button
          type="button"
          className={styles.tecla}
          onClick={() => escribir('0')}
          disabled={disabled}
        >
          0
        </button>

        <button
          type="button"
          className={`${styles.tecla} ${styles.teclaConfirmar}`}
          onClick={() => valor.length === longitud && onCompleto(valor)}
          disabled={disabled || valor.length !== longitud}
          aria-label="Confirmar"
        >
          <IconCheck size={24} />
        </button>
      </div>
    </div>
  );
};
