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
import { Categoria, Producto, OrderType, OrderDetails, MetodoPago, PedidoWithDetalles } from '@/types';
import { CategoryTabs } from './CategoryTabs';
import { MenuGrid } from './MenuGrid';
import { OrderTypeSelector } from './OrderTypeSelector';
import { DeliveryForm } from './DeliveryForm';
import { DuplicateProductModal } from './DuplicateProductModal';
import { PedidosEnCurso } from './PedidosEnCurso';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TIPOS_ATENCION } from '@/lib/constants';
import { toast } from '@/components/ui/Toast';
import styles from './OrderContainer.module.css';

interface OrderContainerProps {
  initialCategorias: Categoria[];
  initialProductos: Producto[];
}

import { useCart, cartStore } from '@/hooks/useCart';
import { submitOrder, updateOrder } from '@/app/actions/pedidos';
import { Cart } from './Cart';

export const OrderContainer: React.FC<OrderContainerProps> = ({
  initialCategorias,
  initialProductos,
}) => {
  const { items, addItem, addToLine } = useCart();
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
     Edición de un pedido que sigue pendiente en cocina
     ---------------------------------------------------------------- */
  const [editingOrder, setEditingOrder] = useState<PedidoWithDetalles | null>(null);
  /** Pedido que se quiere editar pero el carrito tiene cosas sin enviar */
  const [pedidoAConfirmar, setPedidoAConfirmar] = useState<PedidoWithDetalles | null>(null);

  /** Carga un pedido existente en el carrito y el formulario */
  const cargarPedidoEnCarrito = useCallback((order: PedidoWithDetalles) => {
    cartStore.clearCart();

    // Cada detalle es una línea independiente, con sus propias observaciones.
    // Se conserva el precio con el que se tomó el pedido para no alterar el
    // total si el precio del producto cambió después.
    (order.detalle_pedidos ?? []).forEach((detalle) => {
      const producto = initialProductos.find((p) => p.id === detalle.producto_id);
      const productoLinea: Producto = producto
        ? { ...producto, precio: detalle.precio_unitario }
        : ({
            id: detalle.producto_id,
            nombre: detalle.productos?.nombre ?? 'Producto',
            precio: detalle.precio_unitario,
            categoria_id: null,
            activo: false,
            es_adicion: false,
            created_at: new Date().toISOString(),
          } as Producto);

      cartStore.addItem(productoLinea, detalle.cantidad, detalle.notas ?? undefined);
    });

    // Hora de entrega guardada como timestamp → 'HH:MM' en hora de Colombia
    const horaEntrega = order.hora_entrega
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Bogota',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(order.hora_entrega))
      : '';

    setOrderType(order.tipo as OrderType);
    setOrderDetails({
      numero_mesa: order.numero_mesa != null ? String(order.numero_mesa) : '',
      cliente_nombre: order.cliente_nombre ?? '',
      cliente_telefono: order.cliente_telefono ?? '',
      cliente_direccion: order.cliente_direccion ?? '',
      hora_entrega: horaEntrega,
      costo_domicilio: order.costo_domicilio || undefined,
    });
    setFormErrors({});
    setEditingOrder(order);
    setPedidoAConfirmar(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Editando el pedido #${order.id}`);
  }, [initialProductos]);

  /** Entra a modo edición, avisando si se va a perder un carrito a medias */
  const handleEditarPedido = useCallback((order: PedidoWithDetalles) => {
    const hayCarritoSinEnviar = cartStore.getSnapshot().items.length > 0 && !editingOrder;
    if (hayCarritoSinEnviar) {
      setPedidoAConfirmar(order);
      return;
    }
    cargarPedidoEnCarrito(order);
  }, [editingOrder, cargarPedidoEnCarrito]);

  /** Sale de modo edición sin guardar: el pedido en cocina queda como estaba */
  const salirDeEdicion = useCallback(() => {
    cartStore.clearCart();
    setEditingOrder(null);
    setOrderType(null);
    setOrderDetails({});
    setFormErrors({});
  }, []);

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

  /** Resolver modal: sumar uno a la última línea existente de ese producto */
  const handleModalAddToExisting = useCallback(() => {
    if (!pendingProduct) return;
    // Se suma a la última línea agregada de ese producto (la que se está armando)
    const existing = [...items].reverse().find((i) => i.producto.id === pendingProduct.id);
    if (!existing) return;
    addToLine(existing.lineId, 1);
    toast.success(
      <>
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          {pendingProduct.nombre}
        </span>{' '}
        (+1 al existente)
      </>
    );
    setPendingProduct(null);
  }, [pendingProduct, items, addToLine]);

  /** Resolver modal: agregar como línea independiente, con sus propias observaciones */
  const handleModalAddNew = useCallback(() => {
    if (!pendingProduct) return;
    addItem(pendingProduct, 1);
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
  /** Cobro de domicilio, definido por quien toma el pedido (0 si no aplica) */
  const costoDomicilio =
    orderType === TIPOS_ATENCION.DOMICILIO ? (orderDetails.costo_domicilio ?? 0) : 0;

  const isFormValid = (() => {
    if (!orderType) return false;
    if (orderType === TIPOS_ATENCION.MESA) return !!orderDetails.numero_mesa;
    return !!(
      orderDetails.cliente_direccion
    );
  })();

  /**
   * Envía el pedido completo a Supabase.
   */
  const handleEnviarCocina = async (metodoPago: MetodoPago, pagaCon: number | null) => {
    if (!orderType || !isFormValid) {
      toast.error('Completa los datos obligatorios del pedido.');
      return;
    }

    const { items } = cartStore.getSnapshot();
    if (items.length === 0) {
      toast.error('El carrito está vacío.');
      return;
    }

    const res = editingOrder
      ? await updateOrder(editingOrder.id, orderType, orderDetails, items, metodoPago, pagaCon)
      : await submitOrder(orderType, orderDetails, items, metodoPago, pagaCon);

    if (!res.success) {
      throw new Error(res.error || 'Error desconocido al enviar pedido');
    }

    // Limpiar el formulario para un nuevo pedido
    setEditingOrder(null);
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
        {/* Pedidos que aún están en cocina — se pueden modificar */}
        <PedidosEnCurso editingId={editingOrder?.id ?? null} onEditar={handleEditarPedido} />

        {/* Aviso de modo edición */}
        {editingOrder && (
          <div className={styles.editingBanner}>
            <div className={styles.editingText}>
              <strong>✏️ Estás modificando el pedido #{editingOrder.id}</strong>
              <span>
                Los cambios reemplazan el pedido en cocina y la comanda se marcará como
                modificada. Si cocina ya lo despachó, no se podrá guardar.
              </span>
            </div>
            <button type="button" className={styles.editingCancelBtn} onClick={salirDeEdicion}>
              Salir sin guardar
            </button>
          </div>
        )}

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
        <Cart
          orderType={orderType}
          isValidOrder={isFormValid}
          costoDomicilio={costoDomicilio}
          editingOrderId={editingOrder?.id ?? null}
          initialMetodoPago={(editingOrder?.metodo_pago as MetodoPago) ?? null}
          initialPagaCon={editingOrder?.paga_con ?? null}
          onEnviarCocina={async (pago, pagaCon) => {
            await handleEnviarCocina(pago, pagaCon);
            setIsMobileCartOpen(false);
          }}
        />
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

      {/* Confirmación: entrar a editar descarta el carrito a medias */}
      <ConfirmDialog
        isOpen={pedidoAConfirmar !== null}
        title="Tienes un pedido sin enviar"
        message={
          <>
            En el carrito hay productos que todavía no se han enviado a cocina. Si abres el
            pedido <strong>#{pedidoAConfirmar?.id}</strong> para modificarlo, esos productos se
            descartan.
          </>
        }
        confirmLabel="Descartar y modificar"
        cancelLabel="Volver"
        variant="danger"
        onConfirm={() => pedidoAConfirmar && cargarPedidoEnCarrito(pedidoAConfirmar)}
        onCancel={() => setPedidoAConfirmar(null)}
      />

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
