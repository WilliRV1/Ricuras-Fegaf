'use client';

import React, { useState } from 'react';
import { PedidoWithDetalles } from '@/types';
import { usePendingOrders } from '@/hooks/usePendingOrders';
import { TIPOS_ATENCION } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import styles from './PedidosEnCurso.module.css';

interface PedidosEnCursoProps {
  /** Id del pedido que se está editando (para resaltarlo) */
  editingId?: number | null;
  onEditar: (order: PedidoWithDetalles) => void;
}

/**
 * Lista de pedidos que aún están pendientes en cocina, con opción de
 * modificarlos. Se cierra sola cuando no hay ninguno.
 */
export const PedidosEnCurso: React.FC<PedidosEnCursoProps> = ({ editingId, onEditar }) => {
  const { orders, loading } = usePendingOrders();
  const [abierto, setAbierto] = useState(false);

  if (loading || orders.length === 0) return null;

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <section className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setAbierto((prev) => !prev)}
        aria-expanded={abierto}
        type="button"
      >
        <span className={styles.toggleTitle}>
          🍳 Pedidos en cocina
          <span className={styles.count}>{orders.length}</span>
        </span>
        <span className={styles.toggleRight}>
          {!abierto && <span className={styles.hint}>Toca para modificar uno</span>}
          <span className={`${styles.chevron} ${abierto ? styles.chevronOpen : ''}`}>▾</span>
        </span>
      </button>

      {abierto && (
        <div className={styles.list}>
          {orders.map((order) => {
            const esMesa = order.tipo === TIPOS_ATENCION.MESA;
            const enEdicion = editingId === order.id;

            return (
              <div key={order.id} className={`${styles.card} ${enEdicion ? styles.cardEditing : ''}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.orderId}>#{order.id}</span>
                  <span className={styles.tipo}>
                    {esMesa ? `🍽️ Mesa ${order.numero_mesa}` : `🛵 ${order.cliente_nombre || 'Domicilio'}`}
                  </span>
                  <span className={styles.hora}>{formatHora(order.created_at)}</span>
                  {order.modificado_at && (
                    <span className={styles.modificadoTag}>🔄 Modificado</span>
                  )}
                </div>

                <div className={styles.items}>
                  {order.detalle_pedidos?.map((detalle, idx) => (
                    <span key={idx} className={styles.item}>
                      {detalle.cantidad}x {detalle.productos?.nombre || 'Producto'}
                      {detalle.notas && <em className={styles.itemNota}> — {detalle.notas}</em>}
                    </span>
                  ))}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.total}>{formatCurrency(order.total)}</span>
                  <button
                    type="button"
                    className={styles.editarBtn}
                    onClick={() => onEditar(order)}
                    disabled={enEdicion}
                  >
                    {enEdicion ? 'Editando…' : '✏️ Modificar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
