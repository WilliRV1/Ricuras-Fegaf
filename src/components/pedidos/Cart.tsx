'use client';

/**
 * Cart — Panel lateral del carrito de compras.
 *
 * Lógica de método de pago:
 * - **Domicilio**: el cliente elige el método AHORA (antes de enviar).
 *   Si elige "Datáfono" se muestra y aplica el recargo del 5%.
 * - **Mesa**: el pago se gestiona al final de la estadía en `/liquidacion`.
 *   En este panel no se muestra selector de pago para mesa.
 */

import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { CartItem as CartItemComponent } from './CartItem';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { METODOS_PAGO, RECARGO_DATAFONO } from '@/lib/constants';
import { MetodoPago, OrderType } from '@/types';
import styles from './Cart.module.css';

interface CartProps {
  orderType: OrderType;
  onEnviarCocina?: (metodoPago: MetodoPago) => Promise<void>;
  isValidOrder?: boolean;
}

const METODO_LABELS: Record<string, { label: string; icon: string }> = {
  efectivo:    { label: 'Efectivo',    icon: '💵' },
  nequi:       { label: 'Nequi',       icon: '📱' },
  datafono:    { label: 'Datáfono',    icon: '💳' },
  bancolombia: { label: 'Bancolombia', icon: '🏦' },
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);

export const Cart: React.FC<CartProps> = ({
  orderType,
  onEnviarCocina,
  isValidOrder = true,
}) => {
  const { items, subtotal, totalItems, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(null);

  // El recargo solo aplica para domicilio + datáfono
  const aplicaRecargo =
    orderType === 'domicilio' && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? subtotal * RECARGO_DATAFONO : 0;
  const total = subtotal + recargo;

  // Para domicilio, el método de pago es requerido para poder enviar
  const isPagoValido = orderType === 'domicilio' ? metodoPago !== null : true;

  const handleEnviar = async () => {
    if (!isValidOrder) {
      toast.error('Completa los datos del pedido antes de enviar a cocina.');
      return;
    }
    if (!isPagoValido) {
      toast.error('Selecciona el método de pago para el domicilio.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onEnviarCocina) {
        await onEnviarCocina(orderType === 'domicilio' ? metodoPago : null);
      } else {
        await new Promise((res) => setTimeout(res, 800));
      }
      toast.success('Pedido enviado a cocina exitosamente 👨‍🍳');
      clearCart();
      setMetodoPago(null);
    } catch (error) {
      toast.error('Ocurrió un error al enviar el pedido.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estado vacío
  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>🛒</div>
        <h3 className={styles.emptyTitle}>Tu carrito está vacío</h3>
        <p className={styles.emptyText}>
          Agrega productos del menú para comenzar tu pedido.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Resumen del Pedido</h3>
        <span className={styles.badge}>
          {totalItems} ítem{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista de ítems */}
      <div className={styles.itemsList}>
        {items.map((item, idx) => (
          <CartItemComponent key={`${item.producto.id}-${item.notas ?? ''}-${idx}`} item={item} />
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>

        {/* ── Selector de método de pago (solo domicilio) ── */}
        {orderType === 'domicilio' && (
          <div className={styles.paymentSection}>
            <p className={styles.paymentLabel}>
              <span className={styles.paymentIcon}>💳</span>
              Método de pago
            </p>
            <div className={styles.paymentOptions}>
              {Object.entries(METODO_LABELS).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  className={`${styles.paymentOption} ${
                    metodoPago === key ? styles.paymentSelected : ''
                  }`}
                  onClick={() => setMetodoPago(key as MetodoPago)}
                  disabled={isSubmitting}
                  type="button"
                >
                  <span className={styles.paymentOptionIcon}>{icon}</span>
                  <span className={styles.paymentOptionLabel}>{label}</span>
                  {key === METODOS_PAGO.DATAFONO && (
                    <span className={styles.recargoTag}>+5%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Resumen de totales ── */}
        <div className={styles.totals}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Subtotal:</span>
            <span className={styles.summaryValue}>{formatCOP(subtotal)}</span>
          </div>

          {aplicaRecargo && (
            <div className={`${styles.summaryRow} ${styles.recargoRow}`}>
              <span className={styles.summaryLabel}>
                Recargo datáfono (5%):
              </span>
              <span className={`${styles.summaryValue} ${styles.recargoValue}`}>
                + {formatCOP(recargo)}
              </span>
            </div>
          )}

          {(aplicaRecargo) && (
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span className={styles.totalLabel}>Total:</span>
              <span className={styles.totalValue}>{formatCOP(total)}</span>
            </div>
          )}
        </div>

        {/* ── Aviso: mesa paga al final ── */}
        {orderType === 'mesa' && (
          <p className={styles.mesaNotice}>
            🍽️ El pago se registra al cerrar la cuenta en la mesa.
          </p>
        )}

        {/* ── Acciones ── */}
        <div className={styles.actions}>
          <button
            className={styles.clearBtn}
            onClick={clearCart}
            disabled={isSubmitting}
            type="button"
          >
            Limpiar
          </button>

          <Button
            className={styles.submitBtn}
            variant="primary"
            size="md"
            onClick={handleEnviar}
            disabled={isSubmitting || !isValidOrder || !isPagoValido}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar a Cocina'}
          </Button>
        </div>
      </div>
    </div>
  );
};
