import React from 'react';
import styles from './ResumenCards.module.css';
import { formatCurrency } from '@/lib/utils';
import type { LiquidacionDomiciliario } from '@/types';
import { AjustePagoDomiciliario } from './AjustePagoDomiciliario';
import {
  IconBanknote,
  IconTrendingUp,
  IconClipboard,
  IconReceipt,
  IconClock,
  IconScooter,
  IconXCircle,
  IconCreditCard,
  IconPhone,
  IconLandmark,
  IconHandshake,
} from '@/components/ui/Icons';

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
  /** Domiciliario del período: lo que dejaron los productos, lo que se le pagó y la diferencia */
  domiciliario?: LiquidacionDomiciliario | null;
  /** Qué se está mirando: cambia "hoy" por "ese día" o "el período" en los textos */
  periodo?: Periodo;
  /** Si se mira un solo día, cuál ('YYYY-MM-DD'): habilita cambiar el pago de ese día */
  dia?: string;
}

export type Periodo = 'hoy' | 'dia' | 'rango';

/** Los textos que dependen de si se mira hoy, otro día o un rango de fechas */
const TEXTOS: Record<Periodo, {
  cobrado: string;
  seDebe: string;
  ventaReal: string;
  deudasViejas: string;
  entroACaja: string;
}> = {
  hoy: {
    cobrado: 'Cobrado hoy',
    seDebe: 'Se Debe de Hoy',
    ventaReal: 'Venta Real del Día',
    deudasViejas: 'Deudas Viejas Cobradas Hoy',
    entroACaja: 'entró hoy a la caja, pero es venta de otro día',
  },
  dia: {
    cobrado: 'Cobrado ese día',
    seDebe: 'Se Debe de Ese Día',
    ventaReal: 'Venta Real del Día',
    deudasViejas: 'Deudas Viejas Cobradas Ese Día',
    entroACaja: 'entró ese día a la caja, pero es venta de otro día',
  },
  rango: {
    cobrado: 'Cobrado en el período',
    seDebe: 'Se Debe del Período',
    ventaReal: 'Venta Real del Período',
    deudasViejas: 'Deudas Viejas Cobradas',
    entroACaja: 'entró a la caja en el período, pero es venta de antes',
  },
};

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
  domiciliario = null,
  periodo = 'hoy',
  dia,
}) => {
  const t = TEXTOS[periodo];
  // Si lo que se mira ya es esa semana, la línea de la semana repetiría la cifra grande.
  const semanaEsElPeriodo =
    !!domiciliario &&
    domiciliario.semana.aporte === domiciliario.aporte &&
    domiciliario.semana.pago === domiciliario.pago &&
    domiciliario.semana.recaudo === domiciliario.recaudo;
  return (
    <div className={styles.grid}>
      {/* ============================================================
          Las tres cifras del cuadre, juntas y en orden de lectura:
          lo que entró, lo que quedó fiado y la suma de las dos.
          ============================================================ */}

      {/* Total Facturado */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-primary)' }}><IconBanknote size={22} /></div>
        <p className={styles.cardLabel}>Total Facturado</p>
        <p className={styles.cardValue}>{formatCurrency(totalFacturado)}</p>
        <p className={styles.cardSub}>
          {t.cobrado} · incl. {formatCurrency(totalRecargos)} en recargos · sin domicilios
        </p>
      </div>

      {/* Fiado del día — lo que se vendió pero no se ha cobrado */}
      <div className={`${styles.card} ${styles.accentWarning}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-warning)' }}><IconBanknote size={22} /></div>
        <p className={styles.cardLabel}>{t.seDebe}</p>
        <p className={styles.cardValue}>{formatCurrency(totalFiadoHoy)}</p>
        <p className={styles.cardSub}>
          {cantidadFiadoHoy} pedido{cantidadFiadoHoy !== 1 ? 's' : ''} fiado
          {cantidadFiadoHoy !== 1 ? 's' : ''} · vendido pero sin cobrar
        </p>
      </div>

      {/* La cifra con la que se cuadra al cerrar */}
      <div className={`${styles.card} ${styles.accentSuccess} ${styles.cardDestacada}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-success)' }}><IconTrendingUp size={22} /></div>
        <p className={styles.cardLabel}>{t.ventaReal}</p>
        <p className={styles.cardValue}>{formatCurrency(ventaRealDelDia)}</p>
        <p className={styles.cardSub}>
          {formatCurrency(totalFacturado)} cobrado + {formatCurrency(totalFiadoHoy)} fiado
        </p>
      </div>

      {/* Cartera acumulada — arrastra deudas de días anteriores */}
      <div className={`${styles.card} ${styles.accentDanger}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-danger)' }}><IconClipboard size={22} /></div>
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
          <div className={styles.cardIcon} style={{ color: '#2DD4BF' }}><IconHandshake size={22} /></div>
          <p className={styles.cardLabel}>{t.deudasViejas}</p>
          <p className={styles.cardValue}>{formatCurrency(totalCobrosDeudasViejas)}</p>
          <p className={styles.cardSub}>
            {cantidadCobrosDeudasViejas} pago{cantidadCobrosDeudasViejas !== 1 ? 's' : ''} · {t.entroACaja}
          </p>
        </div>
      )}

      {/* Total Pedidos */}
      <div className={`${styles.card} ${styles.accentBlue}`}>
        <div className={styles.cardIcon} style={{ color: '#60A5FA' }}><IconReceipt size={22} /></div>
        <p className={styles.cardLabel}>Pedidos Completados</p>
        <p className={styles.cardValue}>{totalPedidos}</p>
        <p className={styles.cardSub}>
          {porTipo.mesa} Mesa · {porTipo.domicilio} Domicilio
        </p>
      </div>

      {/* Hora Pico */}
      <div className={`${styles.card} ${styles.accentOrange}`}>
        <div className={styles.cardIcon} style={{ color: '#FB923C' }}><IconClock size={22} /></div>
        <p className={styles.cardLabel}>Hora Pico</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>{horaPico}</p>
        <p className={styles.cardSub}>Horario con más pedidos</p>
      </div>

      {/* Tiempo Medio */}
      <div className={`${styles.card} ${styles.accentTeal}`}>
        <div className={styles.cardIcon} style={{ color: '#2DD4BF' }}><IconClock size={22} /></div>
        <p className={styles.cardLabel}>Tiempo Medio</p>
        <p className={styles.cardValue} style={{ fontSize: '1.2rem' }}>
          {tiempoPromedioMinutos ? `${tiempoPromedioMinutos} min` : 'N/A'}
        </p>
        <p className={styles.cardSub}>Desde inicio hasta cobro</p>
      </div>

      {/*
        Domiciliario, como lo lleva el dueño: cada producto vendido (mesa o
        domicilio; sin bebidas ni adicionales, salvo las papas) deja la
        tarifa, a él se le paga un fijo por día y la cifra grande es lo que
        hay que poner de la ganancia para completarlo, o lo que sobró.
      */}
      {domiciliario && (
        <div className={`${styles.card} ${styles.accentOrange} ${styles.cardDestacada}`}>
          <div className={styles.cardIcon} style={{ color: '#FB923C' }}><IconScooter size={22} /></div>
          <p className={styles.cardLabel}>
            {domiciliario.aporte < 0 ? 'Sobra del Domiciliario' : 'Pone para el Domiciliario'}
          </p>
          <p className={styles.cardValue}>{formatCurrency(Math.abs(domiciliario.aporte))}</p>
          <p className={styles.cardSub}>
            {domiciliario.unidades} producto{domiciliario.unidades !== 1 ? 's' : ''} ×{' '}
            {formatCurrency(domiciliario.tarifa)} = {formatCurrency(domiciliario.recaudo)} · se le paga
            {domiciliario.diasPagados !== 1 ? 'n' : ''} {formatCurrency(domiciliario.pago)}
            {domiciliario.diasPagados > 1 ? ` (${domiciliario.diasPagados} días)` : ''}
          </p>
          {!semanaEsElPeriodo && (
            <p className={styles.cardSub}>
              <strong>
                Semana {domiciliario.semana.numero}:{' '}
                {domiciliario.semana.aporte < 0 ? 'sobran' : 'pone'}{' '}
                {formatCurrency(Math.abs(domiciliario.semana.aporte))}
              </strong>{' '}
              · dejó {formatCurrency(domiciliario.semana.recaudo)}, pagó {formatCurrency(domiciliario.semana.pago)}
            </p>
          )}
          {totalDomicilios > 0 && (
            <p className={styles.cardSub}>Aparte: {formatCurrency(totalDomicilios)} de fuera del sector</p>
          )}
          {dia && (
            <AjustePagoDomiciliario
              dia={dia}
              pagoActual={domiciliario.pago}
              pagoFijo={domiciliario.pagoDia}
              ajustado={domiciliario.dias.some((d) => d.dia === dia && d.ajustado)}
            />
          )}
        </div>
      )}

      {/* Domicilios fuera del sector */}
      <div className={`${styles.card} ${styles.accentOrange}`}>
        <div className={styles.cardIcon} style={{ color: '#FB923C' }}><IconScooter size={22} /></div>
        <p className={styles.cardLabel}>Domicilios Fuera del Sector</p>
        <p className={styles.cardValue}>{formatCurrency(totalDomicilios)}</p>
        <p className={styles.cardSub}>
          {cantidadDomiciliosCobrados} domicilio{cantidadDomiciliosCobrados !== 1 ? 's' : ''} · va para el domiciliario
        </p>
      </div>

      {/* Cancelados */}
      <div className={`${styles.card} ${styles.accentDanger}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-danger)' }}><IconXCircle size={22} /></div>
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
        <div className={styles.cardIcon} style={{ color: 'var(--color-success)' }}><IconBanknote size={22} /></div>
        <p className={styles.cardLabel}>Efectivo</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.efectivo)}</p>
      </div>

      {/* Nequi */}
      <div className={`${styles.card} ${styles.accentPurple}`}>
        <div className={styles.cardIcon} style={{ color: '#A78BFA' }}><IconPhone size={22} /></div>
        <p className={styles.cardLabel}>Nequi</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.nequi)}</p>
      </div>

      {/* Datáfono */}
      <div className={`${styles.card} ${styles.accentWarning}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-warning)' }}><IconCreditCard size={22} /></div>
        <p className={styles.cardLabel}>Datáfono</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.datafono)}</p>
      </div>

      {/* Bancolombia */}
      <div className={`${styles.card} ${styles.accentPrimary}`}>
        <div className={styles.cardIcon} style={{ color: 'var(--color-primary)' }}><IconLandmark size={22} /></div>
        <p className={styles.cardLabel}>Bancolombia</p>
        <p className={styles.cardValue}>{formatCurrency(porMetodoPago.bancolombia)}</p>
      </div>
    </div>
  );
};
