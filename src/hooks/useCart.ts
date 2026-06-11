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

// ----------------------------------------------------------------
// Helpers de persistencia (solo en cliente)
// ----------------------------------------------------------------

/** Lee el estado guardado desde localStorage. Retorna null si no existe o hay error. */
function loadFromStorage(): CartState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartState;
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
  addItem: (producto: Producto, cantidad: number = 1, notas?: string) => {
    const existingItemIndex = cartState.items.findIndex(
      (item) => item.producto.id === producto.id && item.notas === notas
    );

    if (existingItemIndex >= 0) {
      const newItems = [...cartState.items];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        cantidad: newItems[existingItemIndex].cantidad + cantidad,
      };
      cartState = { items: newItems };
    } else {
      cartState = {
        items: [...cartState.items, { producto, cantidad, notas }],
      };
    }
    emitChange();
  },

  removeItem: (productoId: number, notas?: string) => {
    cartState = {
      items: cartState.items.filter(
        (item) => !(item.producto.id === productoId && item.notas === notas)
      ),
    };
    emitChange();
  },

  updateQuantity: (productoId: number, notas: string | undefined, delta: number) => {
    const newItems = cartState.items.map((item) => {
      if (item.producto.id === productoId && item.notas === notas) {
        return { ...item, cantidad: Math.max(1, item.cantidad + delta) };
      }
      return item;
    });
    cartState = { items: newItems };
    emitChange();
  },

  updateNotes: (productoId: number, oldNotas: string | undefined, newNotas: string) => {
    const newItems = cartState.items.map((item) => {
      if (item.producto.id === productoId && item.notas === oldNotas) {
        return { ...item, notas: newNotas };
      }
      return item;
    });

    // Si al cambiar notas coincide con otro ítem existente, los fusionamos.
    const mergedItems = newItems.reduce((acc, current) => {
      const existing = acc.find(
        (i) => i.producto.id === current.producto.id && i.notas === current.notas
      );
      if (existing) {
        existing.cantidad += current.cantidad;
      } else {
        acc.push({ ...current });
      }
      return acc;
    }, [] as CartItem[]);

    cartState = { items: mergedItems };
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
    removeItem: cartStore.removeItem,
    updateQuantity: cartStore.updateQuantity,
    updateNotes: cartStore.updateNotes,
    clearCart: cartStore.clearCart,
  };
};
