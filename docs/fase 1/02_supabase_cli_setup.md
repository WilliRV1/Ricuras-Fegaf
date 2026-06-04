# Configuración del CLI de Supabase

Este documento detalla los pasos para conectar el proyecto local de Next.js con el proyecto remoto de Supabase utilizando el CLI (Command Line Interface).

## Pasos Realizados

1. **Verificación de Variables de Entorno**
   - El archivo `.env.local` se verificó exitosamente y cuenta con la URL correcta del proyecto (`https://kbvdhtrqktkdgjacsjuh.supabase.co`) y la `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Inicialización Local**
   - Se ejecutó el comando `supabase init` para crear la carpeta `supabase/config.toml` y preparar el entorno de base de datos local (si se requiere).

## Pasos Pendientes (Acción Manual Requerida)

**¡Actualización!** Se ha completado exitosamente de forma remota la vinculación (Link) y el empuje de base de datos (Push).

- **Vinculación:** Se vinculó el proyecto exitosamente a la referencia `kbvdhtrqktkdgjacsjuh`.
- **Migraciones en la Nube:** Las 4 tablas iniciales (categorias, productos, pedidos, detalle_pedidos) han sido subidas y creadas en la base de datos de producción mediante `supabase db push`.

### Últimos ajustes a realizar en el panel web:
1. **Poblar datos (Seed):** Dado que el `push` solo sube estructuras, copia el contenido del archivo `supabase/seed.sql` y pégalo en el SQL Editor de tu Dashboard de Supabase, y ejecútalo para tener datos iniciales.
2. **Habilitar Realtime:** En el Dashboard de Supabase ve a **Database** -> **Replication** y habilita Insert/Update/Delete para la tabla **pedidos**.
