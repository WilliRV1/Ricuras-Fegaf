'use client';

import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { CartItem } from './CartItem';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import styles from './Cart.module.css';

interface CartProps {
  onEnviarCocina?: () => void;
  isValidOrder?: boolean; // Prop para saber si el formulario (paso 1 y 2) está completo
}

export const Cart: React.FC<CartProps> = ({ onEnviarCocina, isValidOrder = true }) => {
  const { items, subtotal, totalItems, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedSubtotal = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(subtotal);

  const handleEnviar = async () => {
    if (!isValidOrder) {
      toast.error('Completa los datos del pedido antes de enviar a cocina.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (onEnviarCocina) {
        await onEnviarCocina();
      } else {
        await new Promise(res => setTimeout(res, 1000));
      }
      toast.success('Pedido enviado a cocina exitosamente 👨‍🍳');
      clearCart();
    } catch (error) {
      toast.error('Ocurrió un error al enviar el pedido.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>🛒</div>
        <h3 className={styles.emptyTitle}>Tu carrito está vacío</h3>
        <p className={styles.emptyText}>Agrega productos del menú para comenzar tu pedido.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Resumen del Pedido</h3>
        <span className={styles.badge}>{totalItems} ítem{totalItems !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.itemsList}>
        {items.map((item, idx) => (
          // Usamos idx como parte del key por si hay items repetidos pero no deberían haber gracias a cómo agrupamos
          <CartItem key={`${item.producto.id}-${idx}`} item={item} />
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Subtotal:</span>
          <span className={styles.summaryValue}>{formattedSubtotal}</span>
        </div>
        
        {/* Aquí en el futuro se podrían agregar Recargos (Domicilio) */}

        <div className={styles.actions}>
          <button 
            className={styles.clearBtn} 
            onClick={clearCart}
            disabled={isSubmitting}
          >
            Limpiar
          </button>
          
          <Button 
            className={styles.submitBtn}
            variant="primary" 
            size="md" 
            onClick={handleEnviar}
            disabled={isSubmitting || !isValidOrder}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar a Cocina'}
          </Button>
        </div>
      </div>
    </div>
  );
};
