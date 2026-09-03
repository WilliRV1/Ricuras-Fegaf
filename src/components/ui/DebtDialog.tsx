'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/utils';
import { IconBanknote } from '@/components/ui/Icons';
import styles from './DebtDialog.module.css';

interface DebtDialogProps {
  isOpen: boolean;
  orderId: number;
  /** Valor de la deuda, para que quede claro cuánto se está fiando */
  monto: number;
  /** Nombre sugerido (ej. el del domicilio), si el pedido ya trae uno */
  nombreSugerido?: string | null;
  isLoading?: boolean;
  onConfirm: (nombre: string, telefono: string) => void;
  onCancel: () => void;
}

/**
 * Diálogo para registrar una deuda con el nombre de quien queda debiendo.
 *
 * El nombre es obligatorio a propósito: una deuda guardada como "pedido #156,
 * $71.000" no se puede cobrar porque nadie se acuerda de quién era. El
 * teléfono es opcional.
 */
export const DebtDialog: React.FC<DebtDialogProps> = ({
  isOpen,
  orderId,
  monto,
  nombreSugerido,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  // Al abrirse, precargar el nombre que ya tenga el pedido. Se ajusta durante
  // el render (patrón recomendado por React) para no encadenar renders.
  const [estabaAbierto, setEstabaAbierto] = useState(isOpen);
  if (isOpen !== estabaAbierto) {
    setEstabaAbierto(isOpen);
    if (isOpen) {
      setNombre(nombreSugerido ?? '');
      setTelefono('');
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

  const nombreLimpio = nombre.trim();
  const puedeConfirmar = nombreLimpio.length > 0 && !isLoading;

  const confirmar = () => {
    if (!puedeConfirmar) return;
    onConfirm(nombreLimpio, telefono.trim());
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>
          <IconBanknote size={20} style={{ verticalAlign: '-4px', marginRight: '8px' }} />
          ¿Quién queda debiendo?
        </h3>

        <div className={styles.resumen}>
          Pedido <strong>#{orderId}</strong> · <strong>{formatCurrency(monto)}</strong>
        </div>

        <p className={styles.aviso}>
          Esta plata <strong>no cuenta como cobrada</strong>, pero sí queda en la venta del
          día y se arrastra en la cartera hasta que la marques como pagada.
        </p>

        <label className={styles.label} htmlFor={`deudor-nombre-${orderId}`}>
          Nombre <span className={styles.requerido}>*</span>
        </label>
        <input
          id={`deudor-nombre-${orderId}`}
          type="text"
          className={styles.input}
          placeholder="Ej: William Reyes"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
          }}
          disabled={isLoading}
          autoFocus
          maxLength={120}
        />

        <label className={styles.label} htmlFor={`deudor-telefono-${orderId}`}>
          Teléfono <span className={styles.opcional}>(opcional)</span>
        </label>
        <input
          id={`deudor-telefono-${orderId}`}
          type="tel"
          inputMode="tel"
          className={styles.input}
          placeholder="Ej: 300 123 4567"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
          }}
          disabled={isLoading}
          maxLength={40}
        />

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
            onClick={confirmar}
            disabled={!puedeConfirmar}
          >
            {isLoading ? 'Guardando...' : 'Registrar deuda'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
