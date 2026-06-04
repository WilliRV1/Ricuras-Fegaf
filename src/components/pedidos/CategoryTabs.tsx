import React from 'react';
import styles from './CategoryTabs.module.css';
import { Categoria } from '@/types';

interface CategoryTabsProps {
  categorias: Categoria[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categorias,
  selectedCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className={styles.scrollContainer}>
      <div className={styles.tabsWrapper}>
        <button
          className={`${styles.tab} ${selectedCategoryId === null ? styles.active : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          Todas
        </button>
        
        {categorias.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.tab} ${selectedCategoryId === cat.id ? styles.active : ''}`}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.nombre}
          </button>
        ))}
      </div>
    </div>
  );
};
