/** Recargo porcentual aplicado al pagar con datáfono */
export const RECARGO_DATAFONO = 0.05;

/**
 * Motivos de cancelación predefinidos.
 * Tenerlos tipificados permite ver en el dashboard por qué se pierden pedidos.
 */
export const MOTIVOS_CANCELACION = [
  'El cliente cambió el pedido',
  'El cliente ya no lo quiere',
  'Error al digitar el pedido',
  'Producto agotado',
  'El cliente no responde',
] as const;

/** Estados posibles de un pedido */
export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  LISTO: 'listo',
  PAGADO: 'pagado',
  CANCELADO: 'cancelado',
  /** El cliente se fue sin pagar — deuda pendiente por cobrar */
  DEBE: 'debe',
} as const;

/** Métodos de pago disponibles */
export const METODOS_PAGO = {
  EFECTIVO: 'efectivo',
  NEQUI: 'nequi',
  DATAFONO: 'datafono',
  BANCOLOMBIA: 'bancolombia',
} as const;

/**
 * Valor que queda en `pedidos.metodo_pago` cuando el pago se dividió entre
 * varios métodos. El detalle real está en la tabla `pagos_pedido`.
 */
export const METODO_PAGO_MIXTO = 'mixto';

/**
 * Valor que se registra cuando el cliente no entrega un dato
 * (no da el nombre, no contesta el teléfono, no confirma la dirección).
 * Permite seguir con el pedido sin dejar el campo vacío.
 */
export const SIN_DATO = 'No responde';

/** Tipos de atención */
export const TIPOS_ATENCION = {
  MESA: 'mesa',
  DOMICILIO: 'domicilio',
} as const;
