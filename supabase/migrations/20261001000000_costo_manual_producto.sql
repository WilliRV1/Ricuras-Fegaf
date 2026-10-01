-- Migration: costo manual por producto + precios nuevos del churrasco
--
-- Hasta ahora el costo de un producto salía SOLO de su receta (insumos ×
-- últimas compras). La dueña lleva el costeo en su Excel y quiere poder
-- escribir el costo directamente, igual que el precio, sin armar la receta.
--
--   - productos.costo_manual: si no es NULL, manda sobre la receta.
--   - vw_producto_costos: costo_total = costo_manual o, si no hay, el de la
--     receta. Como reportes.ts y la pantalla de Recetas leen costo_total, la
--     utilidad y el margen usan el costo manual sin más cambios.
--   - fijar_costo_manual(): RPC aparte de actualizar_producto para no cambiar
--     su firma (el código desplegado la sigue llamando igual).
--
-- OJO con el costo del Excel: su costeo incluye "Pago auxiliares $1.500" por
-- producto, y la app ya resta esa tarifa en el pago al domiciliario. El costo
-- manual se escribe SIN esa línea para no restarla dos veces.
--
-- Churrasco (pedido del 1/10/2026): 200 gr a $30.000 (costo 17.728 − 1.500)
-- y 250 gr a $33.000 (costo 18.858 − 1.500). Los pedidos ya hechos no
-- cambian: el precio queda congelado en detalle_pedidos.precio_unitario.

-- ============================================================
-- 1. Columna
-- ============================================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS costo_manual INT NULL
  CHECK (costo_manual IS NULL OR costo_manual >= 0);

COMMENT ON COLUMN public.productos.costo_manual IS
  'Costo escrito a mano (pesos). Si no es NULL manda sobre el de la receta. Sin el pago al domiciliario por producto: ese se resta aparte.';

-- ============================================================
-- 2. Vista de costos: el manual manda sobre la receta
-- ============================================================
DROP VIEW IF EXISTS public.vw_producto_costos;

CREATE VIEW public.vw_producto_costos
WITH (security_invoker = true) AS
WITH receta AS (
  SELECT
    p.id AS producto_id,
    COALESCE(SUM(ri.cantidad_usada * vc.costo_unitario), 0) AS costo_receta,
    COUNT(ri.id)::INT AS insumos_en_receta,
    COUNT(ri.id) FILTER (WHERE vc.costo_unitario IS NULL)::INT AS insumos_sin_costo
  FROM public.productos p
  LEFT JOIN public.receta_items ri ON ri.producto_id = p.id
  LEFT JOIN public.vw_insumo_costo_actual vc ON vc.insumo_id = ri.insumo_id
  GROUP BY p.id
)
SELECT
  p.id AS producto_id,
  p.nombre,
  p.precio,
  COALESCE(p.costo_manual::NUMERIC, r.costo_receta) AS costo_total,
  CASE
    WHEN p.precio > 0
      THEN (p.precio - COALESCE(p.costo_manual::NUMERIC, r.costo_receta)) / p.precio
    ELSE NULL
  END AS margen,
  r.insumos_en_receta,
  r.insumos_sin_costo,
  p.costo_manual,
  r.costo_receta
FROM public.productos p
JOIN receta r ON r.producto_id = p.id;

COMMENT ON VIEW public.vw_producto_costos IS
  'Costo total y margen de cada producto. costo_manual no NULL → manda sobre la receta. Sin costo manual: insumos_en_receta = 0 → sin receta; insumos_sin_costo > 0 → el costo está incompleto (falta registrar compras).';

-- ============================================================
-- 3. Fijar / quitar el costo manual
-- ============================================================
CREATE OR REPLACE FUNCTION fijar_costo_manual(p_producto_id INT, p_costo INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF p_costo IS NOT NULL AND p_costo < 0 THEN
    RAISE EXCEPTION 'COSTO_INVALIDO';
  END IF;

  UPDATE productos SET costo_manual = p_costo WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fijar_costo_manual IS
  'Fija el costo manual de un producto (admin/dev). NULL lo quita y el costo vuelve a salir de la receta.';

-- ============================================================
-- 4. Precios y costos nuevos del churrasco
-- ============================================================
-- En una base recién creada (migraciones antes del seed) no hay productos:
-- ahí no hay nada que actualizar y seed.sql ya trae los precios nuevos. Con
-- productos cargados, cada UPDATE debe tocar exactamente un churrasco.
DO $$
DECLARE
  v_filas INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM productos) THEN
    RETURN;
  END IF;

  UPDATE productos SET precio = 30000, costo_manual = 16228
   WHERE nombre ILIKE '%churrasco%' AND nombre ILIKE '%200%';
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 churrasco de 200 gr y se encontraron %', v_filas;
  END IF;

  UPDATE productos SET precio = 33000, costo_manual = 17358
   WHERE nombre ILIKE '%churrasco%' AND nombre ILIKE '%250%';
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 churrasco de 250 gr y se encontraron %', v_filas;
  END IF;
END $$;
