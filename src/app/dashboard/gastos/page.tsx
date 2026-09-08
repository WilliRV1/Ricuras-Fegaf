import { redirect } from 'next/navigation';
import { getSesion } from '@/app/actions/auth';
import { rutaInicial, esAdminOSuperior } from '@/lib/session';
import { listarGastos } from '@/app/actions/gastos';
import { GastosManager } from '@/components/dashboard/GastosManager';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ToastContainer } from '@/components/ui/Toast';
import { IconBanknote } from '@/components/ui/Icons';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

interface GastosPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function GastosPage({ searchParams }: GastosPageProps) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (!esAdminOSuperior(sesion.rol)) redirect(rutaInicial(sesion.rol));

  const { from: fromParam, to: toParam } = await searchParams;
  const res = await listarGastos(fromParam, toParam);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconBanknote size={28} style={{ marginRight: '10px', verticalAlign: '-4px' }} />
            Egresos Operativos
          </h1>
          <p className={styles.subtitle}>
            Gastos fijos y variables — las compras de insumos se registran en Recetas y Costeo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/dashboard" className={styles.refreshBtn}>
            Volver al dashboard
          </a>
        </div>
      </header>

      {res.success && (
        <DateRangeFilter from={res.from} to={res.to} basePath="/dashboard/gastos" />
      )}

      {!res.success ? (
        <div className={styles.errorState}>{res.error} Recarga la página.</div>
      ) : (
        <GastosManager gastosIniciales={res.gastos} from={res.from} to={res.to} />
      )}

      <ToastContainer />
    </main>
  );
}
