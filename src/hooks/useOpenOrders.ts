import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PedidoWithDetalles } from '@/types';
import { ESTADOS_PEDIDO } from '@/lib/constants';

/**
 * Pedidos abiertos —todavía sin cobrar— en tiempo real.
 *
 * Incluye los dos estados que se pueden modificar:
 *  - `pendiente`: cocina todavía no lo despacha.
 *  - `listo`: cocina ya lo despachó y está esperando el cobro. Es el momento
 *    en que el cliente dice "y me das una gaseosa", así que también tiene que
 *    poder modificarse.
 *
 * Se usa en la pantalla de pedidos. A diferencia de `useRealtimeOrders`
 * (tablero de cocina), este hook no reproduce sonidos: quien toma el pedido no
 * necesita que le suene su propia terminal cada vez que registra algo.
 */
export function useOpenOrders() {
  const [orders, setOrders] = useState<PedidoWithDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchAbiertos = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalle_pedidos(*, productos(nombre))')
      .in('estado', [ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.LISTO])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando pedidos abiertos:', error);
      return null;
    }
    return (data || []) as unknown as PedidoWithDetalles[];
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const refrescar = async () => {
      const data = await fetchAbiertos();
      if (mounted && data) {
        setOrders(data);
        setLoading(false);
      } else if (mounted) {
        setLoading(false);
      }
    };

    refrescar();

    // Cualquier cambio en pedidos (nuevo, listo, cobrado, cancelado,
    // modificado) se resuelve recargando la lista: son pocos registros y
    // evita inconsistencias entre terminales.
    const channel = supabase
      .channel('pedidos-abiertos')
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

  return { orders, loading, refetch: fetchAbiertos };
}
