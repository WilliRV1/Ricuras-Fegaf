'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Inicio', icon: '🏠' },
    { href: '/pedidos', label: 'Pedidos', icon: '📱' },
    { href: '/cocina', label: 'Cocina', icon: '👨‍🍳' },
    { href: '/liquidacion', label: 'Liquidación', icon: '💰' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <span className={styles.logo}>RF</span>
          <span className={styles.title}>Ricuras FegaF</span>
        </div>
        <nav className={styles.nav}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${
                pathname === link.href ? styles.active : ''
              }`}
            >
              <span className={styles.navIcon}>{link.icon}</span>
              <span className={styles.navLabel}>{link.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};
