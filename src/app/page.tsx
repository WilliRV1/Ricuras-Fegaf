import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import { sesionActual } from '@/lib/sesionServidor';
import { puedeVer } from '@/lib/session';

const TARJETAS = [
  { href: '/pedidos', icon: '🍔', title: 'Tomar Pedido', desc: 'Menú digital y envío de comandas a cocina.' },
  { href: '/cocina', icon: '👨‍🍳', title: 'Cocina (KDS)', desc: 'Tablero de comandas en tiempo real.' },
  { href: '/liquidacion', icon: '💳', title: 'Liquidación', desc: 'Cierre de órdenes y métodos de pago.' },
  { href: '/dashboard', icon: '📊', title: 'Dashboard', desc: 'Métricas de ventas y cuadre diario.' },
];

export default async function Home() {
  // El proxy ya solo deja llegar aquí a cajero/admin (cocina va directo a su
  // tablero), pero además: cada tarjeta se muestra solo si el rol puede
  // entrar a esa pantalla. Antes se mostraban las cuatro a todo el mundo, y
  // tocar la que no tocaba solo rebotaba de vuelta sin explicación.
  const sesion = await sesionActual();
  const tarjetas = sesion ? TARJETAS.filter((t) => puedeVer(sesion.rol, t.href)) : TARJETAS;

  return (
    <main className={styles.main}>
      <div className={styles.backgroundGlow}></div>

      <header className={styles.header}>
        <Image
          src="/logo.png"
          alt="Ricuras FegaF"
          width={140}
          height={140}
          className={styles.heroLogo}
          priority
        />
        <p className={styles.subtitle}>Sistema de Gestión Operativa</p>
      </header>

      <section className={styles.grid}>
        {tarjetas.map((t) => (
          <Link key={t.href} href={t.href} className={styles.card}>
            <div className={styles.cardIcon}>{t.icon}</div>
            <h2 className={styles.cardTitle}>{t.title}</h2>
            <p className={styles.cardDesc}>{t.desc}</p>
          </Link>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>© 2026 Ricuras Fegaf — Fase 1 (MVP)</p>
      </footer>
    </main>
  );
}
