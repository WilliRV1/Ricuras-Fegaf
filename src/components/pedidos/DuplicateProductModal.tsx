'use client';

import React from 'react';
import { Producto } from '@/types';
import styles from './DuplicateProductModal.module.css';

interface DuplicateProductModalProps {
  producto: Producto;
  onAddNew: () => void;
  onAddToExisting: () => void;
  onCancel: () => void;
}

/**
 * Modal que aparece cuando el usuario intenta agregar un producto
 * que ya existe en el carrito, permitiéndole elegir si:
 * - Suma una unidad más al item existente
 * - Agrega como un item nuevo independiente (para personalizar distinto)
 */
export const DuplicateProductModal: React.FC<DuplicateProductModalProps> = ({
  producto,
  onAddNew,
  onAddToExisting,
  onCancel,
}) => {
  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon}>🍔</span>
          <h3 className={styles.title}>{producto.nombre}</h3>
          <p className={styles.subtitle}>
            Ya está en tu pedido. ¿Qué deseas hacer?
          </p>
        </div>

        <div className={styles.options}>
          {/* Opción: sumar al existente */}
          <button className={`${styles.optionBtn} ${styles.optionSum}`} onClick={onAddToExisting}>
            <span className={styles.optionIcon}>➕</span>
            <div className={styles.optionText}>
              <strong>Agregar uno más</strong>
              <span>Suma una unidad al que ya está en el pedido</span>
            </div>
          </button>

          {/* Opción: agregar independiente */}
          <button className={`${styles.optionBtn} ${styles.optionNew}`} onClick={onAddNew}>
            <span className={styles.optionIcon}>📝</span>
            <div className={styles.optionText}>
              <strong>Con condiciones distintas</strong>
              <span>Agrega como ítem separado para personalizarlo diferente</span>
            </div>
          </button>
        </div>

        <button className={styles.cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
};
