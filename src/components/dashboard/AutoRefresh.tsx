'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  intervalMs?: number;
}

/**
 * Componente invisible que refresca la página (re-fetch del Server Component)
 * silenciosamente cada `intervalMs` (por defecto 60 segundos).
 */
export const AutoRefresh: React.FC<AutoRefreshProps> = ({ intervalMs = 60000 }) => {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      // router.refresh() refresca el estado del servidor sin perder el estado del cliente
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
};
