'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Rol, puedeVer } from '@/lib/session';
import { cerrarSesion } from '@/app/actions/auth';
import { cartStore } from '@/hooks/useCart';
import { IconHome, IconOrder, IconChefHat, IconCreditCard, IconBarChart, IconKey, IconChevronDown } from './Icons';
import { CambiarPinDialog } from './CambiarPinDialog';
import styles from './Header.module.css';

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administración',
  cajero: 'Caja y pedidos',
  cocina: 'Cocina',
  dev: 'Dev / Tester',
};

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
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // El menú se cierra tocando fuera (en tablet no hay "blur" confiable)
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener('pointerdown', cerrar);
    return () => document.removeEventListener('pointerdown', cerrar);
  }, [menuAbierto]);

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

        {/*
          Quién está usando esta terminal — importa cuando se comparten.
          El nombre abre un menú: desde ahí cualquiera cambia su PIN en el
          momento (si alguien se lo vio) sin pasar por administración.
        */}
        <div className={styles.sesion} ref={menuRef}>
          <button
            type="button"
            className={styles.sesionBtn}
            onClick={() => setMenuAbierto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            title={`Sesión de ${sesion.nombre}`}
          >
            <span className={styles.sesionNombre}>{sesion.nombre}</span>
            <IconChevronDown size={14} className={`${styles.sesionChevron} ${menuAbierto ? styles.sesionChevronAbierto : ''}`} />
          </button>

          {menuAbierto && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuCabecera}>
                <strong>{sesion.nombre}</strong>
                <span>{ETIQUETA_ROL[sesion.rol]}</span>
              </div>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  setMenuAbierto(false);
                  setCambiandoPin(true);
                }}
              >
                <IconKey size={16} /> Cambiar mi PIN
              </button>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuItemSalir}`}
                role="menuitem"
                onClick={salir}
                disabled={saliendo}
              >
                {saliendo ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          )}
        </div>
      </div>

      <CambiarPinDialog isOpen={cambiandoPin} nombre={sesion.nombre} onClose={() => setCambiandoPin(false)} />
    </header>
  );
};
