import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

/**
 * Pedidos que siguen pendientes en cocina, en tiempo real.
 *
 * Se usa en la pantalla de pedidos para poder modificar uno antes de que cocina
 * lo cierre. A diferencia de `useRealtimeOrders` (tablero de cocina), este hook
 * no reproduce sonidos: quien toma el pedido no necesita que le suene su propia
 * terminal cada vez que registra algo.
 */
export function usePendingOrders() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchPendientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalle_pedidos(*, productos(nombre))')
      .eq('estado', ESTADOS_PEDIDO.PENDIENTE)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando pedidos pendientes:', error);
      return null;
    }
    return (data || []) as unknown as PedidoWithDetalles[];
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const refrescar = async () => {
      const data = await fetchPendientes();
      if (mounted && data) {
        setOrders(data);
        setLoading(false);
      } else if (mounted) {
        setLoading(false);
      }
    };

    refrescar();

    // Cualquier cambio en pedidos (nuevo, listo, cancelado, modificado)
    // se resuelve recargando la lista: son pocos registros y evita
    // inconsistencias entre terminales.
    const channel = supabase
      .channel('pedidos-pendientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        refrescar();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { orders, loading, refetch: fetchPendientes };
}
