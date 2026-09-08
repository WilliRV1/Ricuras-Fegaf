import { redirect } from 'next/navigation';
import { getSesion } from '@/app/actions/auth';
import { rutaInicial, esAdminOSuperior } from '@/lib/session';
import { listarInsumos, listarProductoCostos } from '@/app/actions/recetas';
import { createClient } from '@/lib/supabase/server';
import { RecetaBuilder } from '@/components/dashboard/RecetaBuilder';
import { ToastContainer } from '@/components/ui/Toast';
import { IconUtensils } from '@/components/ui/Icons';
import type { Producto } from '@/types';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export default async function RecetasPage() {
  // Misma doble comprobación que /dashboard: el proxy ya reparte por rol,
  // pero esta pantalla también muestra costos y márgenes del negocio.
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (!esAdminOSuperior(sesion.rol)) redirect(rutaInicial(sesion.rol));

  const supabase = await createClient();

  const [insumosRes, costosRes, { data: productos }] = await Promise.all([
    listarInsumos(),
    listarProductoCostos(),
    supabase.from('productos').select('*').eq('activo', true).order('nombre', { ascending: true }),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconUtensils size={28} style={{ marginRight: '10px', verticalAlign: '-4px' }} />
            Recetas y Costeo
          </h1>
          <p className={styles.subtitle}>Insumos, compras y el costo real de cada producto del menú</p>
        </div>
        <a href="/dashboard" className={styles.refreshBtn}>
          Volver al dashboard
        </a>
      </header>

      {!insumosRes.success || !costosRes.success ? (
        <div className={styles.errorState}>Error al cargar los datos de costeo. Recarga la página.</div>
      ) : (
        <RecetaBuilder
          productos={(productos ?? []) as Producto[]}
          insumosIniciales={insumosRes.insumos}
          costosIniciales={costosRes.costos}
        />
      )}

      <ToastContainer />
    </main>
  );
}
