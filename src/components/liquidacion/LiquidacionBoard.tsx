'use client';

import React from 'react';
import { useRealtimeLiquidacion } from '@/hooks/useRealtimeLiquidacion';
import { LiquidacionTicket } from './LiquidacionTicket';
import styles from './LiquidacionBoard.module.css';

export const LiquidacionBoard: React.FC = () => {
  const { orders, loading, error } = useRealtimeLiquidacion();

  if (loading) {
    return <div className={styles.loader}>Cargando cuentas por cobrar... ⏳</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>⚠️ Ocurrió un error al cargar las liquidaciones.</p>
        <small>{error}</small>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>💳</div>
        <h3 className={styles.emptyTitle}>Sin cuentas pendientes</h3>
        <p className={styles.emptyText}>Todas las órdenes listas han sido cobradas.</p>
      </div>
    );
  }

  return (
    <div className={styles.boardContainer}>
      <div className={styles.grid}>
        {orders.map((order) => (
          <LiquidacionTicket key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
};
