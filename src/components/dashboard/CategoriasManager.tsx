'use client';

import React, { useState, useTransition } from 'react';
import { Categoria } from '@/types';
import { crearCategoria, actualizarCategoria, eliminarCategoria } from '@/app/actions/productos';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconPencil, IconTrash } from '@/components/ui/Icons';
import styles from './StockManager.module.css';

interface CategoriasManagerProps {
  categorias: Categoria[];
  onCategoriasChange: (categorias: Categoria[]) => void;
}

/**
 * Gestión de categorías del menú, anidada dentro de "Gestión del Menú" —
 * vive en el mismo bloque colapsable de StockManager porque las categorías
 * solo tienen sentido en función de los productos que las usan.
 */
export const CategoriasManager: React.FC<CategoriasManagerProps> = ({ categorias, onCategoriasChange }) => {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');

  const guardarNueva = () => {
    if (!nombreNueva.trim()) {
      toast.error('Escribe el nombre de la categoría.');
      return;
    }
    startTransition(async () => {
      const res = await crearCategoria(nombreNueva.trim(), null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Categoría "${nombreNueva.trim()}" creada.`);
      onCategoriasChange(
        [...categorias, { id: res.categoriaId, nombre: nombreNueva.trim(), orden: categorias.length + 1, created_at: new Date().toISOString() }].sort(
          (a, b) => a.orden - b.orden
        )
      );
      setNombreNueva('');
      setCreando(false);
    });
  };

  const empezarEdicion = (categoria: Categoria) => {
    setEditandoId(categoria.id);
    setNombreEdicion(categoria.nombre);
  };

  const guardarEdicion = (categoria: Categoria) => {
    if (!nombreEdicion.trim()) {
      toast.error('Escribe el nombre de la categoría.');
      return;
    }
    startTransition(async () => {
      const res = await actualizarCategoria(categoria.id, nombreEdicion.trim(), null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success('Categoría actualizada.');
      onCategoriasChange(
        categorias.map((c) => (c.id === categoria.id ? { ...c, nombre: nombreEdicion.trim() } : c))
      );
      setEditandoId(null);
    });
  };

  const borrar = (categoria: Categoria) => {
    const confirmado = window.confirm(
      `¿Borrar la categoría "${categoria.nombre}"?\n\nLos productos que la tenían quedan sin categoría — no se borran ni se bloquean.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const res = await eliminarCategoria(categoria.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Categoría "${categoria.nombre}" eliminada.`);
      onCategoriasChange(categorias.filter((c) => c.id !== categoria.id));
    });
  };

  return (
    <div className={styles.formulario} style={{ marginBottom: '4px' }}>
      <button
        type="button"
        className={styles.cancelarBtn}
        onClick={() => setAbierto((v) => !v)}
        style={{ alignSelf: 'flex-start' }}
      >
        {abierto ? 'Ocultar categorías ▾' : `Categorías (${categorias.length}) ▸`}
      </button>

      {abierto && (
        <>
          <div className={styles.formFila} style={{ flexWrap: 'wrap' }}>
            {categorias.map((categoria) =>
              editandoId === categoria.id ? (
                <div key={categoria.id} className={styles.fila} style={{ alignItems: 'center' }}>
                  <input
                    className={styles.formInput}
                    style={{ maxWidth: '160px' }}
                    value={nombreEdicion}
                    onChange={(e) => setNombreEdicion(e.target.value)}
                    maxLength={100}
                    disabled={isPending}
                    autoFocus
                  />
                  <button type="button" className={styles.nuevoBtn} onClick={() => guardarEdicion(categoria)} disabled={isPending}>
                    Guardar
                  </button>
                  <button type="button" className={styles.cancelarBtn} onClick={() => setEditandoId(null)} disabled={isPending}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <span
                  key={categoria.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background)',
                    fontSize: '0.875rem',
                  }}
                >
                  {categoria.nombre}
                  <button
                    type="button"
                    onClick={() => empezarEdicion(categoria)}
                    disabled={isPending}
                    aria-label={`Editar ${categoria.nombre}`}
                    style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  >
                    <IconPencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(categoria)}
                    disabled={isPending}
                    aria-label={`Borrar ${categoria.nombre}`}
                    style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                  >
                    <IconTrash size={13} />
                  </button>
                </span>
              )
            )}
          </div>

          {creando ? (
            <div className={styles.formFila}>
              <input
                className={styles.formInput}
                style={{ maxWidth: '200px' }}
                placeholder="Ej: Postres"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                maxLength={100}
                disabled={isPending}
                autoFocus
              />
              <button type="button" className={styles.nuevoBtn} onClick={guardarNueva} disabled={isPending}>
                {isPending ? 'Guardando…' : 'Crear'}
              </button>
              <button type="button" className={styles.cancelarBtn} onClick={() => setCreando(false)} disabled={isPending}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className={styles.cancelarBtn} onClick={() => setCreando(true)} disabled={isPending} style={{ alignSelf: 'flex-start' }}>
              <IconPlus size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
              Nueva categoría
            </button>
          )}
        </>
      )}
    </div>
  );
};
