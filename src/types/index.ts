import { Database } from '../lib/supabase/database.types';

// Tipos base extraídos de Supabase
export type Categoria = Database['public']['Tables']['categorias']['Row'];
export type Producto = Database['public']['Tables']['productos']['Row'];
export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type DetallePedido = Database['public']['Tables']['detalle_pedidos']['Row'];

// Tipos auxiliares para el Frontend
export type OrderType = 'mesa' | 'domicilio' | null;

/** Métodos de pago — coincide con los valores de la DB */
export type MetodoPago = 'efectivo' | 'nequi' | 'datafono' | 'bancolombia' | null;

export interface OrderDetails {
  numero_mesa?: string;
  cliente_nombre?: string;
  /** Teléfono opcional para domicilio */
  cliente_telefono?: string;
  cliente_direccion?: string;
  /** Solo para domicilio: método de pago elegido al momento del pedido */
  metodo_pago?: MetodoPago;
  /** Hora de entrega programada (ISO string o HH:MM). Null = pedido inmediato */
  hora_entrega?: string | null;
  /** Domicilio fuera del sector: suma el cobro adicional al total */
  fuera_sector?: boolean;
}

export interface CartItem {
  /**
   * Identificador único de la línea del carrito.
   * Dos líneas del mismo producto son SIEMPRE independientes: cada una tiene
   * su propia cantidad y sus propias observaciones.
   */
  lineId: string;
  producto: Producto;
  cantidad: number;
  notas?: string;
}

export interface PedidoWithDetalles extends Pedido {
  /** Hora de entrega programada. Puede no estar en el tipo generado automáticamente. */
  hora_entrega?: string | null;
  detalle_pedidos: (DetallePedido & {
    productos: {
      nombre: string;
    } | null;
  })[];
}
