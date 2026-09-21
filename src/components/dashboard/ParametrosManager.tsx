'use client';

import React, { useState, useTransition } from 'react';
import { Categoria, Parametro } from '@/types';
import { actualizarParametro } from '@/app/actions/parametros';
import { toast } from '@/components/ui/Toast';
import { IconSettings } from '@/components/ui/Icons';
import styles from './StockManager.module.css';

interface ParametrosManagerProps {
  parametros: Parametro[];
  categorias: Categoria[];
}

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

/** Cómo se muestra cada parámetro: etiqueta corta y tipo de dato */
const PRESENTACION: Record<string, { etiqueta: string; tipo: 'pesos' | 'minutos' | 'categoria' }> = {
  domiciliario_tarifa_producto: { etiqueta: 'Pago al domiciliario por producto', tipo: 'pesos' },
  domiciliario_minimo_dia: { etiqueta: 'Mínimo del domiciliario por día', tipo: 'pesos' },
  programados_minutos_antes: { etiqueta: 'Programados: minutos antes en cocina', tipo: 'minutos' },
  categoria_bebidas_id: { etiqueta: 'Categoría de bebidas (no cuentan al domiciliario)', tipo: 'categoria' },
};

/**
 * Cifras del negocio que antes vivían en el código o en la cabeza de la
 * dueña. Colapsado por defecto: se cambian una vez cada mucho tiempo.
 */
export const ParametrosManager: React.FC<ParametrosManagerProps> = ({ parametros: iniciales, categorias }) => {
  const [abierto, setAbierto] = useState(false);
  const [parametros, setParametros] = useState<Parametro[]>(iniciales);
  const [editando, setEditando] = useState<string | null>(null);
  const [valorEdicion, setValorEdicion] = useState('');
  const [isPending, startTransition] = useTransition();

  const mostrar = (p: Parametro) => {
    const tipo = PRESENTACION[p.clave]?.tipo ?? 'pesos';
    if (tipo === 'pesos') return formatoCOP.format(p.valor);
    if (tipo === 'minutos') return `${p.valor} min`;
    return categorias.find((c) => c.id === p.valor)?.nombre ?? '(sin categoría)';
  };

  const guardar = (p: Parametro) => {
    const valor = Number(valorEdicion);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Escribe un número válido.');
      return;
    }
    startTransition(async () => {
      const res = await actualizarParametro(p.clave, valor);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${PRESENTACION[p.clave]?.etiqueta ?? p.clave} actualizado.`);
      setParametros((prev) => prev.map((x) => (x.clave === p.clave ? { ...x, valor } : x)));
      setEditando(null);
    });
  };

  return (
    <div className={styles.container}>
      <button className={styles.headerToggle} onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}><IconSettings size={20} /></span>
          <h2 className={styles.title}>Parámetros del Negocio</h2>
        </div>
        <div className={styles.headerRight}>
          {!abierto && <span className={styles.preview}>{parametros.length} cifras</span>}
          <span className={`${styles.chevron} ${abierto ? styles.chevronOpen : ''}`}>▾</span>
        </div>
      </button>

      {abierto && (
        <div className={styles.content}>
          <p className={styles.description}>
            Cifras con las que la app calcula el pago al domiciliario y el tablero de cocina.
            Cambiarlas aquí aplica de inmediato, sin tocar el programa.
          </p>

          <div className={styles.grid}>
            {parametros.map((p) => {
              const pres = PRESENTACION[p.clave] ?? { etiqueta: p.clave, tipo: 'pesos' as const };
              const enEdicion = editando === p.clave;
              return (
                <div key={p.clave} className={styles.card} style={enEdicion ? { gridColumn: '1 / -1' } : undefined}>
                  {enEdicion ? (
                    <div className={styles.formulario} style={{ width: '100%' }}>
                      <span className={styles.formEtiqueta}>{pres.etiqueta}</span>
                      <div className={styles.formFila}>
                        {pres.tipo === 'categoria' ? (
                          <select
                            className={styles.formInput}
                            value={valorEdicion}
                            onChange={(e) => setValorEdicion(e.target.value)}
                            disabled={isPending}
                          >
                            <option value="0">(ninguna)</option>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            className={styles.formInput}
                            value={valorEdicion}
                            onChange={(e) => setValorEdicion(e.target.value)}
                            disabled={isPending}
                            autoFocus
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className={styles.nuevoBtn} onClick={() => guardar(p)} disabled={isPending}>
                          {isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" className={styles.cancelarBtn} onClick={() => setEditando(null)} disabled={isPending}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.info}>
                        <span className={styles.name}>{pres.etiqueta}</span>
                        <span className={styles.price}>{mostrar(p)}</span>
                        <span className={styles.description} style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                          {p.descripcion}
                        </span>
                      </div>
                      <div className={styles.cardAcciones}>
                        <button
                          type="button"
                          className={styles.cancelarBtn}
                          onClick={() => {
                            setEditando(p.clave);
                            setValorEdicion(String(p.valor));
                          }}
                          disabled={isPending}
                        >
                          Cambiar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
