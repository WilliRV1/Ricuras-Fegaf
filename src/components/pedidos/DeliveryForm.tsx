import React from 'react';
import styles from './DeliveryForm.module.css';
import { OrderType, OrderDetails } from '@/types';
import { TIPOS_ATENCION } from '@/lib/constants';
import { Input } from '../ui/Input';
import deliveryStyles from './DeliveryForm.module.css';

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
              label="Teléfono"
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

        {/* ── Hora de entrega programada (opcional para ambos tipos) ── */}
        <div className={deliveryStyles.horaEntregaGroup}>
          <label className={deliveryStyles.horaEntregaLabel}>
            ⏰ Hora de entrega programada
            <span className={deliveryStyles.horaEntregaOptional}>(opcional)</span>
          </label>
          <input
            type="time"
            className={deliveryStyles.horaEntregaInput}
            value={details.hora_entrega || ''}
            onChange={(e) => handleChange('hora_entrega', e.target.value || '')}
          />
          {details.hora_entrega && (
            <p className={deliveryStyles.horaEntregaHint}>
              📅 Este pedido quedará como <strong>programado</strong> y se mostrará en la parte superior de cocina con un countdown.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
