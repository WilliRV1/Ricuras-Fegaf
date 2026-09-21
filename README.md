# Ricuras Fegaf — Sistema de gestión operativa

App para el local: toma de pedidos, tablero de cocina en tiempo real,
liquidación/cobro, cartera de deudas y dashboard de administración
(costeo por recetas, reportes de utilidad, personal).

Next.js 16 (App Router) + Supabase (Postgres, RLS, Realtime). El login es
propio, por PIN de 4 dígitos, con cookie firmada — no usa Supabase Auth.

## Levantar el proyecto

```bash
npm install
cp .env.example .env.local   # y completar las variables
npm run dev                  # http://localhost:3000
```

Variables necesarias (ver `.env.example` para el detalle):

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión a Supabase |
| `SESSION_SECRET` | Firma de la cookie de sesión. **Obligatoria en producción.** |
| `SUPABASE_JWT_SECRET` | Firma del token que le prueba a Supabase que hay sesión y con qué rol |

Las mismas variables deben existir en Vercel.

## Cómo está protegida la base

La app se conecta con la clave pública (`anon`), que cualquiera puede ver
en el navegador. Por eso la base no confía en la app:

- **Lectura**: las tablas del negocio (`pedidos`, `pagos_pedido`, `insumos`…)
  solo se leen con un JWT `authenticated` que firma el servidor a partir de
  la sesión por PIN (`src/lib/session.ts:crearTokenSupabase`). El menú
  (`productos`, `categorias`) sí es público.
- **Escritura**: nunca directa a las tablas; siempre por funciones
  `SECURITY DEFINER` que **exigen el rol** que viaja en ese JWT
  (`exigir_rol`, migración `20260916000000`). Cocina no puede crear pedidos,
  caja no puede cambiar precios, y sin sesión no se puede nada.
- **Acciones delicadas** (anular un pedido, administrar personal) piden el
  PIN otra vez y la base lo verifica ella misma.
- **Sesiones**: la cookie lleva la versión de sesión del usuario; desactivar
  a alguien, resetearle el PIN, forzarle el cambio o que él mismo cambie su
  PIN invalida sus sesiones abiertas en menos de 5 minutos.
- **PIN**: cada quien lo cambia cuando quiera desde su nombre (arriba a la
  derecha → "Cambiar mi PIN"). Administración puede resetear (temporal) o
  forzar el cambio, nunca ver ni fijar el PIN definitivo de otro.

## Cifras del negocio (tabla `parametros`)

Tarifa y mínimo del domiciliario, minutos de anticipación de los programados
en cocina y categoría de bebidas viven en la base y se editan desde el
dashboard ("Parámetros del Negocio"), no en el código.

Las bebidas (gaseosas, aguas, jugos) se crean como productos "que se compran
hechos": la base les crea un insumo propio con receta de 1 unidad y su costo
sale de las compras registradas, igual que la hoja PRECIOS del Excel. Seed
inicial con los sabores del Excel: `supabase/seed_bebidas_2026.sql`.

Guía para la dueña sobre los rangos de fechas:
`docs/Guia - Rangos de fechas en el dashboard.pdf`.

## Base de datos

Las migraciones viven en `supabase/migrations/` y se aplican con:

```bash
node scripts/aplicar-migracion.mjs supabase/migrations/<archivo>.sql
```

**No hay entorno de pruebas: la base es la de producción.** Antes de aplicar
una migración, pruébala con los scripts de `scripts/test-*.mjs`: corren
contra la base real dentro de una transacción que termina en `ROLLBACK`, así
que validan el SQL sin dejar rastro.

```bash
npm run test:db:all        # precios, caja, lectura pública, cobertura RLS, autorización, PIN/bebidas
npm run test:autorizacion  # roles, PIN en la base, validaciones, versión de sesión
npm run test:pin-bebidas   # cambio de PIN, forzar cambio, productos que se compran hechos, parámetros
npm run test:usuarios      # usuarios y PIN
npm run test:acceso        # control de acceso, contra la app corriendo
```

Cuando una migración cambia la firma de una función, hay que borrar todas
las versiones antes de recrearla (`CREATE OR REPLACE` con un parámetro nuevo
crea una sobrecarga y rompe las llamadas). Ver el bloque `DO` que usan las
migraciones existentes.

## Estructura

```
src/app/actions/     server actions (cada una vuelve a exigir sesión y rol)
src/app/<ruta>/      páginas: /login, /pedidos, /cocina, /liquidacion, /dashboard
src/components/      UI por pantalla + src/components/ui (piezas comunes)
src/hooks/           carrito y suscripciones realtime
src/lib/session.ts   cookie firmada, JWT para Supabase, permisos por rol
src/proxy.ts         control de acceso por ruta (Next 16)
supabase/migrations/ esquema, RLS y funciones
scripts/             pruebas contra la base (ROLLBACK) y aplicar migraciones
```

## Roles

| Rol | Pantallas |
| --- | --- |
| `cocina` | solo `/cocina` |
| `cajero` | `/pedidos`, `/cocina`, `/liquidacion` |
| `admin`, `dev` | todo, incluido `/dashboard` |
