-- ============================================================
-- Corrige un olvido de la migración anterior (cerrar_lectura_publica).
--
-- Esa migración hizo que el servidor se identifique como 'authenticated'
-- ante Supabase en cuanto hay sesión — en TODAS las páginas, incluida
-- /pedidos. Pero 'productos' y 'categorias' se quedaron con la política
-- vieja, que solo dejaba pasar al rol 'anon'. Resultado: en cuanto alguien
-- inicia sesión, el menú deja de calzar con cualquier política y aparece
-- vacío (sin error — RLS filtra, no lanza excepción).
--
-- No hay dato de cliente en el menú, así que no hace falta restringirlo:
-- se deja igual de público que antes (anon) y ADEMÁS se abre a
-- 'authenticated', en vez de reemplazar una cosa por la otra.
-- ============================================================

DROP POLICY IF EXISTS public_read_productos ON productos;
CREATE POLICY public_read_productos ON productos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS public_read_categorias ON categorias;
CREATE POLICY public_read_categorias ON categorias
  FOR SELECT TO anon, authenticated USING (true);
