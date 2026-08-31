import React from 'react';
import styles from './CancelacionesTable.module.css';
import { formatCurrency } from '@/lib/utils';

export interface CancelacionDetalle {
  id: number;
  hora: string;
  motivo: string;
  canceladoPor: string | null;
  origen: string;
  monto: number;
  /** Id del pedido que lo reemplazó. Null = nunca se volvió a montar. */
  rehechoEn: number | null;
  productos: string;
}

interface CancelacionesTableProps {
  cancelados: CancelacionDetalle[];
}

/**
 * Pedidos anulados del día, con todo lo necesario para reconstruir una venta
 * que alguien borró: qué contenía, cuánto valía, quién lo anuló y si se volvió
 * a montar.
 */
export const CancelacionesTable: React.FC<CancelacionesTableProps> = ({ cancelados }) => {
  if (cancelados.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>✅</span>
        <p>Sin cancelaciones en este período. ¡Excelente!</p>
      </div>
    );
  }

  const sinRehacer = cancelados.filter((c) => c.rehechoEn === null);

  return (
    <div className={styles.wrapper}>
      {/*
        El aviso importante: un pedido anulado que nunca se volvió a montar es
        justamente lo que descuadra la caja al cerrar.
      */}
      {sinRehacer.length > 0 && (
        <div className={styles.alerta}>
          ⚠️ {sinRehacer.length} pedido{sinRehacer.length !== 1 ? 's' : ''} anulado
          {sinRehacer.length !== 1 ? 's' : ''} no se volvió a montar
          {sinRehacer.length !== 1 ? 'n' : ''}. Si el cliente sí se llevó la comida, esa venta
          no está registrada en ninguna parte.
        </div>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Pedido</th>
            <th className={styles.th}>Hora</th>
            <th className={styles.th}>Qué contenía</th>
            <th className={styles.th}>Motivo</th>
            <th className={styles.th}>Quién</th>
            <th className={styles.th} style={{ textAlign: 'right' }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {cancelados.map((c) => (
            <tr key={c.id} className={styles.row}>
              <td className={styles.td}>
                <span className={styles.badge}>#{c.id}</span>
                <span className={styles.origen}>{c.origen}</span>
              </td>
              <td className={styles.td}>{c.hora}</td>
              <td className={styles.td}>
                <span className={styles.productos}>{c.productos}</span>
                {c.rehechoEn !== null ? (
                  <span className={styles.rehecho}>🔁 Rehecho en #{c.rehechoEn}</span>
                ) : (
                  <span className={styles.sinRehacer}>Sin volver a montar</span>
                )}
              </td>
              <td className={styles.td}>
                <span className={styles.motivo}>{c.motivo}</span>
              </td>
              <td className={styles.td}>
                {c.canceladoPor ? (
                  <span className={styles.persona}>{c.canceladoPor}</span>
                ) : (
                  <span className={styles.sinDato}>Sin registrar</span>
                )}
              </td>
              <td className={`${styles.td} ${styles.monto}`}>{formatCurrency(c.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
