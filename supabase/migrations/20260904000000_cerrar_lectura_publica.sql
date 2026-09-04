-- ============================================================
-- Cierra la lectura pública de las tablas con datos del negocio.
--
-- Hasta ahora, pedidos/detalle_pedidos/pagos_pedido/arqueos_caja tenían
-- SELECT abierto al rol 'anon' (USING (true)): cualquiera con la clave
-- pública del proyecto —visible en el bundle del navegador, es normal que
-- lo sea— podía leerlas directo por la API de Supabase sin haber iniciado
-- sesión en la app. Ahí vive el nombre, teléfono y dirección de los
-- clientes de domicilio, y los arqueos de caja.
--
-- La app ahora firma un JWT propio al leer la sesión (ver
-- src/lib/session.ts:crearTokenSupabase) que Supabase reconoce como
-- 'authenticated' sin necesitar usuarios de Supabase Auth. Las políticas
-- pasan a exigir esa etiqueta.
--
-- categorias y productos NO se tocan: es el menú, no hay dato de cliente
-- ahí, y no hay necesidad de restringirlo.
-- ============================================================

DROP POLICY IF EXISTS public_read_pedidos ON pedidos;
DROP POLICY IF EXISTS authenticated_read_pedidos ON pedidos;
CREATE POLICY authenticated_read_pedidos ON pedidos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_read_detalle_pedidos ON detalle_pedidos;
DROP POLICY IF EXISTS authenticated_read_detalle_pedidos ON detalle_pedidos;
CREATE POLICY authenticated_read_detalle_pedidos ON detalle_pedidos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_read_pagos_pedido ON pagos_pedido;
DROP POLICY IF EXISTS authenticated_read_pagos_pedido ON pagos_pedido;
CREATE POLICY authenticated_read_pagos_pedido ON pagos_pedido
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_read_arqueos_caja ON arqueos_caja;
DROP POLICY IF EXISTS authenticated_read_arqueos_caja ON arqueos_caja;
CREATE POLICY authenticated_read_arqueos_caja ON arqueos_caja
  FOR SELECT TO authenticated USING (true);
