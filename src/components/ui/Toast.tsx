'use client';

/**
 * Toast — Sistema de notificaciones flotantes reutilizable.
 *
 * ## Uso
 * 1. Renderizar `<ToastContainer />` una sola vez en el layout o página.
 * 2. Llamar a `toast.success(msg)`, `toast.error(msg)`, etc., desde cualquier componente.
 *
 * Internamente usa un store ligero con `useSyncExternalStore` (zero deps).
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { IconCheck, IconX, IconInfo } from './Icons';
import styles from './Toast.module.css';

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: React.ReactNode;
  variant: ToastVariant;
  duration: number;   // ms — cuanto tiempo permanece visible
}

/* ------------------------------------------------------------------ */
/*  Store externo (singleton)                                         */
/* ------------------------------------------------------------------ */

let toasts: ToastItem[] = [];
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

function addToast(item: Omit<ToastItem, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [...toasts, { ...item, id }];
  emitChange();
  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitChange();
}

/* ------------------------------------------------------------------ */
/*  API pública: importa `toast` y llama a sus métodos                */
/* ------------------------------------------------------------------ */

const DEFAULT_DURATION = 3000; // 3 segundos

/**
 * API para mostrar notificaciones toast.
 *
 * @example
 * ```ts
 * import { toast } from '@/components/ui/Toast';
 *
 * toast.success(<>Agregado: <b>Hamburguesa</b></>);
 * toast.error('No se pudo enviar el pedido');
 * toast.info('Nuevo pedido recibido');
 * ```
 */
export const toast = {
  success(message: React.ReactNode, duration = DEFAULT_DURATION) {
    return addToast({ message, variant: 'success', duration });
  },
  error(message: React.ReactNode, duration = DEFAULT_DURATION) {
    return addToast({ message, variant: 'error', duration });
  },
  info(message: React.ReactNode, duration = DEFAULT_DURATION) {
    return addToast({ message, variant: 'info', duration });
  },
  dismiss(id: string) {
    removeToast(id);
  },
};

/* ------------------------------------------------------------------ */
/*  Componente individual de Toast                                    */
/* ------------------------------------------------------------------ */

const VARIANT_ICONS: Record<ToastVariant, React.ComponentType<{ size?: number }>> = {
  success: IconCheck,
  error: IconX,
  info: IconInfo,
};

function ToastItemComponent({ item }: { item: ToastItem }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => removeToast(item.id), 280); // Coincidir con la duración de la animación de salida
  }, [item.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, handleDismiss]);

  const iconClass = [
    styles.icon,
    item.variant === 'success' ? styles.iconSuccess : '',
    item.variant === 'error' ? styles.iconError : '',
    item.variant === 'info' ? styles.iconInfo : '',
  ]
    .filter(Boolean)
    .join(' ');

  const progressClass = [
    styles.progressBar,
    item.variant === 'success' ? styles.progressBarSuccess : '',
    item.variant === 'error' ? styles.progressBarError : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.exiting : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className={iconClass}>
        {(() => {
          const IconComp = VARIANT_ICONS[item.variant];
          return <IconComp size={18} />;
        })()}
      </span>
      <span className={styles.message}>{item.message}</span>
      <button className={styles.closeButton} onClick={handleDismiss} aria-label="Cerrar notificación">
        ×
      </button>
      <span
        className={progressClass}
        style={{ '--toast-duration': `${item.duration}ms` } as React.CSSProperties}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contenedor (montado una sola vez)                                 */
/* ------------------------------------------------------------------ */

/**
 * Renderizar `<ToastContainer />` una sola vez, típicamente en el layout principal.
 * Este componente escucha el store global y renderiza los toasts activos.
 */
export function ToastContainer() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (currentToasts.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-label="Notificaciones">
      {currentToasts.map((item) => (
        <ToastItemComponent key={item.id} item={item} />
      ))}
    </div>
  );
}
