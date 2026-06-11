import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

/**
 * Reproduce un chime doble sutil usando la Web Audio API del navegador.
 * No requiere archivos externos. C5 (523Hz) → E5 (659Hz), suavemente.
 */
function playOrderChime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };
    playTone(523.25, 0,    0.30); // C5
    playTone(659.25, 0.18, 0.40); // E5
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Silencioso si el navegador no soporta Web Audio API
  }
}

export function useRealtimeOrders() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

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
        if (mounted) setConnectionStatus('connecting');
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, detalle_pedidos(*, productos(nombre))')
          .eq('estado', ESTADOS_PEDIDO.PENDIENTE)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (mounted) {
          setOrders((data || []) as unknown as PedidoWithDetalles[]);
          setLoading(false);
          setConnectionStatus('online');
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching initial orders:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
          setConnectionStatus('offline');
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newOrder = payload.new as any;
          if (newOrder.estado === ESTADOS_PEDIDO.PENDIENTE) {
            const orderWithDetails = await fetchOrderDetails(newOrder.id);
            if (orderWithDetails && mounted) {
              playOrderChime();
              setOrders((prev) => [...prev, orderWithDetails]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedOrder = payload.new as any;
          if (updatedOrder.estado !== ESTADOS_PEDIDO.PENDIENTE) {
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

    // Heartbeat: Verificar conexión cada 15 segundos y reintentar si está offline
    const heartbeat = setInterval(() => {
      if (mounted && supabase.getChannels().some(c => c.state === 'errored' || c.state === 'closed')) {
        setConnectionStatus('offline');
        fetchInitialOrders(); // Intenta reconectar cargando el initial state
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
