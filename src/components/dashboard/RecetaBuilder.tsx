'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { InsumoConCosto, Producto, ProductoCosto, RecetaItem } from '@/types';
import {
  crearInsumo,
  registrarCompraInsumo,
  listarRecetaDeProducto,
  guardarReceta,
  listarInsumos,
  listarProductoCostos,
} from '@/app/actions/recetas';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconTrash, IconUtensils } from '@/components/ui/Icons';
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

  // ── Alta de insumo ──
  const [creandoInsumo, setCreandoInsumo] = useState(false);
  const [nombreInsumo, setNombreInsumo] = useState('');
  const [unidadInsumo, setUnidadInsumo] = useState('');

  // ── Registrar compra de un insumo ──
  const [insumoConLote, setInsumoConLote] = useState<number | null>(null);
  const [precioLote, setPrecioLote] = useState('');
  const [rendimientoLote, setRendimientoLote] = useState('');

  // ── Receta de un producto ──
  const [productoId, setProductoId] = useState<number | ''>('');
  const [items, setItems] = useState<FilaEdicion[]>([]);
  const [cargandoReceta, setCargandoReceta] = useState(false);

  const recargarInsumos = async () => {
    const res = await listarInsumos();
    if (res.success) setInsumos(res.insumos);
  };

  const recargarCostos = async () => {
    const res = await listarProductoCostos();
    if (res.success) setCostos(res.costos);
  };

  const guardarInsumo = () => {
    if (!nombreInsumo.trim() || !unidadInsumo.trim()) {
      toast.error('Completa el nombre y la unidad del insumo.');
      return;
    }
    startTransition(async () => {
      const res = await crearInsumo(nombreInsumo.trim(), unidadInsumo.trim());
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombreInsumo.trim()} agregado. Ahora registra su primera compra.`);
      setNombreInsumo('');
      setUnidadInsumo('');
      setCreandoInsumo(false);
      await recargarInsumos();
    });
  };

  const guardarLote = (insumo: InsumoConCosto) => {
    const precio = Number(precioLote);
    const rendimiento = Number(rendimientoLote);
    if (!precio || precio <= 0) {
      toast.error('El precio de compra debe ser mayor a cero.');
      return;
    }
    if (!rendimiento || rendimiento <= 0) {
      toast.error(`El rendimiento debe ser mayor a cero (en ${insumo.unidad_base}).`);
      return;
    }
    startTransition(async () => {
      const res = await registrarCompraInsumo(insumo.id, precio, rendimiento);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Compra registrada: ${insumo.nombre} a ${formatoCOP.format(precio / rendimiento)} por ${insumo.unidad_base}.`);
      setInsumoConLote(null);
      setPrecioLote('');
      setRendimientoLote('');
      await recargarInsumos();
      await recargarCostos();
    });
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
      {/* ── Catálogo de insumos ── */}
      <div className={styles.bloque}>
        <div className={styles.cabecera}>
          <h3 className={styles.bloqueTitulo}>Insumos</h3>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setCreandoInsumo((v) => !v)}
            disabled={cargando}
          >
            {creandoInsumo ? 'Cancelar' : (
              <><IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Nuevo insumo</>
            )}
          </button>
        </div>
        <p className={styles.ayuda}>
          El precio no se edita aquí: cada compra queda registrada como un lote (precio + cuánto
          rindió). El costo vigente es el promedio de los últimos 5 lotes.
        </p>

        {creandoInsumo && (
          <div className={styles.formulario}>
            <div className={styles.fila}>
              <label className={styles.campo}>
                <span className={styles.etiqueta}>Nombre</span>
                <input
                  className={styles.input}
                  placeholder="Ej: Carne Res - Ampolleta"
                  value={nombreInsumo}
                  onChange={(e) => setNombreInsumo(e.target.value)}
                  maxLength={200}
                  disabled={cargando}
                />
              </label>
              <label className={styles.campo}>
                <span className={styles.etiqueta}>Unidad base</span>
                <input
                  className={styles.input}
                  placeholder="Ej: gramo, unidad, mililitro"
                  value={unidadInsumo}
                  onChange={(e) => setUnidadInsumo(e.target.value)}
                  maxLength={50}
                  disabled={cargando}
                />
              </label>
            </div>
            <button type="button" className={styles.btn} onClick={guardarInsumo} disabled={cargando}>
              {cargando ? 'Guardando…' : 'Dar de alta'}
            </button>
          </div>
        )}

        <p className={styles.scrollHint}>← Desliza para ver más →</p>
        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th className={styles.th}>Insumo</th>
                <th className={styles.th}>Unidad</th>
                <th className={styles.th}>Costo vigente</th>
                <th className={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((insumo) => (
                <React.Fragment key={insumo.id}>
                  <tr className={styles.tr}>
                    <td className={`${styles.td} ${styles.nombre}`}>{insumo.nombre}</td>
                    <td className={styles.td}>{insumo.unidad_base}</td>
                    <td className={`${styles.td} ${styles.costo}`}>
                      {insumo.costo_unitario != null ? (
                        `${formatoCOP.format(insumo.costo_unitario)} / ${insumo.unidad_base}`
                      ) : (
                        <span className={styles.sinCosto}>sin compras registradas</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <button
                        type="button"
                        className={styles.accionBtn}
                        onClick={() => setInsumoConLote(insumoConLote === insumo.id ? null : insumo.id)}
                        disabled={cargando}
                      >
                        {insumoConLote === insumo.id ? 'Cancelar' : 'Registrar compra'}
                      </button>
                    </td>
                  </tr>
                  {insumoConLote === insumo.id && (
                    <tr>
                      <td className={styles.td} colSpan={4}>
                        <div className={styles.fila}>
                          <label className={styles.campo}>
                            <span className={styles.etiqueta}>Precio pagado</span>
                            <input
                              type="number"
                              className={styles.input}
                              placeholder="Ej: 95000"
                              value={precioLote}
                              onChange={(e) => setPrecioLote(e.target.value)}
                              disabled={cargando}
                            />
                          </label>
                          <label className={styles.campo}>
                            <span className={styles.etiqueta}>
                              Rindió cuántos {insumo.unidad_base}
                            </span>
                            <input
                              type="number"
                              className={styles.input}
                              placeholder="Ej: 125"
                              value={rendimientoLote}
                              onChange={(e) => setRendimientoLote(e.target.value)}
                              disabled={cargando}
                            />
                          </label>
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => guardarLote(insumo)}
                            disabled={cargando}
                          >
                            Guardar compra
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {insumos.length === 0 && (
                <tr>
                  <td className={styles.vacio} colSpan={4}>
                    Todavía no hay insumos. Crea el primero arriba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    {c.costo_total > 0 ? (
                      formatoCOP.format(c.costo_total)
                    ) : (
                      <span className={styles.sinCosto}>sin receta</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {c.margen != null && c.costo_total > 0 ? (
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
