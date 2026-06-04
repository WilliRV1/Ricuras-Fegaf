# 🗺️ Roadmap del Vibecoder — Ricuras Fegaf

> **Tú diriges, la IA construye.**  
> Este roadmap está diseñado para ti como vibecoder. Cada día tiene lo que TÚ haces, lo que le PIDES a la IA, y cuánto toma cada cosa.

---

## ⏱️ Resumen de Tiempos

| Métrica | Valor |
|---------|-------|
| **Días totales** | 11 (5 Jun → 15 Jun 2026) |
| **Horas estimadas por día** | 5-7 horas |
| **Horas totales estimadas** | ~65 horas |
| **Historias de Usuario** | 11 |
| **Vistas a construir** | 5 (Inicio + 4 módulos) |

---

## 🚨 DÍA 0 — Hoy (4 Jun) · Preparación · ~1 hora

> Esto lo haces ANTES de empezar a codear. Sin esto, el Día 1 se traba.

### Lo que TÚ haces:

- [ ] **Crear cuenta en Supabase** (gratis) → [supabase.com](https://supabase.com)
  - Crear un nuevo proyecto llamado `ricuras-fegaf`
  - Elegir región más cercana (São Paulo)
  - Guardar la contraseña de la DB
  - ⏱️ ~10 min

- [ ] **Copiar credenciales de Supabase**
  - Ir a Settings → API
  - Copiar `Project URL` y `anon public key`
  - ⏱️ ~5 min

- [ ] **Crear cuenta en Vercel** (gratis) → [vercel.com](https://vercel.com)
  - Conectar con GitHub si tienes cuenta
  - ⏱️ ~5 min

- [ ] **Crear repositorio en GitHub** (opcional pero recomendado)
  - Nombre: `ricuras-fegaf`
  - Privado
  - ⏱️ ~5 min

- [ ] **Preparar los datos del menú**
  - Necesitas la lista de los 42 productos + 10 adiciones con sus precios
  - Formato ideal: un listado por categoría con nombre y precio
  - Pregúntale al cliente si no los tienes
  - ⏱️ ~15 min

- [ ] **Obtener branding** (si existe)
  - Logo de Ricuras Fegaf (imagen PNG/SVG)
  - Colores de marca (si los tienen)
  - Si no hay, la IA diseñará una paleta
  - ⏱️ ~10 min

---

## 📅 DÍA 1 — Setup & Arquitectura · ~5 horas

### Bloque 1: Inicialización del Proyecto (⏱️ ~1.5 horas)

**Le pides a la IA:**
- [ ] Inicializar proyecto Next.js con TypeScript
- [ ] Instalar dependencias (`@supabase/supabase-js`, `@supabase/ssr`)
- [ ] Crear estructura de carpetas según PROJECT.md
- [ ] Configurar `.env.local` con las credenciales de Supabase

**Tú verificas:**
- [ ] `npm run dev` funciona sin errores
- [ ] Abrir `localhost:3000` muestra algo

### Bloque 2: Base de Datos (⏱️ ~1.5 horas)

**Le pides a la IA:**
- [ ] Crear la migración SQL con las 4 tablas (categorias, productos, pedidos, detalle_pedidos)
- [ ] Crear el archivo seed.sql con categorías de ejemplo
- [ ] Configurar clientes de Supabase (client.ts y server.ts)
- [ ] Generar los tipos TypeScript del esquema

**Tú haces:**
- [ ] Ir al SQL Editor de Supabase (dashboard web) y ejecutar la migración
- [ ] Verificar que las tablas se crearon en Table Editor
- [ ] Habilitar Realtime en la tabla `pedidos` (Database → Replication → habilitar tabla)

### Bloque 3: Design System & Layout (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Crear `globals.css` con variables CSS, reset, tokens de diseño
- [ ] Crear el layout raíz (`layout.tsx`) con fuentes (Google Fonts: Inter)
- [ ] Crear la página de inicio (`/`) con navegación a los 4 módulos
- [ ] Crear componentes UI base: Button, Card, Badge, Modal, Input

**Tú verificas:**
- [ ] La página de inicio se ve bonita y responsiva
- [ ] Los 4 botones de navegación llevan a sus rutas (aunque estén vacías)
- [ ] El diseño se ve bien en móvil (F12 → responsive)

### ✅ Checkpoint Día 1:
```
✓ Proyecto corriendo en localhost:3000
✓ 4 tablas creadas en Supabase
✓ Realtime habilitado en tabla pedidos
✓ Página de inicio con navegación a 4 módulos
✓ Design system con colores, fuentes y componentes base
```

---

## 📅 DÍA 2 — Menú Digital & Pedidos pt.1 · ~6 horas

### Bloque 1: Menú Digital (⏱️ ~3 horas)

**Le pides a la IA:**
- [ ] Crear componente `CategoryTabs` — pestañas de filtro por categoría
- [ ] Crear componente `ProductCard` — tarjeta de producto con nombre, precio y botón "Agregar"
- [ ] Crear componente `MenuGrid` — grilla que muestra los productos filtrados
- [ ] Conectar todo con Supabase — query a las tablas `categorias` y `productos`
- [ ] Ensamblar la página `/pedidos`

**Tú verificas:**
- [ ] Cargar 5-10 productos de prueba en Supabase (Table Editor → Insert Row)
- [ ] Las categorías se muestran como pestañas
- [ ] Los productos se filtran al tocar una categoría
- [ ] Se ve bien en celular

### Bloque 2: Selector Mesa / Domicilio (⏱️ ~1.5 horas)

**Le pides a la IA:**
- [ ] Crear componente `OrderTypeSelector` — botones "Mesa" / "Domicilio"
- [ ] Crear componente `DeliveryForm` — campos nombre, teléfono, dirección
- [ ] Integrar la validación (mesa requiere número, domicilio requiere 3 campos)

**Tú verificas:**
- [ ] Al seleccionar "Mesa" aparece el campo de número
- [ ] Al seleccionar "Domicilio" aparecen los 3 campos
- [ ] No se puede avanzar sin completar los campos requeridos

### Bloque 3: Integración en la Página (⏱️ ~1.5 horas)

**Le pides a la IA:**
- [ ] Integrar el selector de tipo con el menú en `/pedidos`
- [ ] Hacer que al tocar "Agregar" en un producto, se muestre feedback visual (animación, toast)
- [ ] Pulir el layout responsive de toda la vista

**Tú verificas:**
- [ ] El flujo completo funciona: seleccionar tipo → ver menú → agregar producto
- [ ] Todo responsivo en móvil

### ✅ Checkpoint Día 2:
```
✓ Menú digital funcional con categorías y filtros
✓ Productos se cargan desde Supabase
✓ Selector Mesa/Domicilio con validación
✓ Se puede agregar productos (aunque el carrito aún no existe)
```

---

## 📅 DÍA 3 — Carrito & Envío a Cocina · ~6 horas

### Bloque 1: Hook del Carrito (⏱️ ~1.5 horas)

**Le pides a la IA:**
- [ ] Crear hook `useCart` con: agregar producto, quitar producto, modificar cantidad, limpiar carrito, calcular subtotal
- [ ] Incluir la funcionalidad de **notas por producto** dentro del carrito

### Bloque 2: Componentes del Carrito (⏱️ ~2.5 horas)

**Le pides a la IA:**
- [ ] Crear componente `CartItem` — ítem con cantidad (+/-), precio, campo de notas, botón eliminar
- [ ] Crear componente `Cart` — panel lateral o inferior con lista de ítems, subtotal y botón "Enviar a Cocina"
- [ ] Integrar el carrito en la página `/pedidos`

**Tú verificas:**
- [ ] Agregar producto desde el menú lo mete al carrito
- [ ] Se puede cambiar la cantidad con +/-
- [ ] Se puede escribir notas (ej: "Sin cebolla")
- [ ] Se puede eliminar un producto del carrito
- [ ] El subtotal se calcula correctamente

### Bloque 3: Envío a Cocina (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Implementar la función de envío: INSERT en `pedidos` + INSERT en `detalle_pedidos`
- [ ] Vaciar el carrito tras envío exitoso
- [ ] Mostrar toast/notificación de "Pedido enviado ✓"
- [ ] Deshabilitar botón si el carrito está vacío o faltan datos

**Tú verificas:**
- [ ] Armar un pedido completo y enviarlo
- [ ] Ir a Supabase Table Editor → verificar que el pedido y sus detalles se guardaron
- [ ] Verificar que el estado es `pendiente`
- [ ] El carrito se limpió después del envío

### ✅ Checkpoint Día 3:
```
✓ Carrito completamente funcional (agregar, quitar, cantidad, notas)
✓ Envío a cocina guarda en Supabase (pedidos + detalle_pedidos)
✓ Toast de confirmación
✓ EPIC 1 COMPLETO ✅
```

---

## 📅 DÍA 4 — KDS (Kitchen Display System) · ~6 horas

### Bloque 1: Tablero Base (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Crear hook `useRealtimeOrders` — suscripción Supabase Realtime a pedidos con estado `pendiente`
- [ ] Crear componente `OrderTicket` — tarjeta de comanda con número de pedido, tipo, productos, hora
- [ ] Crear componente `OrderBoard` — tablero que muestra todos los tickets

### Bloque 2: Notas Resaltadas & Layout (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Crear componente `NoteHighlight` — texto rojo/negrita con ícono de alerta para las notas
- [ ] Integrar las notas visualmente dentro de cada producto en el ticket
- [ ] Optimizar el layout para **vista horizontal (landscape)** en tablet/celular
- [ ] Agregar el tiempo transcurrido desde la creación del pedido

### Bloque 3: Despacho (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Agregar botón "Pedido Listo" en cada ticket
- [ ] Implementar UPDATE del estado a `listo` en Supabase
- [ ] Animar la salida del ticket cuando se marca como listo
- [ ] Ensamblar toda la página `/cocina`

**Tú verificas (PRUEBA CRÍTICA 🔴):**
- [ ] Abrir `/pedidos` en un dispositivo y `/cocina` en otro
- [ ] Enviar un pedido desde `/pedidos`
- [ ] Verificar que **aparece automáticamente** en `/cocina` (sin recargar)
- [ ] Las notas (ej: "Sin cebolla") se ven en rojo/resaltadas
- [ ] Presionar "Pedido Listo" → la comanda desaparece
- [ ] En Supabase, el pedido ahora tiene `estado = 'listo'`

### ✅ Checkpoint Día 4:
```
✓ KDS recibe comandas en TIEMPO REAL
✓ Notas resaltadas visualmente
✓ Botón "Pedido Listo" funciona
✓ Layout optimizado para tablet horizontal
✓ EPIC 2 COMPLETO ✅
```

---

## 📅 DÍA 5 — Liquidación y Cierre · ~5 horas

### Bloque 1: Vista de Pedidos Listos (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Crear la página `/liquidacion` que muestra pedidos con `estado = 'listo'`
- [ ] Cada pedido muestra: número, tipo (mesa/domicilio), productos, subtotal
- [ ] Crear componente `PaymentSelector` — 3 botones: Efectivo, Nequi, Datáfono

### Bloque 2: Recargo & Cierre (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Crear componente `SurchargeDisplay` — muestra el recargo del 5% si es datáfono
- [ ] Implementar lógica: al seleccionar datáfono → recalcular total y mostrar desglose
- [ ] Crear componente `OrderSummary` — resumen final con botón "Confirmar Pago"
- [ ] Al confirmar: UPDATE estado a `pagado`, guardar `metodo_pago`, `recargo`, `total`, `closed_at`

### Bloque 3: Pulido (⏱️ ~1 hora)

**Le pides a la IA:**
- [ ] Toast de confirmación al cerrar la orden
- [ ] La orden desaparece de la lista tras el pago
- [ ] Animaciones de entrada/salida

**Tú verificas:**
- [ ] Flujo completo: pedido enviado → cocina lo marca listo → aparece en liquidación
- [ ] Seleccionar Efectivo/Nequi → total se mantiene
- [ ] Seleccionar Datáfono → total sube 5% y muestra el recargo
- [ ] Confirmar pago → pedido cambia a `pagado` en Supabase con `closed_at`

### ✅ Checkpoint Día 5:
```
✓ Pedidos listos aparecen para liquidar
✓ 3 métodos de pago funcionan
✓ Recargo datáfono 5% se calcula y muestra
✓ Cierre guarda método, recargo, total y timestamp
✓ EPIC 3 COMPLETO ✅
```

---

## 📅 DÍA 6 — Dashboard de Ventas · ~5 horas

### Bloque 1: Métricas del Día (⏱️ ~2.5 horas)

**Le pides a la IA:**
- [ ] Crear hook `useDailySales` — query que trae pedidos pagados del día con totales
- [ ] Crear componente `DailySummaryCard` — tarjeta grande con el total del día en COP
- [ ] Crear componente `PaymentBreakdown` — 3 tarjetas con subtotal por Efectivo, Nequi, Datáfono
- [ ] Crear componente `OrderCount` — número de pedidos despachados hoy

### Bloque 2: Ensamblaje & Diseño (⏱️ ~2.5 horas)

**Le pides a la IA:**
- [ ] Ensamblar la página `/dashboard` con todos los componentes
- [ ] Diseño premium: tarjetas con gradientes, iconos de dinero, animaciones al cargar
- [ ] Diferenciar visualmente pedidos de mesa vs domicilio en el conteo
- [ ] Hacer responsive para móvil y tablet

**Tú verificas:**
- [ ] Crear varios pedidos de prueba (3 en efectivo, 2 en nequi, 1 en datáfono) y cerrarlos
- [ ] El dashboard muestra el total correcto
- [ ] El desglose por método de pago cuadra
- [ ] El conteo de pedidos es correcto

### ✅ Checkpoint Día 6:
```
✓ Dashboard muestra total del día
✓ Desglose por método de pago
✓ Conteo de pedidos despachados
✓ EPIC 4 COMPLETO ✅
✓ 🎉 TODOS LOS EPICS COMPLETOS — MVP FUNCIONAL
```

---

## 📅 DÍAS 7-8 — Pulido UI/UX · ~10 horas totales

> A partir de aquí el MVP ya funciona. Estos días son para que se vea PREMIUM.

### Día 7: Visual & Animaciones (⏱️ ~5 horas)

**Le pides a la IA:**
- [ ] Revisar TODAS las vistas y mejorar el diseño visual
- [ ] Agregar micro-animaciones: hover en botones, entrada de tarjetas, transiciones de página
- [ ] Agregar animaciones al carrito (bounce al agregar, slide al eliminar)
- [ ] Agregar sonido sutil o vibración al recibir comanda en cocina (si es posible)
- [ ] Agregar un indicador de "sin pedidos" en cocina y liquidación (empty state)
- [ ] Mejorar la tipografía y espaciados

### Día 8: Responsive & Mobile (⏱️ ~5 horas)

**Le pides a la IA:**
- [ ] Testing responsive en 3 breakpoints: móvil (375px), tablet (768px), desktop (1024px+)
- [ ] Ajustar el menú para que el carrito sea un panel inferior en móvil (bottom sheet)
- [ ] Optimizar el KDS para tablet en modo landscape
- [ ] Verificar que los botones sean suficientemente grandes para uso táctil (min 44px)
- [ ] Agregar la navegación global (navbar o menú hamburguesa)
- [ ] Optimizar performance: lazy loading de imágenes, minimizar re-renders

**Tú verificas:**
- [ ] Abrir la app en TU celular real (no solo el emulador del navegador)
- [ ] Probar en la tablet si hay una disponible
- [ ] Verificar que todo se toca bien con los dedos
- [ ] El KDS se ve bien en horizontal

### ✅ Checkpoint Días 7-8:
```
✓ Animaciones y transiciones en todas las vistas
✓ Responsive perfecto en móvil, tablet y desktop
✓ Empty states diseñados
✓ Navegación global implementada
✓ Botones táctiles grandes y accesibles
```

---

## 📅 DÍA 9 — Testing & QA · ~6 horas

### Test del Flujo Completo (⏱️ ~3 horas)

> **Abre 3 pestañas** simultáneamente: `/pedidos`, `/cocina`, `/liquidacion`

**Tú ejecutas estos escenarios:**

- [ ] **Escenario 1 — Pedido de Mesa básico:**
  1. En `/pedidos`: seleccionar Mesa #5
  2. Agregar 2 hamburguesas y 1 bebida
  3. Enviar a cocina
  4. En `/cocina`: verificar que aparece → marcar como listo
  5. En `/liquidacion`: verificar que aparece → pagar en Efectivo
  6. En `/dashboard`: verificar que el total cuadra

- [ ] **Escenario 2 — Pedido de Domicilio con notas:**
  1. En `/pedidos`: seleccionar Domicilio, llenar datos
  2. Agregar 1 hamburguesa con nota "SIN CEBOLLA SIN SALSAS"
  3. Enviar a cocina
  4. En `/cocina`: verificar que la nota aparece **resaltada en rojo**
  5. Marcar como listo → liquidar con Datáfono
  6. Verificar que el recargo del 5% se aplicó correctamente

- [ ] **Escenario 3 — Múltiples pedidos simultáneos:**
  1. Enviar 3 pedidos rápidamente desde `/pedidos`
  2. Verificar que los 3 aparecen en cocina en orden (FIFO)
  3. Marcar solo 1 como listo → verificar que solo ese aparece en liquidación

- [ ] **Escenario 4 — Edge cases:**
  1. Intentar enviar pedido con carrito vacío → debe estar bloqueado
  2. Intentar enviar sin seleccionar tipo (mesa/domicilio) → debe estar bloqueado
  3. Seleccionar domicilio sin llenar teléfono → debe validar

### Corrección de Bugs Encontrados (⏱️ ~3 horas)

**Le pides a la IA:**
- [ ] Corregir cada bug que encontraste en los escenarios
- [ ] Volver a correr los escenarios para verificar

### ✅ Checkpoint Día 9:
```
✓ 4 escenarios de prueba pasados
✓ Tiempo real verificado con múltiples pestañas
✓ Validaciones funcionan
✓ Recargo datáfono es correcto
✓ Bugs encontrados y corregidos
```

---

## 📅 DÍA 10 — Datos Reales & Bugfixes · ~5 horas

### Bloque 1: Cargar los 42 Productos + 10 Adiciones (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Generar el SQL INSERT con los 42 productos reales organizados por categoría
- [ ] Generar el SQL INSERT con las 10 adiciones
- [ ] Incluir precios reales en COP

**Tú haces:**
- [ ] Ejecutar el SQL en Supabase (SQL Editor)
- [ ] Verificar en la app que todos los productos aparecen correctamente
- [ ] Verificar que las categorías tienen sentido

### Bloque 2: Últimos Ajustes (⏱️ ~2 horas)

**Le pides a la IA:**
- [ ] Corregir cualquier bug restante
- [ ] Ajustar precios o nombres si algo no cuadra
- [ ] Último review del diseño visual

### Bloque 3: Preparar Deploy (⏱️ ~1 hora)

**Le pides a la IA:**
- [ ] Crear archivo `.env.example` documentado
- [ ] Revisar que no haya `console.log` o datos de prueba en el código
- [ ] Optimizar el build: `npm run build` debe pasar sin errores

**Tú verificas:**
- [ ] `npm run build` → sin errores
- [ ] Los 42 productos + 10 adiciones están en la app
- [ ] Un flujo completo con datos reales funciona

### ✅ Checkpoint Día 10:
```
✓ Datos reales cargados (52 productos)
✓ Build de producción sin errores
✓ Último round de bugfixes completado
✓ Listo para deploy
```

---

## 📅 DÍA 11 — Deploy & Entrega al Cliente · ~5 horas

### Bloque 1: Deploy a Producción (⏱️ ~1.5 horas)

**Tú haces:**
- [ ] Subir el código a GitHub (si no lo has hecho)
- [ ] Conectar el repo a Vercel → deploy automático
- [ ] Configurar las variables de entorno en Vercel (Supabase URL + Anon Key)
- [ ] Verificar que la URL de producción funciona (ej: `ricuras-fegaf.vercel.app`)

**Le pides a la IA (si algo falla):**
- [ ] Debuggear errores de deploy

### Bloque 2: Prueba en Dispositivos del Cliente (⏱️ ~1.5 horas)

**Tú haces:**
- [ ] Abrir la app en el celular del mesero
- [ ] Abrir la app en la tablet de cocina
- [ ] Abrir la app en el celular del admin/dueño
- [ ] Correr el escenario completo: pedido → cocina → cobro → dashboard
- [ ] Verificar la velocidad del Realtime en la red wifi del local

### Bloque 3: Capacitación & Documentación (⏱️ ~2 horas)

**Tú haces:**
- [ ] Grabar un video corto (3-5 min) mostrando cómo usar cada vista
- [ ] Enseñarle al cliente cómo:
  - Tomar un pedido
  - Ver la cocina
  - Cobrar un pedido
  - Ver las ventas del día
- [ ] Entregar la URL y guardar las credenciales en un lugar seguro

### ✅ Checkpoint Día 11:
```
✓ App en producción con URL pública
✓ Funciona en los dispositivos reales del local
✓ Cliente capacitado
✓ 🎉 PROYECTO ENTREGADO
```

---

## 📊 Resumen Visual del Progreso

```
DÍA  0  ████░░░░░░░░░░░░░░░░░░  Preparación (cuentas, datos)
DÍA  1  ████████░░░░░░░░░░░░░░  Setup + DB + Design System
DÍA  2  ████████████░░░░░░░░░░  Menú Digital + Selector
DÍA  3  ████████████████░░░░░░  Carrito + Envío → EPIC 1 ✅
DÍA  4  ████████████████████░░  KDS Tiempo Real → EPIC 2 ✅
DÍA  5  ██████████████████████  Liquidación → EPIC 3 ✅
DÍA  6  ██████████████████████  Dashboard → EPIC 4 ✅ · MVP COMPLETO 🎉
DÍA  7  ██████████████████████  Pulido Visual + Animaciones
DÍA  8  ██████████████████████  Responsive + Mobile
DÍA  9  ██████████████████████  Testing + QA
DÍA 10  ██████████████████████  Datos Reales + Bugfixes
DÍA 11  ██████████████████████  Deploy + Entrega 🚀
```

---

## 💡 Tips para el Vibecoder

> [!TIP]
> **Cómo pedirle a la IA de forma efectiva:**
> - Siempre referencia el `PROJECT.md` → "Según el PROJECT.md, crea el componente X"
> - Pide un componente a la vez, no toda la página de golpe
> - Después de cada componente, **pruébalo** antes de pedir el siguiente
> - Si algo se ve feo, pide cambios específicos: "hazlo más grande", "cambia el color a X"

> [!WARNING]
> **Errores comunes que evitar:**
> - ❌ No pidas toda la app de un tirón — se rompe
> - ❌ No ignores los checkpoints — si algo falla en el día 3, no avances al día 4
> - ❌ No dejes el Realtime para el final — pruébalo en el día 4 porque es el feature más crítico
> - ❌ No cargues datos reales hasta el día 10 — usa datos de prueba mientras desarrollas

> [!IMPORTANT]
> **Si vas retrasado:**
> - Sacrifica el **Dashboard (EPIC 4)** primero — el cliente puede ver las ventas en Supabase Table Editor temporalmente
> - Reduce los días de pulido UI de 2 a 1
> - El core innegociable es: **Pedidos + KDS + Liquidación** (EPICs 1-3)
