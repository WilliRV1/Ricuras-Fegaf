'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ESTADOS_PEDIDO } from '@/lib/constants';

export async function abrirCaja(baseInicial: number) {
  const supabase = await createClient();
  
  try {
    // Verificar si ya hay una caja abierta
    const { data: abierta } = await supabase
      .from('arqueos_caja')
      .select('id')
      .eq('estado', 'abierto')
      .single();

    if (abierta) {
      return { success: false, error: 'Ya hay un turno de caja abierto. Ciérralo primero.' };
    }

    const { error } = await supabase
      .from('arqueos_caja')
      .insert([{ base_inicial: baseInicial, estado: 'abierto' }]);

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error al abrir caja:', error);
    return { success: false, error: 'Error inesperado al abrir la caja.' };
  }
}

export async function cerrarCaja(id: number, efectivo: number, transferencias: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('arqueos_caja')
      .update({ 
        estado: 'cerrado', 
        closed_at: new Date().toISOString(),
        total_efectivo: efectivo,
        total_transferencias: transferencias
      })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    return { success: false, error: 'Error inesperado al cerrar la caja.' };
  }
}

export async function obtenerEstadoCaja() {
  const supabase = await createClient();
  
  try {
    const { data: arqueo } = await supabase
      .from('arqueos_caja')
      .select('*')
      .eq('estado', 'abierto')
      .single();

    if (!arqueo) {
      return { isOpen: false, data: null };
    }

    // Calcular ventas desde opened_at
    const { data: ventas, error: ventasError } = await supabase
      .from('pedidos')
      .select('total, metodo_pago, pagos_pedido(metodo, monto)')
      .eq('estado', ESTADOS_PEDIDO.PAGADO)
      .gte('created_at', arqueo.opened_at);

    if (ventasError) throw ventasError;

    let ventasEfectivo = 0;
    let ventasTransferencias = 0; // Nequi, Bancolombia, Datáfono (todo lo no efectivo)

    ventas?.forEach(pedido => {
      const pagos = pedido.pagos_pedido ?? [];

      // Con pagos divididos, cada parte va a su bolsillo: lo que entró en
      // efectivo debe estar en la caja, el resto no.
      if (pagos.length > 0) {
        for (const pago of pagos) {
          const monto = Number(pago.monto) || 0;
          if (pago.metodo === 'efectivo') {
            ventasEfectivo += monto;
          } else {
            ventasTransferencias += monto;
          }
        }
        return;
      }

      // Pedidos anteriores a los pagos divididos: un solo método.
      // Si no tiene método registrado se asume efectivo de caja.
      const total = Number(pedido.total);
      if (pedido.metodo_pago === 'efectivo' || !pedido.metodo_pago) {
        ventasEfectivo += total;
      } else {
        ventasTransferencias += total;
      }
    });

    return {
      isOpen: true,
      data: {
        ...arqueo,
        ventasEfectivo,
        ventasTransferencias,
        totalEsperadoEfectivo: Number(arqueo.base_inicial) + ventasEfectivo
      }
    };
  } catch (error) {
    console.error('Error al obtener estado de caja:', error);
    return { isOpen: false, data: null, error: 'Error al cargar datos de la caja.' };
  }
}
