import React from 'react';
import styles from './CarteraTable.module.css';
import { formatCurrency } from '@/lib/utils';
import { IconCheckCircle, IconPhone, IconLightbulb } from '@/components/ui/Icons';

export interface DeudaPendiente {
  id: number;
  nombre: string;
  telefono: string | null;
  origen: string;
  monto: number;
  fecha: string;
  productos: string;
}

interface CarteraTableProps {
  deudas: DeudaPendiente[];
}

/** "hoy", "ayer" o la fecha, para saber de un vistazo qué tan vieja es la deuda */
function etiquetaFecha(iso: string) {
  const bogota = (fecha: Date) =>
    new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);

  const fechaDeuda = bogota(new Date(iso));
  const hoy = bogota(new Date());

  if (fechaDeuda === hoy) return 'Hoy';

  const ayer = bogota(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (fechaDeuda === ayer) return 'Ayer';

  return new Date(`${fechaDeuda}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

/** Días transcurridos desde que quedó la deuda, en hora de Colombia */
function diasTranscurridos(iso: string) {
  const dia = 24 * 60 * 60 * 1000;
  const inicio = new Date(iso).getTime();
  return Math.floor((Date.now() - inicio) / dia);
}

/**
 * Cartera pendiente por cobrar: quién debe, cuánto, desde cuándo y qué pidió.
 *
 * Arrastra las deudas de todos los días hasta que se cobran desde liquidación.
 */
export const CarteraTable: React.FC<CarteraTableProps> = ({ deudas }) => {
  if (deudas.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}><IconCheckCircle size={32} style={{ color: 'var(--color-success)' }} /></span>
        <p>No hay nada pendiente por cobrar. Toda la venta está al día.</p>
      </div>
    );
  }

  const total = deudas.reduce((sum, d) => sum + d.monto, 0);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Quién debe</th>
            <th className={styles.th}>Desde</th>
            <th className={styles.th}>Pedido</th>
            <th className={styles.th} style={{ textAlign: 'right' }}>Debe</th>
          </tr>
        </thead>
        <tbody>
          {deudas.map((deuda) => {
            const dias = diasTranscurridos(deuda.fecha);

            return (
              <tr key={deuda.id} className={styles.row}>
                <td className={styles.td}>
                  <span className={styles.nombre}>{deuda.nombre}</span>
                  {deuda.telefono && (
                    <span className={styles.telefono}><IconPhone size={12} /> {deuda.telefono}</span>
                  )}
                </td>
                <td className={styles.td}>
                  <span className={styles.fecha}>{etiquetaFecha(deuda.fecha)}</span>
                  {/* Una semana sin cobrar ya merece que salte a la vista */}
                  {dias >= 7 && (
                    <span className={styles.vieja}>{dias} días</span>
                  )}
                </td>
                <td className={styles.td}>
                  <span className={styles.badge}>#{deuda.id}</span>
                  <span className={styles.origen}>{deuda.origen}</span>
                  <span className={styles.productos}>{deuda.productos}</span>
                </td>
                <td className={`${styles.td} ${styles.monto}`}>
                  {formatCurrency(deuda.monto)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.totalLabel} colSpan={3}>
              Total por cobrar
            </td>
            <td className={styles.totalValue}>{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>

      <p className={styles.nota}>
        <IconLightbulb size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
        Para cobrar una deuda, ábrela en <strong>Liquidación</strong> → sección
        &quot;Deudas Pendientes&quot; y registra el pago. Ahí sale de esta lista.
      </p>
    </div>
  );
};
