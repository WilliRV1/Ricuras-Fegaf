'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PedidoWithDetalles } from '@/types';
import { TIPOS_ATENCION, METODOS_PAGO, SIN_DATO } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { CancelOrderDialog } from '@/components/ui/CancelOrderDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DebtDialog } from '@/components/ui/DebtDialog';
import { closeOrderWithPayments, markOrderAsDebe } from '@/app/actions/liquidacion';
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
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingDebe, setIsMarkingDebe] = useState(false);
  const [isAnulando, setIsAnulando] = useState(false);
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [showDebeDialog, setShowDebeDialog] = useState(false);
  const [showCobrarConfirm, setShowCobrarConfirm] = useState(false);
  /** Modo pago dividido: monto (texto) por cada método */
  const [dividido, setDividido] = useState(false);
  const [montos, setMontos] = useState<Record<string, string>>({});

  const isMesa = order.tipo === TIPOS_ATENCION.MESA;

  // Lo que vale el pedido antes del recargo del datáfono
  const subtotal = order.subtotal;
  const costoDomicilio = order.costo_domicilio ?? 0;
  const base = subtotal + costoDomicilio;

  /** Monto asignado a un método en modo dividido */
  const montoDe = (metodo: string) => {
    const digits = (montos[metodo] ?? '').replace(/\D/g, '');
    return digits === '' ? 0 : parseInt(digits, 10);
  };

  // ── Cálculo del cobro, según el modo ──
  const pagos = dividido
    ? METODO_OPTIONS.map(({ key }) => ({ metodo: key as string, monto: montoDe(key) })).filter(
        (p) => p.monto > 0
      )
    : selectedMethod
      ? [{ metodo: selectedMethod, monto: base }]
      : [];

  const asignado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const restante = base - asignado;

  // El 5% se cobra solo sobre lo que pasa por el datáfono
  const recargo = pagos
    .filter((p) => p.metodo === METODOS_PAGO.DATAFONO)
    .reduce((sum, p) => sum + calcularRecargoDatafono(p.monto), 0);

  const totalCalculado = base + recargo;

  const puedeCobrar = dividido ? pagos.length > 0 && restante === 0 : !!selectedMethod;

  const direccionUtil =
    !!order.cliente_direccion && order.cliente_direccion.trim() !== SIN_DATO;

  // El nombre del deudor pisa al del domicilio: es el que sirve para cobrar.
  // En mesa no hay nombre de cliente, así que solo aparece cuando hay deuda.
  const nombreClienteUtil =
    !!order.cliente_nombre && order.cliente_nombre.trim() !== SIN_DATO
      ? order.cliente_nombre
      : null;
  const nombreMostrado = order.deudor_nombre || (isMesa ? null : nombreClienteUtil);

  /** Cambia entre cobro simple y dividido, limpiando lo anterior */
  const toggleDividido = () => {
    setDividido((prev) => {
      const siguiente = !prev;
      setMontos({});
      setSelectedMethod(null);
      return siguiente;
    });
  };

  /** Asigna a un método todo lo que falta por cubrir */
  const asignarResto = (metodo: string) => {
    const otros = pagos.filter((p) => p.metodo !== metodo).reduce((s, p) => s + p.monto, 0);
    const resto = Math.max(base - otros, 0);
    setMontos((prev) => ({ ...prev, [metodo]: resto > 0 ? String(resto) : '' }));
  };

  const handleCobrarConfirmed = async () => {
    setIsSubmitting(true);
    try {
      const res = await closeOrderWithPayments(order.id, pagos);
      if (res.success) {
        toast.success(`Pedido #${order.id} liquidado correctamente`);
      } else {
        toast.error(res.error || 'Error al liquidar pedido');
        setIsSubmitting(false);
        setShowCobrarConfirm(false);
      }
    } catch {
      toast.error('Error al cerrar el pedido');
      setIsSubmitting(false);
      setShowCobrarConfirm(false);
    }
  };

  const handleConfirm = () => {
    if (!puedeCobrar) {
      toast.error(
        dividido
          ? 'Los montos deben sumar el valor del pedido.'
          : 'Selecciona un método de pago'
      );
      return;
    }
    setShowCobrarConfirm(true);
  };

  /**
   * Registra la deuda con el nombre de quien queda debiendo.
   * Sin nombre la deuda es incobrable — es exactamente lo que pasaba antes,
   * cuando en la cartera solo quedaba "pedido #156".
   */
  const handleDebeConfirmed = async (nombre: string, telefono: string) => {
    setIsMarkingDebe(true);
    try {
      const res = await markOrderAsDebe(order.id, nombre, telefono);
      if (res.success) {
        toast.success(`${nombre} queda debiendo ${formatCurrency(base)} (pedido #${order.id})`);
      } else {
        toast.error(res.error || 'Error al registrar la deuda');
        setIsMarkingDebe(false);
        setShowDebeDialog(false);
      }
    } catch {
      toast.error('Error al procesar');
      setIsMarkingDebe(false);
      setShowDebeDialog(false);
    }
  };

  /**
   * Anula un pedido que ya salió de cocina y no se va a cobrar
   * (el cliente cambió el pedido, se digitó mal, etc.).
   */
  const handleAnularConfirmed = async (
    motivo: string,
    canceladoPor: string,
    rehacer: boolean
  ) => {
    setIsAnulando(true);
    try {
      const res = await cancelOrder(order.id, motivo, canceladoPor);
      if (res.success) {
        toast.success(`Pedido #${order.id} anulado`);
        // Se navega de una vez, antes de que realtime saque el ticket del
        // tablero, para que el pedido quede cargado y no se olvide montarlo.
        if (rehacer) router.push(`/pedidos?rehacer=${order.id}`);
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
          {/*
            En una deuda manda el nombre del deudor: puede no ser el mismo del
            domicilio, y en mesa es el único nombre que existe.
          */}
          {nombreMostrado && (
            <span className={styles.clientName}>{nombreMostrado}</span>
          )}
        </div>
      </div>

      {/* Contacto del deudor — para poder cobrarle */}
      {isDebe && order.deudor_telefono && (
        <p className={styles.direccion}>📞 {order.deudor_telefono}</p>
      )}

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
        <div className={styles.paymentHeader}>
          <span className={styles.paymentLabel}>Método de Pago:</span>
          <button
            type="button"
            className={`${styles.dividirBtn} ${dividido ? styles.dividirActivo : ''}`}
            onClick={toggleDividido}
            disabled={accionesBloqueadas}
          >
            {dividido ? '↩️ Un solo método' : '➗ Dividir pago'}
          </button>
        </div>

        {!dividido ? (
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
        ) : (
          <div className={styles.splitBox}>
            {METODO_OPTIONS.map(({ key, label, icon }) => {
              const monto = montoDe(key);
              const recargoFila =
                key === METODOS_PAGO.DATAFONO && monto > 0 ? calcularRecargoDatafono(monto) : 0;

              return (
                <div key={key} className={styles.splitRow}>
                  <span className={styles.splitLabel}>
                    {icon} {label}
                  </span>
                  <div className={styles.splitInputWrap}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.splitInput}
                      placeholder="0"
                      value={montos[key] ?? ''}
                      onChange={(e) =>
                        setMontos((prev) => ({ ...prev, [key]: e.target.value.replace(/\D/g, '') }))
                      }
                      disabled={accionesBloqueadas}
                    />
                    <button
                      type="button"
                      className={styles.restoBtn}
                      onClick={() => asignarResto(key)}
                      disabled={accionesBloqueadas}
                      title="Poner aquí todo lo que falta"
                    >
                      resto
                    </button>
                  </div>
                  {recargoFila > 0 && (
                    <span className={styles.splitRecargo}>
                      +{formatCurrency(recargoFila)} de recargo → se cobran{' '}
                      {formatCurrency(monto + recargoFila)}
                    </span>
                  )}
                </div>
              );
            })}

            <div
              className={`${styles.splitStatus} ${restante === 0 ? styles.splitOk : styles.splitPendiente}`}
            >
              {restante === 0
                ? '✅ Los montos cuadran con el pedido'
                : restante > 0
                  ? `Falta asignar ${formatCurrency(restante)}`
                  : `Sobran ${formatCurrency(Math.abs(restante))}`}
            </div>
          </div>
        )}

        <div className={styles.confirmActions}>
          <Button
            variant="primary"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!puedeCobrar || accionesBloqueadas}
          >
            {isSubmitting ? 'Procesando...' : 'Cobrar'}
          </Button>

          {/* Botón 'Debe' solo si el pedido AÚN NO está en ese estado */}
          {!isDebe && (
            <button
              className={styles.debeBtn}
              onClick={() => setShowDebeDialog(true)}
              disabled={accionesBloqueadas}
              title="El cliente se fue sin pagar — registrar como deuda"
            >
              {isMarkingDebe ? '...' : '💸 Debe'}
            </button>
          )}

          {/*
            Agregar algo de última hora ("y me das una gaseosa"). Antes había
            que anular la venta y volverla a montar, y a veces no se volvía a
            montar. Una deuda ya cerrada no se toca: se cobra o nada.
          */}
          {!isDebe && (
            <button
              className={styles.agregarBtn}
              onClick={() => router.push(`/pedidos?editar=${order.id}`)}
              disabled={accionesBloqueadas}
              title="El cliente pidió algo más antes de pagar"
            >
              ➕ Agregar algo
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

      {/* Confirmación del cobro, con el desglose de cómo paga */}
      <ConfirmDialog
        isOpen={showCobrarConfirm}
        title={`Cobrar ${formatCurrency(totalCalculado)}`}
        message={
          <>
            Pedido #{order.id}
            <br />
            {pagos.map((p) => {
              const rec = p.metodo === METODOS_PAGO.DATAFONO ? calcularRecargoDatafono(p.monto) : 0;
              const label = METODO_OPTIONS.find((m) => m.key === p.metodo);
              return (
                <span key={p.metodo}>
                  {label?.icon} {label?.label}: <strong>{formatCurrency(p.monto + rec)}</strong>
                  {rec > 0 && ` (incl. ${formatCurrency(rec)} de recargo)`}
                  <br />
                </span>
              );
            })}
          </>
        }
        confirmLabel="Confirmar cobro"
        cancelLabel="Volver"
        isLoading={isSubmitting}
        onConfirm={handleCobrarConfirmed}
        onCancel={() => setShowCobrarConfirm(false)}
      />

      {/* Registro de la deuda con nombre — sin nombre no se puede cobrar */}
      <DebtDialog
        isOpen={showDebeDialog}
        orderId={order.id}
        monto={base}
        nombreSugerido={nombreClienteUtil}
        isLoading={isMarkingDebe}
        onConfirm={handleDebeConfirmed}
        onCancel={() => setShowDebeDialog(false)}
      />

      <CancelOrderDialog
        isOpen={showAnularDialog}
        orderId={order.id}
        confirmLabel="Anular pedido"
        ofrecerRehacer
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
