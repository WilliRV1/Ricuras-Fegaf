'use client';

import React from 'react';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { OrderTicket } from './OrderTicket';
import styles from './OrderBoard.module.css';

export const OrderBoard: React.FC = () => {
  const { orders, loading, error } = useRealtimeOrders();

  if (loading) {
    return <div className={styles.loader}>Cargando comandas en tiempo real... ⏳</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>⚠️ Ocurrió un error de conexión al cargar las comandas.</p>
        <small>{error}</small>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>✨</div>
        <h3 className={styles.emptyTitle}>¡Todo al día!</h3>
        <p className={styles.emptyText}>No hay pedidos pendientes en cocina. Buen trabajo 👨‍🍳</p>
      </div>
    );
  }

  return (
    <div className={styles.boardContainer}>
      <div className={styles.grid}>
        {orders.map((order) => (
          <OrderTicket key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
};
