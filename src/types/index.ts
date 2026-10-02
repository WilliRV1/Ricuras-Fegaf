import { Database } from '../lib/supabase/database.types';
import type { LiquidacionDia, TotalesLiquidacion } from '../lib/domiciliario';

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

/** Una línea de un pedido de evento: el producto a un precio acordado con el cliente. */
export interface LineaEvento {
  productoId: number;
  cantidad: number;
  /** Precio por unidad acordado con el cliente */
  precio: number;
  notas?: string;
}

export interface DatosEvento {
  tipo: 'mesa' | 'domicilio';
  numeroMesa?: number | null;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  /** Solo domicilio */
  metodoPago?: MetodoPago;
  /** 'YYYY-MM-DDTHH:MM' en hora de Colombia. Vacío = para ya. */
  entrega?: string;
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

/**
 * Insumo con su costo vigente ya calculado: su última compra, o lo que valga
 * el insumo o el producto al que está enlazado (vw_insumo_costo_actual).
 */
export interface InsumoConCosto extends Insumo {
  costo_unitario: number | null;
  /** true = es el insumo propio de un producto que se compra hecho (gaseosa, agua, jugo). */
  se_compra_hecho?: boolean;
  /** De dónde sale el costo: de sus compras, de otro insumo o del costo de un producto */
  origen: 'compra' | 'insumo' | 'producto';
  /** Fecha ('YYYY-MM-DD') de la compra que fija el precio. Null si no hay. */
  fecha_ultima_compra: string | null;
  enlace_insumo_id: number | null;
  enlace_producto_id: number | null;
  enlace_factor: number;
  /** true = el costo es el promedio de las últimas 5 compras (gas, aceite) */
  promedia: boolean;
  /** En cuántas recetas aparece */
  usos: number;
}

/** Cifra del negocio editable desde el dashboard (tabla `parametros`). */
export interface Parametro {
  clave: string;
  valor: number;
  descripcion: string;
}

/**
 * Pago al domiciliario en un período, como lo lleva el dueño: cada producto
 * vendido que "aporta" deja la tarifa, el domiciliario recibe un fijo por día
 * trabajado y la diferencia la pone (o le sobra a) la ganancia.
 * El cálculo vive en src/lib/domiciliario.ts.
 */
export interface LiquidacionDomiciliario extends TotalesLiquidacion {
  tarifa: number;
  /** Pago fijo por día trabajado */
  pagoDia: number;
  /** Un renglón por día con ventas (o con el pago ajustado) */
  dias: LiquidacionDia[];
  /** La semana (lunes a domingo) de la fecha final del período, completa */
  semana: TotalesLiquidacion & { anio: number; numero: number; from: string; to: string };
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
  /** Costo escrito a mano: si no es null, costo_total es este y no el de la receta. */
  costo_manual: number | null;
  /** Lo que daría la receta, haya o no costo manual. */
  costo_receta: number;
}

/** Utilidad neta real de un período: ventas − costo de productos vendidos − lo que se puso para el domiciliario (Fase 2, Módulo 8). */
export interface ReporteUtilidad {
  from: string;
  to: string;
  ventas: number;
  /** Incluye la línea "Pago auxiliares" de cada producto, como en el Excel */
  costoProductos: number;
  /** Lo que dejaron los productos vendidos para el domiciliario */
  recaudoDomiciliario: number;
  /** Lo que recibió el domiciliario en el período */
  pagoDomiciliario: number;
  /** pago − recaudo. Positivo = salió de la ganancia; negativo = sobró. */
  aporteDomiciliario: number;
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
