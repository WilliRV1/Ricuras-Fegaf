'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { MetodoPago, Producto, ProductoCosto } from '@/types';
import { crearPedidoEvento } from '@/app/actions/pedidos';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconTrash } from '@/components/ui/Icons';
import tabla from './RecetaBuilder.module.css';
import styles from './EventoBuilder.module.css';

interface EventoBuilderProps {
  productos: Producto[];
  costos: ProductoCosto[];
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface Linea {
  clave: number;
  productoId: number;
  cantidad: string;
  precio: string;
  notas: string;
}

/**
 * Cotiza y registra un pedido de evento: se arma la lista, se escribe el
 * precio por unidad para ese cliente y se ve cuánto queda antes de dar el
 * precio. "Crear pedido" lo manda a cocina con esos precios.
 */
export const EventoBuilder: React.FC<EventoBuilderProps> = ({ productos, costos }) => {
  const [cargando, startTransition] = useTransition();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [productoNuevo, setProductoNuevo] = useState('');
  const [creado, setCreado] = useState<{ id: number; total: number } | null>(null);

  const [tipo, setTipo] = useState<'mesa' | 'domicilio'>('domicilio');
  const [mesa, setMesa] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [metodo, setMetodo] = useState('');
  const [entrega, setEntrega] = useState('');

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  /** Costo por unidad, o null si el producto no tiene un costo completo */
  const costoPorId = useMemo(() => {
    const mapa = new Map<number, number | null>();
    for (const c of costos) {
      const completo = c.costo_manual != null || (c.insumos_en_receta > 0 && c.insumos_sin_costo === 0);
      mapa.set(c.producto_id, completo ? Number(c.costo_total) : null);
    }
    return mapa;
  }, [costos]);

  const agregar = () => {
    const producto = productoPorId.get(Number(productoNuevo));
    if (!producto) return;
    setLineas((prev) => [
      ...prev,
      { clave: Date.now(), productoId: producto.id, cantidad: '1', precio: String(producto.precio), notas: '' },
    ]);
    setProductoNuevo('');
    setCreado(null);
  };

  const cambiar = (clave: number, cambios: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));

  const filas = lineas.map((l) => {
    const producto = productoPorId.get(l.productoId);
    const cantidad = Number(l.cantidad) || 0;
    const precio = Number(l.precio) || 0;
    const costo = costoPorId.get(l.productoId) ?? null;
    return {
      ...l,
      nombre: producto?.nombre ?? 'Producto',
      precioMenu: producto?.precio ?? 0,
      cantidadNum: cantidad,
      precioNum: precio,
      costo,
      venta: precio * cantidad,
      utilidad: costo == null ? null : (precio - costo) * cantidad,
      margen: costo == null || precio <= 0 ? null : (precio - costo) / precio,
    };
  });

  const venta = filas.reduce((s, f) => s + f.venta, 0);
  const ventaMenu = filas.reduce((s, f) => s + f.precioMenu * f.cantidadNum, 0);
  const costoTotal = filas.reduce((s, f) => s + (f.costo ?? 0) * f.cantidadNum, 0);
  const sinCosto = filas.filter((f) => f.costo == null);
  const utilidad = venta - costoTotal;
  const margen = venta > 0 ? utilidad / venta : null;
  const bajoCosto = filas.filter((f) => f.costo != null && f.precioNum > 0 && f.precioNum < f.costo);

  const crear = () => {
    if (filas.some((f) => !Number.isInteger(f.cantidadNum) || f.cantidadNum <= 0)) {
      toast.error('Revisa las cantidades: deben ser números enteros mayores a cero.');
      return;
    }
    if (filas.some((f) => !Number.isInteger(f.precioNum) || f.precioNum <= 0)) {
      toast.error('Revisa los precios: cada producto necesita un precio en pesos, sin decimales.');
      return;
    }
    if (!nombre.trim()) {
      toast.error('Escribe para quién es el evento.');
      return;
    }
    if (tipo === 'mesa' && !(Number(mesa) > 0)) {
      toast.error('Escribe el número de la mesa.');
      return;
    }
    const aviso = bajoCosto.length > 0 ? `\n\nOjo: ${bajoCosto.map((f) => f.nombre).join(', ')} queda por debajo del costo.` : '';
    if (!window.confirm(`¿Crear el pedido de ${nombre.trim()} por ${formatoCOP.format(venta)}?\n\nPasa a cocina de una vez.${aviso}`)) {
      return;
    }

    startTransition(async () => {
      const res = await crearPedidoEvento(
        {
          tipo,
          numeroMesa: tipo === 'mesa' ? Number(mesa) : null,
          clienteNombre: nombre,
          clienteTelefono: telefono,
          clienteDireccion: direccion,
          metodoPago: (metodo || null) as MetodoPago,
          entrega: entrega || undefined,
        },
        filas.map((f) => ({ productoId: f.productoId, cantidad: f.cantidadNum, precio: f.precioNum, notas: f.notas }))
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCreado({ id: res.pedidoId, total: res.total });
      setLineas([]);
      toast.success(`Pedido #${res.pedidoId} creado y enviado a cocina.`);
    });
  };

  return (
    <div className={tabla.contenedor}>
      {creado && (
        <div className={styles.creado} role="status">
          <strong>Pedido #{creado.id} creado por {formatoCOP.format(creado.total)}.</strong> Ya está en cocina y se
          cobra desde Liquidación como cualquier otro.
        </div>
      )}

      <div className={tabla.bloque}>
        <h3 className={tabla.bloqueTitulo}>Qué lleva y a cómo</h3>
        <div className={tabla.fila}>
          <label className={tabla.campo}>
            <span className={tabla.etiqueta}>Producto</span>
            <select
              className={tabla.select}
              value={productoNuevo}
              onChange={(e) => setProductoNuevo(e.target.value)}
              disabled={cargando}
            >
              <option value="">Elige un producto del menú…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({formatoCOP.format(p.precio)})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={tabla.btn} onClick={agregar} disabled={cargando || !productoNuevo}>
            <IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            Agregar al evento
          </button>
        </div>

        {filas.length === 0 ? (
          <p className={tabla.vacio}>
            Agrega los productos del pedido. Cada uno arranca con el precio del menú y tú lo bajas hasta donde
            te sirva.
          </p>
        ) : (
          <>
            <p className={tabla.scrollHint}>Desliza la tabla hacia los lados para ver todo</p>
            <div className={tabla.tablaWrapper}>
              <table className={tabla.tabla}>
                <thead>
                  <tr>
                    <th className={tabla.th}>Producto</th>
                    <th className={tabla.th}>Cantidad</th>
                    <th className={tabla.th}>Precio por unidad</th>
                    <th className={tabla.th}>Te cuesta</th>
                    <th className={tabla.th}>Te queda</th>
                    <th className={tabla.th}>Margen</th>
                    <th className={tabla.th}><span className={styles.soloLectores}>Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.clave} className={tabla.tr}>
                      <td className={`${tabla.td} ${tabla.nombre}`}>
                        {f.nombre}
                        <span className={tabla.enlace}>En el menú: {formatoCOP.format(f.precioMenu)}</span>
                        <input
                          className={`${tabla.input} ${styles.notas}`}
                          placeholder="Observación para cocina (opcional)"
                          value={f.notas}
                          onChange={(e) => cambiar(f.clave, { notas: e.target.value })}
                          maxLength={200}
                          disabled={cargando}
                          aria-label={`Observación para ${f.nombre}`}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          className={`${tabla.input} ${styles.numero}`}
                          value={f.cantidad}
                          onChange={(e) => cambiar(f.clave, { cantidad: e.target.value })}
                          disabled={cargando}
                          aria-label={`Cantidad de ${f.nombre}`}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          className={`${tabla.input} ${styles.numero}`}
                          value={f.precio}
                          onChange={(e) => cambiar(f.clave, { precio: e.target.value })}
                          disabled={cargando}
                          aria-label={`Precio por unidad de ${f.nombre}`}
                        />
                      </td>
                      <td className={`${tabla.td} ${tabla.costo}`}>
                        {f.costo == null ? <span className={tabla.sinCosto}>sin costo</span> : formatoCOP.format(f.costo)}
                      </td>
                      <td className={`${tabla.td} ${tabla.costo}`}>
                        {f.utilidad == null ? '—' : formatoCOP.format(f.utilidad)}
                      </td>
                      <td className={tabla.td}>
                        {f.margen == null ? (
                          <span className={tabla.sinCosto}>—</span>
                        ) : (
                          <span className={f.margen >= 0 ? tabla.margenPositivo : tabla.margenNegativo}>
                            {(f.margen * 100).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className={tabla.td}>
                        <button
                          type="button"
                          className={tabla.iconBtn}
                          onClick={() => setLineas((prev) => prev.filter((l) => l.clave !== f.clave))}
                          disabled={cargando}
                          aria-label={`Quitar ${f.nombre}`}
                        >
                          <IconTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.totales}>
              <div className={styles.queda}>
                <span className={tabla.resumenEtiqueta}>Te queda</span>
                <span className={utilidad >= 0 ? styles.quedaValor : styles.quedaNegativo}>{formatoCOP.format(utilidad)}</span>
                <span className={tabla.ayuda}>
                  {margen == null ? 'Escribe los precios para ver el margen.' : `Margen de ${(margen * 100).toFixed(1)}% sobre la venta`}
                </span>
              </div>
              <div className={tabla.resumenItem}>
                <span className={tabla.resumenEtiqueta}>Le cobras</span>
                <span className={tabla.resumenValor}>{formatoCOP.format(venta)}</span>
                {ventaMenu !== venta && (
                  <span className={tabla.ayuda}>
                    Al precio del menú serían {formatoCOP.format(ventaMenu)}
                    {ventaMenu > venta ? `: le rebajas ${formatoCOP.format(ventaMenu - venta)}` : ''}
                  </span>
                )}
              </div>
              <div className={tabla.resumenItem}>
                <span className={tabla.resumenEtiqueta}>Te cuesta</span>
                <span className={tabla.resumenValor}>{formatoCOP.format(costoTotal)}</span>
                <span className={tabla.ayuda}>Con el pago auxiliares de cada producto</span>
              </div>
            </div>

            {bajoCosto.length > 0 && (
              <p className={styles.alerta} role="alert">
                {bajoCosto.map((f) => f.nombre).join(', ')}: el precio está por debajo de lo que te cuesta.
              </p>
            )}
            {sinCosto.length > 0 && (
              <p className={styles.alerta}>
                {sinCosto.map((f) => f.nombre).join(', ')}: no tiene costo completo en Recetas y Costeo, así que
                lo que te queda está contado de más.
              </p>
            )}
          </>
        )}
      </div>

      {filas.length > 0 && (
        <div className={tabla.bloque}>
          <h3 className={tabla.bloqueTitulo}>Para quién y cuándo</h3>
          <div className={tabla.modos} role="radiogroup" aria-label="Dónde se entrega">
            <label className={tabla.modo}>
              <input type="radio" checked={tipo === 'domicilio'} onChange={() => setTipo('domicilio')} disabled={cargando} />
              Se lleva o se envía
            </label>
            <label className={tabla.modo}>
              <input type="radio" checked={tipo === 'mesa'} onChange={() => setTipo('mesa')} disabled={cargando} />
              Se sirve en el local
            </label>
          </div>
          <div className={tabla.fila}>
            <label className={tabla.campo}>
              <span className={tabla.etiqueta}>Cliente</span>
              <input className={tabla.input} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} disabled={cargando} />
            </label>
            {tipo === 'mesa' ? (
              <label className={tabla.campo} style={{ maxWidth: '160px' }}>
                <span className={tabla.etiqueta}>Mesa</span>
                <input type="number" inputMode="numeric" min={1} className={tabla.input} value={mesa} onChange={(e) => setMesa(e.target.value)} disabled={cargando} />
              </label>
            ) : (
              <>
                <label className={tabla.campo}>
                  <span className={tabla.etiqueta}>Teléfono (opcional)</span>
                  <input type="tel" className={tabla.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} disabled={cargando} />
                </label>
                <label className={tabla.campo}>
                  <span className={tabla.etiqueta}>Dirección (opcional)</span>
                  <input className={tabla.input} value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={300} disabled={cargando} />
                </label>
              </>
            )}
          </div>
          <div className={tabla.fila}>
            <label className={tabla.campo} style={{ maxWidth: '280px' }}>
              <span className={tabla.etiqueta}>Entrega (vacío si es para ya)</span>
              <input type="datetime-local" className={tabla.input} value={entrega} onChange={(e) => setEntrega(e.target.value)} disabled={cargando} />
            </label>
            {tipo === 'domicilio' && (
              <label className={tabla.campo} style={{ maxWidth: '280px' }}>
                <span className={tabla.etiqueta}>Cómo paga (opcional)</span>
                <select className={tabla.select} value={metodo} onChange={(e) => setMetodo(e.target.value)} disabled={cargando}>
                  <option value="">Se define al cobrar</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="bancolombia">Bancolombia</option>
                  <option value="datafono">Datáfono (suma el 5 %)</option>
                </select>
              </label>
            )}
          </div>
          <button type="button" className={tabla.btn} onClick={crear} disabled={cargando}>
            {cargando ? 'Creando…' : `Crear pedido por ${formatoCOP.format(venta)}`}
          </button>
        </div>
      )}
    </div>
  );
};
