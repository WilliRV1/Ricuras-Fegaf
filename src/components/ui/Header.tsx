'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Rol, puedeVer } from '@/lib/session';
import { cerrarSesion } from '@/app/actions/auth';
import styles from './Header.module.css';

interface HeaderProps {
  /** Quién tiene la sesión abierta. null = nadie (pantalla de entrada) */
  sesion: { nombre: string; rol: Rol } | null;
}

const TODOS_LOS_ENLACES = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/pedidos', label: 'Pedidos', icon: '📱' },
  { href: '/cocina', label: 'Cocina', icon: '👨‍🍳' },
  { href: '/liquidacion', label: 'Liquidación', icon: '💰' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
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
              <span className={styles.navIcon}>{link.icon}</span>
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
