'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fijarPagoDomiciliario } from '@/app/actions/dashboard';
import { toast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';
import styles from './AjustePagoDomiciliario.module.css';

interface AjustePagoDomiciliarioProps {
  /** Día que se está mirando, 'YYYY-MM-DD' */
  dia: string;
  /** Lo que la app tiene como pagado ese día */
  pagoActual: number;
  /** El fijo de Parámetros del Negocio */
  pagoFijo: number;
  /** true = el pago de ese día ya se cambió a mano */
  ajustado: boolean;
}

/**
 * Cambia lo que se le pagó al domiciliario un día puntual: no vino, se fue
 * temprano o se le pagó otra cifra. Vive dentro de la tarjeta del domiciliario
 * y solo aparece cuando se mira un solo día.
 */
export const AjustePagoDomiciliario: React.FC<AjustePagoDomiciliarioProps> = ({
  dia,
  pagoActual,
  pagoFijo,
  ajustado,
}) => {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(String(pagoActual));
  const [isPending, startTransition] = useTransition();

  const guardar = (pago: number | null) => {
    startTransition(async () => {
      const res = await fijarPagoDomiciliario(dia, pago);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        pago === null
          ? `El pago de ese día volvió a ${formatCurrency(pagoFijo)}.`
          : `Pago de ese día: ${formatCurrency(pago)}.`
      );
      setAbierto(false);
      router.refresh();
    });
  };

  const guardarValor = () => {
    const pago = Number(valor);
    if (valor.trim() === '' || !Number.isInteger(pago) || pago < 0) {
      toast.error('Escribe cuánto se le pagó, en pesos. Si no vino, escribe 0.');
      return;
    }
    guardar(pago);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        className={styles.abrirBtn}
        onClick={() => {
          setValor(String(pagoActual));
          setAbierto(true);
        }}
      >
        {ajustado ? 'Pago cambiado a mano · corregir' : 'Se le pagó otra cifra'}
      </button>
    );
  }

  return (
    <div className={styles.formulario}>
      <label className={styles.campo}>
        <span className={styles.etiqueta}>Pagado ese día (0 si no vino)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={styles.input}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={isPending}
          autoFocus
        />
      </label>
      <div className={styles.acciones}>
        <button type="button" className={styles.guardarBtn} onClick={guardarValor} disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar pago'}
        </button>
        {ajustado && (
          <button type="button" className={styles.secundarioBtn} onClick={() => guardar(null)} disabled={isPending}>
            Volver a {formatCurrency(pagoFijo)}
          </button>
        )}
        <button type="button" className={styles.secundarioBtn} onClick={() => setAbierto(false)} disabled={isPending}>
          Cancelar
        </button>
      </div>
    </div>
  );
};
