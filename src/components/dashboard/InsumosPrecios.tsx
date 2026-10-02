'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { CompraInsumo, InsumoConCosto, Producto, ProductoCosto } from '@/types';
import {
  actualizarInsumo,
  crearInsumo,
  eliminarCompraInsumo,
  enlazarInsumo,
  listarLotesDeInsumo,
  registrarCompraInsumo,
} from '@/app/actions/recetas';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconSearch, IconTrash } from '@/components/ui/Icons';
import styles from './RecetaBuilder.module.css';

interface InsumosPreciosProps {
  insumos: InsumoConCosto[];
  productos: Producto[];
  costos: ProductoCosto[];
  /** Vuelve a pedir insumos y costos al servidor y devuelve los costos nuevos */
  recargar: () => Promise<ProductoCosto[]>;
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fecha = (iso: string) => formatoFecha.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const porcentaje = (margen: number | null) => (margen == null ? '—' : `${(margen * 100).toFixed(1)}%`);

type Panel = 'precio' | 'compras' | 'enlace';

interface Cambio {
  titulo: string;
  productos: { nombre: string; costoAntes: number; costoAhora: number; margenAntes: number | null; margenAhora: number | null }[];
}

/**
 * Precios de los insumos. Un precio se cambia en un solo lugar y llega a
 * todos los productos que lo usan, igual que en el Excel: los insumos que
 * comparten precio están enlazados a uno solo, y los combos toman el costo
 * del producto que incluyen.
 */
export const InsumosPrecios: React.FC<InsumosPreciosProps> = ({ insumos, productos, costos, recargar }) => {
  const [cargando, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<{ id: number; panel: Panel } | null>(null);
  const [cambio, setCambio] = useState<Cambio | null>(null);

  // Cambiar precio
  const [modo, setModo] = useState<'directo' | 'calculado'>('directo');
  const [precioUnidad, setPrecioUnidad] = useState('');
  const [precioPagado, setPrecioPagado] = useState('');
  const [paraCuantas, setParaCuantas] = useState('');

  // Compras anteriores
  const [lotes, setLotes] = useState<CompraInsumo[] | null>(null);

  // De dónde toma el precio
  const [origenEnlace, setOrigenEnlace] = useState('');
  const [factor, setFactor] = useState('1');
  const [promedia, setPromedia] = useState(false);

  // Insumo nuevo
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [unidadNueva, setUnidadNueva] = useState('');

  const nombreDeInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.nombre])), [insumos]);
  const nombreDeProducto = useMemo(() => new Map(costos.map((c) => [c.producto_id, c.nombre])), [costos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? insumos.filter((i) => i.nombre.toLowerCase().includes(q)) : insumos;
  }, [insumos, busqueda]);

  /** "mismo precio que Queso tajado" o "2 × el costo de Hamburguesa CLASICA" */
  const describirEnlace = (insumo: InsumoConCosto): string | null => {
    const veces = insumo.enlace_factor !== 1 ? `${insumo.enlace_factor} × ` : '';
    if (insumo.enlace_insumo_id != null) {
      const origen = nombreDeInsumo.get(insumo.enlace_insumo_id) ?? 'otro insumo';
      return veces ? `${veces}el precio de ${origen}` : `mismo precio que ${origen}`;
    }
    if (insumo.enlace_producto_id != null) {
      return `${veces}el costo de ${nombreDeProducto.get(insumo.enlace_producto_id) ?? 'un producto'}`;
    }
    return null;
  };

  /** Compara los costos de antes con los que devuelve el servidor y deja a la vista qué cambió */
  const recargarYComparar = async (titulo: string) => {
    const antes = new Map(costos.map((c) => [c.producto_id, c]));
    const ahora = await recargar();
    const productosCambiados = ahora
      .filter((c) => {
        const a = antes.get(c.producto_id);
        return a && Math.round(a.costo_total) !== Math.round(c.costo_total);
      })
      .map((c) => {
        const a = antes.get(c.producto_id)!;
        return {
          nombre: c.nombre,
          costoAntes: a.costo_total,
          costoAhora: c.costo_total,
          margenAntes: a.margen,
          margenAhora: c.margen,
        };
      });
    setCambio({ titulo, productos: productosCambiados });
  };

  const abrir = (insumo: InsumoConCosto, panel: Panel) => {
    if (abierto?.id === insumo.id && abierto.panel === panel) {
      setAbierto(null);
      return;
    }
    setAbierto({ id: insumo.id, panel });
    if (panel === 'precio') {
      setModo('directo');
      setPrecioUnidad('');
      setPrecioPagado('');
      setParaCuantas('');
    }
    if (panel === 'compras') {
      setLotes(null);
      startTransition(async () => {
        const res = await listarLotesDeInsumo(insumo.id);
        if (res.success) setLotes(res.lotes);
        else toast.error(res.error);
      });
    }
    if (panel === 'enlace') {
      setOrigenEnlace(
        insumo.enlace_insumo_id != null
          ? `i:${insumo.enlace_insumo_id}`
          : insumo.enlace_producto_id != null
            ? `p:${insumo.enlace_producto_id}`
            : ''
      );
      setFactor(String(insumo.enlace_factor));
      setPromedia(insumo.promedia);
    }
  };

  // El precio por unidad que saldría de lo escrito, o null si aún no alcanza
  const precioNuevo = (() => {
    if (modo === 'directo') {
      const v = Number(precioUnidad);
      return v > 0 ? v : null;
    }
    const pagado = Number(precioPagado);
    const cuantas = Number(paraCuantas);
    return pagado > 0 && cuantas > 0 ? pagado / cuantas : null;
  })();

  const guardarPrecio = (insumo: InsumoConCosto) => {
    if (precioNuevo == null) {
      toast.error(
        modo === 'directo'
          ? `Escribe cuánto vale ${insumo.unidad_base === 'receta' ? 'por receta' : `cada ${insumo.unidad_base}`}.`
          : 'Escribe cuánto pagaste y para cuántas unidades alcanzó.'
      );
      return;
    }
    const pagado = modo === 'directo' ? Number(precioUnidad) : Number(precioPagado);
    const cuantas = modo === 'directo' ? 1 : Number(paraCuantas);
    startTransition(async () => {
      const res = await registrarCompraInsumo(insumo.id, pagado, cuantas);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setAbierto(null);
      await recargarYComparar(
        `${insumo.nombre}: ${insumo.costo_unitario != null ? `de ${formatoCOP.format(insumo.costo_unitario)} a ` : ''}${formatoCOP.format(precioNuevo)}`
      );
    });
  };

  const borrarCompra = (insumo: InsumoConCosto, lote: CompraInsumo) => {
    const porUnidad = formatoCOP.format(lote.precio_compra / lote.rendimiento);
    if (!window.confirm(`¿Borrar la compra del ${fecha(lote.fecha)} (${porUnidad})?\n\nEl precio de ${insumo.nombre} vuelve a salir de la compra anterior.`)) {
      return;
    }
    startTransition(async () => {
      const res = await eliminarCompraInsumo(lote.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setAbierto(null);
      await recargarYComparar(`${insumo.nombre}: se borró la compra del ${fecha(lote.fecha)}`);
    });
  };

  const guardarEnlace = (insumo: InsumoConCosto) => {
    const veces = Number(factor);
    if (origenEnlace && !(veces > 0)) {
      toast.error('La cantidad por la que se multiplica debe ser mayor a cero.');
      return;
    }
    const id = origenEnlace ? Number(origenEnlace.slice(2)) : null;
    const enlace = {
      insumoId: origenEnlace.startsWith('i:') ? id : null,
      productoId: origenEnlace.startsWith('p:') ? id : null,
      factor: origenEnlace ? veces : 1,
    };
    startTransition(async () => {
      const res = await enlazarInsumo(insumo.id, enlace);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (promedia !== insumo.promedia) {
        const resPromedia = await actualizarInsumo(insumo.id, insumo.nombre, insumo.unidad_base, promedia);
        if (!resPromedia.success) {
          toast.error(resPromedia.error);
          return;
        }
      }
      setAbierto(null);
      await recargarYComparar(`${insumo.nombre}: cambió de dónde toma el precio`);
    });
  };

  const guardarInsumoNuevo = () => {
    if (!nombreNuevo.trim() || !unidadNueva.trim()) {
      toast.error('Completa el nombre y la unidad del insumo.');
      return;
    }
    startTransition(async () => {
      const res = await crearInsumo(nombreNuevo.trim(), unidadNueva.trim());
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombreNuevo.trim()} agregado. Ahora ponle precio.`);
      setBusqueda(nombreNuevo.trim());
      setNombreNuevo('');
      setUnidadNueva('');
      setCreando(false);
      await recargar();
    });
  };

  const unidadDe = (insumo: InsumoConCosto) => (insumo.unidad_base === 'receta' ? 'receta' : insumo.unidad_base);

  return (
    <div className={styles.bloque}>
      <div className={styles.cabecera}>
        <h3 className={styles.bloqueTitulo}>Precios de insumos ({insumos.length})</h3>
        <button type="button" className={styles.btnSecundario} onClick={() => setCreando((v) => !v)} disabled={cargando}>
          {creando ? 'Cancelar' : (
            <><IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Nuevo insumo</>
          )}
        </button>
      </div>
      <p className={styles.ayuda}>
        Cuando algo sube, búscalo y cambia su precio una sola vez: se actualizan todos los productos que lo
        llevan, incluidos los combos. Los insumos que dicen «mismo precio que…» cambian solos con el principal.
      </p>

      {creando && (
        <div className={styles.formulario}>
          <div className={styles.fila}>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Nombre</span>
              <input
                className={styles.input}
                placeholder="Ej: Carne Res - Ampolleta"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                maxLength={200}
                disabled={cargando}
              />
            </label>
            <label className={styles.campo}>
              <span className={styles.etiqueta}>Se cuenta por</span>
              <input
                className={styles.input}
                placeholder="Ej: unidad, par, porción"
                value={unidadNueva}
                onChange={(e) => setUnidadNueva(e.target.value)}
                maxLength={50}
                disabled={cargando}
              />
            </label>
          </div>
          <button type="button" className={styles.btn} onClick={guardarInsumoNuevo} disabled={cargando}>
            {cargando ? 'Guardando…' : 'Crear insumo'}
          </button>
        </div>
      )}

      {cambio && (
        <div className={styles.cambio} role="status">
          <div className={styles.cabecera}>
            <strong>{cambio.titulo}</strong>
            <button type="button" className={styles.accionBtn} onClick={() => setCambio(null)}>
              Cerrar
            </button>
          </div>
          {cambio.productos.length === 0 ? (
            <p className={styles.ayuda}>Ningún producto cambió de costo: nadie usa este insumo en su receta, o el precio quedó igual.</p>
          ) : (
            <>
              <p className={styles.ayuda}>
                {cambio.productos.length === 1 ? 'Cambió 1 producto' : `Cambiaron ${cambio.productos.length} productos`}.
                Las ventas ya hechas conservan el costo que tenían.
              </p>
              <div className={styles.tablaWrapper}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Producto</th>
                      <th className={styles.th}>Costo antes</th>
                      <th className={styles.th}>Costo ahora</th>
                      <th className={styles.th}>Margen antes</th>
                      <th className={styles.th}>Margen ahora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambio.productos.map((p) => (
                      <tr key={p.nombre} className={styles.tr}>
                        <td className={`${styles.td} ${styles.nombre}`}>{p.nombre}</td>
                        <td className={`${styles.td} ${styles.costo}`}>{formatoCOP.format(p.costoAntes)}</td>
                        <td className={`${styles.td} ${styles.costo}`}>{formatoCOP.format(p.costoAhora)}</td>
                        <td className={`${styles.td} ${styles.costo}`}>{porcentaje(p.margenAntes)}</td>
                        <td className={`${styles.td} ${styles.costo}`}>
                          <span className={(p.margenAhora ?? 0) >= 0 ? styles.margenPositivo : styles.margenNegativo}>
                            {porcentaje(p.margenAhora)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <label className={styles.buscador}>
        <IconSearch size={16} />
        <input
          className={styles.buscadorInput}
          placeholder="Buscar insumo: queso, carne, pan…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      <p className={styles.scrollHint}>Desliza la tabla hacia los lados para ver todo</p>
      <div className={`${styles.tablaWrapper} ${styles.tablaAlta}`}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th className={styles.th}>Insumo</th>
              <th className={styles.th}>Precio</th>
              <th className={styles.th}>Lo usan</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((insumo) => {
              const enlace = describirEnlace(insumo);
              const panel = abierto?.id === insumo.id ? abierto.panel : null;
              return (
                <React.Fragment key={insumo.id}>
                  <tr className={styles.tr}>
                    <td className={`${styles.td} ${styles.nombre}`}>
                      {insumo.nombre}
                      {insumo.se_compra_hecho && (
                        <span className={styles.tagBebida} title="Es un producto del menú que se compra hecho: su costo es lo que pagas por él">
                          se compra hecho
                        </span>
                      )}
                      {enlace && <span className={styles.enlace}>{enlace}</span>}
                    </td>
                    <td className={`${styles.td} ${styles.costo}`}>
                      {insumo.costo_unitario != null ? (
                        <>
                          {formatoCOP.format(insumo.costo_unitario)} por {unidadDe(insumo)}
                          {!enlace && insumo.fecha_ultima_compra && (
                            <span className={styles.enlace}>
                              {insumo.promedia ? 'promedio de las últimas compras' : `desde el ${fecha(insumo.fecha_ultima_compra)}`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.sinCosto}>sin precio todavía</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      {insumo.usos === 0 ? (
                        <span className={styles.sinCosto}>ninguna receta</span>
                      ) : (
                        `${insumo.usos} receta${insumo.usos !== 1 ? 's' : ''}`
                      )}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.acciones}>
                        {!enlace && (
                          <button
                            type="button"
                            className={styles.accionBtn}
                            onClick={() => abrir(insumo, 'precio')}
                            disabled={cargando}
                            aria-expanded={panel === 'precio'}
                          >
                            Cambiar precio
                          </button>
                        )}
                        {!enlace && (
                          <button
                            type="button"
                            className={styles.accionBtn}
                            onClick={() => abrir(insumo, 'compras')}
                            disabled={cargando}
                            aria-expanded={panel === 'compras'}
                          >
                            Compras anteriores
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.accionBtn}
                          onClick={() => abrir(insumo, 'enlace')}
                          disabled={cargando}
                          aria-expanded={panel === 'enlace'}
                        >
                          {enlace ? 'Cambiar de dónde sale' : 'Tomar el precio de otro'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {panel === 'precio' && (
                    <tr>
                      <td className={styles.td} colSpan={4}>
                        <div className={styles.formulario}>
                          <div className={styles.modos} role="radiogroup" aria-label="Cómo escribir el precio">
                            <label className={styles.modo}>
                              <input type="radio" checked={modo === 'directo'} onChange={() => setModo('directo')} disabled={cargando} />
                              Ya sé cuánto vale por {unidadDe(insumo)}
                            </label>
                            <label className={styles.modo}>
                              <input type="radio" checked={modo === 'calculado'} onChange={() => setModo('calculado')} disabled={cargando} />
                              Calcularlo con lo que pagué
                            </label>
                          </div>
                          {modo === 'directo' ? (
                            <div className={styles.fila}>
                              <label className={styles.campo} style={{ maxWidth: '260px' }}>
                                <span className={styles.etiqueta}>Precio por {unidadDe(insumo)}</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className={styles.input}
                                  placeholder="Ej: 3309"
                                  value={precioUnidad}
                                  onChange={(e) => setPrecioUnidad(e.target.value)}
                                  disabled={cargando}
                                  autoFocus
                                />
                              </label>
                            </div>
                          ) : (
                            <div className={styles.fila}>
                              <label className={styles.campo} style={{ maxWidth: '260px' }}>
                                <span className={styles.etiqueta}>Precio pagado</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className={styles.input}
                                  placeholder="Ej: 63000"
                                  value={precioPagado}
                                  onChange={(e) => setPrecioPagado(e.target.value)}
                                  disabled={cargando}
                                  autoFocus
                                />
                              </label>
                              <label className={styles.campo} style={{ maxWidth: '260px' }}>
                                <span className={styles.etiqueta}>Para cuántas unidades ({unidadDe(insumo)})</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className={styles.input}
                                  placeholder="Ej: 50"
                                  value={paraCuantas}
                                  onChange={(e) => setParaCuantas(e.target.value)}
                                  disabled={cargando}
                                />
                              </label>
                            </div>
                          )}
                          <p className={styles.resultado} aria-live="polite">
                            {precioNuevo == null ? (
                              insumo.costo_unitario != null
                                ? `Hoy vale ${formatoCOP.format(insumo.costo_unitario)} por ${unidadDe(insumo)}.`
                                : 'Todavía no tiene precio.'
                            ) : (
                              <>
                                {insumo.costo_unitario != null && <>{formatoCOP.format(insumo.costo_unitario)} pasa a </>}
                                <strong>{formatoCOP.format(precioNuevo)} por {unidadDe(insumo)}</strong>
                                {insumo.usos > 0 && <>, y cambia en {insumo.usos} receta{insumo.usos !== 1 ? 's' : ''}</>}.
                              </>
                            )}
                          </p>
                          <div className={styles.acciones}>
                            <button type="button" className={styles.btn} onClick={() => guardarPrecio(insumo)} disabled={cargando || precioNuevo == null}>
                              {cargando ? 'Guardando…' : 'Guardar precio'}
                            </button>
                            <button type="button" className={styles.btnSecundario} onClick={() => setAbierto(null)} disabled={cargando}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {panel === 'compras' && (
                    <tr>
                      <td className={styles.td} colSpan={4}>
                        {lotes == null ? (
                          <p className={styles.ayuda}>Cargando compras…</p>
                        ) : lotes.length === 0 ? (
                          <p className={styles.ayuda}>Este insumo no tiene compras registradas.</p>
                        ) : (
                          <ul className={styles.lotes}>
                            {lotes.map((lote, i) => (
                              <li key={lote.id} className={styles.lote}>
                                <span className={styles.costo}>
                                  <strong>{formatoCOP.format(lote.precio_compra / lote.rendimiento)}</strong> por {unidadDe(insumo)}
                                  <span className={styles.enlace}>
                                    {fecha(lote.fecha)}
                                    {Number(lote.rendimiento) !== 1 &&
                                      `, ${formatoCOP.format(lote.precio_compra)} para ${Number(lote.rendimiento)}`}
                                    {i === 0 && !insumo.promedia && ', es el precio de hoy'}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  onClick={() => borrarCompra(insumo, lote)}
                                  disabled={cargando}
                                  aria-label={`Borrar la compra del ${fecha(lote.fecha)}`}
                                >
                                  <IconTrash size={16} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}

                  {panel === 'enlace' && (
                    <tr>
                      <td className={styles.td} colSpan={4}>
                        <div className={styles.formulario}>
                          <div className={styles.fila}>
                            <label className={styles.campo}>
                              <span className={styles.etiqueta}>De dónde sale el precio</span>
                              <select
                                className={styles.select}
                                value={origenEnlace}
                                onChange={(e) => setOrigenEnlace(e.target.value)}
                                disabled={cargando}
                              >
                                <option value="">De sus propias compras</option>
                                <optgroup label="Del precio de otro insumo">
                                  {insumos
                                    .filter((i) => i.id !== insumo.id && i.origen === 'compra')
                                    .map((i) => (
                                      <option key={i.id} value={`i:${i.id}`}>{i.nombre}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Del costo de un producto del menú">
                                  {productos.map((p) => (
                                    <option key={p.id} value={`p:${p.id}`}>{p.nombre}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </label>
                            {origenEnlace && (
                              <label className={styles.campo} style={{ maxWidth: '200px' }}>
                                <span className={styles.etiqueta}>Multiplicado por</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  className={styles.input}
                                  value={factor}
                                  onChange={(e) => setFactor(e.target.value)}
                                  disabled={cargando}
                                />
                              </label>
                            )}
                          </div>
                          <p className={styles.ayuda}>
                            {origenEnlace
                              ? 'Es lo que hace el Excel cuando una casilla copia a otra: 1 para el mismo precio, 2 para un combo de dos hamburguesas, 0,5 para media porción.'
                              : 'Con sus propias compras, el precio es el de la última que registres.'}
                          </p>
                          {!origenEnlace && (
                            <label className={styles.modo}>
                              <input type="checkbox" checked={promedia} onChange={(e) => setPromedia(e.target.checked)} disabled={cargando} />
                              Promediar las últimas 5 compras (para lo que cambia mucho, como el gas o el aceite)
                            </label>
                          )}
                          <div className={styles.acciones}>
                            <button type="button" className={styles.btn} onClick={() => guardarEnlace(insumo)} disabled={cargando}>
                              {cargando ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button type="button" className={styles.btnSecundario} onClick={() => setAbierto(null)} disabled={cargando}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtrados.length === 0 && insumos.length > 0 && (
              <tr>
                <td className={styles.vacio} colSpan={4}>
                  Ningún insumo se llama «{busqueda}». Revisa cómo está escrito o créalo con «Nuevo insumo».
                </td>
              </tr>
            )}
            {insumos.length === 0 && (
              <tr>
                <td className={styles.vacio} colSpan={4}>
                  Todavía no hay insumos. Crea el primero con «Nuevo insumo».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
