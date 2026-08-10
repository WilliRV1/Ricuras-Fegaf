import React from 'react';
import styles from './ResumenCards.module.css';
import { formatCurrency } from '@/lib/utils';

interface ResumenCardsProps {
  totalPedidos: number;
  totalFacturado: number;
  totalRecargos: number;
  horaPico: string;
  tiempoPromedioMinutos?: number;
  cancelados: { id: number; motivo: string; hora: string }[];
  porMetodoPago: {
    efectivo: number;
    nequi: number;
    datafono: number;
    bancolombia: number;
  };
  porTipo: {
    mesa: number;
    domicilio: number;
  };
}

export const ResumenCards: React.FC<ResumenCardsProps> = ({
  totalPedidos,
  totalFacturado,
  totalRecargos,
  horaPico,
  tiempoPromedioMinutos,
  cancelados,
  porMetodoPago,
  porTipo,
}) => {
  return (
    <div className={styles.grid}>
      {/* Total Facturado */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon}>💰</div>
        <p className={styles.cardLabel}>Total Facturado</p>
        <p className={styles.cardValue}>{formatCurrency(totalFacturado)}</p>
        <p className={styles.cardSub}>Incl. {formatCurrency(totalRecargos)} en recargos</p>
      </div>

      {/* Total Pedidos */}
      <div className={`${styles.card} ${styles.accentBlue}`}>
        <div className={styles.cardIcon}>🧾</div>
        <p className={styles.cardLabel}>Pedidos Completados</p>
        <p className={styles.cardValue}>{totalPedidos}</p>
        <p className={styles.cardSub}>
          {porTipo.mesa} Mesa · {porTipo.domicilio} Domicilio
        </p>
      </div>

      {/* Hora Pico */}
      <div className={`${styles.card} ${styles.accentOrange}`}>
        <div className={styles.cardIcon}>🕐</div>
        <p className={styles.cardLabel}>Hora Pico</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>{horaPico}</p>
        <p className={styles.cardSub}>Horario con más pedidos</p>
      </div>

      {/* Tiempo Medio */}
      <div className={`${styles.card} ${styles.accentTeal}`}>
        <div className={styles.cardIcon}>⏱️</div>
        <p className={styles.cardLabel}>Tiempo Medio</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>
          {tiempoPromedioMinutos ? `${tiempoPromedioMinutos} min` : 'N/A'}
        </p>
        <p className={styles.cardSub}>Desde inicio hasta cobro</p>
      </div>

      {/* Cancelados */}
      <div className={`${styles.card} ${styles.accentDanger}`}>
        <div className={styles.cardIcon}>❌</div>
        <p className={styles.cardLabel}>Cancelados</p>
        <p className={styles.cardValue}>{cancelados.length}</p>
        <p className={styles.cardSub}>Pedidos no completados</p>
      </div>

      {/* Efectivo */}
      <div className={`${styles.card} ${styles.accentSuccess}`}>
        <div className={styles.cardIcon}>💵</div>
        <p className={styles.cardLabel}>Efectivo</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.efectivo)}</p>
      </div>

      {/* Nequi */}
      <div className={`${styles.card} ${styles.accentPurple}`}>
        <div className={styles.cardIcon}>📱</div>
        <p className={styles.cardLabel}>Nequi</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.nequi)}</p>
      </div>

      {/* Datáfono */}
      <div className={`${styles.card} ${styles.accentWarning}`}>
        <div className={styles.cardIcon}>💳</div>
        <p className={styles.cardLabel}>Datáfono</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.datafono)}</p>
      </div>

      {/* Bancolombia */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon}>🏦</div>
        <p className={styles.cardLabel}>Bancolombia</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.bancolombia)}</p>
      </div>
    </div>
  );
};
