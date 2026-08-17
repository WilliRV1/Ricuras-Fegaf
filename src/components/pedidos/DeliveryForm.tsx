import React from 'react';
import styles from './DeliveryForm.module.css';
import { OrderType, OrderDetails } from '@/types';
import { TIPOS_ATENCION, SIN_DATO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { Input } from '../ui/Input';
import deliveryStyles from './DeliveryForm.module.css';

/** Montos sugeridos de un toque — el valor real siempre lo decide quien toma el pedido */
const COSTOS_DOMICILIO_SUGERIDOS = [3000, 5000, 8000, 10000];

interface DeliveryFormProps {
  orderType: OrderType;
  details: OrderDetails;
  onChange: (details: OrderDetails) => void;
  errors: Partial<Record<keyof OrderDetails, string>>;
}

/** Campos de domicilio que se pueden marcar como "No responde" */
type CampoDomicilio = 'cliente_nombre' | 'cliente_telefono' | 'cliente_direccion';

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

  /**
   * Marca (o desmarca) un campo como "No responde".
   * Sirve cuando el cliente hace el pedido pero no da su nombre o no entrega
   * los datos completos: se deja constancia y el pedido puede seguir el flujo.
   */
  const toggleNoResponde = (field: CampoDomicilio) => {
    const yaMarcado = details[field] === SIN_DATO;
    onChange({ ...details, [field]: yaMarcado ? '' : SIN_DATO });
  };

  /** Renderiza un campo de domicilio con su botón "No responde" al lado */
  const renderCampoDomicilio = (
    field: CampoDomicilio,
    label: string,
    placeholder: string,
    type: string = 'text'
  ) => {
    const marcado = details[field] === SIN_DATO;

    return (
      <div className={styles.fieldRow}>
        <Input
          className={styles.fieldInput}
          label={label}
          placeholder={placeholder}
          type={marcado ? 'text' : type}
          value={details[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          error={errors[field]}
          disabled={marcado}
        />
        <button
          type="button"
          className={`${styles.noRespondeBtn} ${marcado ? styles.noRespondeActive : ''}`}
          onClick={() => toggleNoResponde(field)}
          title={
            marcado
              ? 'Quitar la marca y escribir el dato'
              : 'El cliente no entregó este dato — continuar igual'
          }
          aria-pressed={marcado}
        >
          {marcado ? '✓ No responde' : '🚫 No responde'}
        </button>
      </div>
    );
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
            {renderCampoDomicilio('cliente_nombre', 'Nombre del Cliente (opcional)', 'Ej: Juan Pérez')}
            {renderCampoDomicilio('cliente_telefono', 'Teléfono', 'Ej: 300 123 4567', 'tel')}
            {renderCampoDomicilio('cliente_direccion', 'Dirección *', 'Ej: Calle 123 #45-67')}

            <p className={styles.noRespondeHint}>
              💡 Si el cliente no da un dato (no dice su nombre, no confirma la dirección),
              márcalo con <strong>No responde</strong> y el pedido sigue su curso normal.
            </p>

            {/* ── Costo de domicilio (opcional, lo define quien toma el pedido) ── */}
            <div className={styles.sectorBox}>
              <p className={styles.sectorLabel}>
                🛵 Costo del domicilio <span className={styles.sectorOptional}>(opcional, si queda fuera del sector)</span>
              </p>

              <div className={styles.sectorChips}>
                {COSTOS_DOMICILIO_SUGERIDOS.map((monto) => (
                  <button
                    key={monto}
                    type="button"
                    className={`${styles.sectorChip} ${details.costo_domicilio === monto ? styles.sectorChipActive : ''}`}
                    onClick={() => onChange({ ...details, costo_domicilio: monto })}
                  >
                    {formatCurrency(monto)}
                  </button>
                ))}
              </div>

              <div className={styles.sectorInputRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.sectorInput}
                  placeholder="Otro monto (ej. 12000)"
                  value={details.costo_domicilio ? String(details.costo_domicilio) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    onChange({ ...details, costo_domicilio: digits === '' ? undefined : parseInt(digits, 10) });
                  }}
                />
                {!!details.costo_domicilio && (
                  <button
                    type="button"
                    className={styles.sectorClear}
                    onClick={() => onChange({ ...details, costo_domicilio: undefined })}
                    aria-label="Quitar costo de domicilio"
                  >
                    ×
                  </button>
                )}
              </div>

              {!!details.costo_domicilio && (
                <p className={styles.sectorPreview}>
                  Se suma <strong>{formatCurrency(details.costo_domicilio)}</strong> al total del pedido.
                </p>
              )}
            </div>
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
