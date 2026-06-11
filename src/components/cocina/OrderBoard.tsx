'use client';

import React from 'react';
import { useRealtimeOrders, ConnectionStatus } from '@/hooks/useRealtimeOrders';
import { OrderTicket } from './OrderTicket';
import styles from './OrderBoard.module.css';

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'connecting') return <span className={styles.statusConnecting}>🔄 Conectando...</span>;
  if (status === 'offline') return <span className={styles.statusOffline}>🔴 Desconectado (Reconectando...)</span>;
  return <span className={styles.statusOnline}>🟢 Online</span>;
};

export const OrderBoard: React.FC = () => {
  const { orders, loading, error, connectionStatus } = useRealtimeOrders();

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', fontWeight: 'bold' }}>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {orders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✨</div>
          <h3 className={styles.emptyTitle}>¡Todo al día!</h3>
          <p className={styles.emptyText}>No hay pedidos pendientes en cocina. Buen trabajo 👨‍🍳</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {orders.map((order) => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
