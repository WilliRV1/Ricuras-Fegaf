-- Migration: Cerrar el hueco de RLS en arqueos_caja
--
-- El módulo de "Arqueo de Caja" está deshabilitado en el dashboard (a
-- petición de la dueña) pero la tabla y las acciones (`src/app/actions/caja.ts`)
-- siguen existiendo. `arqueos_caja` nunca tuvo Row Level Security habilitado
-- — a diferencia de todas las demás tablas — así que si algún día se vuelve
-- a activar esa pantalla sin revisar esto, quedaría escribible directamente
-- con la clave pública, igual que estaban `pedidos`/`productos` antes de la
-- migración 20260902000000.
--
-- `getResumenDelDia` sí necesita poder LEER esta tabla (para saber si hay un
-- turno abierto y usar su hora de apertura como inicio del día), así que la
-- lectura se mantiene pública; solo se cierra la escritura.

ALTER TABLE public.arqueos_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_arqueos_caja" ON public.arqueos_caja;
CREATE POLICY "public_read_arqueos_caja"
  ON public.arqueos_caja FOR SELECT
  TO anon
  USING (true);

-- Sin políticas de INSERT/UPDATE/DELETE para anon: quedan bloqueadas por
-- defecto. Si se reactiva el módulo de caja, hay que decidir entonces cómo
-- se protege (por ejemplo, una función SECURITY DEFINER como las de pedidos).
