import { useSyncExternalStore } from 'react';
import { Producto, CartItem } from '@/types';

/**
 * Clave bajo la que se guarda el carrito en localStorage.
 * Prefijada con el nombre del proyecto para evitar colisiones.
 */
const STORAGE_KEY = 'ricuras_fegaf_cart';

interface CartState {
  items: CartItem[];
}

/**
 * Genera un id único para una línea del carrito.
 * Cada línea es independiente aunque repita el mismo producto, de forma que
 * las observaciones se pueden escribir por unidad y no quedan atadas a un "x2".
 */
let lineCounter = 0;
function nextLineId(): string {
  lineCounter += 1;
  return `${Date.now().toString(36)}-${lineCounter}`;
}

// ----------------------------------------------------------------
// Helpers de persistencia (solo en cliente)
// ----------------------------------------------------------------

/** Lee el estado guardado desde localStorage. Retorna null si no existe o hay error. */
function loadFromStorage(): CartState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartState;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    // Migración: los carritos guardados antes de esta versión no tienen lineId
    return {
      items: parsed.items.map((item) => ({
        ...item,
        lineId: item.lineId ?? nextLineId(),
      })),
    };
  } catch {
    return null;
  }
}

/** Escribe el estado actual en localStorage. */
function saveToStorage(state: CartState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silenciar errores de cuota o modo privado
  }
}

// ----------------------------------------------------------------
// Estado inicial: intentar restaurar desde localStorage
// ----------------------------------------------------------------
let cartState: CartState = loadFromStorage() ?? { items: [] };

const listeners = new Set<() => void>();

const emitChange = () => {
  saveToStorage(cartState); // Persiste en cada cambio
  listeners.forEach((listener) => listener());
};

// ----------------------------------------------------------------
// Store público
// ----------------------------------------------------------------
export const cartStore = {
  /**
   * Agrega el producto como una **línea nueva e independiente** del carrito.
   * Nunca fusiona con líneas existentes: eso lo decide quien llama
   * (ver `addToLine` para sumar una unidad a una línea concreta).
   */
  addItem: (producto: Producto, cantidad: number = 1, notas?: string) => {
    cartState = {
      items: [...cartState.items, { lineId: nextLineId(), producto, cantidad, notas }],
    };
    emitChange();
  },

  /** Suma unidades a una línea existente identificada por su lineId. */
  addToLine: (lineId: string, cantidad: number = 1) => {
    cartState = {
      items: cartState.items.map((item) =>
        item.lineId === lineId ? { ...item, cantidad: item.cantidad + cantidad } : item
      ),
    };
    emitChange();
  },

  removeItem: (lineId: string) => {
    cartState = {
      items: cartState.items.filter((item) => item.lineId !== lineId),
    };
    emitChange();
  },

  updateQuantity: (lineId: string, delta: number) => {
    cartState = {
      items: cartState.items.map((item) =>
        item.lineId === lineId
          ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
          : item
      ),
    };
    emitChange();
  },

  /**
   * Actualiza las observaciones de UNA línea.
   * No fusiona líneas: dos líneas del mismo producto siguen separadas aunque
   * terminen con la misma nota, porque en cocina se preparan por separado.
   */
  updateNotes: (lineId: string, newNotas: string) => {
    cartState = {
      items: cartState.items.map((item) =>
        item.lineId === lineId ? { ...item, notas: newNotas } : item
      ),
    };
    emitChange();
  },

  /**
   * Separa una línea con cantidad > 1 en líneas individuales de 1 unidad,
   * para poder escribir observaciones distintas en cada una.
   * Ej.: "2x Hamburguesa" → "1x Hamburguesa" + "1x Hamburguesa".
   */
  splitLine: (lineId: string) => {
    const index = cartState.items.findIndex((item) => item.lineId === lineId);
    if (index < 0) return;

    const target = cartState.items[index];
    if (target.cantidad <= 1) return;

    const individuales: CartItem[] = Array.from({ length: target.cantidad }, () => ({
      lineId: nextLineId(),
      producto: target.producto,
      cantidad: 1,
      notas: target.notas,
    }));

    cartState = {
      items: [
        ...cartState.items.slice(0, index),
        ...individuales,
        ...cartState.items.slice(index + 1),
      ],
    };
    emitChange();
  },

  clearCart: () => {
    cartState = { items: [] };
    emitChange();
  },

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot: () => cartState,
};

// Generamos un estado inicial vacío para la hidratación del servidor,
// evitando problemas de Server/Client mismatch si hubiera almacenamiento persistente después.
const emptyState: CartState = { items: [] };

export const useCart = () => {
  const state = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    () => emptyState // getSnapshot en SSR
  );

  const subtotal = state.items.reduce(
    (total, item) => total + item.producto.precio * item.cantidad,
    0
  );

  const totalItems = state.items.reduce((total, item) => total + item.cantidad, 0);

  return {
    items: state.items,
    subtotal,
    totalItems,
    addItem: cartStore.addItem,
    addToLine: cartStore.addToLine,
    removeItem: cartStore.removeItem,
    updateQuantity: cartStore.updateQuantity,
    updateNotes: cartStore.updateNotes,
    splitLine: cartStore.splitLine,
    clearCart: cartStore.clearCart,
  };
};
