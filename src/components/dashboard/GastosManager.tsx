'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { Gasto } from '@/types';
import { crearGasto, eliminarGasto, listarGastos } from '@/app/actions/gastos';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconTrash } from '@/components/ui/Icons';
import styles from './GastosManager.module.css';

interface GastosManagerProps {
  gastosIniciales: Gasto[];
  from: string;
  to: string;
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

const formatoFecha = (f: string) =>
  new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export const GastosManager: React.FC<GastosManagerProps> = ({ gastosIniciales, from, to }) => {
  const [gastos, setGastos] = useState<Gasto[]>(gastosIniciales);
  const [cargando, startTransition] = useTransition();

  const [creando, setCreando] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState<'fijo' | 'variable'>('variable');
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState(to);

  const recargar = async () => {
    const res = await listarGastos(from, to);
    if (res.success) setGastos(res.gastos);
  };

  const totalFijos = useMemo(
    () => gastos.filter((g) => g.tipo === 'fijo').reduce((acc, g) => acc + g.valor, 0),
    [gastos]
  );
  const totalVariables = useMemo(
    () => gastos.filter((g) => g.tipo === 'variable').reduce((acc, g) => acc + g.valor, 0),
    [gastos]
  );
  const total = totalFijos + totalVariables;

  const guardar = () => {
    if (!descripcion.trim()) {
      toast.error('Escribe una descripción del gasto.');
      return;
    }
    if (!categoria.trim()) {
      toast.error('Escribe la categoría del gasto.');
      return;
    }
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) {
      toast.error('El valor debe ser mayor a cero.');
      return;
    }

    startTransition(async () => {
      const res = await crearGasto(descripcion.trim(), categoria.trim(), tipo, valorNum, fecha);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Gasto de ${formatoCOP.format(valorNum)} registrado.`);
      setDescripcion('');
      setCategoria('');
      setValor('');
      setCreando(false);
      await recargar();
    });
  };

  const borrar = (gasto: Gasto) => {
    startTransition(async () => {
      const res = await eliminarGasto(gasto.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Gasto "${gasto.descripcion}" eliminado.`);
      await recargar();
    });
  };

  return (
    <div className={styles.contenedor}>
      <div className={styles.cabecera}>
        <div className={styles.resumen}>
          <div className={styles.resumenItem}>
            <span className={styles.resumenEtiqueta}>Gastos fijos</span>
            <span className={styles.resumenValor}>{formatoCOP.format(totalFijos)}</span>
          </div>
          <div className={styles.resumenItem}>
            <span className={styles.resumenEtiqueta}>Gastos variables</span>
            <span className={styles.resumenValor}>{formatoCOP.format(totalVariables)}</span>
          </div>
          <div className={styles.resumenItem}>
            <span className={styles.resumenEtiqueta}>Total del período</span>
            <span className={styles.resumenValor}>{formatoCOP.format(total)}</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.nuevoBtn}
          onClick={() => setCreando((v) => !v)}
          disabled={cargando}
        >
          {creando ? 'Cancelar' : (
            <><IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Nuevo gasto</>
          )}
        </button>
      </div>

      {creando && (
        <div className={styles.formulario}>
          <div className={styles.fila}>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Descripción</span>
              <input
                className={styles.input}
                placeholder="Ej: Servicios públicos"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={200}
                disabled={cargando}
                autoFocus
              />
            </label>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Categoría</span>
              <input
                className={styles.input}
                placeholder="Ej: Servicios, Transporte, Personal"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                maxLength={100}
                disabled={cargando}
              />
            </label>
          </div>
          <div className={styles.fila}>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Tipo</span>
              <select
                className={styles.select}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'fijo' | 'variable')}
                disabled={cargando}
              >
                <option value="variable">Variable</option>
                <option value="fijo">Fijo</option>
              </select>
            </label>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Valor</span>
              <input
                type="number"
                className={styles.input}
                placeholder="Ej: 450000"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={cargando}
              />
            </label>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Fecha</span>
              <input
                type="date"
                className={styles.input}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={cargando}
              />
            </label>
          </div>
          <button type="button" className={styles.guardarBtn} onClick={guardar} disabled={cargando}>
            {cargando ? 'Guardando…' : 'Registrar gasto'}
          </button>
        </div>
      )}

      <p className={styles.scrollHint}>← Desliza para ver más →</p>
      <div className={styles.tablaWrapper}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th className={styles.th}>Descripción</th>
              <th className={styles.th}>Categoría</th>
              <th className={styles.th}>Tipo</th>
              <th className={styles.th}>Fecha</th>
              <th className={styles.th}>Valor</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.descripcion}`}>{g.descripcion}</td>
                <td className={styles.td}>{g.categoria}</td>
                <td className={styles.td}>
                  <span className={g.tipo === 'fijo' ? styles.tagFijo : styles.tagVariable}>
                    {g.tipo === 'fijo' ? 'Fijo' : 'Variable'}
                  </span>
                </td>
                <td className={styles.td}>{formatoFecha(g.fecha)}</td>
                <td className={styles.td}>{formatoCOP.format(g.valor)}</td>
                <td className={styles.td}>
                  <button
                    type="button"
                    className={styles.accionBtn}
                    onClick={() => borrar(g)}
                    disabled={cargando}
                    aria-label={`Eliminar ${g.descripcion}`}
                  >
                    <IconTrash size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td className={styles.vacio} colSpan={6}>
                  No hay gastos registrados en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
