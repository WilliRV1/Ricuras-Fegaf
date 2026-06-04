# 📖 PROJECT.md — Ricuras Fegaf · Fase 1 (MVP)

> **Este archivo es la fuente de verdad del proyecto.**  
> Cualquier IA o desarrollador que ingrese al repositorio debe leer este archivo primero para entender la arquitectura, el alcance y las convenciones.

---

## 1. Información General

| Campo | Valor |
|-------|-------|
| **Proyecto** | Sistema de Gestión Operativa — Ricuras Fegaf |
| **Tipo** | Aplicación Web (PWA-ready) |
| **Fase** | 1 — MVP (Producto Mínimo Viable) |
| **Deadline** | 15 de Junio de 2026 (11 días desde el 4 de Junio) |
| **Cliente** | Ricuras Fegaf — Negocio de comidas rápidas (8 años de trayectoria) |
| **Contexto** | Restaurante con 42 productos y 10 adiciones. Opera con pedidos en mesa y domicilio. Actualmente todo se maneja en cuadernos físicos y Excel. |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Framework Frontend** | Next.js (App Router) | 14+ | SSR/SSG, routing basado en archivos, React Server Components |
| **Lenguaje** | TypeScript | 5+ | Tipado estático, menos errores en runtime |
| **Estilos** | Vanilla CSS (Custom Properties) | — | Máximo control, sin dependencias externas, design system propio |
| **BaaS / Backend** | Supabase | — | Auth, PostgreSQL, Realtime, Edge Functions — todo en uno |
| **Base de Datos** | PostgreSQL | 15+ (via Supabase) | SQL relacional, joins complejos, preparado para Fase 2 |
| **Tiempo Real** | Supabase Realtime | — | WebSockets nativos, suscripción a cambios en tablas |
| **Hosting Frontend** | Vercel | — | Deploy automático, CDN global, integración nativa con Next.js |
| **Hosting Backend** | Supabase Cloud | — | Free tier: 500MB DB, 50K MAU, Realtime ilimitado |

### 2.1. Dependencias Principales

```
next
react / react-dom
@supabase/supabase-js
@supabase/ssr
typescript
```

### 2.2. Sin Sistema de Roles

> **IMPORTANTE:** Este proyecto NO implementa autenticación ni roles de usuario.  
> No existe login, no hay diferenciación entre Mesero/Cocinero/Administrador.  
> Todas las vistas son accesibles por cualquier usuario que tenga el enlace.  
> La seguridad se basa en que el sistema solo se usa dentro de la red del restaurante.

---

## 3. Estructura del Proyecto

```
ricuras-fegaf/
├── public/
│   ├── favicon.ico
│   └── images/                    # Imágenes estáticas (logo, iconos)
│
├── src/
│   ├── app/                       # App Router de Next.js
│   │   ├── layout.tsx             # Layout raíz (fuentes, metadata, nav global)
│   │   ├── page.tsx               # Página de inicio (navegación a módulos)
│   │   ├── globals.css            # Variables CSS, reset, tokens del design system
│   │   │
│   │   ├── pedidos/               # EPIC 1: Toma de Pedidos
│   │   │   └── page.tsx           # Vista del menú + carrito + envío a cocina
│   │   │
│   │   ├── cocina/                # EPIC 2: KDS (Kitchen Display System)
│   │   │   └── page.tsx           # Tablero de comandas en tiempo real
│   │   │
│   │   ├── liquidacion/           # EPIC 3: Liquidación y Cierre
│   │   │   └── page.tsx           # Selección de pago + cierre de orden
│   │   │
│   │   └── dashboard/             # EPIC 4: Dashboard de Ventas
│   │       └── page.tsx           # Cuadre diario + métricas
│   │
│   ├── components/                # Componentes reutilizables
│   │   ├── ui/                    # Componentes genéricos (Button, Card, Badge, Modal)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Input.tsx
│   │   │
│   │   ├── pedidos/               # Componentes específicos de toma de pedidos
│   │   │   ├── MenuGrid.tsx       # Grilla de productos por categoría
│   │   │   ├── ProductCard.tsx    # Tarjeta individual de producto
│   │   │   ├── CategoryTabs.tsx   # Pestañas de filtro por categoría
│   │   │   ├── Cart.tsx           # Panel del carrito / resumen de pedido
│   │   │   ├── CartItem.tsx       # Ítem individual en el carrito (con notas)
│   │   │   ├── OrderTypeSelector.tsx  # Selector Mesa / Domicilio
│   │   │   └── DeliveryForm.tsx   # Formulario de datos de domicilio
│   │   │
│   │   ├── cocina/                # Componentes del KDS
│   │   │   ├── OrderBoard.tsx     # Tablero principal de comandas
│   │   │   ├── OrderTicket.tsx    # Tarjeta individual de comanda
│   │   │   └── NoteHighlight.tsx  # Resaltado visual de notas/modificaciones
│   │   │
│   │   ├── liquidacion/           # Componentes de liquidación
│   │   │   ├── PaymentSelector.tsx    # Botones de método de pago
│   │   │   ├── SurchargeDisplay.tsx   # Muestra recargo datáfono
│   │   │   └── OrderSummary.tsx       # Resumen para cierre
│   │   │
│   │   └── dashboard/             # Componentes del dashboard
│   │       ├── DailySummaryCard.tsx    # Tarjeta de total del día
│   │       ├── PaymentBreakdown.tsx    # Desglose por medio de pago
│   │       └── OrderCount.tsx         # Contador de pedidos despachados
│   │
│   ├── lib/                       # Utilidades y configuración
│   │   ├── supabase/
│   │   │   ├── client.ts          # Cliente Supabase para el browser
│   │   │   ├── server.ts          # Cliente Supabase para Server Components
│   │   │   └── types.ts           # Tipos generados de la DB (Database types)
│   │   │
│   │   ├── constants.ts           # Constantes (RECARGO_DATAFONO = 0.05, estados, etc.)
│   │   └── utils.ts               # Funciones helper (formatCurrency, calcularTotal, etc.)
│   │
│   ├── hooks/                     # Custom React Hooks
│   │   ├── useCart.ts             # Estado y lógica del carrito de pedidos
│   │   ├── useRealtimeOrders.ts   # Suscripción Realtime a pedidos (para KDS)
│   │   └── useDailySales.ts      # Query de ventas del día (para Dashboard)
│   │
│   └── types/                     # Tipos TypeScript del dominio
│       └── index.ts               # Product, Order, OrderDetail, Category, etc.
│
├── supabase/
│   ├── migrations/                # Migraciones SQL de la base de datos
│   │   └── 001_initial_schema.sql
│   └── seed.sql                   # Datos iniciales (categorías + 42 productos + 10 adiciones)
│
├── .env.local                     # Variables de entorno (NUNCA commitear)
├── .env.example                   # Plantilla de variables de entorno
├── next.config.js
├── tsconfig.json
├── package.json
└── PROJECT.md                     # ← Este archivo
```

---

## 4. Base de Datos (PostgreSQL — Supabase)

### 4.1. Diagrama Entidad-Relación

```
┌─────────────────┐       ┌──────────────────────┐
│   CATEGORIAS    │       │      PRODUCTOS       │
├─────────────────┤       ├──────────────────────┤
│ id (PK)         │──1:N──│ id (PK)              │
│ nombre          │       │ nombre               │
│ orden           │       │ precio               │
│ created_at      │       │ categoria_id (FK)    │
└─────────────────┘       │ activo               │
                          │ es_adicion           │
                          │ created_at           │
                          └──────────┬───────────┘
                                     │
                                     │ 1:N
                                     ▼
┌─────────────────────┐   ┌──────────────────────┐
│      PEDIDOS        │   │  DETALLE_PEDIDOS     │
├─────────────────────┤   ├──────────────────────┤
│ id (PK)             │──1:N──│ id (PK)          │
│ tipo                │   │ pedido_id (FK)       │
│ numero_mesa         │   │ producto_id (FK)     │
│ cliente_nombre      │   │ cantidad             │
│ cliente_telefono    │   │ precio_unitario      │
│ cliente_direccion   │   │ notas                │
│ estado              │   │ created_at           │
│ metodo_pago         │   └──────────────────────┘
│ subtotal            │
│ recargo             │
│ total               │
│ created_at          │
│ closed_at           │
└─────────────────────┘
```

### 4.2. Definición de Tablas

#### `categorias`
| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Identificador único |
| `nombre` | `VARCHAR(100)` | NOT NULL, UNIQUE | Nombre de la categoría (Hamburguesas, Asados, Perros, etc.) |
| `orden` | `INT` | NOT NULL, DEFAULT 0 | Orden de aparición en el menú |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Fecha de creación |

#### `productos`
| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Identificador único |
| `nombre` | `VARCHAR(200)` | NOT NULL | Nombre del producto |
| `precio` | `INT` | NOT NULL | Precio en COP (sin decimales) |
| `categoria_id` | `INT` | FK → categorias.id | Categoría del producto |
| `activo` | `BOOLEAN` | DEFAULT TRUE | Si el producto está disponible |
| `es_adicion` | `BOOLEAN` | DEFAULT FALSE | TRUE si es una adición (queso extra, huevo, etc.) |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Fecha de creación |

#### `pedidos`
| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Identificador único / número de orden |
| `tipo` | `VARCHAR(20)` | NOT NULL, CHECK (mesa, domicilio) | Tipo de atención |
| `numero_mesa` | `INT` | NULLABLE | Número de mesa (solo si tipo = mesa) |
| `cliente_nombre` | `VARCHAR(200)` | NULLABLE | Nombre del cliente (solo si tipo = domicilio) |
| `cliente_telefono` | `VARCHAR(20)` | NULLABLE | Teléfono (solo si tipo = domicilio) |
| `cliente_direccion` | `TEXT` | NULLABLE | Dirección (solo si tipo = domicilio) |
| `estado` | `VARCHAR(20)` | NOT NULL, DEFAULT 'pendiente' | Estado del pedido: `pendiente` → `listo` → `pagado` / `cancelado` |
| `metodo_pago` | `VARCHAR(20)` | NULLABLE | Método: `efectivo`, `nequi`, `datafono` (se asigna al liquidar) |
| `subtotal` | `INT` | NOT NULL, DEFAULT 0 | Suma de productos sin recargos |
| `recargo` | `INT` | NOT NULL, DEFAULT 0 | Recargo aplicado (ej: 5% datáfono) |
| `total` | `INT` | NOT NULL, DEFAULT 0 | subtotal + recargo |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Fecha de creación del pedido |
| `closed_at` | `TIMESTAMPTZ` | NULLABLE | Fecha/hora de cierre (pago confirmado) |

#### `detalle_pedidos`
| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Identificador único |
| `pedido_id` | `INT` | FK → pedidos.id, ON DELETE CASCADE | Pedido al que pertenece |
| `producto_id` | `INT` | FK → productos.id | Producto seleccionado |
| `cantidad` | `INT` | NOT NULL, DEFAULT 1 | Cantidad de este producto |
| `precio_unitario` | `INT` | NOT NULL | Precio al momento de la venta (snapshot) |
| `notas` | `TEXT` | NULLABLE | Modificaciones: "Sin cebolla", "Extra queso", etc. |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Fecha de creación |

### 4.3. Estados de un Pedido (Máquina de Estados)

```
  ┌──────────┐    Enviar a     ┌──────────┐   Pedido    ┌─────────┐   Confirmar   ┌─────────┐
  │          │    Cocina       │          │   Listo     │         │   Pago       │         │
  │ (nuevo)  │───────────────▶│ pendiente│────────────▶│  listo  │─────────────▶│ pagado  │
  │          │                │          │             │         │              │         │
  └──────────┘                └────┬─────┘             └────┬────┘              └─────────┘
                                   │                        │
                                   │    Cancelar            │   Cancelar
                                   ▼                        ▼
                              ┌──────────┐            ┌──────────┐
                              │cancelado │            │cancelado │
                              └──────────┘            └──────────┘
```

| Transición | Quién la ejecuta | Dónde ocurre |
|------------|-----------------|--------------|
| (nuevo) → `pendiente` | Quien toma el pedido | `/pedidos` — al presionar "Enviar a Cocina" |
| `pendiente` → `listo` | Cocina | `/cocina` — al presionar "Pedido Listo" |
| `listo` → `pagado` | Quien cobra | `/liquidacion` — al confirmar pago |
| cualquiera → `cancelado` | Cualquier usuario | Desde cualquier vista con acceso al pedido |

### 4.4. Supabase Realtime

Se habilita Realtime en la tabla `pedidos` para que la vista de cocina (`/cocina`) reciba automáticamente:
- **INSERT** → Nueva comanda aparece en el tablero
- **UPDATE** → Cambio de estado (ej: cuando se marca como "listo", desaparece del tablero)

```typescript
// Ejemplo de suscripción en el KDS
const channel = supabase
  .channel('pedidos-cocina')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'pedidos',
    filter: 'estado=eq.pendiente'
  }, (payload) => {
    // Actualizar el tablero
  })
  .subscribe()
```

---

## 5. EPICs e Historias de Usuario

---

### EPIC 1: Toma de Pedidos (`/pedidos`)

> **Objetivo:** Digitalizar la toma de pedidos reemplazando el cuaderno físico. Permitir registrar pedidos de mesa y domicilio con notas específicas por producto.

---

#### HU 1.1: Visualización del Menú Digital

- **Descripción:** Como usuario, quiero ver los productos divididos por categorías (Hamburguesas, Asados, Perros, Bebidas, etc.) para encontrar rápidamente lo que el cliente pide.
- **Criterios de Aceptación:**
  - [ ] Los productos se obtienen de la tabla `productos` vía Supabase.
  - [ ] Cada producto muestra su **nombre** y **precio actual** formateado en COP.
  - [ ] Existen **pestañas o filtros por categoría** para navegar el menú.
  - [ ] Solo se muestran productos con `activo = true`.
  - [ ] Las **adiciones** (`es_adicion = true`) se muestran en una sección separada o claramente diferenciada.
  - [ ] La interfaz es responsive y funcional en celulares (pantalla principal de trabajo).

---

#### HU 1.2: Selección de Tipo de Atención — Mesa

- **Descripción:** Como usuario, quiero seleccionar la opción "Mesa" e ingresar el número de la mesa para saber a dónde llevar el pedido.
- **Criterios de Aceptación:**
  - [ ] Existe un selector con dos opciones: **"Mesa"** y **"Domicilio"**.
  - [ ] Al seleccionar "Mesa", aparece un campo numérico **obligatorio** para ingresar el N° de mesa.
  - [ ] No se puede enviar el pedido sin ingresar el número de mesa.
  - [ ] El valor se guarda en `pedidos.numero_mesa`.

---

#### HU 1.3: Selección de Tipo de Atención — Domicilio

- **Descripción:** Como usuario, quiero seleccionar la opción "Domicilio" y registrar los datos del cliente para el despacho.
- **Criterios de Aceptación:**
  - [ ] Al seleccionar "Domicilio", aparecen tres campos **obligatorios**: Nombre, Teléfono y Dirección.
  - [ ] Los valores se guardan en `pedidos.cliente_nombre`, `pedidos.cliente_telefono`, `pedidos.cliente_direccion`.
  - [ ] No se puede enviar el pedido sin completar los tres campos.

---

#### HU 1.4: Sistema de Notas / Modificaciones por Producto

- **Descripción:** Como usuario, quiero poder escribir una nota específica en cada producto añadido al pedido (Ej: "Sin cebolla", "Sin salsas") para que la cocina no cometa errores.
- **Criterios de Aceptación:**
  - [ ] Cada ítem en el carrito tiene un campo de texto para agregar **notas**.
  - [ ] Las notas se guardan en `detalle_pedidos.notas` como texto libre.
  - [ ] Las notas son **opcionales** — un producto puede no tener notas.
  - [ ] Las notas se visualizarán resaltadas en la vista de cocina (ver HU 2.2).

---

#### HU 1.5: Carrito y Envío de Comanda

- **Descripción:** Como usuario, quiero ver el resumen del pedido (carrito), el total a pagar y un botón de "Enviar a Cocina" para oficializar la orden.
- **Criterios de Aceptación:**
  - [ ] El carrito muestra la lista de productos añadidos con cantidad, precio unitario y subtotal por línea.
  - [ ] Se calcula y muestra el **subtotal general** (suma de todos los ítems).
  - [ ] Se puede modificar la **cantidad** de cada producto (+/-) o eliminarlo del carrito.
  - [ ] Al presionar **"Enviar a Cocina"**:
    - Se inserta un registro en `pedidos` con `estado = 'pendiente'`.
    - Se insertan los registros correspondientes en `detalle_pedidos`.
    - El carrito se **vacía automáticamente**.
    - Se muestra una confirmación visual (toast/notificación).
  - [ ] El botón "Enviar a Cocina" está **deshabilitado** si el carrito está vacío o faltan datos del tipo de atención.

---

### EPIC 2: Kitchen Display System — KDS (`/cocina`)

> **Objetivo:** Mostrar en tiempo real las comandas entrantes en un tablero optimizado para cocina, resaltando las modificaciones y permitiendo marcar pedidos como listos.

---

#### HU 2.1: Tablero de Comandas en Tiempo Real

- **Descripción:** Como usuario de cocina, quiero ver las comandas nuevas aparecer en mi pantalla automáticamente sin tener que recargar la página, para empezar a prepararlas al instante.
- **Criterios de Aceptación:**
  - [ ] La interfaz muestra todos los pedidos con `estado = 'pendiente'` como tarjetas en un tablero.
  - [ ] Los pedidos nuevos aparecen **automáticamente** vía Supabase Realtime (sin refresh).
  - [ ] Cada tarjeta muestra:
    - Número de pedido (`pedidos.id`).
    - Tipo de atención (Mesa N° X / Domicilio + nombre).
    - Lista de productos con cantidad.
    - Hora de creación (`created_at`) y tiempo transcurrido.
  - [ ] La interfaz está **optimizada para vista horizontal** (tablet/celular en landscape).
  - [ ] Los pedidos se ordenan del **más antiguo al más reciente** (FIFO).

---

#### HU 2.2: Resaltado Visual de Notas / Modificaciones

- **Descripción:** Como usuario de cocina, quiero que las notas o modificaciones de los platos tengan un formato visual llamativo para no pasarlas por alto.
- **Criterios de Aceptación:**
  - [ ] Si un producto tiene `notas` (no nulo y no vacío), el texto se muestra con:
    - **Color rojo** o fondo resaltado (alto contraste).
    - **Texto en negrita**.
    - Un ícono de alerta (⚠️ o similar) junto a la nota.
  - [ ] Las notas son claramente legibles a distancia de brazo (tamaño de fuente mayor).

---

#### HU 2.3: Despacho de Pedidos

- **Descripción:** Como usuario de cocina, quiero tener un botón de "Pedido Listo" en cada comanda para quitarla de mi cola de trabajo una vez preparada.
- **Criterios de Aceptación:**
  - [ ] Cada tarjeta de comanda tiene un botón **"Pedido Listo"** visible y grande.
  - [ ] Al presionar el botón:
    - El `estado` del pedido cambia de `'pendiente'` a `'listo'` en la DB.
    - La tarjeta **desaparece** de la vista del tablero (con animación de salida).
  - [ ] La acción es **irreversible** desde esta vista (no hay botón de "deshacer").

---

### EPIC 3: Liquidación y Cierre (`/liquidacion`)

> **Objetivo:** Permitir cerrar las órdenes listas, registrar el método de pago, aplicar recargos automáticos y generar el registro contable del día.

---

#### HU 3.1: Selector de Método de Pago

- **Descripción:** Como usuario, quiero poder seleccionar si el cliente pagó en Efectivo, Nequi o Datáfono al momento de cerrar la orden.
- **Criterios de Aceptación:**
  - [ ] La vista muestra los pedidos con `estado = 'listo'` (listos para cobrar).
  - [ ] Cada pedido muestra el resumen de productos y el total.
  - [ ] Existe un selector (botones o dropdown) con **3 opciones**: Efectivo, Nequi, Datáfono.
  - [ ] No se puede cerrar una orden sin seleccionar un método de pago.

---

#### HU 3.2: Cálculo Automático de Recargo por Datáfono

- **Descripción:** Como sistema, quiero sumar automáticamente un 5% al total de la cuenta si el método de pago elegido es Datáfono.
- **Criterios de Aceptación:**
  - [ ] Si se selecciona **Efectivo** o **Nequi**: el total se mantiene igual (`recargo = 0`).
  - [ ] Si se selecciona **Datáfono**: el total se recalcula como `subtotal * 1.05`.
  - [ ] Se muestra el **valor del recargo** de forma explícita (ej: "Recargo datáfono: $2.500").
  - [ ] El recargo se guarda en `pedidos.recargo` y el nuevo total en `pedidos.total`.
  - [ ] La constante del recargo es `RECARGO_DATAFONO = 0.05` (definida en `constants.ts`).

---

#### HU 3.3: Cierre Histórico de Orden

- **Descripción:** Como usuario, quiero confirmar el pago para que el pedido se marque como "Pagado" y sus valores pasen a la contabilidad del día.
- **Criterios de Aceptación:**
  - [ ] Al confirmar el pago:
    - El `estado` cambia a `'pagado'`.
    - Se registra `metodo_pago` con el valor seleccionado.
    - Se registra `closed_at` con la fecha/hora exacta del cierre.
  - [ ] El pedido desaparece de la lista de pendientes de liquidación.
  - [ ] Se muestra una confirmación visual del cierre exitoso.

---

### EPIC 4: Dashboard de Ventas (`/dashboard`)

> **Objetivo:** Proporcionar un resumen visual de la operación del día: ingresos totales, desglose por medio de pago y volumen de pedidos, para reemplazar el conteo manual.

---

#### HU 4.1: Cuadre Diario (Ingresos Totales)

- **Descripción:** Como usuario, quiero ver en la pantalla la suma total de dinero que ha ingresado en el día en curso para no tener que sumar facturas a mano.
- **Criterios de Aceptación:**
  - [ ] Se muestra una tarjeta prominente con el **monto total del día**.
  - [ ] El cálculo es: `SUM(total) WHERE estado = 'pagado' AND DATE(closed_at) = HOY`.
  - [ ] El valor se formatea en pesos colombianos (ej: `$1.250.000`).
  - [ ] Se actualiza en tiempo real o al recargar la página.

---

#### HU 4.2: Desglose por Medio de Pago

- **Descripción:** Como usuario, quiero ver cuánto dinero hay en Efectivo, cuánto en Nequi y cuánto en Datáfono para cuadrar la caja física.
- **Criterios de Aceptación:**
  - [ ] Se muestran **3 tarjetas/indicadores separados**, uno por cada medio de pago.
  - [ ] Cada tarjeta muestra el subtotal de ventas filtrado por `metodo_pago` del día.
  - [ ] Los valores se formatean en COP.

---

#### HU 4.3: Conteo de Pedidos Despachados

- **Descripción:** Como usuario, quiero ver cuántos pedidos se vendieron hoy para entender el volumen operativo.
- **Criterios de Aceptación:**
  - [ ] Se muestra un número que refleja la **cantidad de órdenes** con `estado = 'pagado'` del día actual.
  - [ ] Se diferencia entre pedidos de **mesa** y de **domicilio** si es posible.

---

## 6. Navegación de la Aplicación

```
┌─────────────────────────────────────────────────┐
│                   INICIO (/)                     │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│   │ 🍔       │  │ 👨‍🍳       │  │ 💳           │  │
│   │ Tomar    │  │ Cocina   │  │ Liquidar     │  │
│   │ Pedido   │  │ (KDS)    │  │ Pedido       │  │
│   └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │             │               │           │
│   ┌────┴─────────────┴───────────────┴────────┐  │
│   │              📊 Dashboard                  │  │
│   └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | Inicio | Navegación principal a los 4 módulos |
| `/pedidos` | Toma de Pedidos | Menú digital + carrito + envío a cocina |
| `/cocina` | KDS | Tablero de comandas en tiempo real |
| `/liquidacion` | Liquidación | Lista de pedidos listos + cierre con pago |
| `/dashboard` | Dashboard | Métricas de ventas del día |

---

## 7. Convenciones de Código

### 7.1. Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Componentes React | PascalCase | `ProductCard.tsx` |
| Hooks | camelCase con prefijo `use` | `useCart.ts` |
| Utilidades/funciones | camelCase | `formatCurrency()` |
| Constantes | UPPER_SNAKE_CASE | `RECARGO_DATAFONO` |
| Archivos CSS | kebab-case | `category-tabs.css` |
| Tablas DB | snake_case, plural | `detalle_pedidos` |
| Columnas DB | snake_case | `precio_unitario` |

### 7.2. Estilos CSS

- Se usa **Vanilla CSS** con Custom Properties (variables CSS).
- Las variables globales se definen en `globals.css`.
- Cada componente puede tener su propio archivo `.module.css` (CSS Modules de Next.js).
- **No se usa Tailwind CSS.**

```css
/* Ejemplo de tokens en globals.css */
:root {
  --color-primary: #FF6B35;
  --color-primary-dark: #E5541F;
  --color-background: #1A1A2E;
  --color-surface: #16213E;
  --color-text: #EAEAEA;
  --color-danger: #E63946;
  --color-success: #2A9D8F;
  --color-warning: #F4A261;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3);
  --font-family: 'Inter', sans-serif;
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
}
```

### 7.3. Componentes

- Los componentes son **funcionales** (no clases).
- Se usa TypeScript con **interfaces explícitas** para las props.
- Los componentes de UI (`/components/ui/`) son genéricos y reutilizables.
- Los componentes de dominio (`/components/pedidos/`, etc.) son específicos de cada módulo.

```typescript
// Ejemplo de componente tipado
interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  // ...
}
```

### 7.4. Supabase

- Existen **dos clientes** de Supabase:
  - `client.ts` → Para componentes del lado del cliente (Client Components).
  - `server.ts` → Para Server Components y Server Actions.
- Los tipos de la DB se generan con `npx supabase gen types typescript` y se almacenan en `lib/supabase/types.ts`.
- Las queries a Supabase usan el **query builder** nativo (no SQL crudo en el frontend).

---

## 8. Variables de Entorno

```env
# .env.local (NO commitear)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> `NEXT_PUBLIC_` es obligatorio para variables que se usan en el cliente (browser).

---

## 9. Constantes del Negocio

```typescript
// src/lib/constants.ts

/** Recargo porcentual aplicado al pagar con datáfono */
export const RECARGO_DATAFONO = 0.05;

/** Estados posibles de un pedido */
export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  LISTO: 'listo',
  PAGADO: 'pagado',
  CANCELADO: 'cancelado',
} as const;

/** Métodos de pago disponibles */
export const METODOS_PAGO = {
  EFECTIVO: 'efectivo',
  NEQUI: 'nequi',
  DATAFONO: 'datafono',
} as const;

/** Tipos de atención */
export const TIPOS_ATENCION = {
  MESA: 'mesa',
  DOMICILIO: 'domicilio',
} as const;
```

---

## 10. Flujo de Datos Principal

```
  TOMA DE PEDIDO (/pedidos)          COCINA (/cocina)              LIQUIDACIÓN (/liquidacion)         DASHBOARD (/dashboard)
  ─────────────────────             ──────────────────             ──────────────────────────         ─────────────────────
         │                                │                                │                                │
  1. Usuario arma el                2. Supabase Realtime           4. Muestra pedidos               6. Consulta pedidos
     pedido en el carrito              notifica INSERT               con estado='listo'               con estado='pagado'
         │                                │                                │                           del día actual
  2. Presiona "Enviar               3. Comanda aparece             5. Usuario selecciona                   │
     a Cocina"                         en el tablero                  método de pago               7. Suma totales y
         │                                │                                │                           genera métricas
  3. INSERT en                      4. Cocinero prepara            6. UPDATE pedido:
     pedidos + detalle_pedidos         y presiona                    estado='pagado'
         │                             "Pedido Listo"                 metodo_pago=X
         ▼                                │                           closed_at=NOW()
  estado = 'pendiente'              5. UPDATE pedido:                     │
                                       estado='listo'                     ▼
                                          │                       Pedido cerrado ✓
                                          ▼
                                    Comanda sale del tablero
```

---

## 11. Cronograma de Desarrollo

| Día | Fecha | Fase | Entregable |
|-----|-------|------|------------|
| 1 | 5 Jun | 🔧 Setup | Proyecto Next.js + Supabase configurado, esquema DB, design system CSS, navegación |
| 2 | 6 Jun | 🍔 Pedidos pt.1 | Menú digital con categorías, filtros, productos con precio, selector mesa/domicilio |
| 3 | 7 Jun | 🛒 Pedidos pt.2 | Notas por producto, carrito completo, envío a cocina con persistencia |
| 4 | 8 Jun | 👨‍🍳 KDS | Tablero en tiempo real, resaltado de notas, botón "Pedido Listo", layout tablet |
| 5 | 9 Jun | 💳 Liquidación | Métodos de pago, recargo datáfono 5%, cierre de orden |
| 6 | 10 Jun | 📊 Dashboard | Cuadre diario, desglose por método de pago, conteo de pedidos |
| 7 | 11 Jun | 🎨 UI/UX pt.1 | Animaciones, transiciones, responsive testing |
| 8 | 12 Jun | 🎨 UI/UX pt.2 | Performance, ajustes visuales, experiencia táctil móvil |
| 9 | 13 Jun | 🧪 QA | Pruebas de flujo completo, testing en múltiples dispositivos |
| 10 | 14 Jun | 🐛 Bugfixes | Corrección de bugs, carga de 42 productos + 10 adiciones reales |
| 11 | 15 Jun | 🚀 Deploy | Producción en Vercel + Supabase, prueba con el cliente, capacitación |

---

## 12. Comandos Útiles

```bash
# Desarrollo local
npm run dev                    # Inicia servidor de desarrollo (localhost:3000)

# Build de producción
npm run build                  # Genera build optimizado
npm run start                  # Sirve el build de producción

# Supabase (si se usa CLI local)
npx supabase start             # Inicia Supabase local (Docker)
npx supabase db reset          # Resetea la DB y re-aplica migraciones + seed
npx supabase gen types typescript --local > src/lib/supabase/types.ts  # Genera tipos TS

# Lint
npm run lint                   # Ejecuta ESLint
```
