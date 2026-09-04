import { redirect } from 'next/navigation';
import { getSesion } from '@/app/actions/auth';
import { rutaInicial, esAdminOSuperior } from '@/lib/session';
import {
  getResumenDelDia,
  getPedidosRecientes,
  getProductosVendidosDelDia,
  getCarteraPendiente,
  getCancelacionesDelDia,
} from '@/app/actions/dashboard';
import { ResumenCards } from '@/components/dashboard/ResumenCards';
import { PedidosTable } from '@/components/dashboard/PedidosTable';
import { CancelacionesTable } from '@/components/dashboard/CancelacionesTable';
import { CarteraTable } from '@/components/dashboard/CarteraTable';
import { ProductosVendidosTable } from '@/components/dashboard/ProductosVendidosTable';
import { StockManager } from '@/components/dashboard/StockManager';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { PersonalManager } from '@/components/dashboard/PersonalManager';
import { ToastContainer } from '@/components/ui/Toast';
import {
  IconBarChart,
  IconCalendar,
  IconRefresh,
  IconAlertTriangle,
  IconClipboard,
  IconUtensils,
  IconXCircle,
  IconUser,
} from '@/components/ui/Icons';
import styles from './page.module.css';

export const dynamic = 'force-dynamic'; // Siempre renderizar en el servidor (sin caché)

interface DashboardPageProps {
  // 'date' se mantiene por compatibilidad con enlaces guardados de antes del
  // filtro por rango: si llega solo, se toma como un rango de un día.
  searchParams: Promise<{ from?: string; to?: string; date?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // El proxy ya reparte por rol, pero la página también lo comprueba: es la
  // que sirve las cifras del negocio y no debe depender de una sola barrera.
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (!esAdminOSuperior(sesion.rol)) redirect(rutaInicial(sesion.rol));

  const { from: fromParam, to: toParam, date } = await searchParams;

  // Calcular la fecha en la zona horaria de Colombia (America/Bogota)
  const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const from = fromParam || date || todayISO;
  const to = toParam || date || from;

  const [
    stats,
    pedidosRecientes,
    productosVendidos,
    cartera,
    cancelaciones,
    { data: productos },
  ] = await Promise.all([
    getResumenDelDia(from, to),
    getPedidosRecientes(50, from, to),
    getProductosVendidosDelDia(from, to),
    // La cartera no depende de la fecha: son todas las deudas abiertas
    getCarteraPendiente(),
    getCancelacionesDelDia(from, to),
    (await import('@/lib/supabase/server')).createClient().then(sb => sb.from('productos').select('*').order('nombre', { ascending: true })),
  ]);

  const formatoFecha = (f: string) =>
    new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const esUnSoloDia = from === to;
  const fechaLabel = esUnSoloDia
    ? formatoFecha(from)
    : `Del ${new Date(`${from}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} al ${formatoFecha(to)}`;

  const esHoy = from === todayISO && to === todayISO;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconBarChart size={28} style={{ marginRight: '10px', verticalAlign: '-4px' }} />
            Dashboard de Ventas
          </h1>
          <p className={styles.subtitle}>
            {esHoy ? `Hoy — ${fechaLabel}` : fechaLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter from={from} to={to} />
          {!esHoy && (
            <a href="/dashboard" className={styles.refreshBtn}>
              <IconCalendar size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
              Volver a Hoy
            </a>
          )}
          {esHoy && (
            <a href="/dashboard" className={styles.refreshBtn}>
              <IconRefresh size={15} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
              Actualizar
            </a>
          )}
        </div>
      </header>

      {!stats ? (
        <div className={styles.errorState}>
          <IconAlertTriangle size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
          Error al cargar métricas. Recarga la página.
        </div>
      ) : (
        <>
          {/* Arqueo de Caja (Deshabilitado temporalmente a petición del usuario) */}
          {/* 
          {esHoy && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Turno de Caja</h2>
              <ArqueoCaja initialState={estadoCaja} />
            </section>
          )} 
          */}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Resumen del Día</h2>
            <ResumenCards {...stats} />
          </section>

          {/* Cartera por cobrar — arrastra deudas de todos los días */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <IconClipboard size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
              Cartera por Cobrar
              {cartera.length > 0 ? ` (${cartera.length})` : ''}
            </h2>
            <CarteraTable deudas={cartera} />
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
              <IconUtensils size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
              Productos Vendidos{productosVendidos.length > 0 ? ` (${productosVendidos.length} distintos)` : ''}
            </h2>
            <ProductosVendidosTable productos={productosVendidos} />
          </section>

          {cancelaciones.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <IconXCircle size={16} style={{ marginRight: '6px', verticalAlign: '-3px', color: 'var(--color-danger)' }} />
                Pedidos Cancelados ({cancelaciones.length})
              </h2>
              <CancelacionesTable cancelados={cancelaciones} />
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {esHoy ? 'Últimos Pedidos (Hoy)' : esUnSoloDia ? `Pedidos del ${fechaLabel}` : `Pedidos — ${fechaLabel}`}
            </h2>
            <PedidosTable pedidos={pedidosRecientes} mostrarFecha={!esUnSoloDia} />
          </section>

          {/* Personal: quién puede entrar y con qué permisos */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <IconUser size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
              Personal
            </h2>
            <PersonalManager />
          </section>
        </>
      )}

      {/* Auto-refresco de página cada 60s si estamos viendo "Hoy" */}
      {esHoy && <AutoRefresh />}

      <ToastContainer />
    </main>
  );
}
