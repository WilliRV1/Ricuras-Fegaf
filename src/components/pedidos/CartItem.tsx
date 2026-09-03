'use client';

import React, { useState, useEffect } from 'react';
import { CartItem as CartItemType } from '@/types';
import { useCart } from '@/hooks/useCart';
import { IconTrash, IconScissors, IconPencil } from '@/components/ui/Icons';
import styles from './CartItem.module.css';

interface CartItemProps {
  item: CartItemType;
  /** Posición de esta línea entre las líneas del mismo producto (1-based) */
  lineIndex?: number;
  /** Cuántas líneas del mismo producto hay en el carrito */
  lineTotal?: number;
}

export const CartItem: React.FC<CartItemProps> = ({ item, lineIndex = 1, lineTotal = 1 }) => {
  const { updateQuantity, removeItem, updateNotes, splitLine } = useCart();
  const [localNotes, setLocalNotes] = useState(item.notas || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Formateador de precios
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(item.producto.precio * item.cantidad);

  // Sincronizar notas locales si cambian externamente
  useEffect(() => {
    // eslint-disable-next-line
    setLocalNotes(item.notas || '');
  }, [item.notas]);

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (localNotes.trim() !== (item.notas || '')) {
      updateNotes(item.lineId, localNotes.trim());
    }
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNotesBlur();
    }
  };

  const handleRemove = () => {
    setIsExiting(true);
    // Esperar a que termine la animación antes de remover del estado
    setTimeout(() => {
      removeItem(item.lineId);
    }, 380);
  };

  return (
    <div className={`${styles.container} ${isExiting ? styles.exiting : ''}`}>
      <div className={styles.header}>
        <div className={styles.productInfo}>
          <h4 className={styles.productName}>
            {item.producto.nombre}
            {lineTotal > 1 && (
              <span className={styles.lineBadge} title="Línea independiente del mismo producto">
                #{lineIndex} de {lineTotal}
              </span>
            )}
          </h4>
          <span className={styles.price}>{formattedPrice}</span>
        </div>

        <button
          className={styles.deleteBtn}
          onClick={handleRemove}
          aria-label="Eliminar producto"
          title="Eliminar del carrito"
          disabled={isExiting}
        >
          <IconTrash size={16} />
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.quantityRow}>
          <div className={styles.quantityControls}>
            <button
              className={styles.qtyBtn}
              onClick={() => updateQuantity(item.lineId, -1)}
              disabled={item.cantidad <= 1 || isExiting}
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <span className={styles.qtyValue}>{item.cantidad}</span>
            <button
              className={styles.qtyBtn}
              onClick={() => updateQuantity(item.lineId, 1)}
              aria-label="Aumentar cantidad"
              disabled={isExiting}
            >
              +
            </button>
          </div>

          {/* Separar en unidades para poder anotar observaciones distintas */}
          {item.cantidad > 1 && (
            <button
              className={styles.splitBtn}
              onClick={() => splitLine(item.lineId)}
              disabled={isExiting}
              type="button"
              title="Separar en unidades para escribir observaciones distintas en cada una"
            >
              <IconScissors size={14} /> Separar en {item.cantidad}
            </button>
          )}
        </div>

        {item.cantidad > 1 && (
          <p className={styles.sharedNoteHint}>
            La observación aplica a las {item.cantidad} unidades. Usa &quot;Separar&quot; si cada una lleva algo distinto.
          </p>
        )}

        <div className={styles.notesContainer}>
          {isEditingNotes || !item.notas ? (
            <input
              type="text"
              className={styles.notesInput}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              onKeyDown={handleNotesKeyDown}
              placeholder="Añadir nota (ej. Sin cebolla)..."
              autoFocus={isEditingNotes}
            />
          ) : (
            <div
              className={styles.notesDisplay}
              onClick={() => setIsEditingNotes(true)}
              title="Haz clic para editar"
            >
              <span className={styles.notesIcon}><IconPencil size={14} /></span>
              <span className={styles.notesText}>{item.notas}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
