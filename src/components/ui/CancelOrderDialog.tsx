'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTIVOS_CANCELACION, PERSONAL } from '@/lib/constants';
import styles from './CancelOrderDialog.module.css';

interface CancelOrderDialogProps {
  isOpen: boolean;
  orderId: number;
  /** Texto extra bajo el título (ej. advertencia al anular desde liquidación) */
  aviso?: React.ReactNode;
  confirmLabel?: string;
  isLoading?: boolean;
  /**
   * Muestra la casilla "voy a volver a montarlo". Solo tiene sentido donde se
   * pueden tomar pedidos (liquidación), no en el tablero de cocina.
   */
  ofrecerRehacer?: boolean;
  onConfirm: (motivo: string, canceladoPor: string, rehacer: boolean) => void;
  onCancel: () => void;
}

const OTRO = '__otro__';

/**
 * Diálogo para cancelar/anular un pedido con motivo y responsable obligatorios.
 *
 * Los motivos vienen de una lista fija (se eligen con un toque) para que el
 * dashboard pueda mostrar por qué se pierden pedidos, con opción de escribir
 * uno distinto.
 *
 * El responsable se pide porque todas las terminales entran con la misma
 * clave: sin este dato no hay forma de saber a quién preguntarle qué pasó con
 * una venta que desapareció.
 */
export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  isOpen,
  orderId,
  aviso,
  confirmLabel = 'Cancelar pedido',
  isLoading = false,
  ofrecerRehacer = false,
  onConfirm,
  onCancel,
}) => {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [otroTexto, setOtroTexto] = useState('');
  const [responsable, setResponsable] = useState<string | null>(null);
  const [otroResponsable, setOtroResponsable] = useState('');
  const [rehacer, setRehacer] = useState(false);

  // Al abrirse, empezar siempre en blanco. Se ajusta durante el render (patrón
  // recomendado por React) en lugar de un efecto, para no encadenar renders.
  const [estabaAbierto, setEstabaAbierto] = useState(isOpen);
  if (isOpen !== estabaAbierto) {
    setEstabaAbierto(isOpen);
    if (isOpen) {
      setSeleccion(null);
      setOtroTexto('');
      setResponsable(null);
      setOtroResponsable('');
      setRehacer(false);
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
  const responsableFinal =
    responsable === OTRO ? otroResponsable.trim() : responsable ?? '';
  const puedeConfirmar =
    motivoFinal.length > 0 && responsableFinal.length > 0 && !isLoading;

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

        <p className={styles.subtitle}>¿Quién lo está cancelando?</p>

        <div className={styles.responsables}>
          {PERSONAL.map((persona) => (
            <button
              key={persona}
              type="button"
              className={`${styles.responsableBtn} ${responsable === persona ? styles.motivoActive : ''}`}
              onClick={() => setResponsable(persona)}
              disabled={isLoading}
            >
              {persona}
            </button>
          ))}

          <button
            type="button"
            className={`${styles.responsableBtn} ${responsable === OTRO ? styles.motivoActive : ''}`}
            onClick={() => setResponsable(OTRO)}
            disabled={isLoading}
          >
            Otra persona…
          </button>
        </div>

        {responsable === OTRO && (
          <input
            type="text"
            className={styles.otroInput}
            placeholder="¿Quién?"
            value={otroResponsable}
            onChange={(e) => setOtroResponsable(e.target.value)}
            disabled={isLoading}
            autoFocus
            maxLength={60}
          />
        )}

        {ofrecerRehacer && (
          <label className={styles.rehacerBox}>
            <input
              type="checkbox"
              className={styles.rehacerCheck}
              checked={rehacer}
              onChange={(e) => setRehacer(e.target.checked)}
              disabled={isLoading}
            />
            <span>
              <strong>Voy a volver a montarlo</strong>
              <span className={styles.rehacerHint}>
                Se abre la pantalla de pedidos con los mismos productos cargados, para no
                tener que digitarlos otra vez ni correr el riesgo de olvidarlo.
              </span>
            </span>
          </label>
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
            onClick={() => onConfirm(motivoFinal, responsableFinal, rehacer)}
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
