import { useSyncExternalStore } from 'react';
import { Producto, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
}

let cartState: CartState = {
  items: [],
};

const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

export const cartStore = {
  addItem: (producto: Producto, cantidad: number = 1, notas?: string) => {
    const existingItemIndex = cartState.items.findIndex(
      (item) => item.producto.id === producto.id && item.notas === notas
    );

    if (existingItemIndex >= 0) {
      const newItems = [...cartState.items];
      newItems[existingItemIndex].cantidad += cantidad;
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
    
    // Al actualizar notas, es posible que el item se combine con otro item idéntico que ya tenía esas mismas notas.
    // Para simplificar y mantener un carrito predecible, los agrupamos si coinciden.
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
