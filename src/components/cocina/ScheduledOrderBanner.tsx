'use client';

import React, { useState, useEffect } from 'react';
import { PedidoWithDetalles } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CancelOrderDialog } from '@/components/ui/CancelOrderDialog';
import { SIN_DATO } from '@/lib/constants';
import { markOrderAsReady, cancelOrder } from '@/app/actions/cocina';
import { toast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
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
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [errorCancelacion, setErrorCancelacion] = useState('');

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

  /** Confirmado en el diálogo — recién aquí se marca como listo */
  const handleReadyConfirmed = async () => {
    setIsSubmitting(true);
    try {
      const res = await markOrderAsReady(order.id);
      if (res.success) {
        toast.success(`Pedido #${order.id} marcado como listo`);
      } else {
        toast.error(res.error || 'Error al actualizar pedido');
        setIsSubmitting(false);
        setShowReadyConfirm(false);
      }
    } catch {
      toast.error('Error de red');
      setIsSubmitting(false);
      setShowReadyConfirm(false);
    }
  };

  const handleCancelConfirmed = async ({
    motivo,
    usuarioId,
    pin,
  }: {
    motivo: string;
    usuarioId: number;
    pin: string;
  }) => {
    setIsCancelling(true);
    setErrorCancelacion('');
    try {
      const res = await cancelOrder(order.id, motivo, usuarioId, pin);
      if (res.success) {
        toast.success(`Pedido #${order.id} cancelado`);
      } else {
        // El diálogo sigue abierto para volver a marcar el PIN
        setErrorCancelacion(res.error || 'Error al cancelar pedido');
        setIsCancelling(false);
      }
    } catch {
      setErrorCancelacion('Error de red');
      setIsCancelling(false);
    }
  };

  // Datos de entrega
  const direccionUtil =
    !!order.cliente_direccion && order.cliente_direccion.trim() !== SIN_DATO;
  const telefonoDigitos =
    order.cliente_telefono && order.cliente_telefono.trim() !== SIN_DATO
      ? order.cliente_telefono.replace(/\D/g, '')
      : '';

  // Efectivo: vuelta que hay que alistar antes de salir
  const tienePagaCon = !isMesa && order.paga_con != null;
  const vuelto = order.vuelto ?? 0;

  const totalUnidades = (order.detalle_pedidos ?? []).reduce(
    (acc, detalle) => acc + detalle.cantidad,
    0
  );

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
            <span className={styles.countdownSub}>
              {countdown && countdown.minutes < 0 ? 'debía entregarse a las' : 'para entregar a las'}{' '}
              <strong className={styles.horaFuerte}>{horaEntregaLabel}</strong>
            </span>
          </div>
        </div>

        {/* Info del pedido */}
        <div className={styles.orderInfo}>
          <div className={styles.orderHeader}>
            <span className={styles.orderId}>#{order.id}</span>
            <span className={styles.scheduledTag}>📅 {horaEntregaLabel}</span>
            {order.modificado_at && (
              <span className={styles.modificadoTag}>🔄 MODIFICADO</span>
            )}
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
          {/* Dirección y teléfono — el domiciliario los necesita */}
          {!isMesa && (
            <div className={styles.entregaRow}>
              <span className={styles.entregaDireccion}>
                📍{' '}
                {direccionUtil ? (
                  <a
                    className={styles.entregaLink}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.cliente_direccion!)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {order.cliente_direccion}
                  </a>
                ) : (
                  order.cliente_direccion || 'Sin dirección'
                )}
              </span>
              {telefonoDigitos && (
                <a className={styles.entregaLink} href={`tel:${telefonoDigitos}`}>
                  📞 {order.cliente_telefono}
                </a>
              )}
            </div>
          )}

          {tienePagaCon && (
            <div className={styles.efectivoRow}>
              💵 Paga con <strong>{formatCurrency(order.paga_con!)}</strong>
              {vuelto > 0 ? (
                <> · alistar vuelta <strong>{formatCurrency(vuelto)}</strong></>
              ) : (
                <> · paga completo</>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          className={styles.readyBtn}
          onClick={() => setShowReadyConfirm(true)}
          disabled={isSubmitting || isCancelling}
        >
          {isSubmitting ? '...' : '✅ Listo'}
        </Button>
        <button
          className={styles.cancelBtn}
          onClick={() => setShowCancelDialog(true)}
          disabled={isSubmitting || isCancelling}
        >
          {isCancelling ? '...' : 'Cancelar'}
        </button>
      </div>

      {/* Cancelar con motivo tipificado */}
      <CancelOrderDialog
        isOpen={showCancelDialog}
        errorServidor={errorCancelacion}
        orderId={order.id}
        isLoading={isCancelling}
        onConfirm={handleCancelConfirmed}
        onCancel={() => setShowCancelDialog(false)}
      />

      {/* Confirmación antes de sacarlo del tablero */}
      <ConfirmDialog
        isOpen={showReadyConfirm}
        title={`¿Marcar el pedido #${order.id} como listo?`}
        message={
          <>
            📅 Programado para las <strong>{horaEntregaLabel}</strong> · {totalUnidades} producto
            {totalUnidades !== 1 ? 's' : ''}.
            <br />
            Saldrá del tablero de cocina y pasará a liquidación.
          </>
        }
        confirmLabel="Sí, está listo"
        cancelLabel="Todavía no"
        isLoading={isSubmitting}
        onConfirm={handleReadyConfirmed}
        onCancel={() => setShowReadyConfirm(false)}
      />
    </div>
  );
};
