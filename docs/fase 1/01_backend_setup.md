# Backend Setup - Fase 1

## Tareas Completadas

1. **Creación de Migración Inicial**
   - Archivo creado en: `supabase/migrations/20260604000000_initial_schema.sql`
   - Tablas creadas:
     - `categorias`
     - `productos`
     - `pedidos`
     - `detalle_pedidos`
   - Se configuraron las Primary Keys, Foreign Keys, valores por defecto (UUID, timestamps) y los borrados en cascada para mantener la integridad relacional.

2. **Creación de Datos Iniciales (Seed)**
   - Archivo creado en: `supabase/seed.sql`
   - Se agregaron las categorías iniciales: Pizzas, Bebidas, Postres.
   - Se insertaron productos iniciales y se asociaron a sus respectivas categorías dinámicamente.

3. **Configuración de los Clientes de Supabase**
   - Cliente de Navegador (Browser Client): `src/lib/supabase/client.ts` (usa `@supabase/ssr`).
   - Cliente de Servidor (Server Client): `src/lib/supabase/server.ts` (maneja correctamente el paso y lectura de cookies en componentes de servidor de Next.js).
   
4. **Generación de Tipos de TypeScript**
   - Archivo creado en: `src/lib/supabase/database.types.ts`
   - Tipos estáticos para tener autocompletado en el front y mantener la sincronía del modelo relacional en Typescript.

## Próximos Pasos (Manuales en la Plataforma de Supabase)

- Ejecutar el código SQL en el editor web de Supabase para generar el esquema de las tablas.
- Ejecutar el código Seed en el editor web para popular la base de datos con los registros de prueba.
- Habilitar `Realtime` en la tabla `pedidos`.
- Conectar el proyecto y probar las variables de entorno en `.env.local`.
