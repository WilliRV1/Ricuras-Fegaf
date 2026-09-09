'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ComparativoMensual } from '@/types';
import styles from './ComparativoChart.module.css';

interface ComparativoChartProps {
  comparativo: ComparativoMensual;
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  notation: 'compact',
});

/**
 * Gráfica de barras "Mes actual vs. Mes anterior" del Módulo 8 — Ventas,
 * Costo de productos, Gastos y Utilidad Neta, uno al lado del otro por mes.
 */
export const ComparativoChart: React.FC<ComparativoChartProps> = ({ comparativo }) => {
  const { mesActual, mesAnterior } = comparativo;

  const data = [
    { concepto: 'Ventas', [mesAnterior.etiqueta]: mesAnterior.ventas, [mesActual.etiqueta]: mesActual.ventas },
    {
      concepto: 'Costo productos',
      [mesAnterior.etiqueta]: mesAnterior.costoProductos,
      [mesActual.etiqueta]: mesActual.costoProductos,
    },
    { concepto: 'Gastos', [mesAnterior.etiqueta]: mesAnterior.gastos, [mesActual.etiqueta]: mesActual.gastos },
    {
      concepto: 'Utilidad neta',
      [mesAnterior.etiqueta]: mesAnterior.utilidadNeta,
      [mesActual.etiqueta]: mesActual.utilidadNeta,
    },
  ];

  return (
    <div className={styles.contenedor}>
      <div className={styles.chartAspect}>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="concepto"
            stroke="var(--color-text-muted)"
            fontSize={11}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="var(--color-text-muted)"
            fontSize={11}
            tickFormatter={(v) => formatoCOP.format(Number(v))}
            width={56}
          />
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                Number(value)
              )
            }
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
          />
          <Legend />
          <Bar dataKey={mesAnterior.etiqueta} fill="var(--color-text-muted)" radius={[4, 4, 0, 0]} />
          <Bar dataKey={mesActual.etiqueta} fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
