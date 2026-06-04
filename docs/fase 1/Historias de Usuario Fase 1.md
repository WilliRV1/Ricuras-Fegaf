# **Backlog de Producto: Fase 1 (MVP) \- Ricuras Fegaf**

Este documento contiene las Historias de Usuario (HU) atómicas para configurar el tablero de Trello/Scrum.

## **EPIC 1: Control de Accesos y Perfiles (Módulo 1\)**

**HU 1.1: Inicio de Sesión (Login)**

* **Descripción:** Como usuario del sistema, quiero poder ingresar mi usuario y contraseña para acceder a la plataforma.  
* **Criterios de Aceptación:**  
  * Debe existir un formulario con campos de Usuario y Contraseña.  
  * Si las credenciales son incorrectas, debe mostrar un mensaje de error.  
  * Si las credenciales son correctas, se genera la sesión (token).

**HU 1.2: Enrutamiento por Roles**

* **Descripción:** Como sistema, quiero identificar el rol del usuario logueado (Mesero, Cocinero o Administrador) para redirigirlo a su pantalla correspondiente.  
* **Criterios de Aceptación:**  
  * Si el rol es "Cocinero", al iniciar sesión debe ir directo a la pantalla del KDS (Cocina).  
  * Si el rol es "Mesero", debe ir directo a la toma de pedidos.  
  * Si el rol es "Administrador", debe ir al Dashboard.  
  * Un Mesero o Cocinero no puede acceder a las URL del Administrador.

## **EPIC 2: Toma de Pedidos (Módulo 2\)**

**HU 2.1: Visualización del Menú Digital**

* **Descripción:** Como mesero, quiero ver los productos divididos por categorías (Ej: Hamburguesas, Asados, Bebidas) para encontrar rápidamente lo que el cliente pide.  
* **Criterios de Aceptación:**  
  * Los productos deben mostrar su nombre y precio actual.  
  * Debe existir un filtro o pestañas por categorías.

**HU 2.2: Selección de Tipo de Atención (Mesa)**

* **Descripción:** Como mesero, quiero seleccionar la opción "Mesa" e ingresar el número de la mesa para saber a dónde llevar el pedido.  
* **Criterios de Aceptación:**  
  * Al seleccionar "Mesa", debe aparecer un campo numérico obligatorio para ingresar el N° de mesa.

**HU 2.3: Selección de Tipo de Atención (Domicilio)**

* **Descripción:** Como mesero/admin, quiero seleccionar la opción "Domicilio" y registrar los datos del cliente para el despacho.  
* **Criterios de Aceptación:**  
  * Al seleccionar "Domicilio", deben aparecer campos obligatorios: Nombre, Teléfono y Dirección.

**HU 2.4: Sistema de Reseñas/Modificaciones**

* **Descripción:** Como mesero, quiero poder escribir una nota específica en cada producto añadido (Ej: "Sin cebolla") para que la cocina no cometa errores.  
* **Criterios de Aceptación:**  
  * Cada ítem en el carrito debe tener un campo de texto u opción para agregar "Notas".  
  * Estas notas deben quedar guardadas dentro del objeto de ese producto específico en la base de datos.

**HU 2.5: Carrito y Envío de Comanda**

* **Descripción:** Como mesero, quiero ver el resumen del pedido (carrito), el total a pagar y un botón de "Enviar a Cocina" para oficializar la orden.  
* **Criterios de Aceptación:**  
  * El carrito debe sumar correctamente el subtotal de los productos.  
  * Al presionar "Enviar a Cocina", el estado del pedido pasa a "Pendiente" y la base de datos se actualiza.  
  * El carrito se vacía automáticamente tras el envío exitoso.

## **EPIC 3: Visualizador de Cocina \- KDS (Módulo 3\)**

**HU 3.1: Tablero de Comandas en Tiempo Real**

* **Descripción:** Como cocinero, quiero ver las comandas nuevas aparecer en mi pantalla automáticamente sin tener que recargar la página para empezar a prepararlas al instante.  
* **Criterios de Aceptación:**  
  * La interfaz debe estar optimizada para verse bien en horizontal (Tablet/Celular).  
  * Los pedidos nuevos deben aparecer mediante WebSockets/Suscripción en tiempo real (ej. Supabase realtime).

**HU 3.2: Resaltado Visual de Reseñas**

* **Descripción:** Como cocinero, quiero que las notas o modificaciones de los platos (reseñas) tengan un color o formato llamativo para no pasarlas por alto.  
* **Criterios de Aceptación:**  
  * Si un producto trae notas (Ej: Sin Salsas), el texto de esa nota debe aparecer en texto rojo o en negrita resaltada dentro de la tarjeta de la comanda.

**HU 3.3: Despacho de Pedidos**

* **Descripción:** Como cocinero, quiero tener un botón de "Pedido Listo" en cada comanda para quitarla de mi cola de trabajo una vez preparada.  
* **Criterios de Aceptación:**  
  * Al presionar el botón, el estado del pedido cambia de "Pendiente" a "Listo".  
  * La tarjeta del pedido desaparece de la vista principal del cocinero.

## **EPIC 4: Liquidación y Cierre (Módulo 4\)**

**HU 4.1: Selector de Método de Pago**

* **Descripción:** Como cajero/admin, quiero poder seleccionar si el cliente pagó en Efectivo, Nequi o Datáfono al momento de cerrar la mesa.  
* **Criterios de Aceptación:**  
  * Debe existir un selector (dropdown o botones) con las 3 opciones de pago al liquidar la orden.

**HU 4.2: Cálculo Automático de Recargo por Datáfono**

* **Descripción:** Como sistema, quiero sumar automáticamente un 5% al total de la cuenta si el método de pago elegido es Datáfono.  
* **Criterios de Aceptación:**  
  * Si seleccionan Efectivo o Nequi, el total se mantiene igual.  
  * Si seleccionan Datáfono, el total a cobrar debe recalcularse (Subtotal \* 1.05) y mostrar el valor del recargo en el recibo digital de cierre.

**HU 4.3: Cierre Histórico de Orden**

* **Descripción:** Como cajero, quiero confirmar el pago para que el pedido se marque como "Cerrado" y sus valores pasen a la contabilidad del día.  
* **Criterios de Aceptación:**  
  * Al cerrar, el estado de la orden cambia a "Pagado".  
  * Se registra la fecha y hora exacta del pago para los cortes diarios.

## **EPIC 5: Dashboard Básico de Ventas (Módulo 5\)**

**HU 5.1: Cuadre Diario (Ingresos Totales)**

* **Descripción:** Como administrador, quiero ver en mi pantalla de inicio la suma total de dinero que ha ingresado en el día en curso para no tener que sumar facturas a mano.  
* **Criterios de Aceptación:**  
  * Debe mostrar una tarjeta con el monto total (Sumatoria de todos los pedidos "Pagados" cuya fecha coincida con hoy).

**HU 5.2: Desglose por Medio de Pago**

* **Descripción:** Como administrador, quiero ver cuánto dinero hay en Efectivo, cuánto en Nequi y cuánto en Datáfono para cuadrar la caja física.  
* **Criterios de Aceptación:**  
  * Deben existir 3 indicadores separados mostrando el subtotal de ventas según el medio de pago registrado en la HU 4.1.

**HU 5.3: Conteo de Pedidos Despachados**

* **Descripción:** Como administrador, quiero ver cuántos pedidos se vendieron hoy para entender el volumen operativo.  
* **Criterios de Aceptación:**  
  * Un número que refleje la cantidad de documentos/órdenes en estado "Pagado" del día actual.