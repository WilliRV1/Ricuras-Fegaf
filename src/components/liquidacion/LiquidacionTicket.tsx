'use client';

import React, { useState } from 'react';
import { PedidoWithDetalles } from '@/types';
import { TIPOS_ATENCION, METODOS_PAGO, RECARGO_DATAFONO } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { closeOrder } from '@/app/actions/liquidacion';
import { toast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import styles from './LiquidacionTicket.module.css';

interface LiquidacionTicketProps {
  order: PedidoWithDetalles;
}

export const LiquidacionTicket: React.FC<LiquidacionTicketProps> = ({ order }) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMesa = order.tipo === TIPOS_ATENCION.MESA;
  
  // Calcular valores en cliente para previsualizar
  const subtotal = order.subtotal;
  let recargo = 0;
  
  if (selectedMethod === METODOS_PAGO.DATAFONO) {
    // Si ya tenía recargo desde el pedido (ej. domicilio con datáfono)
    if (order.recargo > 0) {
      recargo = order.recargo;
    } else {
      recargo = Math.round(subtotal * RECARGO_DATAFONO);
    }
  }

  const totalCalculado = subtotal + recargo;

  const handleConfirm = async () => {
    if (!selectedMethod) {
      toast.error('Selecciona un método de pago');
      return;
    }

    if (!window.confirm(`¿Confirmar cobro por ${formatCurrency(totalCalculado)}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await closeOrder(order.id, selectedMethod);
      if (res.success) {
        toast.success(`Pedido #${order.id} liquidado correctamente`);
      } else {
        toast.error(res.error || 'Error al liquidar pedido');
        setIsSubmitting(false);
      }
    } catch {
      toast.error('Error al cerrar el pedido');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <div className={styles.idAndType}>
          <h3 className={styles.orderId}>Pedido #{order.id}</h3>
          <span className={styles.orderType}>
            {isMesa ? `🍽️ Mesa ${order.numero_mesa}` : '🛵 Domicilio'}
          </span>
          {!isMesa && order.cliente_nombre && (
            <span className={styles.clientName}>{order.cliente_nombre}</span>
          )}
        </div>
      </div>

      <div className={styles.itemsList}>
        {order.detalle_pedidos?.map((detalle) => (
          <div key={detalle.id} className={styles.itemRow}>
            <div>
              <span className={styles.itemQty}>{detalle.cantidad}x</span>
              <span>{detalle.productos?.nombre || 'Producto eliminado'}</span>
            </div>
            <span className={styles.itemPrice}>
              {formatCurrency(detalle.precio_unitario * detalle.cantidad)}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {recargo > 0 && (
          <div className={styles.summaryRow} style={{ color: 'var(--color-warning)' }}>
            <span>Recargo Datáfono (5%)</span>
            <span>+ {formatCurrency(recargo)}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <span>Total a Cobrar</span>
          <span>{formatCurrency(totalCalculado)}</span>
        </div>
      </div>

      <div className={styles.paymentSection}>
        <span className={styles.paymentLabel}>Método de Pago:</span>
        <div className={styles.methods}>
          <button
            className={`${styles.methodBtn} ${selectedMethod === METODOS_PAGO.EFECTIVO ? styles.methodBtnActive : ''}`}
            onClick={() => setSelectedMethod(METODOS_PAGO.EFECTIVO)}
          >
            💵 Efectivo
          </button>
          <button
            className={`${styles.methodBtn} ${selectedMethod === METODOS_PAGO.NEQUI ? styles.methodBtnActive : ''}`}
            onClick={() => setSelectedMethod(METODOS_PAGO.NEQUI)}
          >
            📱 Nequi
          </button>
          <button
            className={`${styles.methodBtn} ${selectedMethod === METODOS_PAGO.DATAFONO ? styles.methodBtnActive : ''}`}
            onClick={() => setSelectedMethod(METODOS_PAGO.DATAFONO)}
            data-method="datafono"
          >
            💳 Datáfono
          </button>
        </div>

        <Button
          variant="primary"
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={!selectedMethod || isSubmitting}
        >
          {isSubmitting ? 'Procesando...' : 'Cobrar'}
        </Button>
      </div>
    </div>
  );
};
