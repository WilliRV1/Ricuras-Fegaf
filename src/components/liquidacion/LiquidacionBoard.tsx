'use client';

import React from 'react';
import { useRealtimeLiquidacion, ConnectionStatus } from '@/hooks/useRealtimeLiquidacion';
import { LiquidacionTicket } from './LiquidacionTicket';
import styles from './LiquidacionBoard.module.css';

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'connecting') return <span style={{ color: 'var(--color-warning)' }}>🔄 Conectando...</span>;
  if (status === 'offline') return <span style={{ color: 'var(--color-danger)' }}>🔴 Desconectado (Reconectando...)</span>;
  return <span style={{ color: 'var(--color-success)' }}>🟢 Online</span>;
};

export const LiquidacionBoard: React.FC = () => {
  const { orders, loading, error, connectionStatus } = useRealtimeLiquidacion();

  if (loading) {
    return <div className={styles.loader}>Cargando pedidos por cobrar... ⏳</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>⚠️ Ocurrió un error de conexión al cargar las cuentas.</p>
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
          <div className={styles.emptyIcon}>🎉</div>
          <h3 className={styles.emptyTitle}>Sin cuentas pendientes</h3>
          <p className={styles.emptyText}>Todas las comandas han sido liquidadas. ¡Excelente!</p>
        </div>
      ) : (
        <div className={styles.boardContainer}>
          <div className={styles.grid}>
            {orders.map((order) => (
              <LiquidacionTicket key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
