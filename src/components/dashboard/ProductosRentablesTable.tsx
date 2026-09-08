'use client';

import React, { useMemo, useState } from 'react';
import { ProductoRentable } from '@/types';
import styles from './ProductosRentablesTable.module.css';

interface ProductosRentablesTableProps {
  productos: ProductoRentable[];
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

/**
 * Dos rankings del mismo período con un solo dato: por cantidad vendida
 * ("más vendidos", lo que ya mostraba el dashboard) y por margen real
 * ("más rentables", nuevo en el Módulo 8) — no siempre coinciden, y esa
 * diferencia es justamente lo que este reporte deja ver.
 */
export const ProductosRentablesTable: React.FC<ProductosRentablesTableProps> = ({ productos }) => {
  const [orden, setOrden] = useState<'rentables' | 'vendidos'>('rentables');

  const ordenados = useMemo(() => {
    const copia = [...productos];
    return orden === 'rentables'
      ? copia.sort((a, b) => b.margenTotal - a.margenTotal)
      : copia.sort((a, b) => b.cantidad - a.cantidad);
  }, [productos, orden]);

  return (
    <div className={styles.contenedor}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${orden === 'rentables' ? styles.tabActivo : ''}`}
          onClick={() => setOrden('rentables')}
        >
          Más rentables
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${orden === 'vendidos' ? styles.tabActivo : ''}`}
          onClick={() => setOrden('vendidos')}
        >
          Más vendidos
        </button>
      </div>

      <div className={styles.tablaWrapper}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th className={styles.th}>Producto</th>
              <th className={styles.th}>Cantidad</th>
              <th className={styles.th}>Ingresos</th>
              <th className={styles.th}>Costo</th>
              <th className={styles.th}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((p) => (
              <tr key={p.productoId} className={styles.tr}>
                <td className={`${styles.td} ${styles.nombre}`}>{p.nombre}</td>
                <td className={styles.td}>{p.cantidad}</td>
                <td className={styles.td}>{formatoCOP.format(p.ingresos)}</td>
                <td className={styles.td}>
                  {p.costoTotal > 0 ? formatoCOP.format(p.costoTotal) : <span className={styles.sinDato}>sin receta</span>}
                </td>
                <td className={styles.td}>
                  {p.margenPorcentaje != null && p.costoTotal > 0 ? (
                    <span className={p.margenTotal >= 0 ? styles.margenPositivo : styles.margenNegativo}>
                      {formatoCOP.format(p.margenTotal)} ({(p.margenPorcentaje * 100).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className={styles.sinDato}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {ordenados.length === 0 && (
              <tr>
                <td className={styles.vacio} colSpan={5}>
                  No hay productos vendidos en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
