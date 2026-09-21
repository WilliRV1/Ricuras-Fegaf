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
  /**
   * Cobro adicional por domicilio fuera del sector, escrito por quien toma
   * el pedido. Undefined/0 = no aplica.
   */
  costo_domicilio?: number;
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

/** Insumo del catálogo de costeo (Fase 2, Módulo 6). Tablas nuevas, sin generar aún en database.types.ts. */
export interface Insumo {
  id: number;
  nombre: string;
  unidad_base: string;
  activo: boolean;
  created_at: string;
}

/** Un lote de compra de un insumo — equivale a una fila de la hoja PRECIOS del Excel. */
export interface CompraInsumo {
  id: number;
  insumo_id: number;
  precio_compra: number;
  rendimiento: number;
  fecha: string;
  created_at: string;
}

/** Insumo con su costo vigente ya calculado (promedio de sus últimos lotes). */
export interface InsumoConCosto extends Insumo {
  costo_unitario: number | null;
  /** true = es el insumo propio de un producto que se compra hecho (gaseosa, agua, jugo). */
  se_compra_hecho?: boolean;
}

/** Cifra del negocio editable desde el dashboard (tabla `parametros`). */
export interface Parametro {
  clave: string;
  valor: number;
  descripcion: string;
}

/**
 * Pago al domiciliario en un período: tarifa × unidades de comida entregadas a
 * domicilio, con mínimo diario. Lo que falte para el mínimo lo pone el fondo
 * aparte, no el negocio.
 */
export interface LiquidacionDomiciliario {
  /** Unidades de comida (sin bebidas) en pedidos a domicilio del período */
  unidades: number;
  tarifa: number;
  minimoDia: number;
  /** Tope por día. 0 = sin tope. */
  maximoDia: number;
  /** unidades × tarifa */
  porProductos: number;
  /** Lo que pone el negocio (porProductos, recortado al tope si lo hay) */
  delNegocio: number;
  /** Lo que pone el fondo aparte para completar el mínimo */
  delFondo: number;
  /** Lo que recibe el domiciliario: entre el mínimo y el máximo, sumado por día */
  recibe: number;
  /** Días del período en que se aplicó el mínimo */
  diasConMinimo: number;
  /** Días del período en que se aplicó el tope */
  diasConMaximo: number;
}

/** Un renglón de la receta de un producto. */
export interface RecetaItem {
  insumo_id: number;
  nombre: string;
  unidad_base: string;
  cantidad_usada: number;
  costo_unitario: number | null;
}

/** Costo y margen calculados de un producto, desde vw_producto_costos. */
export interface ProductoCosto {
  producto_id: number;
  nombre: string;
  precio: number;
  costo_total: number;
  margen: number | null;
  /** 0 = el producto no tiene receta: su costo no es 0, es desconocido. */
  insumos_en_receta: number;
  /** Insumos de la receta sin ninguna compra registrada: el costo está incompleto. */
  insumos_sin_costo: number;
}

/** Utilidad neta real de un período: ventas − costo de productos vendidos (Fase 2, Módulo 8). */
export interface ReporteUtilidad {
  from: string;
  to: string;
  ventas: number;
  costoProductos: number;
  /** Aporte del negocio al pago del domiciliario en el período */
  pagoDomiciliario: number;
  utilidadNeta: number;
}

/** Un mes dentro del comparativo mensual, con su etiqueta para el eje del gráfico. */
export interface ReporteUtilidadMensual extends ReporteUtilidad {
  mes: string; // 'YYYY-MM'
  etiqueta: string; // Ej: "sept 2026"
}

export interface ComparativoMensual {
  mesActual: ReporteUtilidadMensual;
  mesAnterior: ReporteUtilidadMensual;
}

/** Un producto con su rentabilidad real del período, no solo cuánto se vendió. */
export interface ProductoRentable {
  productoId: number;
  nombre: string;
  cantidad: number;
  ingresos: number;
  costoTotal: number;
  margenTotal: number;
  margenPorcentaje: number | null;
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
