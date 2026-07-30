'use client';

import React, { useState, useEffect } from 'react';
import { PedidoWithDetalles } from '@/types';
import { Button } from '@/components/ui/Button';
import { markOrderAsReady, cancelOrder } from '@/app/actions/cocina';
import { toast } from '@/components/ui/Toast';
import styles from './ScheduledOrderBanner.module.css';

interface ScheduledOrderBannerProps {
  order: PedidoWithDetalles;
}

function getCountdown(horaEntrega: string): { minutes: number; label: string; urgency: 'normal' | 'warning' | 'danger' } {
  const target = new Date(horaEntrega).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 0) {
    return { minutes, label: `VENCIDO hace ${Math.abs(minutes)} min`, urgency: 'danger' };
  }

  if (minutes < 60) {
    return { minutes, label: `${minutes} min`, urgency: minutes <= 15 ? 'danger' : minutes <= 45 ? 'warning' : 'normal' };
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    minutes,
    label: `${hours}h ${mins > 0 ? `${mins}m` : ''}`,
    urgency: 'normal'
  };
}

export const ScheduledOrderBanner: React.FC<ScheduledOrderBannerProps> = ({ order }) => {
  const [countdown, setCountdown] = useState(() =>
    order.hora_entrega ? getCountdown(order.hora_entrega) : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!order.hora_entrega) return;
    const update = () => setCountdown(getCountdown(order.hora_entrega!));
    update();
    const interval = setInterval(update, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [order.hora_entrega]);

  const horaEntregaLabel = order.hora_entrega
    ? new Date(order.hora_entrega).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota',
      })
    : '';

  const isMesa = order.tipo === 'mesa';
  const urgency = countdown?.urgency ?? 'normal';

  const handleReady = async () => {
    setIsSubmitting(true);
    try {
      const res = await markOrderAsReady(order.id);
      if (res.success) {
        toast.success(`Pedido #${order.id} marcado como listo`);
      } else {
        toast.error(res.error || 'Error al actualizar pedido');
        setIsSubmitting(false);
      }
    } catch {
      toast.error('Error de red');
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt(`¿Por qué deseas cancelar el pedido #${order.id}? (Obligatorio)`);
    if (reason === null) return;
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
    } catch {
      toast.error('Error de red');
      setIsCancelling(false);
    }
  };

  return (
    <div className={`${styles.banner} ${styles[`banner_${urgency}`]}`}>
      {/* Pulso de atención (solo en warning/danger) */}
      {urgency !== 'normal' && <div className={styles.pulse} />}

      <div className={styles.leftSection}>
        {/* Icono de reloj + countdown */}
        <div className={`${styles.countdownBadge} ${styles[`badge_${urgency}`]}`}>
          <span className={styles.clockIcon}>⏰</span>
          <div className={styles.countdownText}>
            <span className={styles.countdownValue}>{countdown?.label ?? '—'}</span>
            <span className={styles.countdownSub}>para entrega a las {horaEntregaLabel}</span>
          </div>
        </div>

        {/* Info del pedido */}
        <div className={styles.orderInfo}>
          <div className={styles.orderHeader}>
            <span className={styles.orderId}>#{order.id}</span>
            <span className={styles.scheduledTag}>📅 PROGRAMADO</span>
            <span className={styles.orderType}>
              {isMesa ? `🍽️ Mesa ${order.numero_mesa}` : `🛵 ${order.cliente_nombre || 'Domicilio'}`}
            </span>
          </div>
          <div className={styles.itemsList}>
            {order.detalle_pedidos?.map((detalle, idx) => (
              <span key={idx} className={styles.item}>
                {detalle.cantidad}x {detalle.productos?.nombre || 'Producto'}
                {detalle.notas && <em className={styles.itemNote}> — {detalle.notas}</em>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          className={styles.readyBtn}
          onClick={handleReady}
          disabled={isSubmitting || isCancelling}
        >
          {isSubmitting ? '...' : '✅ Listo'}
        </Button>
        <button
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={isSubmitting || isCancelling}
        >
          {isCancelling ? '...' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
};
