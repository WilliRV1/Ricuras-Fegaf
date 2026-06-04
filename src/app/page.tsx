import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.backgroundGlow}></div>
      
      <header className={styles.header}>
        <h1 className={styles.title}>
          Ricuras <span className={styles.highlight}>Fegaf</span>
        </h1>
        <p className={styles.subtitle}>Sistema de Gestión Operativa</p>
      </header>

      <section className={styles.grid}>
        {/* Módulo Toma de Pedidos */}
        <Link href="/pedidos" className={styles.card}>
          <div className={styles.cardIcon}>🍔</div>
          <h2 className={styles.cardTitle}>Tomar Pedido</h2>
          <p className={styles.cardDesc}>Menú digital y envío de comandas a cocina.</p>
        </Link>

        {/* Módulo KDS (Cocina) */}
        <Link href="/cocina" className={styles.card}>
          <div className={styles.cardIcon}>👨‍🍳</div>
          <h2 className={styles.cardTitle}>Cocina (KDS)</h2>
          <p className={styles.cardDesc}>Tablero de comandas en tiempo real.</p>
        </Link>

        {/* Módulo Liquidación */}
        <Link href="/liquidacion" className={styles.card}>
          <div className={styles.cardIcon}>💳</div>
          <h2 className={styles.cardTitle}>Liquidación</h2>
          <p className={styles.cardDesc}>Cierre de órdenes y métodos de pago.</p>
        </Link>

        {/* Módulo Dashboard */}
        <Link href="/dashboard" className={styles.card}>
          <div className={styles.cardIcon}>📊</div>
          <h2 className={styles.cardTitle}>Dashboard</h2>
          <p className={styles.cardDesc}>Métricas de ventas y cuadre diario.</p>
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 Ricuras Fegaf — Fase 1 (MVP)</p>
      </footer>
    </main>
  );
}
