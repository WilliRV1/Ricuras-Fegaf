import React, { useState, useEffect } from 'react';
import { PedidoWithDetalles } from '@/types';
import { Button } from '@/components/ui/Button';
import { markOrderAsReady, cancelOrder } from '@/app/actions/cocina';
import { toast } from '@/components/ui/Toast';
import styles from './OrderTicket.module.css';

interface OrderTicketProps {
  order: PedidoWithDetalles;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ order }) => {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const createdTime = new Date(order.created_at).getTime();
      const now = Date.now();
      const diffMs = now - createdTime;
      const minutes = Math.floor(diffMs / 60000);
      setElapsedMinutes(Math.max(0, minutes));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [order.created_at]);

  const handleReady = async () => {
    setIsSubmitting(true);
    try {
      const res = await markOrderAsReady(order.id);
      if (res.success) {
        toast.success(`Pedido #${order.id} marcado como listo`);
      } else {
        toast.error(res.error || 'Error al actualizar pedido');
        setIsSubmitting(false); // Only re-enable if there's an error, otherwise it unmounts
      }
    } catch (err) {
      toast.error('Error de red');
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt(`¿Por qué deseas cancelar el pedido #${order.id}? (Obligatorio)`);
    if (reason === null) return; // Usuario clickeó cancelar en el prompt
    if (reason.trim() === '') {
      toast.error('Debes ingresar un motivo para cancelar el pedido');
      return;
    }
    
    setIsCancelling(true);
    try {
      const res = await cancelOrder(order.id, reason.trim());
      if (res.success) {
        toast.success(`Pedido #${order.id} cancelado`);
      } else {
        toast.error(res.error || 'Error al cancelar pedido');
        setIsCancelling(false);
      }
    } catch (err) {
      toast.error('Error de red');
      setIsCancelling(false);
    }
  };

  let timerClass = styles.timerNormal;
  if (elapsedMinutes >= 15) {
    timerClass = styles.timerDanger;
  } else if (elapsedMinutes >= 10) {
    timerClass = styles.timerWarning;
  }

  const isMesa = order.tipo === 'mesa';
  const headerIcon = isMesa ? '🍽️' : '🛵';
  const headerText = isMesa 
    ? `Mesa #${order.numero_mesa}` 
    : `Domicilio`;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <div className={styles.idAndType}>
          <h4 className={styles.orderId}>Orden #{order.id}</h4>
          <span className={styles.orderType}>
            {headerIcon} {headerText}
          </span>
          {!isMesa && order.cliente_nombre && (
            <span className={styles.clientName}>👤 {order.cliente_nombre}</span>
          )}
        </div>
        <div className={`${styles.timer} ${timerClass}`}>
          ⏱️ {elapsedMinutes} min
        </div>
      </div>

      <div className={styles.itemsList}>
        {order.detalle_pedidos?.map((detalle, idx) => {
          const hasNotes = !!detalle.notas && detalle.notas.trim().length > 0;
          return (
            <div 
              key={`${detalle.id}-${idx}`} 
              className={`${styles.itemRow} ${hasNotes ? styles.itemRowHasNotes : ''}`}
            >
              <div className={styles.itemMain}>
                <span className={styles.itemQty}>{detalle.cantidad}x</span>
                <span className={styles.itemName}>{detalle.productos?.nombre || 'Producto'}</span>
              </div>
              {hasNotes && (
                <div className={styles.itemNotes}>
                  <span className={styles.noteIcon}>⚠️</span>
                  <span>{detalle.notas}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <Button 
          variant="secondary" 
          className={styles.cancelBtn} 
          onClick={handleCancel}
          disabled={isSubmitting || isCancelling}
          style={{ backgroundColor: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger)' }}
        >
          {isCancelling ? '...' : 'Cancelar'}
        </Button>
        <Button 
          variant="primary" 
          className={styles.readyBtn} 
          onClick={handleReady}
          disabled={isSubmitting || isCancelling}
        >
          {isSubmitting ? '...' : 'Pedido Listo'}
        </Button>
      </div>
    </div>
  );
};
