'use client';

import React, { useState, useTransition } from 'react';
import { abrirCaja, cerrarCaja } from '@/app/actions/caja';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { IconLock, IconLockOpen } from '@/components/ui/Icons';
import styles from './ArqueoCaja.module.css';

// Formateador de moneda
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface ArqueoData {
  id: number;
  base_inicial: number;
  ventasEfectivo: number;
  ventasTransferencias: number;
  totalEsperadoEfectivo: number;
  opened_at: string;
}

interface ArqueoCajaProps {
  initialState: {
    isOpen: boolean;
    data: ArqueoData | null;
  };
}

export const ArqueoCaja: React.FC<ArqueoCajaProps> = ({ initialState }) => {
  const [isOpen, setIsOpen] = useState(initialState.isOpen);
  const [data, setData] = useState<ArqueoData | null>(initialState.data);
  const [baseInput, setBaseInput] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleAbrir = (e: React.FormEvent) => {
    e.preventDefault();
    const base = Number(baseInput.replace(/\D/g, ''));
    if (isNaN(base)) return toast.error('Base inválida');

    startTransition(async () => {
      const res = await abrirCaja(base);
      if (res.success) {
        toast.success('Caja abierta exitosamente');
        setIsOpen(true);
        // Recargar para obtener los datos frescos
        window.location.reload(); 
      } else {
        toast.error(res.error || 'Error al abrir caja');
      }
    });
  };

  const handleCerrar = () => {
    if (!data) return;
    const confirm = window.confirm(
      `Vas a cerrar el turno.\n\n` +
      `Debes tener en la caja física: ${formatCurrency(data.totalEsperadoEfectivo)}\n` +
      `¿Confirmas el cierre?`
    );

    if (!confirm) return;

    startTransition(async () => {
      const res = await cerrarCaja(data.id, data.ventasEfectivo, data.ventasTransferencias);
      if (res.success) {
        toast.success('Caja cerrada. Arqueo guardado.');
        setIsOpen(false);
        setData(null);
        setBaseInput('');
      } else {
        toast.error(res.error || 'Error al cerrar caja');
      }
    });
  };

  if (!isOpen) {
    return (
      <div className={styles.containerClosed}>
        <div className={styles.iconClosed}><IconLock size={40} /></div>
        <div className={styles.infoClosed}>
          <h3>Caja Cerrada</h3>
          <p>Abre el turno para empezar a registrar las ventas del día.</p>
        </div>
        <form onSubmit={handleAbrir} className={styles.formAbrir}>
          <input 
            type="number" 
            placeholder="Base en caja ($)" 
            value={baseInput}
            onChange={(e) => setBaseInput(e.target.value)}
            required
            className={styles.inputBase}
            disabled={isPending}
          />
          <Button type="submit" variant="primary" disabled={isPending || !baseInput}>
            {isPending ? 'Abriendo...' : 'Abrir Caja'}
          </Button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.containerOpen}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.iconOpen}><IconLockOpen size={22} /></span>
          <h3>Caja Abierta</h3>
        </div>
        <span className={styles.timeOpen}>
          Desde: {new Date(data.opened_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Base Inicial</span>
          <span className={styles.metricValue}>{formatCurrency(data.base_inicial)}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Ventas Efectivo</span>
          <span className={styles.metricValue}>{formatCurrency(data.ventasEfectivo)}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Ventas Digitales</span>
          <span className={styles.metricValue}>{formatCurrency(data.ventasTransferencias)}</span>
        </div>
        <div className={`${styles.metricCard} ${styles.metricHighlight}`}>
          <span className={styles.metricLabel}>Esperado en Caja (Físico)</span>
          <span className={styles.metricValueHighlight}>{formatCurrency(data.totalEsperadoEfectivo)}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <Button 
          variant="secondary" 
          onClick={handleCerrar} 
          disabled={isPending}
          style={{ backgroundColor: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger)' }}
        >
          {isPending ? 'Cerrando...' : 'Cerrar Turno y Caja'}
        </Button>
      </div>
    </div>
  );
};
