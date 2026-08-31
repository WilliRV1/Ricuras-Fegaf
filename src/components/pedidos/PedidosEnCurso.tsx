'use client';

import React, { useState } from 'react';
import { PedidoWithDetalles } from '@/types';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { TIPOS_ATENCION, ESTADOS_PEDIDO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import styles from './PedidosEnCurso.module.css';

interface PedidosEnCursoProps {
  /** Id del pedido que se está editando (para resaltarlo) */
  editingId?: number | null;
  onEditar: (order: PedidoWithDetalles) => void;
}

/**
 * Lista de pedidos que todavía no se han cobrado, con opción de modificarlos.
 *
 * Incluye los que ya salieron de cocina: ahí es donde el cliente pide algo de
 * última hora y antes tocaba anular la venta entera. Se cierra sola cuando no
 * hay ninguno.
 */
export const PedidosEnCurso: React.FC<PedidosEnCursoProps> = ({ editingId, onEditar }) => {
  const { orders, loading } = useOpenOrders();
  const [abierto, setAbierto] = useState(false);

  if (loading || orders.length === 0) return null;

  const enCocina = orders.filter((o) => o.estado === ESTADOS_PEDIDO.PENDIENTE).length;
  const porCobrar = orders.length - enCocina;

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
          🧾 Pedidos sin cobrar
          <span className={styles.count}>{orders.length}</span>
        </span>
        <span className={styles.toggleRight}>
          {!abierto && (
            <span className={styles.hint}>
              {enCocina > 0 && `${enCocina} en cocina`}
              {enCocina > 0 && porCobrar > 0 && ' · '}
              {porCobrar > 0 && `${porCobrar} por cobrar`}
            </span>
          )}
          <span className={`${styles.chevron} ${abierto ? styles.chevronOpen : ''}`}>▾</span>
        </span>
      </button>

      {abierto && (
        <div className={styles.list}>
          {orders.map((order) => {
            const esMesa = order.tipo === TIPOS_ATENCION.MESA;
            const enEdicion = editingId === order.id;
            const yaListo = order.estado === ESTADOS_PEDIDO.LISTO;

            return (
              <div key={order.id} className={`${styles.card} ${enEdicion ? styles.cardEditing : ''}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.orderId}>#{order.id}</span>
                  <span className={styles.tipo}>
                    {esMesa ? `🍽️ Mesa ${order.numero_mesa}` : `🛵 ${order.cliente_nombre || 'Domicilio'}`}
                  </span>
                  <span className={styles.hora}>{formatHora(order.created_at)}</span>
                  <span className={yaListo ? styles.estadoListo : styles.estadoCocina}>
                    {yaListo ? '✅ Listo, por cobrar' : '🍳 En cocina'}
                  </span>
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
                    {enEdicion ? 'Editando…' : yaListo ? '➕ Agregar algo' : '✏️ Modificar'}
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
