'use client';

import React, { useState } from 'react';
import { useRealtimeLiquidacion, ConnectionStatus } from '@/hooks/useRealtimeLiquidacion';
import { LiquidacionTicket } from './LiquidacionTicket';
import { IconRefresh, IconDot, IconAlertTriangle, IconCheckCircle, IconBanknote } from '@/components/ui/Icons';
import styles from './LiquidacionBoard.module.css';

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'connecting') {
    return (
      <span style={{ color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <IconRefresh size={14} /> Conectando...
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <IconDot size={12} /> Desconectado (Reconectando...)
      </span>
    );
  }
  return (
    <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <IconDot size={12} /> Online
    </span>
  );
};

export const LiquidacionBoard: React.FC = () => {
  const { orders, deudas, loading, error, connectionStatus } = useRealtimeLiquidacion();
  const [deudasOpen, setDeudasOpen] = useState(false);

  if (loading) {
    return <div className={styles.loader}>Cargando pedidos por cobrar...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <IconAlertTriangle size={18} /> Ocurrió un error de conexión al cargar las cuentas.
        </p>
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
          {/* Header clicable para desplegar/colapsar */}
          <button
            className={styles.deudasToggle}
            onClick={() => setDeudasOpen((prev) => !prev)}
            aria-expanded={deudasOpen}
          >
            <div className={styles.deudasTitleRow}>
              <span className={styles.deudasTitleText}>
                <IconBanknote size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                Deudas Pendientes
              </span>
              <span className={styles.deudasCount}>{deudas.length}</span>
            </div>
            <div className={styles.deudasToggleRight}>
              {!deudasOpen && (
                <span className={styles.deudasPreview}>
                  {deudas.slice(0, 2).map(d =>
                    `#${d.id}${d.cliente_nombre ? ` · ${d.cliente_nombre}` : d.numero_mesa ? ` · Mesa ${d.numero_mesa}` : ''}`
                  ).join('  •  ')}
                  {deudas.length > 2 && `  +${deudas.length - 2} más`}
                </span>
              )}
              <span className={`${styles.chevron} ${deudasOpen ? styles.chevronOpen : ''}`}>
                ▾
              </span>
            </div>
          </button>

          {/* Contenido desplegable */}
          {deudasOpen && (
            <>
              <p className={styles.deudasSubtitle}>
                Selecciona el método de pago y presiona &quot;Cobrar&quot; cuando el cliente venga a pagar.
              </p>
              <div className={styles.grid}>
                {deudas.map((order) => (
                  <LiquidacionTicket key={order.id} order={order} isDebe />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ============================================================
          CUENTAS LISTAS PARA COBRAR
          ============================================================ */}
      {orders.length === 0 && deudas.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><IconCheckCircle size={56} /></div>
          <h3 className={styles.emptyTitle}>Sin cuentas pendientes</h3>
          <p className={styles.emptyText}>Todas las comandas han sido liquidadas. ¡Excelente!</p>
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><IconCheckCircle size={56} /></div>
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
