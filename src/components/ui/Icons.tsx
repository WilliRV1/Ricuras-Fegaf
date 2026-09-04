import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: Omit<IconProps, 'size'>) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

/** Ícono del logo (llama) usado en el wordmark. */
export function IconFlame({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} fill="currentColor" stroke="none">
      <path d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.176 7.547 7.547 0 01-1.705-1.715.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" />
    </svg>
  );
}

export function IconOrder({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 9V7a6 6 0 0112 0v2" />
      <rect x="4" y="9" width="16" height="12" rx="2" />
      <path d="M9 13v3M15 13v3" />
    </svg>
  );
}

export function IconChefHat({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 4a4 4 0 013.9 4.9A3.5 3.5 0 0119 12.3V16H5v-3.7a3.5 3.5 0 013.1-3.4A4 4 0 0112 4z" />
      <line x1="7" y1="19" x2="17" y2="19" />
      <line x1="7" y1="16" x2="7" y2="19" />
      <line x1="17" y1="16" x2="17" y2="19" />
    </svg>
  );
}

export function IconCreditCard({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

export function IconBarChart({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="18" y1="20" x2="18" y2="15" />
    </svg>
  );
}

/** Tenedor + cuchillo: atención en mesa. */
export function IconUtensils({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="5" y1="2" x2="5" y2="8" />
      <line x1="8" y1="2" x2="8" y2="8" />
      <path d="M5 8v14M8 8c0 1.7-1.3 3-3 3s-3-1.3-3-3V2" />
      <path d="M17 2c1.5 2 1.5 6 0 8-.8.7-2 .7-2 .7V22" />
    </svg>
  );
}

/** Moto: domicilio. */
export function IconScooter({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 18h6l2-5h4M12 13l-1.5-3.5H7" />
    </svg>
  );
}

export function IconBanknote({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconPhone({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

export function IconLandmark({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 21h18M4 21V10M20 21V10M2 10l10-6 10 6" />
      <line x1="6" y1="21" x2="6" y2="14" />
      <line x1="10" y1="21" x2="10" y2="14" />
      <line x1="14" y1="21" x2="14" y2="14" />
      <line x1="18" y1="21" x2="18" y2="14" />
    </svg>
  );
}

export function IconClock({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export function IconMapPin({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function IconPhoneCall({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.4 2.1L8.1 9.7a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.4c.9.3 1.8.5 2.7.6a2 2 0 011.9 2.2z" />
    </svg>
  );
}

export function IconCheck({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconCheckCircle({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 3l9 16H3L12 3z" />
      <line x1="12" y1="10" x2="12" y2="13.5" />
      <line x1="12" y1="16.5" x2="12" y2="16.6" />
    </svg>
  );
}

export function IconRefresh({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
    </svg>
  );
}

export function IconCalendar({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function IconSearch({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconPlus({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconPlusCircle({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function IconXCircle({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

export function IconX({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconReceipt({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

export function IconCrown({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
    </svg>
  );
}

/** Código entre corchetes angulares: cuenta de desarrollo/pruebas. */
export function IconCode({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="8 6 2 12 8 18" />
      <polyline points="16 6 22 12 16 18" />
    </svg>
  );
}

export function IconChevronLeft({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconBackspace({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  );
}

export function IconCart({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.5 2.5h3l2.7 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 7H6.5" />
    </svg>
  );
}

export function IconUser({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  );
}

export function IconClipboard({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function IconTrendingUp({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="15 6 21 6 21 12" />
    </svg>
  );
}

export function IconList({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBurger({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 9a8 8 0 0116 0" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <path d="M3 18h18a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

export function IconDrink({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 3h12l-1 15a2 2 0 01-2 2H9a2 2 0 01-2-2L6 3z" />
      <line x1="5" y1="7" x2="19" y2="7" />
    </svg>
  );
}

export function IconFries({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M5 9h14l-1.4 10.9a1 1 0 01-1 .9H7.4a1 1 0 01-1-.9L5 9z" />
      <path d="M8 9V5a1 1 0 011-1 1 1 0 011 1v4M12 9V4a1 1 0 011-1 1 1 0 011 1v5M16 9V5a1 1 0 011-1 1 1 0 011 1v4" />
    </svg>
  );
}

export function IconInfo({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12" y2="8.01" />
    </svg>
  );
}

/** Punto lleno: indicador de estado (online/offline). */
export function IconDot({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

/** Flechas separándose: dividir pago. */
export function IconSplit({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 6h4l8 12h4" />
      <path d="M4 18h4l3-4.5" />
      <path d="M16 6h4M16 6l-3 3M16 6l-3-3" />
      <path d="M20 18l-3-3M20 18l-3 3" />
    </svg>
  );
}

/** Flecha curva hacia atrás: volver a un solo método de pago. */
export function IconUndo({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a5 5 0 010 10h-1" />
    </svg>
  );
}

export function IconHome({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

/** Lápiz: editar/modificar. */
export function IconPencil({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

/** Candado: bloqueado. */
export function IconLock({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

/** Candado abierto: caja abierta / desbloqueado. */
export function IconLockOpen({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 017.8-1.3" />
    </svg>
  );
}

/** Tijeras: separar en unidades. */
export function IconScissors({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

/** Papelera: eliminar. */
export function IconTrash({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** Manos dándose la mano: acuerdo/cobro de deuda vieja. */
export function IconHandshake({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 12l4-4 4.5 4.5a1.5 1.5 0 002.5-1.5L9 7" />
      <path d="M22 12l-4-4-5.5 5.5a1.5 1.5 0 000 2l1 1a1.5 1.5 0 002 0" />
      <path d="M6 8l3.5-3.5a2 2 0 012.7-.1L14 6" />
      <path d="M18 8l-3.5-3.5" />
      <path d="M2 12l3 3M22 12l-3 3" />
    </svg>
  );
}

/** Bombilla: tip/sugerencia. */
export function IconLightbulb({ size = 24, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a6 6 0 00-4 10.472c.667.61 1 1.475 1 2.528h6c0-1.053.333-1.917 1-2.528A6 6 0 0012 2z" />
    </svg>
  );
}
