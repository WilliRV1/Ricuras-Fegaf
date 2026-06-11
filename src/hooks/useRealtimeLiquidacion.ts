import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export function useRealtimeLiquidacion() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

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
        if (mounted) setConnectionStatus('connecting');
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, detalle_pedidos(*, productos(nombre))')
          .eq('estado', ESTADOS_PEDIDO.LISTO)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (mounted) {
          setOrders((data || []) as unknown as PedidoWithDetalles[]);
          setLoading(false);
          setConnectionStatus('online');
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Error fetching initial ready orders:', err);
          setError(err.message);
          setLoading(false);
          setConnectionStatus('offline');
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedOrder = payload.new as any;
          
          if (updatedOrder.estado === ESTADOS_PEDIDO.LISTO) {
            const orderWithDetails = await fetchOrderDetails(updatedOrder.id);
            if (orderWithDetails && mounted) {
              setOrders((prev) => {
                if (prev.some(o => o.id === orderWithDetails.id)) return prev;
                return [...prev, orderWithDetails];
              });
            }
          }
          
          if (updatedOrder.estado !== ESTADOS_PEDIDO.LISTO) {
            if (mounted) {
              setOrders((prev) => prev.filter((order) => order.id !== updatedOrder.id));
            }
          }
        }
      )
      .subscribe((status) => {
        if (mounted) {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('online');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('offline');
          }
        }
      });

    const heartbeat = setInterval(() => {
      if (mounted && supabase.getChannels().some(c => c.state === 'errored' || c.state === 'closed')) {
        setConnectionStatus('offline');
        fetchInitialOrders();
      }
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { orders, loading, error, connectionStatus };
}
