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
          id: string
          nombre: string
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          created_at?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          precio: number
          imagen_url: string | null
          categoria_id: string | null
          disponible: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          precio: number
          imagen_url?: string | null
          categoria_id?: string | null
          disponible?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          precio?: number
          imagen_url?: string | null
          categoria_id?: string | null
          disponible?: boolean
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
          id: string
          cliente_nombre: string
          cliente_telefono: string | null
          estado: string
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          cliente_nombre: string
          cliente_telefono?: string | null
          estado?: string
          total?: number
          created_at?: string
        }
        Update: {
          id?: string
          cliente_nombre?: string
          cliente_telefono?: string | null
          estado?: string
          total?: number
          created_at?: string
        }
        Relationships: []
      }
      detalle_pedidos: {
        Row: {
          id: string
          pedido_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          created_at: string
        }
        Insert: {
          id?: string
          pedido_id: string
          producto_id: string
          cantidad?: number
          precio_unitario: number
          created_at?: string
        }
        Update: {
          id?: string
          pedido_id?: string
          producto_id?: string
          cantidad?: number
          precio_unitario?: number
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
