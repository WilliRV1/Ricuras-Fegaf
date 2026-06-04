import { Database } from '../lib/supabase/database.types';

// Tipos base extraídos de Supabase
export type Categoria = Database['public']['Tables']['categorias']['Row'];
export type Producto = Database['public']['Tables']['productos']['Row'];
export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type DetallePedido = Database['public']['Tables']['detalle_pedidos']['Row'];

// Tipos auxiliares para el Frontend
export type OrderType = 'mesa' | 'domicilio' | null;

export interface OrderDetails {
  numero_mesa?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
}
