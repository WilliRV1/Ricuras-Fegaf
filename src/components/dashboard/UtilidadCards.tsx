import React from 'react';
import { ReporteUtilidad } from '@/types';
import styles from './UtilidadCards.module.css';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

/** Tarjetas de la fórmula del Módulo 8: Ventas − Costo de productos − Gastos = Utilidad neta. */
export const UtilidadCards: React.FC<{ utilidad: ReporteUtilidad }> = ({ utilidad }) => {
  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Ventas reales</span>
        <span className={styles.valor}>{formatoCOP.format(utilidad.ventas)}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Costo de productos</span>
        <span className={styles.valor}>{formatoCOP.format(utilidad.costoProductos)}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Gastos</span>
        <span className={styles.valor}>{formatoCOP.format(utilidad.gastos)}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Utilidad neta</span>
        <span className={utilidad.utilidadNeta >= 0 ? styles.valorPositivo : styles.valorNegativo}>
          {formatoCOP.format(utilidad.utilidadNeta)}
        </span>
      </div>
    </div>
  );
};
