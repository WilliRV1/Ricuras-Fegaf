'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

export const BottomNav = () => {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Inicio', icon: '🏠' },
    { href: '/pedidos', label: 'Pedidos', icon: '🍔' },
    { href: '/cocina', label: 'KDS', icon: '👨‍🍳' },
    { href: '/liquidacion', label: 'Liquidación', icon: '💳' },
  ];

  // Ocultar si estamos en login
  if (pathname === '/login') return null;

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
              <span className={styles.icon}>{link.icon}</span>
              <span className={styles.label}>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
