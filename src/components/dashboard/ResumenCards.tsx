import React from 'react';
import styles from './ResumenCards.module.css';
import { formatCurrency } from '@/lib/utils';

interface ResumenCardsProps {
  totalPedidos: number;
  totalFacturado: number;
  totalRecargos: number;
  porMetodoPago: {
    efectivo: number;
    nequi: number;
    datafono: number;
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
  porMetodoPago,
  porTipo,
}) => {
  return (
    <div className={styles.grid}>
      {/* Total Facturado */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon}>💰</div>
        <p className={styles.cardLabel}>Total Facturado (Hoy)</p>
        <p className={styles.cardValue}>{formatCurrency(totalFacturado)}</p>
        <p className={styles.cardSub}>Incluye {formatCurrency(totalRecargos)} en recargos</p>
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
    </div>
  );
};
