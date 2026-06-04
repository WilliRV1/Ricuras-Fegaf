'use client';

import React, { useState, useEffect } from 'react';
import { CartItem as CartItemType } from '@/types';
import { Button } from '../ui/Button';
import { useCart } from '@/hooks/useCart';
import styles from './CartItem.module.css';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateQuantity, removeItem, updateNotes } = useCart();
  const [localNotes, setLocalNotes] = useState(item.notas || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Formateador de precios
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(item.producto.precio * item.cantidad);

  // Sincronizar notas locales si cambian externamente
  useEffect(() => {
    setLocalNotes(item.notas || '');
  }, [item.notas]);

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (localNotes.trim() !== (item.notas || '')) {
      updateNotes(item.producto.id, item.notas, localNotes.trim());
    }
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNotesBlur();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.productInfo}>
          <h4 className={styles.productName}>{item.producto.nombre}</h4>
          <span className={styles.price}>{formattedPrice}</span>
        </div>
        
        <button 
          className={styles.deleteBtn}
          onClick={() => removeItem(item.producto.id, item.notas)}
          aria-label="Eliminar producto"
          title="Eliminar del carrito"
        >
          🗑️
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.quantityControls}>
          <button 
            className={styles.qtyBtn} 
            onClick={() => updateQuantity(item.producto.id, item.notas, -1)}
            disabled={item.cantidad <= 1}
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className={styles.qtyValue}>{item.cantidad}</span>
          <button 
            className={styles.qtyBtn} 
            onClick={() => updateQuantity(item.producto.id, item.notas, 1)}
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

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
              <span className={styles.notesIcon}>📝</span>
              <span className={styles.notesText}>{item.notas}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
