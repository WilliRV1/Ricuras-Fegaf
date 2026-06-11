import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export function useRealtimeLiquidacion() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

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
          .eq('estado', ESTADOS_PEDIDO.LISTO)
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
      .channel('liquidacion-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const updatedOrder = payload.new as any;
          
          // Si el pedido fue marcado como "listo" en cocina, agregarlo a liquidación
          if (updatedOrder.estado === ESTADOS_PEDIDO.LISTO) {
            const orderWithDetails = await fetchOrderDetails(updatedOrder.id);
            if (orderWithDetails && mounted) {
              setOrders((prev) => {
                // Evitar duplicados si llega evento múltiple
                if (prev.some(o => o.id === orderWithDetails.id)) return prev;
                return [...prev, orderWithDetails];
              });
            }
          }
          
          // Si el pedido ya no está listo (ej: fue pagado o cancelado), removerlo
          if (updatedOrder.estado !== ESTADOS_PEDIDO.LISTO) {
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
