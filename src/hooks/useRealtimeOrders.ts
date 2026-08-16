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

/**
 * Reproduce un chime especial (triple) para pedidos programados — más llamativo.
 */
function playScheduledChime() {
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
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };
    playTone(659.25, 0,    0.25); // E5
    playTone(783.99, 0.20, 0.25); // G5
    playTone(1046.5, 0.40, 0.40); // C6
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Silencioso si el navegador no soporta Web Audio API
  }
}

/**
 * Chime de atención cuando una comanda que ya estaba en el tablero cambia
 * (el cliente modificó el pedido). Es distinto al de pedido nuevo: dos tonos
 * descendentes, para que cocina levante la vista y relea la comanda.
 */
function playModifiedChime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };
    playTone(880, 0, 0.22);    // A5
    playTone(587.33, 0.18, 0.45); // D5
    setTimeout(() => ctx.close(), 900);
  } catch {
    // Silencioso si el navegador no soporta Web Audio API
  }
}

export function useRealtimeOrders() {
  // orders = pedidos regulares (sin hora_entrega)
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  // scheduledOrders = pedidos con hora_entrega — siempre fijados arriba
  const [scheduledOrders, setScheduledOrders] = useState<PedidoWithDetalles[]>([]);
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

    /** Separa pedidos entre regulares y programados y actualiza el estado */
    const splitAndSetOrders = (allOrders: PedidoWithDetalles[]) => {
      const regular = allOrders.filter(o => !o.hora_entrega);
      const scheduled = allOrders.filter(o => !!o.hora_entrega)
        // Ordenar los programados por hora de entrega ascendente
        .sort((a, b) => new Date(a.hora_entrega!).getTime() - new Date(b.hora_entrega!).getTime());
      setOrders(regular);
      setScheduledOrders(scheduled);
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
          splitAndSetOrders((data || []) as unknown as PedidoWithDetalles[]);
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
              // Chime distinto para pedidos programados
              if (orderWithDetails.hora_entrega) {
                playScheduledChime();
                setScheduledOrders((prev) =>
                  [...prev, orderWithDetails].sort(
                    (a, b) => new Date(a.hora_entrega!).getTime() - new Date(b.hora_entrega!).getTime()
                  )
                );
              } else {
                playOrderChime();
                setOrders((prev) => [...prev, orderWithDetails]);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedOrder = payload.new as any;

          // Ya no está pendiente (listo, cancelado, etc.) → sale del tablero
          if (updatedOrder.estado !== ESTADOS_PEDIDO.PENDIENTE) {
            if (mounted) {
              setOrders((prev) => prev.filter((order) => order.id !== updatedOrder.id));
              setScheduledOrders((prev) => prev.filter((order) => order.id !== updatedOrder.id));
            }
            return;
          }

          // Sigue pendiente pero cambió: lo modificaron desde la terminal de
          // pedidos. Hay que recargar la comanda porque los productos pueden
          // ser otros — cocina puede haber empezado a prepararla.
          const orderWithDetails = await fetchOrderDetails(updatedOrder.id);
          if (!orderWithDetails || !mounted) return;

          playModifiedChime();

          // La edición pudo agregar o quitar la hora de entrega, así que el
          // pedido puede cambiar de sección.
          setOrders((prev) => {
            const sinEste = prev.filter((o) => o.id !== orderWithDetails.id);
            return orderWithDetails.hora_entrega ? sinEste : [...sinEste, orderWithDetails];
          });
          setScheduledOrders((prev) => {
            const sinEste = prev.filter((o) => o.id !== orderWithDetails.id);
            if (!orderWithDetails.hora_entrega) return sinEste;
            return [...sinEste, orderWithDetails].sort(
              (a, b) => new Date(a.hora_entrega!).getTime() - new Date(b.hora_entrega!).getTime()
            );
          });
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

  return { orders, scheduledOrders, loading, error, connectionStatus };
}
