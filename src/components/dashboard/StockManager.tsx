'use client';

import React, { useState, useTransition } from 'react';
import { Producto } from '@/types';
import { toggleProductStatus } from '@/app/actions/productos';
import { toast } from '@/components/ui/Toast';
import { IconClipboard } from '@/components/ui/Icons';
import styles from './StockManager.module.css';

interface StockManagerProps {
  productos: Producto[];
}

export const StockManager: React.FC<StockManagerProps> = ({ productos }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticProducts, setOptimisticProducts] = useState<Producto[]>(productos);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (producto: Producto) => {
    const newStatus = !producto.activo;
    
    // Optimistic UI update
    setOptimisticProducts(prev => 
      prev.map(p => p.id === producto.id ? { ...p, activo: newStatus } : p)
    );

    startTransition(async () => {
      const res = await toggleProductStatus(producto.id, newStatus);
      if (res.success) {
        toast.success(`${producto.nombre} marcado como ${newStatus ? 'Disponible' : 'Agotado'}`);
      } else {
        // Revert on failure
        setOptimisticProducts(productos);
        toast.error(res.error || 'Error al actualizar estado');
      }
    });
  };

  return (
    <div className={styles.container}>
      <button 
        className={styles.headerToggle} 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.headerLeft}>
          <span className={styles.icon}><IconClipboard size={20} /></span>
          <h2 className={styles.title}>Control de Stock Rápido</h2>
        </div>
        <div className={styles.headerRight}>
          {!isOpen && (
            <span className={styles.preview}>
              {optimisticProducts.filter(p => !p.activo).length} agotados
            </span>
          )}
          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {isOpen && (
        <div className={styles.content}>
          <p className={styles.description}>
            Apaga los productos que se hayan agotado. Desaparecerán instantáneamente del menú de caja.
          </p>
          
          <div className={styles.grid}>
            {optimisticProducts.map((producto) => (
              <div 
                key={producto.id} 
                className={`${styles.card} ${!producto.activo ? styles.cardInactive : ''}`}
              >
                <div className={styles.info}>
                  <span className={styles.name}>{producto.nombre}</span>
                  <span className={styles.price}>
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(producto.precio)}
                  </span>
                </div>
                
                <button 
                  className={`${styles.toggleBtn} ${producto.activo ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => handleToggle(producto)}
                  disabled={isPending}
                >
                  <div className={styles.toggleKnob} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
