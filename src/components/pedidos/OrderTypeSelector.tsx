import React from 'react';
import styles from './OrderTypeSelector.module.css';
import { OrderType } from '@/types';
import { TIPOS_ATENCION } from '@/lib/constants';
import { IconUtensils, IconScooter } from '@/components/ui/Icons';

interface OrderTypeSelectorProps {
  selectedType: OrderType;
  onSelectType: (type: OrderType) => void;
}

export const OrderTypeSelector: React.FC<OrderTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Tipo de Atención</h3>
      <div className={styles.selectorGroup}>
        <button
          className={`${styles.typeButton} ${
            selectedType === TIPOS_ATENCION.MESA ? styles.active : ''
          }`}
          onClick={() => onSelectType(TIPOS_ATENCION.MESA)}
        >
          <span className={styles.icon}><IconUtensils size={28} /></span>
          Para Mesa
        </button>

        <button
          className={`${styles.typeButton} ${
            selectedType === TIPOS_ATENCION.DOMICILIO ? styles.active : ''
          }`}
          onClick={() => onSelectType(TIPOS_ATENCION.DOMICILIO)}
        >
          <span className={styles.icon}><IconScooter size={28} /></span>
          Domicilio
        </button>
      </div>
    </div>
  );
};
