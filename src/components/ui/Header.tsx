'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
          <Image
            src="/logo.png"
            alt="Ricuras FegaF"
            width={40}
            height={40}
            className={styles.logo}
            priority
          />
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
