import { getResumenDelDia, getPedidosRecientes } from '@/app/actions/dashboard';
import { ResumenCards } from '@/components/dashboard/ResumenCards';
import { PedidosTable } from '@/components/dashboard/PedidosTable';
import styles from './page.module.css';

export const revalidate = 60; // Revalidar cada 60s

export default async function DashboardPage() {
  const [stats, pedidosRecientes] = await Promise.all([
    getResumenDelDia(),
    getPedidosRecientes(20),
  ]);

  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>📊 Dashboard de Ventas</h1>
          <p className={styles.subtitle}>{hoy}</p>
        </div>
        <a href="/dashboard" className={styles.refreshBtn}>
          🔄 Actualizar
        </a>
      </header>

      {!stats ? (
        <div className={styles.errorState}>⚠️ Error al cargar métricas. Recarga la página.</div>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Resumen del Día</h2>
            <ResumenCards {...stats} />
          </section>

          <section className={styles.section} style={{ marginTop: '16px' }}>
            <h2 className={styles.sectionTitle}>Últimos Pedidos (Hoy)</h2>
            <PedidosTable pedidos={pedidosRecientes} />
          </section>
        </>
      )}
    </main>
  );
}
