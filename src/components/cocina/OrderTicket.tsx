import React, { useState, useEffect } from 'react';
import { PedidoWithDetalles } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CancelOrderDialog } from '@/components/ui/CancelOrderDialog';
import { markOrderAsReady, cancelOrder } from '@/app/actions/cocina';
import { toast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import { SIN_DATO } from '@/lib/constants';
import styles from './OrderTicket.module.css';

interface OrderTicketProps {
  order: PedidoWithDetalles;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ order }) => {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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

  /** Confirmado en el diálogo — recién aquí se marca como listo */
  const handleReadyConfirmed = async () => {
    setIsSubmitting(true);
    try {
      const res = await markOrderAsReady(order.id);
      if (res.success) {
        toast.success(`Pedido #${order.id} marcado como listo`);
      } else {
        toast.error(res.error || 'Error al actualizar pedido');
        setIsSubmitting(false); // Only re-enable if there's an error, otherwise it unmounts
        setShowReadyConfirm(false);
      }
    } catch {
      toast.error('Error de red');
      setIsSubmitting(false);
      setShowReadyConfirm(false);
    }
  };

  const handleCancelConfirmed = async (motivo: string) => {
    setIsCancelling(true);
    try {
      const res = await cancelOrder(order.id, motivo);
      if (res.success) {
        toast.success(`Pedido #${order.id} cancelado`);
      } else {
        toast.error(res.error || 'Error al cancelar pedido');
        setIsCancelling(false);
        setShowCancelDialog(false);
      }
    } catch {
      toast.error('Error de red');
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  let timerClass = styles.timerNormal;
  let ticketClass = '';
  if (elapsedMinutes >= 25) {
    timerClass = styles.timerDanger;
    ticketClass = styles.ticketDanger;
  } else if (elapsedMinutes >= 15) {
    timerClass = styles.timerWarning;
    ticketClass = styles.ticketWarning;
  }

  const isMesa = order.tipo === 'mesa';
  const headerIcon = isMesa ? '🍽️' : '🛵';
  const headerText = isMesa
    ? `Mesa #${order.numero_mesa}`
    : `Domicilio`;

  // El pedido se modificó después de enviarlo: cocina debe releerlo
  const fueModificado = !!order.modificado_at;
  const horaModificacion = order.modificado_at
    ? new Date(order.modificado_at).toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Datos de entrega: la dirección solo es "útil" si el cliente la dio de verdad
  const direccionUtil =
    !!order.cliente_direccion && order.cliente_direccion.trim() !== SIN_DATO;
  const telefonoDigitos =
    order.cliente_telefono && order.cliente_telefono.trim() !== SIN_DATO
      ? order.cliente_telefono.replace(/\D/g, '')
      : '';

  // Efectivo: el domiciliario necesita salir con la vuelta ya alistada
  const tienePagaCon = !isMesa && order.paga_con != null;
  const vuelto = order.vuelto ?? 0;

  const totalUnidades = (order.detalle_pedidos ?? []).reduce(
    (acc, detalle) => acc + detalle.cantidad,
    0
  );

  return (
    <div className={`${styles.ticket} ${ticketClass} ${fueModificado ? styles.ticketModificado : ''}`}>
      {fueModificado && (
        <div className={styles.modificadoBanner}>
          🔄 PEDIDO MODIFICADO — vuelve a leer la comanda
          <span className={styles.modificadoHora}>{horaModificacion}</span>
        </div>
      )}

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

      {/* Datos de entrega — lo que el domiciliario necesita para salir */}
      {!isMesa && (
        <div className={styles.domicilioBox}>
          <div className={styles.domicilioDireccion}>
            <span className={styles.domicilioIcon}>📍</span>
            {direccionUtil ? (
              <a
                className={styles.direccionLink}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.cliente_direccion!)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en Google Maps"
              >
                {order.cliente_direccion}
              </a>
            ) : (
              <span className={styles.direccionFaltante}>
                {order.cliente_direccion || 'Sin dirección registrada'}
              </span>
            )}
          </div>

          <div className={styles.domicilioMeta}>
            {telefonoDigitos ? (
              <a className={styles.telLink} href={`tel:${telefonoDigitos}`}>
                📞 {order.cliente_telefono}
              </a>
            ) : (
              <span className={styles.domicilioSinDato}>📞 Sin teléfono</span>
            )}

            <span className={styles.cobrarTag}>
              💰 Cobrar {formatCurrency(order.total)}
              {order.costo_domicilio > 0 && (
                <span className={styles.cobrarExtra}>
                  (incl. {formatCurrency(order.costo_domicilio)} de domicilio)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Efectivo — con cuánto paga y vuelta que hay que alistar */}
      {tienePagaCon && (
        <div className={styles.efectivoBanner}>
          <span className={styles.efectivoIcon}>💵</span>
          <div className={styles.efectivoText}>
            <span>Paga con <strong>{formatCurrency(order.paga_con!)}</strong></span>
            <span className={styles.vueltoValue}>
              {vuelto > 0 ? <>Alistar vuelta: <strong>{formatCurrency(vuelto)}</strong></> : 'Paga completo — sin vuelta'}
            </span>
          </div>
        </div>
      )}

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
          onClick={() => setShowCancelDialog(true)}
          disabled={isSubmitting || isCancelling}
          style={{ backgroundColor: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger)' }}
        >
          {isCancelling ? '...' : 'Cancelar'}
        </Button>
        <Button
          variant="primary"
          className={styles.readyBtn}
          onClick={() => setShowReadyConfirm(true)}
          disabled={isSubmitting || isCancelling}
        >
          {isSubmitting ? '...' : 'Pedido Listo'}
        </Button>
      </div>

      {/* Confirmación antes de sacar la comanda del tablero */}
      <ConfirmDialog
        isOpen={showReadyConfirm}
        title={`¿Marcar el pedido #${order.id} como listo?`}
        message={
          <>
            {isMesa ? `🍽️ Mesa #${order.numero_mesa}` : '🛵 Domicilio'} · {totalUnidades} producto
            {totalUnidades !== 1 ? 's' : ''}.
            <br />
            La comanda desaparecerá del tablero de cocina y pasará a liquidación.
          </>
        }
        confirmLabel="Sí, está listo"
        cancelLabel="Todavía no"
        isLoading={isSubmitting}
        onConfirm={handleReadyConfirmed}
        onCancel={() => setShowReadyConfirm(false)}
      />

      {/* Cancelar con motivo tipificado */}
      <CancelOrderDialog
        isOpen={showCancelDialog}
        orderId={order.id}
        isLoading={isCancelling}
        onConfirm={handleCancelConfirmed}
        onCancel={() => setShowCancelDialog(false)}
      />
    </div>
  );
};
