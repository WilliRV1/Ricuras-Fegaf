'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ESTADOS_PEDIDO } from '@/lib/constants';
import { sesionConAcceso } from '@/lib/sesionServidor';
import { MENSAJE_ROL_NO_AUTORIZADO } from '@/lib/authErrors';

/**
 * Arqueo de caja. El módulo está apagado en el dashboard a petición de la
 * dueña, pero `getTimeWindow` sigue mirando si hay un turno abierto, así que
 * estas acciones tienen que ser correctas por si se reactiva:
 *
 *  - La escritura va por RPC (`abrir_caja`/`cerrar_caja`, migración
 *    20260916000000): la tabla no tiene política de INSERT/UPDATE y el
 *    insert directo de antes fallaba siempre.
 *  - Solo puede haber un turno abierto (índice único parcial) y solo se
 *    cierra un turno que esté abierto.
 */

function mensajeDeErrorCaja(mensaje: string | undefined): string {
  if (!mensaje) return 'Error inesperado.';
  if (mensaje.includes('ROL_NO_AUTORIZADO')) return MENSAJE_ROL_NO_AUTORIZADO;
  if (mensaje.includes('CAJA_YA_ABIERTA')) return 'Ya hay un turno de caja abierto. Ciérralo primero.';
  if (mensaje.includes('CAJA_YA_CERRADA')) return 'Ese turno ya estaba cerrado.';
  if (mensaje.includes('CAJA_NO_ENCONTRADA')) return 'Ese turno ya no existe.';
  if (mensaje.includes('BASE_INVALIDA')) return 'La base inicial no puede ser negativa.';
  return 'No se pudo completar la operación.';
}

export async function abrirCaja(baseInicial: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false, error: 'Necesitas una sesión de administración.' };
  }

  if (!Number.isFinite(baseInicial) || baseInicial < 0) {
    return { success: false, error: 'La base inicial no puede ser negativa.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('abrir_caja', { p_base_inicial: Math.round(baseInicial) });

  if (error) {
    console.error('Error al abrir caja:', error);
    return { success: false, error: mensajeDeErrorCaja(error.message) };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function cerrarCaja(id: number, efectivo: number, transferencias: number) {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { success: false, error: 'Necesitas una sesión de administración.' };
  }

  if (
    !Number.isFinite(efectivo) ||
    !Number.isFinite(transferencias) ||
    efectivo < 0 ||
    transferencias < 0
  ) {
    return { success: false, error: 'Los totales del cierre no pueden ser negativos.' };
  }

  const supabase = await createClient();

  // @ts-expect-error - RPC nuevo, sin generar en database.types.ts
  const { error } = await supabase.rpc('cerrar_caja', {
    p_id: id,
    p_efectivo: Math.round(efectivo),
    p_transferencias: Math.round(transferencias),
  });

  if (error) {
    console.error('Error al cerrar caja:', error);
    return { success: false, error: mensajeDeErrorCaja(error.message) };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function obtenerEstadoCaja() {
  if (!(await sesionConAcceso('/dashboard'))) {
    return { isOpen: false, data: null };
  }

  const supabase = await createClient();

  try {
    // maybeSingle: con cero filas no es un error. Más de una ya no puede
    // pasar (índice único), y si pasara sí debe verse como error.
    const { data: arqueo, error: arqueoError } = await supabase
      .from('arqueos_caja')
      .select('*')
      .eq('estado', 'abierto')
      .maybeSingle();

    if (arqueoError) throw arqueoError;

    if (!arqueo) {
      return { isOpen: false, data: null };
    }

    // Lo que entró a la caja durante el turno es lo que se COBRÓ desde que
    // se abrió (closed_at), no lo que se pidió: un pedido tomado antes de
    // abrir y cobrado después sí está en el cajón.
    const { data: ventas, error: ventasError } = await supabase
      .from('pedidos')
      .select('total, metodo_pago, pagos_pedido(metodo, monto)')
      .eq('estado', ESTADOS_PEDIDO.PAGADO)
      .gte('closed_at', arqueo.opened_at);

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
