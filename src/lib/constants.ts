/** Recargo porcentual aplicado al pagar con datáfono */
export const RECARGO_DATAFONO = 0.05;

/** Estados posibles de un pedido */
export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  LISTO: 'listo',
  PAGADO: 'pagado',
  CANCELADO: 'cancelado',
} as const;

/** Métodos de pago disponibles */
export const METODOS_PAGO = {
  EFECTIVO: 'efectivo',
  NEQUI: 'nequi',
  DATAFONO: 'datafono',
} as const;

/** Tipos de atención */
export const TIPOS_ATENCION = {
  MESA: 'mesa',
  DOMICILIO: 'domicilio',
} as const;
