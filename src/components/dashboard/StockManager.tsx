'use client';

import React, { useState, useTransition } from 'react';
import { Categoria, Producto } from '@/types';
import {
  toggleProductStatus,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from '@/app/actions/productos';
import { toast } from '@/components/ui/Toast';
import { IconClipboard, IconPlus, IconPencil, IconTrash } from '@/components/ui/Icons';
import styles from './StockManager.module.css';

interface StockManagerProps {
  productos: Producto[];
  categorias: Categoria[];
}

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

interface FormularioProducto {
  nombre: string;
  precio: string;
  categoriaId: string;
  esAdicion: boolean;
}

const formularioVacio: FormularioProducto = { nombre: '', precio: '', categoriaId: '', esAdicion: false };

export const StockManager: React.FC<StockManagerProps> = ({ productos, categorias }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticProducts, setOptimisticProducts] = useState<Producto[]>(productos);
  const [isPending, startTransition] = useTransition();

  const [creando, setCreando] = useState(false);
  const [formNuevo, setFormNuevo] = useState<FormularioProducto>(formularioVacio);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormularioProducto>(formularioVacio);

  const handleToggle = (producto: Producto) => {
    const newStatus = !producto.activo;

    setOptimisticProducts((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo: newStatus } : p)));

    startTransition(async () => {
      const res = await toggleProductStatus(producto.id, newStatus);
      if (res.success) {
        toast.success(`${producto.nombre} marcado como ${newStatus ? 'Disponible' : 'Agotado'}`);
      } else {
        setOptimisticProducts(productos);
        toast.error(res.error || 'Error al actualizar estado');
      }
    });
  };

  const guardarNuevo = () => {
    if (!formNuevo.nombre.trim()) {
      toast.error('Escribe el nombre del producto.');
      return;
    }
    const precio = Number(formNuevo.precio);
    if (!precio || precio <= 0) {
      toast.error('El precio debe ser mayor a cero.');
      return;
    }

    startTransition(async () => {
      const res = await crearProducto(
        formNuevo.nombre.trim(),
        precio,
        formNuevo.categoriaId ? Number(formNuevo.categoriaId) : null,
        formNuevo.esAdicion
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${formNuevo.nombre.trim()} agregado al menú.`);
      setFormNuevo(formularioVacio);
      setCreando(false);
      window.location.reload(); // Recarga para traer el producto nuevo (viene del servidor)
    });
  };

  const empezarEdicion = (producto: Producto) => {
    setEditandoId(producto.id);
    setFormEdicion({
      nombre: producto.nombre,
      precio: String(producto.precio),
      categoriaId: producto.categoria_id != null ? String(producto.categoria_id) : '',
      esAdicion: false,
    });
  };

  const guardarEdicion = (producto: Producto) => {
    if (!formEdicion.nombre.trim()) {
      toast.error('Escribe el nombre del producto.');
      return;
    }
    const precio = Number(formEdicion.precio);
    if (!precio || precio <= 0) {
      toast.error('El precio debe ser mayor a cero.');
      return;
    }

    startTransition(async () => {
      const res = await actualizarProducto(
        producto.id,
        formEdicion.nombre.trim(),
        precio,
        formEdicion.categoriaId ? Number(formEdicion.categoriaId) : null
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${formEdicion.nombre.trim()} actualizado.`);
      setOptimisticProducts((prev) =>
        prev.map((p) =>
          p.id === producto.id
            ? { ...p, nombre: formEdicion.nombre.trim(), precio, categoria_id: formEdicion.categoriaId ? Number(formEdicion.categoriaId) : null }
            : p
        )
      );
      setEditandoId(null);
    });
  };

  const borrar = (producto: Producto) => {
    const confirmado = window.confirm(
      `¿Borrar "${producto.nombre}" del menú?\n\nSolo se puede borrar si nunca se vendió. Si ya tiene pedidos asociados, usa el interruptor para desactivarlo en su lugar.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const res = await eliminarProducto(producto.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${producto.nombre} eliminado del menú.`);
      setOptimisticProducts((prev) => prev.filter((p) => p.id !== producto.id));
    });
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.headerToggle}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.headerLeft}>
          <span className={styles.icon}><IconClipboard size={20} /></span>
          <h2 className={styles.title}>Gestión del Menú</h2>
        </div>
        <div className={styles.headerRight}>
          {!isOpen && (
            <span className={styles.preview}>
              {optimisticProducts.filter((p) => !p.activo).length} agotados
            </span>
          )}
          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div className={styles.content}>
          <p className={styles.description}>
            Crea, edita o desactiva productos del menú. Apagar un producto lo quita al instante de la
            toma de pedidos; borrarlo solo se puede si nunca se vendió.
          </p>

          <button
            type="button"
            className={styles.nuevoBtn}
            onClick={() => setCreando((v) => !v)}
            disabled={isPending}
          >
            {creando ? (
              'Cancelar'
            ) : (
              <>
                <IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
                Nuevo producto
              </>
            )}
          </button>

          {creando && (
            <div className={styles.formulario}>
              <div className={styles.formFila}>
                <label className={styles.formCampo}>
                  <span className={styles.formEtiqueta}>Nombre</span>
                  <input
                    className={styles.formInput}
                    placeholder="Ej: Hamburguesa Especial"
                    value={formNuevo.nombre}
                    onChange={(e) => setFormNuevo((f) => ({ ...f, nombre: e.target.value }))}
                    maxLength={200}
                    disabled={isPending}
                    autoFocus
                  />
                </label>
                <label className={styles.formCampo} style={{ maxWidth: '160px' }}>
                  <span className={styles.formEtiqueta}>Precio</span>
                  <input
                    type="number"
                    className={styles.formInput}
                    placeholder="Ej: 18000"
                    value={formNuevo.precio}
                    onChange={(e) => setFormNuevo((f) => ({ ...f, precio: e.target.value }))}
                    disabled={isPending}
                  />
                </label>
                <label className={styles.formCampo}>
                  <span className={styles.formEtiqueta}>Categoría</span>
                  <select
                    className={styles.formInput}
                    value={formNuevo.categoriaId}
                    onChange={(e) => setFormNuevo((f) => ({ ...f, categoriaId: e.target.value }))}
                    disabled={isPending}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className={styles.nuevoBtn} onClick={guardarNuevo} disabled={isPending}>
                {isPending ? 'Guardando…' : 'Crear producto'}
              </button>
            </div>
          )}

          <div className={styles.grid}>
            {optimisticProducts.map((producto) => (
              <div
                key={producto.id}
                className={`${styles.card} ${!producto.activo ? styles.cardInactive : ''}`}
              >
                {editandoId === producto.id ? (
                  <div className={styles.formulario} style={{ width: '100%' }}>
                    <div className={styles.formFila}>
                      <input
                        className={styles.formInput}
                        value={formEdicion.nombre}
                        onChange={(e) => setFormEdicion((f) => ({ ...f, nombre: e.target.value }))}
                        maxLength={200}
                        disabled={isPending}
                      />
                      <input
                        type="number"
                        className={styles.formInput}
                        style={{ maxWidth: '140px' }}
                        value={formEdicion.precio}
                        onChange={(e) => setFormEdicion((f) => ({ ...f, precio: e.target.value }))}
                        disabled={isPending}
                      />
                      <select
                        className={styles.formInput}
                        value={formEdicion.categoriaId}
                        onChange={(e) => setFormEdicion((f) => ({ ...f, categoriaId: e.target.value }))}
                        disabled={isPending}
                      >
                        <option value="">Sin categoría</option>
                        {categorias.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={styles.nuevoBtn}
                        onClick={() => guardarEdicion(producto)}
                        disabled={isPending}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className={styles.cancelarBtn}
                        onClick={() => setEditandoId(null)}
                        disabled={isPending}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.info}>
                      <span className={styles.name}>{producto.nombre}</span>
                      <span className={styles.price}>{formatoCOP.format(producto.precio)}</span>
                    </div>

                    <div className={styles.cardAcciones}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => empezarEdicion(producto)}
                        disabled={isPending}
                        aria-label={`Editar ${producto.nombre}`}
                      >
                        <IconPencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtnPeligro}
                        onClick={() => borrar(producto)}
                        disabled={isPending}
                        aria-label={`Borrar ${producto.nombre}`}
                      >
                        <IconTrash size={14} />
                      </button>
                      <button
                        className={`${styles.toggleBtn} ${producto.activo ? styles.toggleOn : styles.toggleOff}`}
                        onClick={() => handleToggle(producto)}
                        disabled={isPending}
                        aria-label={`Marcar ${producto.nombre} como ${producto.activo ? 'agotado' : 'disponible'}`}
                      >
                        <div className={styles.toggleKnob} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
