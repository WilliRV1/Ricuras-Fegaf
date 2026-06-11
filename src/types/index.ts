import { Database } from '../lib/supabase/database.types';

// Tipos base extraídos de Supabase
export type Categoria = Database['public']['Tables']['categorias']['Row'];
export type Producto = Database['public']['Tables']['productos']['Row'];
export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type DetallePedido = Database['public']['Tables']['detalle_pedidos']['Row'];

// Tipos auxiliares para el Frontend
export type OrderType = 'mesa' | 'domicilio' | null;

/** Métodos de pago — coincide con los valores de la DB */
export type MetodoPago = 'efectivo' | 'nequi' | 'datafono' | null;

export interface OrderDetails {
  numero_mesa?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  /** Solo para domicilio: método de pago elegido al momento del pedido */
  metodo_pago?: MetodoPago;
}

export interface CartItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
}

export interface PedidoWithDetalles extends Pedido {
  detalle_pedidos: (DetallePedido & {
    productos: {
      nombre: string;
    } | null;
  })[];
}

