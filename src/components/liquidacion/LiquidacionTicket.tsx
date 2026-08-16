'use client';

import React, { useState } from 'react';
import { PedidoWithDetalles } from '@/types';
import { TIPOS_ATENCION, METODOS_PAGO, SIN_DATO } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { CancelOrderDialog } from '@/components/ui/CancelOrderDialog';
import { closeOrder, markOrderAsDebe } from '@/app/actions/liquidacion';
import { cancelOrder } from '@/app/actions/cocina';
import { toast } from '@/components/ui/Toast';
import { formatCurrency, calcularRecargoDatafono } from '@/lib/utils';
import styles from './LiquidacionTicket.module.css';

interface LiquidacionTicketProps {
  order: PedidoWithDetalles;
  /** Si true, el pedido ya está en estado 'debe' — solo permite cobrarlo */
  isDebe?: boolean;
}

const METODO_OPTIONS = [
  { key: METODOS_PAGO.EFECTIVO,    label: 'Efectivo',    icon: '💵' },
  { key: METODOS_PAGO.NEQUI,       label: 'Nequi',       icon: '📱' },
  { key: METODOS_PAGO.DATAFONO,    label: 'Datáfono',    icon: '💳' },
  { key: METODOS_PAGO.BANCOLOMBIA, label: 'Bancolombia', icon: '🏦' },
];

export const LiquidacionTicket: React.FC<LiquidacionTicketProps> = ({ order, isDebe = false }) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingDebe, setIsMarkingDebe] = useState(false);
  const [isAnulando, setIsAnulando] = useState(false);
  const [showAnularDialog, setShowAnularDialog] = useState(false);

  const isMesa = order.tipo === TIPOS_ATENCION.MESA;

  // Calcular valores en cliente para previsualizar
  const subtotal = order.subtotal;
  const costoDomicilio = order.costo_domicilio ?? 0;
  let recargo = 0;

  if (selectedMethod === METODOS_PAGO.DATAFONO) {
    // Si ya tenía recargo desde el pedido (ej. domicilio con datáfono)
    if (order.recargo > 0) {
      recargo = order.recargo;
    } else {
      recargo = calcularRecargoDatafono(subtotal, costoDomicilio);
    }
  }

  const totalCalculado = subtotal + costoDomicilio + recargo;

  const direccionUtil =
    !!order.cliente_direccion && order.cliente_direccion.trim() !== SIN_DATO;

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

  const handleDebe = async () => {
    if (!window.confirm(`¿Marcar el pedido #${order.id} como "Debe"?\n\nEl cliente se fue sin pagar. El pedido no contará como ingreso hasta que se cobre.`)) {
      return;
    }
    setIsMarkingDebe(true);
    try {
      const res = await markOrderAsDebe(order.id);
      if (res.success) {
        toast.success(`Pedido #${order.id} marcado como deuda pendiente`);
      } else {
        toast.error(res.error || 'Error al marcar como debe');
        setIsMarkingDebe(false);
      }
    } catch {
      toast.error('Error al procesar');
      setIsMarkingDebe(false);
    }
  };

  /**
   * Anula un pedido que ya salió de cocina y no se va a cobrar
   * (el cliente cambió el pedido, se digitó mal, etc.).
   */
  const handleAnularConfirmed = async (motivo: string) => {
    setIsAnulando(true);
    try {
      const res = await cancelOrder(order.id, motivo);
      if (res.success) {
        toast.success(`Pedido #${order.id} anulado`);
      } else {
        toast.error(res.error || 'Error al anular el pedido');
        setIsAnulando(false);
        setShowAnularDialog(false);
      }
    } catch {
      toast.error('Error al procesar');
      setIsAnulando(false);
      setShowAnularDialog(false);
    }
  };

  const accionesBloqueadas = isSubmitting || isMarkingDebe || isAnulando;

  return (
    <div className={styles.ticket}>
      <div className={styles.header}>
        <div className={styles.idAndType}>
          <h3 className={styles.orderId}>Pedido #{order.id}</h3>
          {isDebe && (
            <span className={styles.debeBadge}>💸 DEBE</span>
          )}
          <span className={styles.orderType}>
            {isMesa ? `🍽️ Mesa ${order.numero_mesa}` : '🛵 Domicilio'}
          </span>
          {!isMesa && order.cliente_nombre && (
            <span className={styles.clientName}>{order.cliente_nombre}</span>
          )}
        </div>
      </div>

      {/* Dirección del domicilio — para confirmar a quién se le está cobrando */}
      {!isMesa && order.cliente_direccion && (
        <p className={styles.direccion}>
          📍{' '}
          {direccionUtil ? (
            <a
              className={styles.direccionLink}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.cliente_direccion)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {order.cliente_direccion}
            </a>
          ) : (
            order.cliente_direccion
          )}
          {order.cliente_telefono && ` · ${order.cliente_telefono}`}
        </p>
      )}

      <div className={styles.itemsList}>
        {order.detalle_pedidos?.map((detalle) => (
          <div key={detalle.id} className={styles.itemRow}>
            <div>
              <span className={styles.itemQty}>{detalle.cantidad}x</span>
              <span>{detalle.productos?.nombre || 'Producto eliminado'}</span>
              {detalle.notas && (
                <div className={styles.itemNotes}>⚠️ {detalle.notas}</div>
              )}
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
        {costoDomicilio > 0 && (
          <div className={styles.summaryRow} style={{ color: 'var(--color-primary)' }}>
            <span>Domicilio fuera del sector</span>
            <span>+ {formatCurrency(costoDomicilio)}</span>
          </div>
        )}
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

        {/* Efectivo informado al tomar el pedido — vuelta que se alistó */}
        {order.paga_con != null && (
          <div className={styles.summaryRow} style={{ color: 'var(--color-success)' }}>
            <span>💵 Paga con {formatCurrency(order.paga_con)}</span>
            <span>
              {(order.vuelto ?? 0) > 0
                ? `Vuelta ${formatCurrency(order.vuelto ?? 0)}`
                : 'Sin vuelta'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.paymentSection}>
        <span className={styles.paymentLabel}>Método de Pago:</span>
        <div className={styles.methods}>
          {METODO_OPTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`${styles.methodBtn} ${selectedMethod === key ? styles.methodBtnActive : ''}`}
              onClick={() => setSelectedMethod(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <div className={styles.confirmActions}>
          <Button
            variant="primary"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!selectedMethod || accionesBloqueadas}
          >
            {isSubmitting ? 'Procesando...' : 'Cobrar'}
          </Button>

          {/* Botón 'Debe' solo si el pedido AÚN NO está en ese estado */}
          {!isDebe && (
            <button
              className={styles.debeBtn}
              onClick={handleDebe}
              disabled={accionesBloqueadas}
              title="El cliente se fue sin pagar — registrar como deuda"
            >
              {isMarkingDebe ? '...' : '💸 Debe'}
            </button>
          )}

          {/* Anular: el pedido no se va a cobrar (cambio de pedido, error, etc.) */}
          <button
            className={styles.anularBtn}
            onClick={() => setShowAnularDialog(true)}
            disabled={accionesBloqueadas}
            title="El pedido no se va a cobrar — sacarlo de liquidación"
          >
            {isAnulando ? '...' : '🚫 Anular'}
          </button>
        </div>
      </div>

      <CancelOrderDialog
        isOpen={showAnularDialog}
        orderId={order.id}
        confirmLabel="Anular pedido"
        aviso={
          <>
            El pedido saldrá de liquidación y <strong>no contará como venta</strong>.
            Quedará registrado como cancelado en el dashboard con el motivo que elijas.
          </>
        }
        isLoading={isAnulando}
        onConfirm={handleAnularConfirmed}
        onCancel={() => setShowAnularDialog(false)}
      />
    </div>
  );
};
