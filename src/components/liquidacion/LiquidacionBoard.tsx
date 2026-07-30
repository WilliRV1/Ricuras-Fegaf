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
  const { orders, deudas, loading, error, connectionStatus } = useRealtimeLiquidacion();

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

      {/* ============================================================
          SECCIÓN DEUDAS — Clientes que se fueron sin pagar
          ============================================================ */}
      {deudas.length > 0 && (
        <section className={styles.deudasSection}>
          <div className={styles.deudasHeader}>
            <h2 className={styles.deudasTitle}>
              💸 Deudas Pendientes
              <span className={styles.deudasCount}>{deudas.length}</span>
            </h2>
            <p className={styles.deudasSubtitle}>
              Estos clientes se fueron sin pagar. Selecciona el método de pago y presiona "Cobrar" cuando vengan a pagar.
            </p>
          </div>
          <div className={styles.grid}>
            {deudas.map((order) => (
              <LiquidacionTicket key={order.id} order={order} isDebe />
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          CUENTAS LISTAS PARA COBRAR
          ============================================================ */}
      {orders.length === 0 && deudas.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎉</div>
          <h3 className={styles.emptyTitle}>Sin cuentas pendientes</h3>
          <p className={styles.emptyText}>Todas las comandas han sido liquidadas. ¡Excelente!</p>
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✅</div>
          <h3 className={styles.emptyTitle}>Sin cuentas nuevas por cobrar</h3>
          <p className={styles.emptyText}>Solo quedan las deudas pendientes de arriba.</p>
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
