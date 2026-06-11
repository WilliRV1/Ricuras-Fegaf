import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export function useRealtimeOrders() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Helper para hacer fetch de un solo pedido completo con sus detalles
    const fetchOrderDetails = async (orderId: number): Promise<PedidoWithDetalles | null> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, detalle_pedidos(*, productos(nombre))')
        .eq('id', orderId)
        .single();
      
      if (error || !data) {
        console.error('Error fetching order details:', error);
        return null;
      }
      return data as PedidoWithDetalles;
    };

    const fetchInitialOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, detalle_pedidos(*, productos(nombre))')
          .eq('estado', ESTADOS_PEDIDO.PENDIENTE)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (mounted) {
          setOrders((data || []) as unknown as PedidoWithDetalles[]);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Error fetching initial orders:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchInitialOrders();

    const channel = supabase
      .channel('kds-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const newOrder = payload.new as any;
          if (newOrder.estado === ESTADOS_PEDIDO.PENDIENTE) {
            // El INSERT de Supabase solo trae los campos de 'pedidos', no las relaciones
            const orderWithDetails = await fetchOrderDetails(newOrder.id);
            if (orderWithDetails && mounted) {
              setOrders((prev) => [...prev, orderWithDetails]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (payload) => {
          const updatedOrder = payload.new as any;
          // Si el pedido ya no está pendiente (fue completado o cancelado), lo removemos del tablero
          if (updatedOrder.estado !== ESTADOS_PEDIDO.PENDIENTE) {
            if (mounted) {
              setOrders((prev) => prev.filter((order) => order.id !== updatedOrder.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loading, error };
}
