import { redirect } from 'next/navigation';
import { getSesion } from '@/app/actions/auth';
import { rutaInicial, esAdminOSuperior } from '@/lib/session';
import { getUtilidadNetaReal, getComparativoMensual, getProductosMasRentables } from '@/app/actions/reportes';
import { UtilidadCards } from '@/components/dashboard/UtilidadCards';
import { ComparativoChart } from '@/components/dashboard/ComparativoChart';
import { ProductosRentablesTable } from '@/components/dashboard/ProductosRentablesTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ToastContainer } from '@/components/ui/Toast';
import { IconTrendingUp } from '@/components/ui/Icons';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

interface ReportesPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (!esAdminOSuperior(sesion.rol)) redirect(rutaInicial(sesion.rol));

  const { from: fromParam, to: toParam } = await searchParams;

  const [utilidad, comparativo, productosRentables] = await Promise.all([
    getUtilidadNetaReal(fromParam, toParam),
    getComparativoMensual(),
    getProductosMasRentables(fromParam, toParam),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconTrendingUp size={28} style={{ marginRight: '10px', verticalAlign: '-4px' }} />
            Inteligencia Financiera
          </h1>
          <p className={styles.subtitle}>Utilidad neta real, comparativo mensual y rentabilidad por producto</p>
        </div>
        <a href="/dashboard" className={styles.refreshBtn}>
          Volver al dashboard
        </a>
      </header>

      {!utilidad ? (
        <div className={styles.errorState}>Error al cargar los reportes. Recarga la página.</div>
      ) : (
        <>
          <DateRangeFilter from={utilidad.from} to={utilidad.to} basePath="/dashboard/reportes" />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Utilidad Neta Real del Período</h2>
            <UtilidadCards utilidad={utilidad} />
          </section>

          {comparativo && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {comparativo.mesActual.etiqueta} vs. {comparativo.mesAnterior.etiqueta}
              </h2>
              <ComparativoChart comparativo={comparativo} />
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Productos</h2>
            <ProductosRentablesTable productos={productosRentables} />
          </section>
        </>
      )}

      <ToastContainer />
    </main>
  );
}
