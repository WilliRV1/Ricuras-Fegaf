'use client';

import React, { useState, useMemo } from 'react';
import { Categoria, Producto, OrderType, OrderDetails } from '@/types';
import { CategoryTabs } from './CategoryTabs';
import { MenuGrid } from './MenuGrid';
import { OrderTypeSelector } from './OrderTypeSelector';
import { DeliveryForm } from './DeliveryForm';
import { TIPOS_ATENCION } from '@/lib/constants';

interface OrderContainerProps {
  initialCategorias: Categoria[];
  initialProductos: Producto[];
}

export const OrderContainer: React.FC<OrderContainerProps> = ({
  initialCategorias,
  initialProductos,
}) => {
  // Estado del menú
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Estado del pedido
  const [orderType, setOrderType] = useState<OrderType>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderDetails, string>>>({});

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return initialProductos;
    return initialProductos.filter((p) => p.categoria_id === selectedCategory);
  }, [initialProductos, selectedCategory]);

  const handleAddProduct = (producto: Producto) => {
    // Aquí implementaremos la lógica del carrito en el Día 3
    console.log('Agregando al carrito:', producto);
    alert(`Agregado: ${producto.nombre}`);
  };

  const handleTypeSelect = (type: OrderType) => {
    setOrderType(type);
    setOrderDetails({});
    setFormErrors({});
  };

  const validateForm = () => {
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
  };

  // Esta validación se conectará con el carrito en el Día 3
  const isFormValid = useMemo(() => {
    if (!orderType) return false;
    if (orderType === TIPOS_ATENCION.MESA) return !!orderDetails.numero_mesa;
    return !!(orderDetails.cliente_nombre && orderDetails.cliente_telefono && orderDetails.cliente_direccion);
  }, [orderType, orderDetails]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Sección del Formulario y Selector */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <OrderTypeSelector selectedType={orderType} onSelectType={handleTypeSelect} />
        <DeliveryForm 
          orderType={orderType}
          details={orderDetails}
          onChange={setOrderDetails}
          errors={formErrors}
        />
      </section>

      <hr style={{ borderColor: 'var(--color-border)', opacity: 0.5 }} />

      {/* Sección del Menú */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Menú Digital</h2>
          <CategoryTabs 
            categorias={initialCategorias}
            selectedCategoryId={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
        
        <MenuGrid 
          productos={filteredProducts}
          onAddProduct={handleAddProduct}
        />
      </section>

    </div>
  );
};
