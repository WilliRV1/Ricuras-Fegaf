import React from 'react';
import styles from './DeliveryForm.module.css';
import { OrderType, OrderDetails } from '@/types';
import { TIPOS_ATENCION } from '@/lib/constants';
import { Input } from '../ui/Input';

interface DeliveryFormProps {
  orderType: OrderType;
  details: OrderDetails;
  onChange: (details: OrderDetails) => void;
  errors: Partial<Record<keyof OrderDetails, string>>;
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  orderType,
  details,
  onChange,
  errors,
}) => {
  if (!orderType) return null;

  const handleChange = (field: keyof OrderDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  return (
    <div className={styles.formContainer}>
      <h3 className={styles.title}>
        {orderType === TIPOS_ATENCION.MESA ? 'Detalles de Mesa' : 'Datos del Domicilio'}
      </h3>
      
      <div className={styles.fields}>
        {orderType === TIPOS_ATENCION.MESA && (
          <Input
            label="Número de Mesa *"
            placeholder="Ej: 5"
            type="number"
            value={details.numero_mesa || ''}
            onChange={(e) => handleChange('numero_mesa', e.target.value)}
            error={errors.numero_mesa}
          />
        )}

        {orderType === TIPOS_ATENCION.DOMICILIO && (
          <>
            <Input
              label="Nombre del Cliente *"
              placeholder="Ej: Juan Pérez"
              value={details.cliente_nombre || ''}
              onChange={(e) => handleChange('cliente_nombre', e.target.value)}
              error={errors.cliente_nombre}
            />
            <Input
              label="Teléfono *"
              placeholder="Ej: 300 123 4567"
              type="tel"
              value={details.cliente_telefono || ''}
              onChange={(e) => handleChange('cliente_telefono', e.target.value)}
              error={errors.cliente_telefono}
            />
            <Input
              label="Dirección *"
              placeholder="Ej: Calle 123 #45-67"
              value={details.cliente_direccion || ''}
              onChange={(e) => handleChange('cliente_direccion', e.target.value)}
              error={errors.cliente_direccion}
            />
          </>
        )}
      </div>
    </div>
  );
};
