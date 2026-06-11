import React from 'react';
import styles from './CancelacionesTable.module.css';

interface CancelacionesTableProps {
  cancelados: { id: number; motivo: string; hora: string }[];
}

export const CancelacionesTable: React.FC<CancelacionesTableProps> = ({ cancelados }) => {
  if (cancelados.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>✅</span>
        <p>Sin cancelaciones en este período. ¡Excelente!</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Pedido</th>
            <th className={styles.th}>Hora</th>
            <th className={styles.th}>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {cancelados.map((c) => (
            <tr key={c.id} className={styles.row}>
              <td className={styles.td}>
                <span className={styles.badge}>#{c.id}</span>
              </td>
              <td className={styles.td}>{c.hora}</td>
              <td className={styles.td}>
                <span className={styles.motivo}>{c.motivo}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
