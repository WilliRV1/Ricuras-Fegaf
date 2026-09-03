import React from 'react';
import styles from './ProductosVendidosTable.module.css';
import { formatCurrency } from '@/lib/utils';
import { IconUtensils } from '@/components/ui/Icons';

interface ProductoVendido {
  nombre: string;
  cantidad: number;
  total: number;
}

interface ProductosVendidosTableProps {
  productos: ProductoVendido[];
}

export const ProductosVendidosTable: React.FC<ProductosVendidosTableProps> = ({ productos }) => {
  if (!productos || productos.length === 0) {
    return (
      <div className={styles.empty}>
        <span><IconUtensils size={32} style={{ color: 'var(--color-text-subtle)' }} /></span>
        <p>No hay productos vendidos registrados hoy.</p>
      </div>
    );
  }

  const maxCantidad = productos[0]?.cantidad || 1;

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {productos.map((producto, idx) => (
          <div key={producto.nombre} className={styles.row}>
            <div className={styles.rankBadge}>#{idx + 1}</div>
            <div className={styles.info}>
              <div className={styles.nameAndBar}>
                <span className={styles.nombre}>{producto.nombre}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(producto.cantidad / maxCantidad) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className={styles.stats}>
              <span className={styles.cantidad}>{producto.cantidad} uds</span>
              <span className={styles.total}>{formatCurrency(producto.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
