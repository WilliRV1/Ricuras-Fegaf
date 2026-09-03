'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rol, puedeVer } from '@/lib/session';
import { IconHome, IconOrder, IconChefHat, IconCreditCard, IconBarChart } from './Icons';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  /** Quién tiene la sesión abierta. null = nadie (pantalla de entrada) */
  sesion: { nombre: string; rol: Rol } | null;
}

const TODOS_LOS_ENLACES = [
  { href: '/', label: 'Inicio', Icon: IconHome },
  { href: '/pedidos', label: 'Pedidos', Icon: IconOrder },
  { href: '/cocina', label: 'KDS', Icon: IconChefHat },
  { href: '/liquidacion', label: 'Liquidación', Icon: IconCreditCard },
  { href: '/dashboard', label: 'Dashboard', Icon: IconBarChart },
];

export const BottomNav = ({ sesion }: BottomNavProps) => {
  const pathname = usePathname();

  // Sin sesión (pantalla de entrada) no hay nada que navegar
  if (!sesion || pathname === '/login') return null;

  // Cada rol ve solo sus pantallas
  const links = TODOS_LOS_ENLACES.filter((link) => puedeVer(sesion.rol, link.href));

  return (
    <nav className={styles.bottomNav}>
      <div className={styles.container}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.icon}><link.Icon size={22} /></span>
              <span className={styles.label}>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
