import { getResumenDelDia, getPedidosRecientes, getProductosVendidosDelDia } from '@/app/actions/dashboard';
import { obtenerEstadoCaja } from '@/app/actions/caja';
import { ResumenCards } from '@/components/dashboard/ResumenCards';
import { PedidosTable } from '@/components/dashboard/PedidosTable';
import { CancelacionesTable } from '@/components/dashboard/CancelacionesTable';
import { ProductosVendidosTable } from '@/components/dashboard/ProductosVendidosTable';
import { StockManager } from '@/components/dashboard/StockManager';
import { ArqueoCaja } from '@/components/dashboard/ArqueoCaja';
import { DatePicker } from '@/components/dashboard/DatePicker';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import styles from './page.module.css';

export const dynamic = 'force-dynamic'; // Siempre renderizar en el servidor (sin caché)

interface DashboardPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { date } = await searchParams;

  // Calcular la fecha en la zona horaria de Colombia (America/Bogota)
  const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const targetDate = date || todayISO;

  const [stats, pedidosRecientes, productosVendidos, { data: productos }, estadoCaja] = await Promise.all([
    getResumenDelDia(targetDate),
    getPedidosRecientes(50, targetDate),
    getProductosVendidosDelDia(targetDate),
    (await import('@/lib/supabase/server')).createClient().then(sb => sb.from('productos').select('*').order('nombre', { ascending: true })),
    obtenerEstadoCaja(),
  ]);

  const fechaLabel = new Date(`${targetDate}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const esHoy = targetDate === todayISO;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>📊 Dashboard de Ventas</h1>
          <p className={styles.subtitle}>
            {esHoy ? `Hoy — ${fechaLabel}` : fechaLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DatePicker currentDate={targetDate} />
          {!esHoy && (
            <a href="/dashboard" className={styles.refreshBtn}>
              📅 Volver a Hoy
            </a>
          )}
          {esHoy && (
            <a href="/dashboard" className={styles.refreshBtn}>
              🔄 Actualizar
            </a>
          )}
        </div>
      </header>

      {!stats ? (
        <div className={styles.errorState}>⚠️ Error al cargar métricas. Recarga la página.</div>
      ) : (
        <>
          {/* Arqueo de Caja (Deshabilitado temporalmente a petición del usuario) */}
          {/* 
          {esHoy && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>💰 Turno de Caja</h2>
              <ArqueoCaja initialState={estadoCaja} />
            </section>
          )} 
          */}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Resumen del Día</h2>
            <ResumenCards {...stats} />
          </section>

          {/* Control de Stock */}
          {productos && productos.length > 0 && (
            <section className={styles.section}>
              <StockManager productos={productos} />
            </section>
          )}

          {/* Productos más vendidos del día */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              🍽️ Productos Vendidos{productosVendidos.length > 0 ? ` (${productosVendidos.length} distintos)` : ''}
            </h2>
            <ProductosVendidosTable productos={productosVendidos} />
          </section>

          {stats.cancelados.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                ❌ Pedidos Cancelados ({stats.cancelados.length})
              </h2>
              <CancelacionesTable cancelados={stats.cancelados} />
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {esHoy ? 'Últimos Pedidos (Hoy)' : `Pedidos del ${fechaLabel}`}
            </h2>
            <PedidosTable pedidos={pedidosRecientes} />
          </section>
        </>
      )}

      {/* Auto-refresco de página cada 60s si estamos viendo "Hoy" */}
      {esHoy && <AutoRefresh />}
    </main>
  );
}
