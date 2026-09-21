'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeOrders, ConnectionStatus, playScheduledChime } from '@/hooks/useRealtimeOrders';
import { createClient } from '@/lib/supabase/client';
import { OrderTicket } from './OrderTicket';
import { ScheduledOrderBanner } from './ScheduledOrderBanner';
import {
  IconRefresh,
  IconCalendar,
  IconList,
  IconUtensils,
  IconScooter,
  IconCheckCircle,
  IconSearch,
  IconChefHat,
  IconAlertTriangle,
} from '@/components/ui/Icons';
import styles from './OrderBoard.module.css';

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  if (status === 'connecting')
    return (
      <span className={styles.statusConnecting}>
        <IconRefresh size={14} className={styles.statusIconSpin} /> Conectando...
      </span>
    );
  if (status === 'offline')
    return (
      <span className={styles.statusOffline}>
        <span className={styles.statusDot} /> Desconectado (Reconectando...)
      </span>
    );
  return (
    <span className={styles.statusOnline}>
      <span className={styles.statusDot} /> Online
    </span>
  );
};

type FilterType = 'all' | 'mesa' | 'domicilio';

/** Si la base no responde, los programados entran 15 min antes (valor por defecto) */
const MINUTOS_ANTES_POR_DEFECTO = 15;

const horaCorta = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

export const OrderBoard: React.FC = () => {
  const { orders, scheduledOrders, loading, error, connectionStatus } = useRealtimeOrders();
  const [filterType, setFilterType] = useState<FilterType>('all');

  /* ------------------------------------------------------------------
     Programados (pedido de Francia, 21/9): antes tapaban la grilla todo
     el tiempo. Ahora, hasta N minutos antes de la hora de entrega, se ven
     solo como una franja de una línea (desplegable); al entrar en la
     ventana pasan a la grilla como una comanda más y suena el timbre.
     ------------------------------------------------------------------ */
  const [minutosAntes, setMinutosAntes] = useState(MINUTOS_ANTES_POR_DEFECTO);
  const [ahora, setAhora] = useState(() => Date.now());
  const [franjaAbierta, setFranjaAbierta] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from: (t: string) => any };
    db.from('parametros')
      .select('valor')
      .eq('clave', 'programados_minutos_antes')
      .maybeSingle()
      .then(({ data }: { data: { valor: number | string } | null }) => {
        const v = Number(data?.valor);
        if (Number.isFinite(v) && v >= 0) setMinutosAntes(v);
      });

    const reloj = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, []);

  const { enVentana, proximos } = useMemo(() => {
    const limite = ahora + minutosAntes * 60000;
    const enVentana: typeof scheduledOrders = [];
    const proximos: typeof scheduledOrders = [];
    for (const o of scheduledOrders) {
      (new Date(o.hora_entrega!).getTime() <= limite ? enVentana : proximos).push(o);
    }
    return { enVentana, proximos };
  }, [scheduledOrders, ahora, minutosAntes]);

  // Timbre cuando un programado entra en su ventana (no al cargar la página)
  const yaAvisados = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (yaAvisados.current === null) {
      yaAvisados.current = new Set(enVentana.map((o) => o.id));
      return;
    }
    let nuevo = false;
    for (const o of enVentana) {
      if (!yaAvisados.current.has(o.id)) {
        yaAvisados.current.add(o.id);
        nuevo = true;
      }
    }
    if (nuevo) playScheduledChime();
  }, [enVentana, loading]);

  if (loading) {
    return <div className={styles.loader}>Cargando comandas en tiempo real...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p><IconAlertTriangle size={16} /> Ocurrió un error de conexión al cargar las comandas.</p>
        <small>{error}</small>
      </div>
    );
  }

  // Los programados que ya entraron en su ventana se preparan como cualquier
  // comanda: van primero en la grilla, ordenados por hora de entrega.
  const regularOrders = [...enVentana, ...orders];
  const countMesas = regularOrders.filter(o => o.tipo === 'mesa').length;
  const countDomicilios = regularOrders.filter(o => o.tipo === 'domicilio').length;
  const filteredOrders = regularOrders.filter(o => filterType === 'all' || o.tipo === filterType);

  return (
    <div>
      {/* ============================================================
          PROGRAMADOS TODAVÍA LEJOS — una línea, sin tapar la grilla
          ============================================================ */}
      {proximos.length > 0 && (
        <section className={styles.franja}>
          <button
            type="button"
            className={styles.franjaToggle}
            onClick={() => setFranjaAbierta((v) => !v)}
            aria-expanded={franjaAbierta}
          >
            <span className={styles.franjaTitulo}>
              <IconCalendar size={16} /> Programados
              <span className={styles.scheduledCount}>{proximos.length}</span>
            </span>
            <span className={styles.franjaLista}>
              {proximos.map((o) => `#${o.id} a las ${horaCorta(o.hora_entrega!)}`).join(' · ')}
            </span>
            <span className={styles.franjaHint}>
              {franjaAbierta ? 'Ocultar ▴' : `entran ${minutosAntes} min antes ▾`}
            </span>
          </button>

          {franjaAbierta && (
            <div className={styles.scheduledList}>
              {proximos.map((order) => (
                <ScheduledOrderBanner key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================
          SECCIÓN REGULAR — Comandas en tiempo real
          ============================================================ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '16px' }}>
        <div className={styles.filtersContainer}>
          <button
            className={`${styles.filterBtn} ${filterType === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('all')}
          >
            <IconList size={16} /> Todos <span className={styles.filterCount}>{regularOrders.length}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${filterType === 'mesa' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('mesa')}
          >
            <IconUtensils size={16} /> Mesas <span className={styles.filterCount}>{countMesas}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${filterType === 'domicilio' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType('domicilio')}
          >
            <IconScooter size={16} /> Domicilios <span className={styles.filterCount}>{countDomicilios}</span>
          </button>
        </div>
        <div style={{ fontWeight: 'bold' }}>
          <ConnectionIndicator status={connectionStatus} />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            {filterType === 'all' ? <IconCheckCircle size={64} /> : <IconSearch size={64} />}
          </div>
          <h3 className={styles.emptyTitle}>
            {filterType === 'all' ? '¡Todo al día!' : 'Sin resultados'}
          </h3>
          <p className={styles.emptyText}>
            {filterType === 'all' ? (
              <>No hay pedidos pendientes en cocina. Buen trabajo <IconChefHat size={14} /></>
            ) : (
              `No hay pedidos pendientes para la categoría "${filterType}".`
            )}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredOrders.map((order) => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
