import React from 'react';
import { ReporteUtilidad } from '@/types';
import styles from './UtilidadCards.module.css';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

/**
 * Tarjetas de la fórmula del Módulo 8: Ventas − Costo de productos − lo que
 * se puso para el domiciliario = Utilidad neta. El costo ya trae lo que cada
 * producto deja para el domiciliario, así que aquí solo va la diferencia.
 */
export const UtilidadCards: React.FC<{ utilidad: ReporteUtilidad }> = ({ utilidad }) => {
  const sobro = utilidad.aporteDomiciliario < 0;
  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Ventas reales</span>
        <span className={styles.valor}>{formatoCOP.format(utilidad.ventas)}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.etiqueta}>Costo de productos</span>
        <span className={styles.valor}>{formatoCOP.format(utilidad.costoProductos)}</span>
        <span className={styles.nota}>Con el pago auxiliares de cada producto, como en el Excel</span>
      </div>
      <div className={styles.card}>
        <span className={styles.etiqueta}>
          {sobro ? 'Sobró del domiciliario' : 'Puesto para el domiciliario'}
        </span>
        <span className={styles.valor}>{formatoCOP.format(Math.abs(utilidad.aporteDomiciliario))}</span>
        <span className={styles.nota}>
          Se le pagó {formatoCOP.format(utilidad.pagoDomiciliario)} y los productos dejaron{' '}
          {formatoCOP.format(utilidad.recaudoDomiciliario)}
        </span>
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
