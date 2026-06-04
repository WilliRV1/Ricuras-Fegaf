import React from 'react';
import { Producto } from '@/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  producto: Producto;
  onAdd: (producto: Producto) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ producto, onAdd }) => {
  // Formatear precio en COP
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(producto.precio);

  return (
    <Card className={styles.productCard} padding="md" interactive>
      <div className={styles.content}>
        <div className={styles.info}>
          <h3 className={styles.title}>{producto.nombre}</h3>
        </div>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formattedPrice}</span>
          <Button 
            size="sm" 
            variant="primary" 
            onClick={() => onAdd(producto)}
            disabled={!producto.activo}
          >
            {producto.activo ? 'Agregar' : 'Agotado'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
