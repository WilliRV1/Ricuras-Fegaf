import React from 'react';
import styles from './OrderTypeSelector.module.css';
import { OrderType } from '@/types';
import { TIPOS_ATENCION } from '@/lib/constants';
import { IconUtensils, IconScooter } from '@/components/ui/Icons';

interface OrderTypeSelectorProps {
  selectedType: OrderType;
  onSelectType: (type: OrderType) => void;
  /**
   * Bloquea el cambio. Al modificar un pedido ya tomado, el tipo no se puede
   * cambiar (la base lo ignora) y cambiarlo aquí borraba la mesa o la
   * dirección sin cambiar nada más.
   */
  disabled?: boolean;
  /** Texto que explica por qué está bloqueado */
  disabledHint?: string;
}

export const OrderTypeSelector: React.FC<OrderTypeSelectorProps> = ({
  selectedType,
  onSelectType,
  disabled = false,
  disabledHint,
}) => {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Tipo de Atención</h3>
      {disabled && disabledHint && (
        <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {disabledHint}
        </p>
      )}
      <div className={styles.selectorGroup}>
        <button
          className={`${styles.typeButton} ${
            selectedType === TIPOS_ATENCION.MESA ? styles.active : ''
          }`}
          onClick={() => onSelectType(TIPOS_ATENCION.MESA)}
          disabled={disabled}
          type="button"
        >
          <span className={styles.icon}><IconUtensils size={28} /></span>
          Para Mesa
        </button>

        <button
          className={`${styles.typeButton} ${
            selectedType === TIPOS_ATENCION.DOMICILIO ? styles.active : ''
          }`}
          onClick={() => onSelectType(TIPOS_ATENCION.DOMICILIO)}
          disabled={disabled}
          type="button"
        >
          <span className={styles.icon}><IconScooter size={28} /></span>
          Domicilio
        </button>
      </div>
    </div>
  );
};
