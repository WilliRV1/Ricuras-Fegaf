'use client';

/**
 * OrderContainer — Componente orquestador de la vista de pedidos.
 *
 * Responsabilidades:
 * 1. Integra el selector de tipo de atención (Mesa/Domicilio) con el menú digital.
 * 2. Bloquea el menú hasta que el usuario seleccione un tipo de atención.
 * 3. Muestra feedback visual (toast) al agregar un producto.
 * 4. Filtra productos por categoría seleccionada.
 * 5. Valida el formulario según el tipo de atención elegido.
 * 6. Detecta productos duplicados y muestra modal de selección.
 *
 * Se comunica con componentes hijos vía props y expone el estado del pedido
 * para que en el Día 3 se conecte con el hook `useCart`.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Categoria, Producto, OrderType, OrderDetails, MetodoPago } from '@/types';
import { CategoryTabs } from './CategoryTabs';
import { MenuGrid } from './MenuGrid';
import { OrderTypeSelector } from './OrderTypeSelector';
import { DeliveryForm } from './DeliveryForm';
import { DuplicateProductModal } from './DuplicateProductModal';
import { TIPOS_ATENCION } from '@/lib/constants';
import { toast } from '@/components/ui/Toast';
import styles from './OrderContainer.module.css';

interface OrderContainerProps {
  initialCategorias: Categoria[];
  initialProductos: Producto[];
}

import { useCart, cartStore } from '@/hooks/useCart';
import { submitOrder } from '@/app/actions/pedidos';
import { Cart } from './Cart';

export const OrderContainer: React.FC<OrderContainerProps> = ({
  initialCategorias,
  initialProductos,
}) => {
  const { items, addItem } = useCart();
  const cartItemCount = items.reduce((acc, item) => acc + item.cantidad, 0);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  /* ----------------------------------------------------------------
     Estado del menú
     ---------------------------------------------------------------- */
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /* ----------------------------------------------------------------
     Estado del pedido
     ---------------------------------------------------------------- */
  const [orderType, setOrderType] = useState<OrderType>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderDetails, string>>>({});

  /* ----------------------------------------------------------------
     Estado del modal de producto duplicado
     ---------------------------------------------------------------- */
  const [pendingProduct, setPendingProduct] = useState<Producto | null>(null);

  /* ----------------------------------------------------------------
     Productos filtrados por categoría
     ---------------------------------------------------------------- */
  const filteredProducts = useMemo(() => {
    let result = initialProductos;

    // Filtrar por categoría
    if (selectedCategory !== null) {
      result = result.filter((p) => Number(p.categoria_id) === Number(selectedCategory));
    }

    // Filtrar por búsqueda de texto
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.nombre.toLowerCase().includes(q));
    }

    return result;
  }, [initialProductos, selectedCategory, searchQuery]);

  /* ----------------------------------------------------------------
     Handlers
     ---------------------------------------------------------------- */

  /**
   * Agrega un producto al carrito.
   * Si el producto ya existe en el carrito (sin importar notas), muestra un
   * modal para preguntar si se suma al existente o se agrega como nuevo ítem.
   */
  const handleAddProduct = useCallback((producto: Producto) => {
    if (!orderType) return;

    // Verificar si ya existe en el carrito (por ID, sin importar notas)
    const yaExiste = items.some((item) => item.producto.id === producto.id);

    if (yaExiste) {
      // Mostrar modal de elección
      setPendingProduct(producto);
      return;
    }

    // No existe — agregar directo
    addItem(producto, 1);
    toast.success(
      <>
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          {producto.nombre}
        </span>{' '}
        agregado al pedido
      </>
    );
  }, [orderType, addItem, items]);

  /** Resolver modal: sumar uno al item existente (mismas notas = undefined) */
  const handleModalAddToExisting = useCallback(() => {
    if (!pendingProduct) return;
    // Sumar al primer item que coincida con el id (el que ya tiene las notas que tenía)
    const existing = items.find((i) => i.producto.id === pendingProduct.id);
    addItem(pendingProduct, 1, existing?.notas);
    toast.success(
      <>
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          {pendingProduct.nombre}
        </span>{' '}
        (+1 al existente)
      </>
    );
    setPendingProduct(null);
  }, [pendingProduct, items, addItem]);

  /** Resolver modal: agregar como ítem independiente con notas vacías */
  const handleModalAddNew = useCallback(() => {
    if (!pendingProduct) return;
    // Usar un placeholder de notas único para diferenciarlo — el usuario puede editarlo
    addItem(pendingProduct, 1, '');
    toast.success(
      <>
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          {pendingProduct.nombre}
        </span>{' '}
        agregado como ítem separado
      </>
    );
    setPendingProduct(null);
  }, [pendingProduct, addItem]);

  /**
   * Cambia el tipo de atención y resetea el formulario de datos.
   */
  const handleTypeSelect = useCallback((type: OrderType) => {
    setOrderType(type);
    setOrderDetails({});
    setFormErrors({});
  }, []);

  /**
   * isFormValid: true si se seleccionó un tipo de atención y,
   * dependiendo del tipo, se completaron los datos requeridos.
   * Teléfono es OPCIONAL para domicilio.
   */
  const isFormValid = (() => {
    if (!orderType) return false;
    if (orderType === TIPOS_ATENCION.MESA) return !!orderDetails.numero_mesa;
    return !!(
      orderDetails.cliente_nombre &&
      orderDetails.cliente_direccion
    );
  })();

  /**
   * Envía el pedido completo a Supabase.
   */
  const handleEnviarCocina = async (metodoPago: MetodoPago) => {
    if (!orderType || !isFormValid) {
      toast.error('Completa los datos obligatorios del pedido.');
      return;
    }

    const { items } = cartStore.getSnapshot();
    if (items.length === 0) {
      toast.error('El carrito está vacío.');
      return;
    }

    const res = await submitOrder(orderType, orderDetails, items, metodoPago);

    if (!res.success) {
      throw new Error(res.error || 'Error desconocido al enviar pedido');
    }

    // Limpiar el formulario para un nuevo pedido
    setOrderType(null);
    setOrderDetails({});
    setFormErrors({});
  };

  /* ----------------------------------------------------------------
     Indicadores de paso
     ---------------------------------------------------------------- */
  const isStep1Complete = orderType !== null;
  const isStep2Complete = isFormValid;

  return (
    <div className={styles.container}>

      <div className={styles.mainColumn}>
        {/* ============================================================
            PASO 1 — Tipo de Atención + Datos del Cliente
            ============================================================ */}
        <section className={styles.orderSetupSection}>
          {/* Indicador de paso 1 */}
          <div className={styles.stepIndicator}>
            <span className={`${styles.stepBadge} ${isStep1Complete ? styles.completed : ''}`}>
              {isStep1Complete ? '✓' : '1'}
            </span>
            <span className={styles.stepLabel}>
              Tipo de Atención
              {orderType && (
                <span className={styles.stepLabelMuted}>
                  {' — '}
                  {orderType === TIPOS_ATENCION.MESA ? '🍽️ Mesa' : '🛵 Domicilio'}
                </span>
              )}
            </span>
          </div>

          <OrderTypeSelector selectedType={orderType} onSelectType={handleTypeSelect} />

          {/* Indicador de paso 2 (visible cuando ya se seleccionó tipo) */}
          {orderType && (
            <>
              <div className={styles.stepIndicator}>
                <span className={`${styles.stepBadge} ${isStep2Complete ? styles.completed : ''}`}>
                  {isStep2Complete ? '✓' : '2'}
                </span>
                <span className={styles.stepLabel}>
                  {orderType === TIPOS_ATENCION.MESA ? 'Número de Mesa' : 'Datos del Cliente'}
                </span>
              </div>

              <DeliveryForm
                orderType={orderType}
                details={orderDetails}
                onChange={setOrderDetails}
                errors={formErrors}
              />
            </>
          )}
        </section>

        {/* ============================================================
            PASO 3 — Menú Digital (bloqueado si no se seleccionó tipo)
            ============================================================ */}
        <section className={styles.menuSection}>
          {/* Header del menú */}
          <div className={styles.menuHeader}>
            <div className={styles.stepIndicator}>
              <span className={styles.stepBadge}>3</span>
              <h2 className={styles.menuTitle}>
                <span className={styles.menuTitleIcon}>📋</span>
                Menú Digital
              </h2>
            </div>
            <span className={styles.productCount}>
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Barra de Búsqueda */}
          <div className={styles.searchContainer}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar plato, bebida..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Pestañas de categoría siempre visibles */}
          <CategoryTabs
            categorias={initialCategorias}
            selectedCategoryId={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Grid de productos — con overlay de bloqueo si no hay tipo seleccionado */}
          {!orderType ? (
            <div
              className={styles.menuLocked}
              onClick={() => toast.error('Debes elegir un tipo de atención (Mesa o Domicilio) para poder escoger productos.')}
            >
              <MenuGrid
                productos={filteredProducts}
                onAddProduct={handleAddProduct}
              />
              <div className={styles.lockOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <span className={styles.lockText}>Selecciona un tipo de atención primero</span>
                <span className={styles.lockSubtext}>Elige &quot;Mesa&quot; o &quot;Domicilio&quot; para comenzar</span>
              </div>
            </div>
          ) : (
            <MenuGrid
              productos={filteredProducts}
              onAddProduct={handleAddProduct}
            />
          )}
        </section>
      </div>

      {/* Cart Column (Desktop) / Drawer (Mobile) */}
      <div className={`${styles.cartColumn} ${isMobileCartOpen ? styles.cartOpen : ''}`}>
        <div className={styles.mobileCartHeader}>
          <h2>Tu Carrito</h2>
          <button className={styles.closeCartBtn} onClick={() => setIsMobileCartOpen(false)}>×</button>
        </div>
        <Cart orderType={orderType} isValidOrder={isFormValid} onEnviarCocina={async (pago) => {
          await handleEnviarCocina(pago);
          setIsMobileCartOpen(false);
        }} />
      </div>

      {/* Mobile FAB to open Cart */}
      {cartItemCount > 0 && (
        <button
          className={`${styles.cartFab} ${isMobileCartOpen ? styles.hidden : ''}`}
          onClick={() => setIsMobileCartOpen(true)}
        >
          <span className={styles.fabIcon}>🛒</span>
          <span className={styles.fabText}>Ver Pedido</span>
          <span className={styles.fabBadge}>{cartItemCount}</span>
        </button>
      )}

      {/* Overlay background when cart is open */}
      {isMobileCartOpen && (
        <div className={styles.cartOverlay} onClick={() => setIsMobileCartOpen(false)} />
      )}

      {/* Modal para producto duplicado */}
      {pendingProduct && (
        <DuplicateProductModal
          producto={pendingProduct}
          onAddToExisting={handleModalAddToExisting}
          onAddNew={handleModalAddNew}
          onCancel={() => setPendingProduct(null)}
        />
      )}
    </div>
  );
}
