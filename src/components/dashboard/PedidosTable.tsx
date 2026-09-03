import React from 'react';
import styles from './PedidosTable.module.css';
import { formatCurrency } from '@/lib/utils';
import { TIPOS_ATENCION, ESTADOS_PEDIDO, METODOS_PAGO, METODO_PAGO_MIXTO } from '@/lib/constants';
import {
  IconUtensils,
  IconScooter,
  IconBanknote,
  IconPhone,
  IconCreditCard,
  IconLandmark,
  IconXCircle,
  IconRefresh,
} from '@/components/ui/Icons';

interface PedidoHistorial {
  id: number;
  tipo: string;
  numero_mesa: number | null;
  cliente_nombre: string | null;
  /** Quién quedó debiendo, cuando el pedido está en estado 'debe' */
  deudor_nombre?: string | null;
  estado: string;
  metodo_pago: string | null;
  subtotal: number;
  recargo: number;
  total: number;
  created_at: string;
  closed_at: string | null;
  /** Desglose cuando el pago se dividió entre varios métodos */
  pagos_pedido?: { metodo: string; monto: number }[];
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
      return (
        <span className={`${styles.badge} ${styles.badgeMesa}`}>
          <IconUtensils size={13} /> Mesa {numeroMesa}
        </span>
      );
    }
    return (
      <span className={`${styles.badge} ${styles.badgeDomicilio}`}>
        <IconScooter size={13} /> Domicilio
      </span>
    );
  };

  /** Nombre asociado al pedido: manda el del deudor, si lo hay */
  const getNombre = (pedido: PedidoHistorial) =>
    pedido.deudor_nombre ||
    (pedido.tipo === TIPOS_ATENCION.DOMICILIO ? pedido.cliente_nombre : null);

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

  const METODO_ICONOS: Record<string, React.ReactNode> = {
    [METODOS_PAGO.EFECTIVO]: <IconBanknote size={11} />,
    [METODOS_PAGO.NEQUI]: <IconPhone size={11} />,
    [METODOS_PAGO.DATAFONO]: <IconCreditCard size={11} />,
    [METODOS_PAGO.BANCOLOMBIA]: <IconLandmark size={11} />,
  };

  const getMetodoPago = (pedido: PedidoHistorial) => {
    const { metodo_pago: metodo, pagos_pedido: pagos } = pedido;

    // Un pedido sin cobrar no tiene método de pago. Antes salía una rayita
    // suelta que no decía nada; ahora dice por qué no hay pago y, si es una
    // deuda, quién la tiene.
    if (pedido.estado === ESTADOS_PEDIDO.DEBE) {
      return (
        <span className={styles.methodDebe}>
          <span className={styles.methodDebeRow}><IconBanknote size={13} /> Debe</span>
          {pedido.deudor_nombre && (
            <span className={styles.deudorNombre}>{pedido.deudor_nombre}</span>
          )}
        </span>
      );
    }

    if (pedido.estado === ESTADOS_PEDIDO.CANCELADO) {
      return <span className={styles.methodSinCobro}><IconXCircle size={13} /> Anulado</span>;
    }

    if (!metodo) return <span className={styles.methodSinCobro}>Sin cobrar aún</span>;

    // Pago dividido: se muestra el desglose de cuánto entró por cada método
    if (metodo === METODO_PAGO_MIXTO && pagos && pagos.length > 0) {
      return (
        <div>
          <span className={styles.methodMixto}><IconRefresh size={13} /> Mixto</span>
          <div style={{ fontSize: '0.6875rem', marginTop: '4px', color: 'var(--color-text-muted)' }}>
            {pagos.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {METODO_ICONOS[p.metodo] ?? ''} {formatCurrency(Number(p.monto))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    switch (metodo) {
      case METODOS_PAGO.EFECTIVO: return <span className={styles.methodEfectivo}><IconBanknote size={13} /> Efectivo</span>;
      case METODOS_PAGO.NEQUI: return <span className={styles.methodNequi}><IconPhone size={13} /> Nequi</span>;
      case METODOS_PAGO.DATAFONO: return <span className={styles.methodDatafono}><IconCreditCard size={13} /> Datáfono</span>;
      case METODOS_PAGO.BANCOLOMBIA: return <span className={styles.methodBancolombia}><IconLandmark size={13} /> Bancolombia</span>;
      default: return metodo;
    }
  };

  const formatHora = (isoDate: string | null) => {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleTimeString('es-CO', { 
      timeZone: 'America/Bogota',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTiempoBadge = (created: string | null, closed: string | null) => {
    if (!created || !closed) return '-';
    
    const start = new Date(created).getTime();
    const end = new Date(closed).getTime();
    const diffMin = Math.round((end - start) / 60000);

    if (diffMin < 0) return '-'; // En caso de inconsistencias

    let colorStyle: React.CSSProperties = { color: 'var(--color-text)', background: 'transparent' };
    
    if (diffMin >= 40) {
      colorStyle = { color: 'var(--color-danger)', background: 'rgba(248, 113, 113, 0.1)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }; // Rojo
    } else if (diffMin >= 25) {
      colorStyle = { color: 'var(--color-warning)', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }; // Naranja
    } else {
      colorStyle = { color: 'var(--color-text-muted)', background: 'transparent' };
    }

    return (
      <span style={colorStyle}>
        {diffMin} min
      </span>
    );
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
            <th className={styles.th}>Tiempo</th>
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
                {/*
                  El nombre se muestra también en mesa: si el pedido quedó
                  debiendo, es el único dato que permite ir a cobrarlo.
                */}
                {getNombre(pedido) && (
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                    {getNombre(pedido)}
                  </div>
                )}
              </td>
              <td className={`${styles.td} ${getEstadoClass(pedido.estado)}`} style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                {pedido.estado}
              </td>
              <td className={styles.td}>
                {getMetodoPago(pedido)}
              </td>
              <td className={styles.td}>
                {getTiempoBadge(pedido.created_at, pedido.closed_at)}
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
