export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: number
          nombre: string
          orden: number
          created_at: string
        }
        Insert: {
          id?: number
          nombre: string
          orden?: number
          created_at?: string
        }
        Update: {
          id?: number
          nombre?: string
          orden?: number
          created_at?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          id: number
          nombre: string
          precio: number
          categoria_id: number | null
          activo: boolean
          es_adicion: boolean
          created_at: string
        }
        Insert: {
          id?: number
          nombre: string
          precio: number
          categoria_id?: number | null
          activo?: boolean
          es_adicion?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          nombre?: string
          precio?: number
          categoria_id?: number | null
          activo?: boolean
          es_adicion?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          }
        ]
      }
      pedidos: {
        Row: {
          id: number
          tipo: string
          numero_mesa: number | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          cliente_direccion: string | null
          estado: string
          metodo_pago: string | null
          subtotal: number
          recargo: number
          total: number
          motivo_cancelacion: string | null
          /** Monto en efectivo con el que el cliente va a pagar (para alistar la vuelta) */
          paga_con: number | null
          /** Vuelta a alistar = paga_con - total */
          vuelto: number | null
          /** Cobro adicional por domicilio fuera del sector (0 = sin cobro) */
          costo_domicilio: number
          /** Última modificación del pedido después de enviarlo (null = nunca) */
          modificado_at: string | null
          /** Nombre de quien quedó debiendo (obligatorio al marcar como 'debe') */
          deudor_nombre: string | null
          /** Teléfono de contacto del deudor (opcional) */
          deudor_telefono: string | null
          /** Persona que canceló el pedido, de la lista fija del local */
          cancelado_por: string | null
          /** Pedido que reemplazó a este después de cancelarlo (null = nunca se rehízo) */
          rehecho_en: number | null
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: number
          tipo: string
          numero_mesa?: number | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          cliente_direccion?: string | null
          estado?: string
          metodo_pago?: string | null
          subtotal?: number
          recargo?: number
          total?: number
          motivo_cancelacion?: string | null
          paga_con?: number | null
          vuelto?: number | null
          costo_domicilio?: number
          modificado_at?: string | null
          deudor_nombre?: string | null
          deudor_telefono?: string | null
          cancelado_por?: string | null
          rehecho_en?: number | null
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: number
          tipo?: string
          numero_mesa?: number | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          cliente_direccion?: string | null
          estado?: string
          metodo_pago?: string | null
          subtotal?: number
          recargo?: number
          total?: number
          motivo_cancelacion?: string | null
          paga_con?: number | null
          vuelto?: number | null
          costo_domicilio?: number
          modificado_at?: string | null
          deudor_nombre?: string | null
          deudor_telefono?: string | null
          cancelado_por?: string | null
          rehecho_en?: number | null
          created_at?: string
          closed_at?: string | null
        }
        Relationships: []
      }
      detalle_pedidos: {
        Row: {
          id: number
          pedido_id: number
          producto_id: number
          cantidad: number
          precio_unitario: number
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: number
          pedido_id: number
          producto_id: number
          cantidad?: number
          precio_unitario: number
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          pedido_id?: number
          producto_id?: number
          cantidad?: number
          precio_unitario?: number
          notas?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_pedidos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          }
        ]
      }
      pagos_pedido: {
        Row: {
          id: number
          pedido_id: number
          metodo: string
          /** Monto cobrado por ese método (en datáfono ya incluye su 5%) */
          monto: number
          created_at: string
        }
        Insert: {
          id?: number
          pedido_id: number
          metodo: string
          monto: number
          created_at?: string
        }
        Update: {
          id?: number
          pedido_id?: number
          metodo?: string
          monto?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          }
        ]
      }
      arqueos_caja: {
        Row: {
          id: number
          base_inicial: number
          estado: string
          opened_at: string
          closed_at: string | null
          total_efectivo: number
          total_transferencias: number
        }
        Insert: {
          id?: number
          base_inicial: number
          estado?: string
          opened_at?: string
          closed_at?: string | null
          total_efectivo?: number
          total_transferencias?: number
        }
        Update: {
          id?: number
          base_inicial?: number
          estado?: string
          opened_at?: string
          closed_at?: string | null
          total_efectivo?: number
          total_transferencias?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
