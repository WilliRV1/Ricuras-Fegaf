import React from 'react';
import { Producto } from '@/types';
import { ProductCard } from './ProductCard';
import { IconUtensils } from '@/components/ui/Icons';
import styles from './MenuGrid.module.css';

interface MenuGridProps {
  productos: Producto[];
  onAddProduct: (producto: Producto) => void;
}

/**
 * MenuGrid — Grilla responsiva que renderiza los productos filtrados.
 *
 * Incluye un estado vacío (empty state) cuando no hay productos
 * en la categoría seleccionada.
 */
export const MenuGrid: React.FC<MenuGridProps> = ({ productos, onAddProduct }) => {
  if (productos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}><IconUtensils size={32} /></span>
        <p className={styles.emptyText}>No encontramos productos que coincidan con los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {productos.map((prod) => (
        <ProductCard 
          key={prod.id} 
          producto={prod} 
          onAdd={onAddProduct} 
        />
      ))}
    </div>
  );
};
