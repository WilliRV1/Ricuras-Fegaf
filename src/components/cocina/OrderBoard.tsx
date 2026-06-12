'use client';

import React, { useState } from 'react';
import { useRealtimeOrders, ConnectionStatus } from '@/hooks/useRealtimeOrders';
import { OrderTicket } from './OrderTicket';
import styles from './OrderBoard.module.css';

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'connecting') return <span className={styles.statusConnecting}>🔄 Conectando...</span>;
  if (status === 'offline') return <span className={styles.statusOffline}>🔴 Desconectado (Reconectando...)</span>;
  return <span className={styles.statusOnline}>🟢 Online</span>;
};

type FilterType = 'all' | 'mesa' | 'domicilio';

export const OrderBoard: React.FC = () => {
  const { orders, loading, error, connectionStatus } = useRealtimeOrders();
  const [filterType, setFilterType] = useState<FilterType>('all');

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

  const countMesas = orders.filter(o => o.tipo === 'mesa').length;
  const countDomicilios = orders.filter(o => o.tipo === 'domicilio').length;
  const filteredOrders = orders.filter(o => filterType === 'all' || o.tipo === filterType);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '16px' }}>
        <div className={styles.filtersContainer}>
          <button 
            className={`${styles.filterBtn} ${filterType === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('all')}
          >
            📋 Todos <span className={styles.filterCount}>{orders.length}</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${filterType === 'mesa' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('mesa')}
          >
            🍽️ Mesas <span className={styles.filterCount}>{countMesas}</span>
          </button>
          <button 
            className={`${styles.filterBtn} ${filterType === 'domicilio' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('domicilio')}
          >
            🛵 Domicilios <span className={styles.filterCount}>{countDomicilios}</span>
          </button>
        </div>
        <div style={{ fontWeight: 'bold' }}>
          <ConnectionIndicator status={connectionStatus} />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{filterType === 'all' ? '✨' : '🔍'}</div>
          <h3 className={styles.emptyTitle}>
            {filterType === 'all' ? '¡Todo al día!' : 'Sin resultados'}
          </h3>
          <p className={styles.emptyText}>
            {filterType === 'all' 
              ? 'No hay pedidos pendientes en cocina. Buen trabajo 👨‍🍳'
              : `No hay pedidos pendientes para la categoría "${filterType}".`}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredOrders.map((order) => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};

