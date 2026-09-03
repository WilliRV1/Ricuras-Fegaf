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
import { METODOS_PAGO } from '@/lib/constants';
import { calcularRecargoDatafono } from '@/lib/utils';
import { MetodoPago, OrderType } from '@/types';
import {
  IconBanknote,
  IconPhone,
  IconCreditCard,
  IconLandmark,
  IconCart,
  IconAlertTriangle,
  IconCheckCircle,
  IconRefresh,
  IconUtensils,
  IconChefHat,
} from '@/components/ui/Icons';
import styles from './Cart.module.css';

interface CartProps {
  orderType: OrderType;
  onEnviarCocina?: (metodoPago: MetodoPago, pagaCon: number | null) => Promise<void>;
  isValidOrder?: boolean;
  /** Cobro por domicilio fuera del sector (0 si no aplica) */
  costoDomicilio?: number;
  /** Si está definido, se está modificando ese pedido en vez de crear uno nuevo */
  editingOrderId?: number | null;
  /** Método de pago con el que quedó el pedido que se está editando */
  initialMetodoPago?: MetodoPago;
  /** Monto en efectivo registrado en el pedido que se está editando */
  initialPagaCon?: number | null;
}

const METODO_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  efectivo:    { label: 'Efectivo',    icon: <IconBanknote size={20} /> },
  nequi:       { label: 'Nequi',       icon: <IconPhone size={20} /> },
  datafono:    { label: 'Datáfono',    icon: <IconCreditCard size={20} /> },
  bancolombia: { label: 'Bancolombia', icon: <IconLandmark size={20} /> },
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
  costoDomicilio = 0,
  editingOrderId = null,
  initialMetodoPago = null,
  initialPagaCon = null,
}) => {
  const { items, subtotal, totalItems, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(null);
  /** Monto con el que el cliente va a pagar en efectivo (string para el input) */
  const [pagaConInput, setPagaConInput] = useState('');

  // Al abrir un pedido para modificarlo, precargar cómo iba a pagar.
  // Se ajusta durante el render (patrón recomendado por React) en vez de un efecto.
  const [editandoId, setEditandoId] = useState<number | null>(editingOrderId);
  if (editingOrderId !== editandoId) {
    setEditandoId(editingOrderId);
    setMetodoPago(editingOrderId ? initialMetodoPago : null);
    setPagaConInput(editingOrderId && initialPagaCon ? String(initialPagaCon) : '');
  }

  const esEdicion = editingOrderId !== null;

  // El cobro de domicilio solo aplica en domicilios
  const domicilio = orderType === 'domicilio' ? costoDomicilio : 0;

  // El recargo solo aplica para domicilio + datáfono
  const aplicaRecargo =
    orderType === 'domicilio' && metodoPago === METODOS_PAGO.DATAFONO;
  const recargo = aplicaRecargo ? calcularRecargoDatafono(subtotal, domicilio) : 0;
  const total = subtotal + domicilio + recargo;

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
      toast.success(
        esEdicion ? (
          <>
            <IconRefresh size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
            Pedido #{editingOrderId} actualizado — cocina ya ve los cambios
          </>
        ) : (
          <>
            <IconChefHat size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
            Pedido enviado a cocina exitosamente
          </>
        )
      );
      clearCart();
      resetPago();
    } catch (error) {
      // El mensaje del servidor es útil (ej. "cocina ya lo marcó como listo")
      const mensaje =
        error instanceof Error && error.message
          ? error.message
          : 'Ocurrió un error al enviar el pedido.';
      toast.error(mensaje);
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
        <div className={styles.emptyIcon}><IconCart size={40} /></div>
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
        <h3 className={styles.title}>
          {esEdicion ? `Modificando #${editingOrderId}` : 'Resumen del Pedido'}
        </h3>
        <span className={styles.badge}>
          {totalItems} ítem{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {/*
        Zona con scroll: lista de ítems + método de pago.
        Va junta para que, aunque la sección de efectivo (billetes, vuelta)
        crezca mucho, el resumen de totales y el botón de enviar de abajo
        SIEMPRE queden visibles sin scroll — eso es lo único que no puede
        quedar oculto en una pantalla de celular.
      */}
      <div className={styles.scrollArea}>
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

        {/* ── Selector de método de pago (solo domicilio) ── */}
        {orderType === 'domicilio' && (
          <div className={styles.paymentSection}>
            <p className={styles.paymentLabel}>
              <span className={styles.paymentIcon}><IconCreditCard size={16} /></span>
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
                  <IconBanknote size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
                  ¿Con cuánto paga? <span className={styles.efectivoOptional}>(para alistar la vuelta)</span>
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
                    <IconAlertTriangle size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                    Paga con {formatCOP(pagaCon!)} pero el total es {formatCOP(total)}.
                  </p>
                ) : vuelta !== null ? (
                  <p className={styles.vueltaOk}>
                    {vuelta === 0 ? (
                      <>
                        <IconCheckCircle size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                        Paga completo — <strong>no hay que llevar vuelta</strong>
                      </>
                    ) : (
                      <>
                        <IconRefresh size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                        Vuelta a alistar: <strong>{formatCOP(vuelta)}</strong>
                      </>
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
      </div>

      {/* Footer fijo: siempre visible, nunca se lo come el scroll */}
      <div className={styles.footer}>
        {/* ── Resumen de totales ── */}
        <div className={styles.totals}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Subtotal:</span>
            <span className={styles.summaryValue}>{formatCOP(subtotal)}</span>
          </div>

          {domicilio > 0 && (
            <div className={`${styles.summaryRow} ${styles.recargoRow}`}>
              <span className={styles.summaryLabel}>
                Domicilio fuera del sector:
              </span>
              <span className={`${styles.summaryValue} ${styles.domicilioValue}`}>
                + {formatCOP(domicilio)}
              </span>
            </div>
          )}

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

          {(aplicaRecargo || domicilio > 0) && (
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span className={styles.totalLabel}>Total:</span>
              <span className={styles.totalValue}>{formatCOP(total)}</span>
            </div>
          )}
        </div>

        {/* ── Aviso: mesa paga al final ── */}
        {orderType === 'mesa' && (
          <p className={styles.mesaNotice}>
            <IconUtensils size={16} />
            El pago se registra al cerrar la cuenta en la mesa.
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
            {isSubmitting
              ? esEdicion ? 'Guardando...' : 'Enviando...'
              : esEdicion ? 'Guardar cambios' : 'Enviar a Cocina'}
          </Button>
        </div>
      </div>
    </div>
  );
};
