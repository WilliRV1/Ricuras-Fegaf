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
 *
 * Se comunica con componentes hijos vía props y expone el estado del pedido
 * para que en el Día 3 se conecte con el hook `useCart`.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Categoria, Producto, OrderType, OrderDetails } from '@/types';
import { CategoryTabs } from './CategoryTabs';
import { MenuGrid } from './MenuGrid';
import { OrderTypeSelector } from './OrderTypeSelector';
import { DeliveryForm } from './DeliveryForm';
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
  const { addItem } = useCart();

  /* ----------------------------------------------------------------
     Estado del menú
     ---------------------------------------------------------------- */
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  /* ----------------------------------------------------------------
     Estado del pedido
     ---------------------------------------------------------------- */
  const [orderType, setOrderType] = useState<OrderType>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderDetails, string>>>({});

  /* ----------------------------------------------------------------
     Productos filtrados por categoría
     ---------------------------------------------------------------- */
  const filteredProducts = useMemo(() => {
    if (selectedCategory === null) return initialProductos;
    return initialProductos.filter((p) => Number(p.categoria_id) === Number(selectedCategory));
  }, [initialProductos, selectedCategory]);

  /* ----------------------------------------------------------------
     Handlers
     ---------------------------------------------------------------- */

  /**
   * Agrega un producto al carrito
   * Muestra un toast de éxito con el nombre del producto.
   */
  const handleAddProduct = useCallback((producto: Producto) => {
    if (!orderType) return;

    addItem(producto, 1);

    toast.success(
      <>
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          {producto.nombre}
        </span>{' '}
        agregado al pedido
      </>
    );
  }, [orderType, addItem]);

  /**
   * Cambia el tipo de atención y resetea el formulario de datos.
   */
  const handleTypeSelect = useCallback((type: OrderType) => {
    setOrderType(type);
    setOrderDetails({});
    setFormErrors({});
  }, []);



  /**
   * Envía el pedido completo a Supabase.
   */
  const handleEnviarCocina = async () => {
    if (!orderType || !isFormValid) {
      toast.error('Completa los datos obligatorios del pedido.');
      return;
    }

    const { items } = cartStore.getSnapshot();
    if (items.length === 0) {
      toast.error('El carrito está vacío.');
      return;
    }

    const res = await submitOrder(orderType, orderDetails, items);
    
    if (!res.success) {
      throw new Error(res.error || 'Error desconocido al enviar pedido');
    }
    
    // Limpiar el formulario para un nuevo pedido
    setOrderType(null);
    setOrderDetails({});
    setFormErrors({});
  };

  /**
   * Valida los campos requeridos según el tipo de atención.
   * Retorna `true` si el formulario es válido.
   */
  const validateForm = useCallback(() => {
    const errors: Partial<Record<keyof OrderDetails, string>> = {};
    if (orderType === TIPOS_ATENCION.MESA && !orderDetails.numero_mesa) {
      errors.numero_mesa = 'El número de mesa es requerido';
    }
    if (orderType === TIPOS_ATENCION.DOMICILIO) {
      if (!orderDetails.cliente_nombre) errors.cliente_nombre = 'El nombre es requerido';
      if (!orderDetails.cliente_telefono) errors.cliente_telefono = 'El teléfono es requerido';
      if (!orderDetails.cliente_direccion) errors.cliente_direccion = 'La dirección es requerida';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [orderType, orderDetails]);

  /**
   * Derivación: indica si el formulario está completo (para habilitación de botones).
   * Se usará en el Día 3 para habilitar el botón de "Enviar a Cocina".
   */
  const isFormValid = useMemo(() => {
    if (!orderType) return false;
    if (orderType === TIPOS_ATENCION.MESA) return !!orderDetails.numero_mesa;
    return !!(
      orderDetails.cliente_nombre &&
      orderDetails.cliente_telefono &&
      orderDetails.cliente_direccion
    );
  }, [orderType, orderDetails]);

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

      <div className={styles.cartColumn}>
        <Cart isValidOrder={isFormValid} onEnviarCocina={handleEnviarCocina} />
      </div>

    </div>
  );
}
