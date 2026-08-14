'use client';

/**
 * Cart — Panel lateral del carrito de compras.
 *
 * Lógica de método de pago:
 * - **Domicilio**: el cliente elige el método AHORA (antes de enviar).
 *   Si elige "Datáfono" se muestra y aplica el recargo del 5%.
 *   Si elige "Efectivo" se puede registrar con cuánto paga para alistar la vuelta.
 * - **Mesa**: el pago se gestiona al final de la estadía en `/liquidacion`.
 *   En este panel no se muestra selector de pago para mesa.
 */

import React, { useMemo, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { CartItem as CartItemComponent } from './CartItem';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { METODOS_PAGO, RECARGO_DATAFONO } from '@/lib/constants';
import { MetodoPago, OrderType } from '@/types';
import styles from './Cart.module.css';

interface CartProps {
  orderType: OrderType;
  onEnviarCocina?: (metodoPago: MetodoPago, pagaCon: number | null) => Promise<void>;
  isValidOrder?: boolean;
}

const METODO_LABELS: Record<string, { label: string; icon: string }> = {
  efectivo:    { label: 'Efectivo',    icon: '💵' },
  nequi:       { label: 'Nequi',       icon: '📱' },
  datafono:    { label: 'Datáfono',    icon: '💳' },
  bancolombia: { label: 'Bancolombia', icon: '🏦' },
};

/** Billetes de uso común en Colombia para elegir con un toque */
const BILLETES_RAPIDOS = [10000, 20000, 50000, 100000];

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
  /** Monto con el que el cliente va a pagar en efectivo (string para el input) */
  const [pagaConInput, setPagaConInput] = useState('');

  // El recargo solo aplica para domicilio + datáfono
  const aplicaRecargo =
    orderType === 'domicilio' && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? subtotal * RECARGO_DATAFONO : 0;
  const total = subtotal + recargo;

  // ── Efectivo: con cuánto paga y cuánta vuelta hay que alistar ──
  const esEfectivoDomicilio =
    orderType === 'domicilio' && metodoPago === METODOS_PAGO.EFECTIVO;

  const pagaCon = useMemo(() => {
    const digits = pagaConInput.replace(/\D/g, '');
    return digits === '' ? null : parseInt(digits, 10);
  }, [pagaConInput]);

  const pagaConInsuficiente = esEfectivoDomicilio && pagaCon !== null && pagaCon < total;
  const vuelta = esEfectivoDomicilio && pagaCon !== null ? pagaCon - total : null;

  // Para domicilio, el método de pago es requerido para poder enviar
  const isPagoValido =
    orderType === 'domicilio' ? metodoPago !== null && !pagaConInsuficiente : true;

  /** Deja el carrito listo para un pedido nuevo */
  const resetPago = () => {
    setMetodoPago(null);
    setPagaConInput('');
  };

  const handleSelectMetodo = (key: MetodoPago) => {
    setMetodoPago(key);
    // El monto en efectivo solo tiene sentido con el método efectivo
    if (key !== METODOS_PAGO.EFECTIVO) setPagaConInput('');
  };

  const handleEnviar = async () => {
    if (!isValidOrder) {
      toast.error('Completa los datos del pedido antes de enviar a cocina.');
      return;
    }
    if (orderType === 'domicilio' && metodoPago === null) {
      toast.error('Selecciona el método de pago para el domicilio.');
      return;
    }
    if (pagaConInsuficiente) {
      toast.error('El monto con el que paga es menor al total del pedido.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onEnviarCocina) {
        await onEnviarCocina(
          orderType === 'domicilio' ? metodoPago : null,
          esEfectivoDomicilio ? pagaCon : null
        );
      } else {
        await new Promise((res) => setTimeout(res, 800));
      }
      toast.success('Pedido enviado a cocina exitosamente 👨‍🍳');
      clearCart();
      resetPago();
    } catch (error) {
      toast.error('Ocurrió un error al enviar el pedido.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contador de líneas por producto — para etiquetar "#1 de 2" cuando se repite
  const lineInfo = useMemo(() => {
    const totalPorProducto = new Map<number, number>();
    items.forEach((item) => {
      totalPorProducto.set(item.producto.id, (totalPorProducto.get(item.producto.id) ?? 0) + 1);
    });

    const vistos = new Map<number, number>();
    return items.map((item) => {
      const index = (vistos.get(item.producto.id) ?? 0) + 1;
      vistos.set(item.producto.id, index);
      return { index, total: totalPorProducto.get(item.producto.id) ?? 1 };
    });
  }, [items]);

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
          <CartItemComponent
            key={item.lineId}
            item={item}
            lineIndex={lineInfo[idx].index}
            lineTotal={lineInfo[idx].total}
          />
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
                  onClick={() => handleSelectMetodo(key as MetodoPago)}
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

            {/* ── Efectivo: con cuánto paga → vuelta a alistar ── */}
            {esEfectivoDomicilio && (
              <div className={styles.efectivoBox}>
                <p className={styles.efectivoLabel}>
                  💵 ¿Con cuánto paga? <span className={styles.efectivoOptional}>(para alistar la vuelta)</span>
                </p>

                <div className={styles.billetes}>
                  <button
                    type="button"
                    className={`${styles.billeteBtn} ${pagaCon === total ? styles.billeteActive : ''}`}
                    onClick={() => setPagaConInput(String(Math.round(total)))}
                    disabled={isSubmitting}
                  >
                    Completo
                  </button>
                  {BILLETES_RAPIDOS.filter((b) => b >= total).map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      className={`${styles.billeteBtn} ${pagaCon === billete ? styles.billeteActive : ''}`}
                      onClick={() => setPagaConInput(String(billete))}
                      disabled={isSubmitting}
                    >
                      {formatCOP(billete)}
                    </button>
                  ))}
                </div>

                <div className={styles.efectivoInputRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.efectivoInput}
                    placeholder="Otro monto (ej. 35000)"
                    value={pagaConInput}
                    onChange={(e) => setPagaConInput(e.target.value.replace(/\D/g, ''))}
                    disabled={isSubmitting}
                  />
                  {pagaConInput !== '' && (
                    <button
                      type="button"
                      className={styles.efectivoClear}
                      onClick={() => setPagaConInput('')}
                      disabled={isSubmitting}
                      aria-label="Borrar monto"
                    >
                      ×
                    </button>
                  )}
                </div>

                {pagaConInsuficiente ? (
                  <p className={styles.vueltaError}>
                    ⚠️ Paga con {formatCOP(pagaCon!)} pero el total es {formatCOP(total)}.
                  </p>
                ) : vuelta !== null ? (
                  <p className={styles.vueltaOk}>
                    {vuelta === 0 ? (
                      <>✅ Paga completo — <strong>no hay que llevar vuelta</strong></>
                    ) : (
                      <>🔁 Vuelta a alistar: <strong>{formatCOP(vuelta)}</strong></>
                    )}
                  </p>
                ) : (
                  <p className={styles.vueltaHint}>
                    Si no lo informa, déjalo vacío.
                  </p>
                )}
              </div>
            )}
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
