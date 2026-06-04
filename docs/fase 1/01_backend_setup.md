# Backend Setup - Fase 1

## Tareas Completadas

1. **Creación y Refinamiento del Esquema de Base de Datos**
   - Migración Inicial (`20260604000000_initial_schema.sql`)
   - Migración de Refinamiento V2 (`20260604000001_schema_v2_to_serial.sql`)
   - **Tablas creadas y ajustadas a `PROJECT.md`:**
     - `categorias`: Se agregó orden.
     - `productos`: Se agregó `activo` y `es_adicion`.
     - `pedidos`: Se agregaron datos completos de domicilio, métodos de pago, desglose de totales (`subtotal`, `recargo`, `total`) y cierres.
     - `detalle_pedidos`: Se agregaron las `notas` para cocina.
   - **Importante:** Todos los IDs primarios se cambiaron de `UUID` a `SERIAL` (autoincrementables numéricos) para asegurar que el restaurante pueda manejar comandas físicas de manera fácil (Pedido #1, #2).

2. **Creación de Datos Iniciales (Seed) del Menú Completo**
   - Archivo: `supabase/seed.sql`
   - Se procesó el archivo Markdown provisto por el restaurante y se programó un script SQL capaz de insertar dinámicamente toda la carta.
   - **Insertados:** 8 categorías, 41 productos y 10 adiciones completas con sus respectivos precios en pesos colombianos.

3. **Configuración de los Clientes de Supabase**
   - Cliente de Navegador: `src/lib/supabase/client.ts`
   - Cliente de Servidor: `src/lib/supabase/server.ts` (con manejo de cookies).
   
4. **Generación de Tipos de TypeScript**
   - Archivo: `src/lib/supabase/database.types.ts`
   - Se ajustó manualmente para reflejar de forma exacta el esquema V2 (IDs numéricos, campos nuevos, etc.) asegurando autocompletado en React.

## Próximos Pasos (Acción Manual Requerida)

- Ejecutar el código de `supabase/seed.sql` en el SQL Editor de Supabase para llenar la base de datos con toda la carta real.
- Habilitar `Realtime` en la tabla `pedidos` desde la vista "Table Editor" para las notificaciones de cocina.
