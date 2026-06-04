import React from 'react';
import { Producto } from '@/types';
import { ProductCard } from './ProductCard';
import styles from './MenuGrid.module.css';

interface MenuGridProps {
  productos: Producto[];
  onAddProduct: (producto: Producto) => void;
}

export const MenuGrid: React.FC<MenuGridProps> = ({ productos, onAddProduct }) => {
  if (productos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No hay productos disponibles en esta categoría.</p>
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
