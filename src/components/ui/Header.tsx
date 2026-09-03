'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Rol, puedeVer } from '@/lib/session';
import { cerrarSesion } from '@/app/actions/auth';
import { cartStore } from '@/hooks/useCart';
import { IconHome, IconOrder, IconChefHat, IconCreditCard, IconBarChart } from './Icons';
import styles from './Header.module.css';

interface HeaderProps {
  /** Quién tiene la sesión abierta. null = nadie (pantalla de entrada) */
  sesion: { nombre: string; rol: Rol } | null;
}

const TODOS_LOS_ENLACES = [
  { href: '/', label: 'Inicio', Icon: IconHome },
  { href: '/pedidos', label: 'Pedidos', Icon: IconOrder },
  { href: '/cocina', label: 'Cocina', Icon: IconChefHat },
  { href: '/liquidacion', label: 'Liquidación', Icon: IconCreditCard },
  { href: '/dashboard', label: 'Dashboard', Icon: IconBarChart },
];

export const Header: React.FC<HeaderProps> = ({ sesion }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  // En la pantalla de entrada no hay nada que navegar
  if (!sesion || pathname === '/login') return null;

  // Cada quien ve solo lo suyo: mostrar un enlace que va a rebotar confunde
  const links = TODOS_LOS_ENLACES.filter((link) => puedeVer(sesion.rol, link.href));

  const salir = async () => {
    setSaliendo(true);
    // El carrito vive en este navegador, no en la sesión: si no se limpia,
    // el siguiente que entre en esta misma tablet se encuentra el pedido a
    // medias de quien salió, y podría enviarlo pensando que es suyo.
    cartStore.clearCart();
    await cerrarSesion();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Image
            src="/logo.png"
            alt="Ricuras FegaF"
            width={56}
            height={56}
            className={styles.logo}
            priority
          />
        </div>

        <nav className={styles.nav}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
            >
              <span className={styles.navIcon}><link.Icon size={17} /></span>
              <span className={styles.navLabel}>{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Quién está usando esta terminal — importa cuando se comparten */}
        <div className={styles.sesion}>
          <span className={styles.sesionNombre} title={`Sesión de ${sesion.nombre}`}>
            {sesion.nombre}
          </span>
          <button
            type="button"
            className={styles.salirBtn}
            onClick={salir}
            disabled={saliendo}
          >
            {saliendo ? '…' : 'Salir'}
          </button>
        </div>
      </div>
    </header>
  );
};
