import React from 'react';
import styles from './ResumenCards.module.css';
import { formatCurrency } from '@/lib/utils';

interface ResumenCardsProps {
  totalPedidos: number;
  totalFacturado: number;
  totalRecargos: number;
  /** Cobros por domicilio fuera del sector (lo que gana el domiciliario) */
  totalDomicilios?: number;
  cantidadDomiciliosCobrados?: number;
  horaPico: string;
  tiempoPromedioMinutos?: number;
  cantidadCancelados: number;
  montoCancelado: number;
  /** Vendido hoy que quedó fiado (todavía sin cobrar) */
  totalFiadoHoy: number;
  cantidadFiadoHoy: number;
  /** Facturado + fiado — la venta real del día */
  ventaRealDelDia: number;
  /** Todo lo que deben, de cualquier día */
  carteraTotal: number;
  carteraCantidad: number;
  /** Deudas de días anteriores que se cobraron hoy */
  totalCobrosDeudasViejas: number;
  cantidadCobrosDeudasViejas: number;
  porMetodoPago: {
    efectivo: number;
    nequi: number;
    datafono: number;
    bancolombia: number;
  };
  porTipo: {
    mesa: number;
    domicilio: number;
  };
}

export const ResumenCards: React.FC<ResumenCardsProps> = ({
  totalPedidos,
  totalFacturado,
  totalRecargos,
  totalDomicilios = 0,
  cantidadDomiciliosCobrados = 0,
  horaPico,
  tiempoPromedioMinutos,
  cantidadCancelados,
  montoCancelado,
  totalFiadoHoy,
  cantidadFiadoHoy,
  ventaRealDelDia,
  carteraTotal,
  carteraCantidad,
  totalCobrosDeudasViejas,
  cantidadCobrosDeudasViejas,
  porMetodoPago,
  porTipo,
}) => {
  return (
    <div className={styles.grid}>
      {/* ============================================================
          Las tres cifras del cuadre, juntas y en orden de lectura:
          lo que entró, lo que quedó fiado y la suma de las dos.
          ============================================================ */}

      {/* Total Facturado */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon}>💰</div>
        <p className={styles.cardLabel}>Total Facturado</p>
        <p className={styles.cardValue}>{formatCurrency(totalFacturado)}</p>
        <p className={styles.cardSub}>
          Cobrado hoy · incl. {formatCurrency(totalRecargos)} en recargos · sin domicilios
        </p>
      </div>

      {/* Fiado del día — lo que se vendió pero no se ha cobrado */}
      <div className={`${styles.card} ${styles.accentWarning}`}>
        <div className={styles.cardIcon}>💸</div>
        <p className={styles.cardLabel}>Se Debe de Hoy</p>
        <p className={styles.cardValue}>{formatCurrency(totalFiadoHoy)}</p>
        <p className={styles.cardSub}>
          {cantidadFiadoHoy} pedido{cantidadFiadoHoy !== 1 ? 's' : ''} fiado
          {cantidadFiadoHoy !== 1 ? 's' : ''} · vendido pero sin cobrar
        </p>
      </div>

      {/* La cifra con la que se cuadra al cerrar */}
      <div className={`${styles.card} ${styles.accentSuccess} ${styles.cardDestacada}`}>
        <div className={styles.cardIcon}>🧮</div>
        <p className={styles.cardLabel}>Venta Real del Día</p>
        <p className={styles.cardValue}>{formatCurrency(ventaRealDelDia)}</p>
        <p className={styles.cardSub}>
          {formatCurrency(totalFacturado)} cobrado + {formatCurrency(totalFiadoHoy)} fiado
        </p>
      </div>

      {/* Cartera acumulada — arrastra deudas de días anteriores */}
      <div className={`${styles.card} ${styles.accentDanger}`}>
        <div className={styles.cardIcon}>📋</div>
        <p className={styles.cardLabel}>Cartera por Cobrar</p>
        <p className={styles.cardValue}>{formatCurrency(carteraTotal)}</p>
        <p className={styles.cardSub}>
          {carteraCantidad} deuda{carteraCantidad !== 1 ? 's' : ''} pendiente
          {carteraCantidad !== 1 ? 's' : ''} · de todos los días
        </p>
      </div>

      {/*
        Plata que entró hoy pero pertenece a una venta de otro día. No está en
        "Total Facturado" (que va por fecha del pedido), así que al contar el
        efectivo de la caja hay que tenerla en cuenta aparte.
      */}
      {totalCobrosDeudasViejas > 0 && (
        <div className={`${styles.card} ${styles.accentTeal}`}>
          <div className={styles.cardIcon}>🤝</div>
          <p className={styles.cardLabel}>Deudas Viejas Cobradas Hoy</p>
          <p className={styles.cardValue}>{formatCurrency(totalCobrosDeudasViejas)}</p>
          <p className={styles.cardSub}>
            {cantidadCobrosDeudasViejas} pago{cantidadCobrosDeudasViejas !== 1 ? 's' : ''} · entró
            hoy a la caja, pero es venta de otro día
          </p>
        </div>
      )}

      {/* Total Pedidos */}
      <div className={`${styles.card} ${styles.accentBlue}`}>
        <div className={styles.cardIcon}>🧾</div>
        <p className={styles.cardLabel}>Pedidos Completados</p>
        <p className={styles.cardValue}>{totalPedidos}</p>
        <p className={styles.cardSub}>
          {porTipo.mesa} Mesa · {porTipo.domicilio} Domicilio
        </p>
      </div>

      {/* Hora Pico */}
      <div className={`${styles.card} ${styles.accentOrange}`}>
        <div className={styles.cardIcon}>🕐</div>
        <p className={styles.cardLabel}>Hora Pico</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>{horaPico}</p>
        <p className={styles.cardSub}>Horario con más pedidos</p>
      </div>

      {/* Tiempo Medio */}
      <div className={`${styles.card} ${styles.accentTeal}`}>
        <div className={styles.cardIcon}>⏱️</div>
        <p className={styles.cardLabel}>Tiempo Medio</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>
          {tiempoPromedioMinutos ? `${tiempoPromedioMinutos} min` : 'N/A'}
        </p>
        <p className={styles.cardSub}>Desde inicio hasta cobro</p>
      </div>

      {/* Domicilios fuera del sector */}
      <div className={`${styles.card} ${styles.accentOrange}`}>
        <div className={styles.cardIcon}>🛵</div>
        <p className={styles.cardLabel}>Domicilios Fuera del Sector</p>
        <p className={styles.cardValue}>{formatCurrency(totalDomicilios)}</p>
        <p className={styles.cardSub}>
          {cantidadDomiciliosCobrados} domicilio{cantidadDomiciliosCobrados !== 1 ? 's' : ''} · va para el domiciliario
        </p>
      </div>

      {/* Cancelados */}
      <div className={`${styles.card} ${styles.accentDanger}`}>
        <div className={styles.cardIcon}>❌</div>
        <p className={styles.cardLabel}>Cancelados</p>
        <p className={styles.cardValue}>{cantidadCancelados}</p>
        <p className={styles.cardSub}>
          {cantidadCancelados > 0
            ? `${formatCurrency(montoCancelado)} en ventas anuladas`
            : 'Ningún pedido anulado'}
        </p>
      </div>

      {/* Efectivo */}
      <div className={`${styles.card} ${styles.accentSuccess}`}>
        <div className={styles.cardIcon}>💵</div>
        <p className={styles.cardLabel}>Efectivo</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.efectivo)}</p>
      </div>

      {/* Nequi */}
      <div className={`${styles.card} ${styles.accentPurple}`}>
        <div className={styles.cardIcon}>📱</div>
        <p className={styles.cardLabel}>Nequi</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.nequi)}</p>
      </div>

      {/* Datáfono */}
      <div className={`${styles.card} ${styles.accentWarning}`}>
        <div className={styles.cardIcon}>💳</div>
        <p className={styles.cardLabel}>Datáfono</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.datafono)}</p>
      </div>

      {/* Bancolombia */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon}>🏦</div>
        <p className={styles.cardLabel}>Bancolombia</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.bancolombia)}</p>
      </div>
    </div>
  );
};
