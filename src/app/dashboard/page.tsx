import { createClient } from '@/lib/supabase/server';
import { ESTADOS_PEDIDO, METODOS_PAGO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import styles from './page.module.css';

export const revalidate = 60; // Revalidar cada 60s

async function getDailyStats() {
  const supabase = await createClient();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data, error } = await supabase
    .from('pedidos')
    .select('total, subtotal, metodo_pago, tipo, estado, closed_at')
    .eq('estado', ESTADOS_PEDIDO.PAGADO)
    .gte('closed_at', startOfDay)
    .lt('closed_at', endOfDay);

  if (error || !data) {
    console.error('Error obteniendo métricas:', error);
    return null;
  }

  const totalDia = data.reduce((sum, p) => sum + (p.total ?? 0), 0);
  const totalEfectivo = data.filter(p => p.metodo_pago === METODOS_PAGO.EFECTIVO).reduce((s, p) => s + (p.total ?? 0), 0);
  const totalNequi = data.filter(p => p.metodo_pago === METODOS_PAGO.NEQUI).reduce((s, p) => s + (p.total ?? 0), 0);
  const totalDatafono = data.filter(p => p.metodo_pago === METODOS_PAGO.DATAFONO).reduce((s, p) => s + (p.total ?? 0), 0);
  const totalPedidos = data.length;
  const pedidosMesa = data.filter(p => p.tipo === 'mesa').length;
  const pedidosDomicilio = data.filter(p => p.tipo === 'domicilio').length;

  return { totalDia, totalEfectivo, totalNequi, totalDatafono, totalPedidos, pedidosMesa, pedidosDomicilio };
}

export default async function DashboardPage() {
  const stats = await getDailyStats();

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
          {/* Total del día */}
          <div className={styles.heroCard}>
            <div className={styles.heroIcon}>💰</div>
            <div className={styles.heroContent}>
              <p className={styles.heroLabel}>Total del Día</p>
              <p className={styles.heroValue}>{formatCurrency(stats.totalDia)}</p>
            </div>
          </div>

          {/* Desglose por método de pago */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Desglose por Método de Pago</h2>
            <div className={styles.metricsGrid}>
              <div className={`${styles.metricCard} ${styles.efectivo}`}>
                <div className={styles.metricIcon}>💵</div>
                <p className={styles.metricLabel}>Efectivo</p>
                <p className={styles.metricValue}>{formatCurrency(stats.totalEfectivo)}</p>
              </div>
              <div className={`${styles.metricCard} ${styles.nequi}`}>
                <div className={styles.metricIcon}>📱</div>
                <p className={styles.metricLabel}>Nequi</p>
                <p className={styles.metricValue}>{formatCurrency(stats.totalNequi)}</p>
              </div>
              <div className={`${styles.metricCard} ${styles.datafono}`}>
                <div className={styles.metricIcon}>💳</div>
                <p className={styles.metricLabel}>Datáfono</p>
                <p className={styles.metricValue}>{formatCurrency(stats.totalDatafono)}</p>
              </div>
            </div>
          </section>

          {/* Volumen de pedidos */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Volumen de Pedidos</h2>
            <div className={styles.metricsGrid}>
              <div className={`${styles.metricCard} ${styles.total}`}>
                <div className={styles.metricIcon}>🧾</div>
                <p className={styles.metricLabel}>Total Pedidos</p>
                <p className={styles.metricValueLg}>{stats.totalPedidos}</p>
              </div>
              <div className={`${styles.metricCard} ${styles.mesa}`}>
                <div className={styles.metricIcon}>🍽️</div>
                <p className={styles.metricLabel}>En Mesa</p>
                <p className={styles.metricValueLg}>{stats.pedidosMesa}</p>
              </div>
              <div className={`${styles.metricCard} ${styles.domicilio}`}>
                <div className={styles.metricIcon}>🛵</div>
                <p className={styles.metricLabel}>Domicilio</p>
                <p className={styles.metricValueLg}>{stats.pedidosDomicilio}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
