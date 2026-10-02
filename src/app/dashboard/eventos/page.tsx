import { redirect } from 'next/navigation';
import { getSesion } from '@/app/actions/auth';
import { rutaInicial, esAdminOSuperior } from '@/lib/session';
import { listarProductoCostos } from '@/app/actions/recetas';
import { createClient } from '@/lib/supabase/server';
import { EventoBuilder } from '@/components/dashboard/EventoBuilder';
import { ToastContainer } from '@/components/ui/Toast';
import { IconReceipt } from '@/components/ui/Icons';
import type { Producto } from '@/types';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export default async function EventosPage() {
  // Misma doble comprobación que /dashboard: aquí se ven costos y se venden
  // productos por debajo del precio del menú.
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  if (!esAdminOSuperior(sesion.rol)) redirect(rutaInicial(sesion.rol));

  const supabase = await createClient();

  const [costosRes, { data: productos }] = await Promise.all([
    listarProductoCostos(),
    supabase.from('productos').select('*').eq('activo', true).order('nombre', { ascending: true }),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconReceipt size={28} style={{ marginRight: '10px', verticalAlign: '-4px' }} />
            Eventos
          </h1>
          <p className={styles.subtitle}>
            Pedidos grandes con precio a la medida del cliente: mira cuánto te queda antes de dar el precio
          </p>
        </div>
        <a href="/dashboard" className={styles.refreshBtn}>
          Volver al dashboard
        </a>
      </header>

      {!costosRes.success ? (
        <div className={styles.errorState}>Error al cargar los costos. Recarga la página.</div>
      ) : (
        <EventoBuilder productos={(productos ?? []) as Producto[]} costos={costosRes.costos} />
      )}

      <ToastContainer />
    </main>
  );
}
