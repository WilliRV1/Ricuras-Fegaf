import React from 'react';
import styles from './PedidosTable.module.css';
import { formatCurrency } from '@/lib/utils';
import { TIPOS_ATENCION, ESTADOS_PEDIDO, METODOS_PAGO } from '@/lib/constants';

interface PedidoHistorial {
  id: number;
  tipo: string;
  numero_mesa: number | null;
  cliente_nombre: string | null;
  estado: string;
  metodo_pago: string | null;
  subtotal: number;
  recargo: number;
  total: number;
  created_at: string;
  closed_at: string | null;
}

interface PedidosTableProps {
  pedidos: PedidoHistorial[];
}

export const PedidosTable: React.FC<PedidosTableProps> = ({ pedidos }) => {
  if (!pedidos || pedidos.length === 0) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>No hay pedidos registrados hoy.</p>
      </div>
    );
  }

  const getTipoBadge = (tipo: string, numeroMesa: number | null) => {
    if (tipo === TIPOS_ATENCION.MESA) {
      return <span className={`${styles.badge} ${styles.badgeMesa}`}>🍽️ Mesa {numeroMesa}</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeDomicilio}`}>🛵 Domicilio</span>;
  };

  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case ESTADOS_PEDIDO.PAGADO: return styles.estadoPagado;
      case ESTADOS_PEDIDO.PENDIENTE: return styles.estadoPendiente;
      case ESTADOS_PEDIDO.LISTO: return styles.estadoListo;
      case ESTADOS_PEDIDO.CANCELADO: return styles.estadoCancelado;
      case ESTADOS_PEDIDO.DEBE: return styles.estadoDebe;
      default: return '';
    }
  };

  const getMetodoPago = (metodo: string | null) => {
    if (!metodo) return '-';
    switch (metodo) {
      case METODOS_PAGO.EFECTIVO: return <span className={styles.methodEfectivo}>💵 Efectivo</span>;
      case METODOS_PAGO.NEQUI: return <span className={styles.methodNequi}>📱 Nequi</span>;
      case METODOS_PAGO.DATAFONO: return <span className={styles.methodDatafono}>💳 Datáfono</span>;
      case METODOS_PAGO.BANCOLOMBIA: return <span className={styles.methodBancolombia}>🏦 Bancolombia</span>;
      default: return metodo;
    }
  };

  const formatHora = (isoDate: string | null) => {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>ID</th>
            <th className={styles.th}>Hora</th>
            <th className={styles.th}>Tipo</th>
            <th className={styles.th}>Estado</th>
            <th className={styles.th}>Método</th>
            <th className={styles.th} style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => (
            <tr key={pedido.id} className={styles.tr}>
              <td className={`${styles.td} ${styles.orderId}`}>#{pedido.id}</td>
              <td className={styles.td}>{formatHora(pedido.created_at)}</td>
              <td className={styles.td}>
                {getTipoBadge(pedido.tipo, pedido.numero_mesa)}
                {pedido.tipo === TIPOS_ATENCION.DOMICILIO && pedido.cliente_nombre && (
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                    {pedido.cliente_nombre}
                  </div>
                )}
              </td>
              <td className={`${styles.td} ${getEstadoClass(pedido.estado)}`} style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                {pedido.estado}
              </td>
              <td className={styles.td}>
                {getMetodoPago(pedido.metodo_pago)}
              </td>
              <td className={`${styles.td} ${styles.total}`} style={{ textAlign: 'right' }}>
                {formatCurrency(pedido.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
