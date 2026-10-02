'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { InsumoConCosto, Producto, ProductoCosto, RecetaItem } from '@/types';
import {
  listarRecetaDeProducto,
  guardarReceta,
  listarInsumos,
  listarProductoCostos,
} from '@/app/actions/recetas';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconTrash, IconUtensils } from '@/components/ui/Icons';
import { InsumosPrecios } from './InsumosPrecios';
import styles from './RecetaBuilder.module.css';

interface RecetaBuilderProps {
  productos: Producto[];
  insumosIniciales: InsumoConCosto[];
  costosIniciales: ProductoCosto[];
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

type FilaEdicion = { insumo_id: number; cantidad_usada: string };

export const RecetaBuilder: React.FC<RecetaBuilderProps> = ({
  productos,
  insumosIniciales,
  costosIniciales,
}) => {
  const [insumos, setInsumos] = useState<InsumoConCosto[]>(insumosIniciales);
  const [costos, setCostos] = useState<ProductoCosto[]>(costosIniciales);
  const [cargando, startTransition] = useTransition();

  // ── Receta de un producto ──
  const [productoId, setProductoId] = useState<number | ''>('');
  const [items, setItems] = useState<FilaEdicion[]>([]);
  const [cargandoReceta, setCargandoReceta] = useState(false);

  const recargarCostos = async () => {
    const res = await listarProductoCostos();
    if (res.success) setCostos(res.costos);
    return res.success ? res.costos : costos;
  };

  /** Tras cambiar un precio o un enlace: insumos y costos frescos del servidor */
  const recargar = async () => {
    const [resInsumos, costosNuevos] = await Promise.all([listarInsumos(), recargarCostos()]);
    if (resInsumos.success) setInsumos(resInsumos.insumos);
    return costosNuevos;
  };

  const cargarReceta = async (id: number | '') => {
    setProductoId(id);
    setItems([]);
    if (!id) return;
    setCargandoReceta(true);
    const res = await listarRecetaDeProducto(id);
    setCargandoReceta(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setItems(
      res.items.map((it: RecetaItem) => ({
        insumo_id: it.insumo_id,
        cantidad_usada: String(it.cantidad_usada),
      }))
    );
  };

  const agregarFila = () => {
    const disponibles = insumos.filter((i) => !items.some((it) => it.insumo_id === i.id));
    if (disponibles.length === 0) {
      toast.error('Ya agregaste todos los insumos disponibles a esta receta.');
      return;
    }
    setItems((prev) => [...prev, { insumo_id: disponibles[0].id, cantidad_usada: '' }]);
  };

  const quitarFila = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarFila = (index: number, cambios: Partial<FilaEdicion>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...cambios } : it)));
  };

  const costoPorInsumo = useMemo(
    () => new Map(insumos.map((i) => [i.id, i.costo_unitario])),
    [insumos]
  );

  const productoActual = productos.find((p) => p.id === productoId);

  const costoTotalEnVivo = useMemo(() => {
    return items.reduce((acc, it) => {
      const cantidad = Number(it.cantidad_usada) || 0;
      const costoUnitario = costoPorInsumo.get(it.insumo_id) ?? 0;
      return acc + cantidad * costoUnitario;
    }, 0);
  }, [items, costoPorInsumo]);

  const margenEnVivo =
    productoActual && productoActual.precio > 0
      ? (productoActual.precio - costoTotalEnVivo) / productoActual.precio
      : null;

  const guardar = () => {
    if (!productoId) return;
    const invalida = items.find((it) => !it.cantidad_usada || Number(it.cantidad_usada) <= 0);
    if (invalida) {
      toast.error('Todas las cantidades deben ser mayores a cero.');
      return;
    }
    startTransition(async () => {
      const res = await guardarReceta(
        productoId,
        items.map((it) => ({ insumo_id: it.insumo_id, cantidad_usada: Number(it.cantidad_usada) }))
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Receta de ${productoActual?.nombre} guardada.`);
      await recargarCostos();
    });
  };

  return (
    <div className={styles.contenedor}>
      {/* ── Precios de insumos: buscar, cambiar el precio una vez, ver qué productos cambian ── */}
      <InsumosPrecios insumos={insumos} productos={productos} costos={costos} recargar={recargar} />

      {/* ── Receta de un producto ── */}
      <div className={styles.bloque}>
        <h3 className={styles.bloqueTitulo}>
          <IconUtensils size={18} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
          Receta de un producto
        </h3>
        <div className={styles.fila}>
          <label className={styles.campo}>
            <span className={styles.etiqueta}>Producto</span>
            <select
              className={styles.select}
              value={productoId}
              onChange={(e) => cargarReceta(e.target.value ? Number(e.target.value) : '')}
              disabled={cargando || cargandoReceta}
            >
              <option value="">Selecciona un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        {productoId && (
          <>
            {cargandoReceta ? (
              <p className={styles.ayuda}>Cargando receta…</p>
            ) : (
              <>
                {items.map((it, index) => {
                  const insumo = insumos.find((i) => i.id === it.insumo_id);
                  return (
                    <div key={index} className={styles.recetaFila}>
                      <label className={styles.campo}>
                        <span className={styles.etiqueta}>Insumo</span>
                        <select
                          className={styles.select}
                          value={it.insumo_id}
                          onChange={(e) => actualizarFila(index, { insumo_id: Number(e.target.value) })}
                          disabled={cargando}
                        >
                          {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.campo} style={{ maxWidth: '160px' }}>
                        <span className={styles.etiqueta}>
                          Cantidad ({insumo?.unidad_base ?? '—'})
                        </span>
                        <input
                          type="number"
                          className={styles.input}
                          value={it.cantidad_usada}
                          onChange={(e) => actualizarFila(index, { cantidad_usada: e.target.value })}
                          disabled={cargando}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => quitarFila(index)}
                        disabled={cargando}
                        aria-label="Quitar insumo"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  );
                })}

                <button type="button" className={styles.btnSecundario} onClick={agregarFila} disabled={cargando}>
                  <IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
                  Agregar insumo
                </button>

                {productoActual && (
                  <div className={styles.resumen}>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenEtiqueta}>Precio de venta</span>
                      <span className={styles.resumenValor}>{formatoCOP.format(productoActual.precio)}</span>
                    </div>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenEtiqueta}>Costo de la receta</span>
                      <span className={styles.resumenValor}>{formatoCOP.format(costoTotalEnVivo)}</span>
                    </div>
                    <div className={styles.resumenItem}>
                      <span className={styles.resumenEtiqueta}>Margen</span>
                      <span
                        className={
                          margenEnVivo != null && margenEnVivo >= 0
                            ? styles.margenPositivo
                            : styles.margenNegativo
                        }
                      >
                        {margenEnVivo != null ? `${(margenEnVivo * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                )}

                <button type="button" className={styles.btn} onClick={guardar} disabled={cargando || items.length === 0}>
                  {cargando ? 'Guardando…' : 'Guardar receta'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Costeo de todo el menú ── */}
      <div className={styles.bloque}>
        <h3 className={styles.bloqueTitulo}>Costeo del menú</h3>
        <p className={styles.scrollHint}>← Desliza para ver más →</p>
        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th className={styles.th}>Producto</th>
                <th className={styles.th}>Precio</th>
                <th className={styles.th}>Costo</th>
                <th className={styles.th}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {costos.map((c) => (
                <tr key={c.producto_id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.nombre}`}>{c.nombre}</td>
                  <td className={styles.td}>{formatoCOP.format(c.precio)}</td>
                  <td className={styles.td}>
                    {c.costo_manual != null ? (
                      // Escrito a mano en el menú: manda sobre la receta.
                      <span title="Costo escrito a mano en el menú: manda sobre la receta">
                        {formatoCOP.format(c.costo_total)} · manual
                      </span>
                    ) : c.insumos_en_receta === 0 ? (
                      <span className={styles.sinCosto}>sin receta</span>
                    ) : c.insumos_sin_costo > 0 ? (
                      // El costo que hay es parcial: falta registrar compras de
                      // algún insumo. Mostrarlo como si estuviera completo
                      // infla el margen sin que se note.
                      <span className={styles.sinCosto} title="Falta registrar la compra de algún insumo de la receta">
                        {formatoCOP.format(c.costo_total)} · incompleto ({c.insumos_sin_costo} sin precio)
                      </span>
                    ) : (
                      formatoCOP.format(c.costo_total)
                    )}
                  </td>
                  <td className={styles.td}>
                    {c.margen != null &&
                    (c.costo_manual != null || (c.insumos_en_receta > 0 && c.insumos_sin_costo === 0)) ? (
                      <span className={c.margen >= 0 ? styles.margenPositivo : styles.margenNegativo}>
                        {(c.margen * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className={styles.sinCosto}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {costos.length === 0 && (
                <tr>
                  <td className={styles.vacio} colSpan={4}>
                    No hay productos en el menú.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
