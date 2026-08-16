'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTIVOS_CANCELACION } from '@/lib/constants';
import styles from './CancelOrderDialog.module.css';

interface CancelOrderDialogProps {
  isOpen: boolean;
  orderId: number;
  /** Texto extra bajo el título (ej. advertencia al anular desde liquidación) */
  aviso?: React.ReactNode;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

const OTRO = '__otro__';

/**
 * Diálogo para cancelar/anular un pedido con motivo obligatorio.
 * Los motivos vienen de una lista fija (se eligen con un toque) para que el
 * dashboard pueda mostrar por qué se pierden pedidos, con opción de escribir
 * uno distinto.
 */
export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  isOpen,
  orderId,
  aviso,
  confirmLabel = 'Cancelar pedido',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [otroTexto, setOtroTexto] = useState('');

  // Al abrirse, empezar siempre en blanco. Se ajusta durante el render (patrón
  // recomendado por React) en lugar de un efecto, para no encadenar renders.
  const [estabaAbierto, setEstabaAbierto] = useState(isOpen);
  if (isOpen !== estabaAbierto) {
    setEstabaAbierto(isOpen);
    if (isOpen) {
      setSeleccion(null);
      setOtroTexto('');
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  const motivoFinal = seleccion === OTRO ? otroTexto.trim() : seleccion ?? '';
  const puedeConfirmar = motivoFinal.length > 0 && !isLoading;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>Cancelar el pedido #{orderId}</h3>
        {aviso && <div className={styles.aviso}>{aviso}</div>}
        <p className={styles.subtitle}>¿Por qué se cancela?</p>

        <div className={styles.motivos}>
          {MOTIVOS_CANCELACION.map((motivo) => (
            <button
              key={motivo}
              type="button"
              className={`${styles.motivoBtn} ${seleccion === motivo ? styles.motivoActive : ''}`}
              onClick={() => setSeleccion(motivo)}
              disabled={isLoading}
            >
              {motivo}
            </button>
          ))}

          <button
            type="button"
            className={`${styles.motivoBtn} ${seleccion === OTRO ? styles.motivoActive : ''}`}
            onClick={() => setSeleccion(OTRO)}
            disabled={isLoading}
          >
            Otro motivo…
          </button>
        </div>

        {seleccion === OTRO && (
          <input
            type="text"
            className={styles.otroInput}
            placeholder="Escribe el motivo"
            value={otroTexto}
            onChange={(e) => setOtroTexto(e.target.value)}
            disabled={isLoading}
            autoFocus
            maxLength={120}
          />
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.volverBtn}
            onClick={onCancel}
            disabled={isLoading}
          >
            Volver
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => onConfirm(motivoFinal)}
            disabled={!puedeConfirmar}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
