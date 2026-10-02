-- Migration: precios de insumos enlazados, como las fórmulas del Excel
--
-- Los insumos se cargaron copiando los VALORES del Excel, sin sus fórmulas.
-- Allá el queso se cambia en una celda de la hoja PRECIOS y se actualizan la
-- hamburguesa, la salchipapa, el adicional y los combos; acá "Queso tajado",
-- "queso" y "Queso Mozarella PAR" quedaron como tres insumos sueltos, y los
-- combos llevan un insumo "Incluye: HAMBURGUESA SENCILLA" con el costo de ese
-- día congelado. Subir el queso el 2/10/2026 no movió ninguna hamburguesa.
--
-- Los insumos se dejan tal cual están en el Excel (no se fusionan ni se
-- renombran) y se les devuelve el enlace:
--
--   - insumos.enlace_insumo_id: toma el precio de otro insumo (=+H10).
--   - insumos.enlace_producto_id: toma el costo de un producto del menú
--     (=+H30 en los combos).
--   - insumos.enlace_factor: multiplica lo enlazado (=+H30*2, =+H571/2).
--   - El costo propio de un insumo pasa a ser el de su ÚLTIMA compra, como
--     hace el Excel con el queso y la carne. El promedio de las últimas 5
--     queda solo para los que se marquen (insumos.promedia: gas, aceite).
--   - eliminar_compra_insumo: una compra mal escrita se puede borrar.
--   - detalle_pedidos.costo_unitario: foto del costo al vender. Sin ella,
--     cada subida de precio cambiaría la utilidad de los meses pasados,
--     porque los reportes costeaban todo con el costo de hoy.
--
-- Un solo nivel de enlace en cada sentido: un insumo enlazado no puede ser
-- el origen de otro, y un producto del que cuelgan insumos no puede llevar
-- en su receta insumos que cuelguen de otro producto. Así el costo se
-- resuelve con vistas por capas, sin recursión.

-- ============================================================
-- 1. Foto del costo al vender (ANTES de tocar las vistas: se llena
--    con el costo vigente hoy, el mismo con el que se venía reportando)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_pedidos' AND column_name = 'costo_unitario'
  ) THEN
    ALTER TABLE public.detalle_pedidos ADD COLUMN costo_unitario NUMERIC NULL;

    UPDATE public.detalle_pedidos d
       SET costo_unitario = v.costo_total
      FROM public.vw_producto_costos v
     WHERE v.producto_id = d.producto_id
       AND (v.costo_manual IS NOT NULL OR v.insumos_en_receta > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.detalle_pedidos.costo_unitario IS
  'Costo del producto cuando se vendió (vw_producto_costos.costo_total). NULL = no tenía costo: los reportes usan el actual.';

-- ============================================================
-- 2. Enlaces
-- ============================================================
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS enlace_insumo_id   INT NULL REFERENCES public.insumos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enlace_producto_id INT NULL REFERENCES public.productos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enlace_factor      NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS promedia           BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_un_solo_enlace;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_un_solo_enlace
  CHECK (enlace_insumo_id IS NULL OR enlace_producto_id IS NULL);

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_enlace_factor_positivo;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_enlace_factor_positivo CHECK (enlace_factor > 0);

ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_no_se_enlaza_a_si_mismo;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_no_se_enlaza_a_si_mismo
  CHECK (enlace_insumo_id IS NULL OR enlace_insumo_id <> id);

COMMENT ON COLUMN public.insumos.enlace_insumo_id IS
  'Si no es NULL, este insumo no tiene precio propio: vale lo que valga ese otro insumo × enlace_factor.';
COMMENT ON COLUMN public.insumos.enlace_producto_id IS
  'Si no es NULL, este insumo vale el costo de ese producto del menú × enlace_factor (la hamburguesa dentro de un combo).';
COMMENT ON COLUMN public.insumos.promedia IS
  'TRUE = el costo es el promedio de las últimas 5 compras (gas, aceite). FALSE = la última compra.';

-- ============================================================
-- 3. Vistas de costo, por capas
-- ============================================================
DROP VIEW IF EXISTS public.vw_producto_costos;
DROP VIEW IF EXISTS public.vw_insumo_costo_actual;
DROP VIEW IF EXISTS public.vw_producto_costo_base;
DROP VIEW IF EXISTS public.vw_insumo_costo_base;
DROP VIEW IF EXISTS public.vw_insumo_costo_propio;

-- 3.1 Lo que dicen sus propias compras
CREATE VIEW public.vw_insumo_costo_propio
WITH (security_invoker = true) AS
SELECT
  i.id AS insumo_id,
  CASE WHEN i.promedia THEN promedio.costo ELSE ultima.costo END AS costo_unitario,
  ultima.fecha AS fecha_ultima_compra
FROM public.insumos i
LEFT JOIN LATERAL (
  SELECT ci.precio_compra / ci.rendimiento AS costo, ci.fecha
  FROM public.compras_insumo ci
  WHERE ci.insumo_id = i.id
  ORDER BY ci.fecha DESC, ci.id DESC
  LIMIT 1
) ultima ON true
LEFT JOIN LATERAL (
  SELECT AVG(u.precio_compra / u.rendimiento) AS costo
  FROM (
    SELECT ci.precio_compra, ci.rendimiento
    FROM public.compras_insumo ci
    WHERE ci.insumo_id = i.id
    ORDER BY ci.fecha DESC, ci.id DESC
    LIMIT 5
  ) u
) promedio ON true;

-- 3.2 Resuelto el enlace a otro insumo
CREATE VIEW public.vw_insumo_costo_base
WITH (security_invoker = true) AS
SELECT
  i.id AS insumo_id,
  CASE
    WHEN i.enlace_insumo_id IS NOT NULL THEN origen.costo_unitario * i.enlace_factor
    ELSE propio.costo_unitario
  END AS costo_unitario,
  CASE
    WHEN i.enlace_insumo_id IS NOT NULL THEN origen.fecha_ultima_compra
    ELSE propio.fecha_ultima_compra
  END AS fecha_ultima_compra
FROM public.insumos i
JOIN public.vw_insumo_costo_propio propio ON propio.insumo_id = i.id
LEFT JOIN public.vw_insumo_costo_propio origen ON origen.insumo_id = i.enlace_insumo_id;

-- 3.3 Costo de los productos de los que cuelgan otros (su receta no lleva
--     insumos enlazados a un producto: lo garantiza enlazar_insumo)
CREATE VIEW public.vw_producto_costo_base
WITH (security_invoker = true) AS
SELECT
  p.id AS producto_id,
  COALESCE(p.costo_manual::NUMERIC, SUM(ri.cantidad_usada * b.costo_unitario)) AS costo_total
FROM public.productos p
LEFT JOIN public.receta_items ri ON ri.producto_id = p.id
LEFT JOIN public.vw_insumo_costo_base b ON b.insumo_id = ri.insumo_id
GROUP BY p.id;

-- 3.4 Costo vigente de cada insumo. Conserva las columnas de siempre
--     (insumo_id, nombre, unidad_base, costo_unitario) y agrega de dónde sale.
CREATE VIEW public.vw_insumo_costo_actual
WITH (security_invoker = true) AS
SELECT
  i.id AS insumo_id,
  i.nombre,
  i.unidad_base,
  CASE
    WHEN i.enlace_producto_id IS NOT NULL THEN pb.costo_total * i.enlace_factor
    ELSE b.costo_unitario
  END AS costo_unitario,
  CASE
    WHEN i.enlace_producto_id IS NOT NULL THEN 'producto'
    WHEN i.enlace_insumo_id IS NOT NULL THEN 'insumo'
    ELSE 'compra'
  END AS origen,
  b.fecha_ultima_compra
FROM public.insumos i
JOIN public.vw_insumo_costo_base b ON b.insumo_id = i.id
LEFT JOIN public.vw_producto_costo_base pb ON pb.producto_id = i.enlace_producto_id;

COMMENT ON VIEW public.vw_insumo_costo_actual IS
  'Costo por unidad_base de cada insumo: su última compra (o el promedio de 5 si promedia), o lo que valga el insumo o producto al que está enlazado. NULL si no hay de dónde sacarlo.';

-- 3.5 Costo y margen de cada producto (igual que en 20261001000000)
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
-- 4. Enlazar, corregir y borrar
-- ============================================================
CREATE OR REPLACE FUNCTION enlazar_insumo(
  p_insumo_id INT,
  p_enlace_insumo_id INT,
  p_enlace_producto_id INT,
  p_factor NUMERIC DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF NOT EXISTS (SELECT 1 FROM insumos WHERE id = p_insumo_id) THEN
    RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
  END IF;

  IF p_enlace_insumo_id IS NOT NULL AND p_enlace_producto_id IS NOT NULL THEN
    RAISE EXCEPTION 'UN_SOLO_ENLACE';
  END IF;

  IF COALESCE(p_factor, 1) <= 0 THEN
    RAISE EXCEPTION 'FACTOR_INVALIDO';
  END IF;

  IF p_enlace_insumo_id IS NOT NULL THEN
    IF p_enlace_insumo_id = p_insumo_id THEN
      RAISE EXCEPTION 'ENLACE_CIRCULAR';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM insumos WHERE id = p_enlace_insumo_id) THEN
      RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
    END IF;
    -- El origen tiene que tener precio propio, y este insumo no puede ser a
    -- su vez el origen de otro.
    IF EXISTS (
         SELECT 1 FROM insumos
          WHERE id = p_enlace_insumo_id
            AND (enlace_insumo_id IS NOT NULL OR enlace_producto_id IS NOT NULL)
       )
       OR EXISTS (SELECT 1 FROM insumos WHERE enlace_insumo_id = p_insumo_id) THEN
      RAISE EXCEPTION 'ENLACE_EN_CADENA';
    END IF;
  END IF;

  IF p_enlace_producto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM productos WHERE id = p_enlace_producto_id) THEN
      RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
    END IF;
    -- El producto no puede llevar este mismo insumo en su receta.
    IF EXISTS (
         SELECT 1 FROM receta_items
          WHERE producto_id = p_enlace_producto_id AND insumo_id = p_insumo_id
       ) THEN
      RAISE EXCEPTION 'ENLACE_CIRCULAR';
    END IF;
    -- Un solo nivel: ni el producto de origen lleva insumos que cuelguen de
    -- otro producto, ni este insumo está en la receta de un producto del que
    -- ya cuelgan otros, ni es el origen de otro insumo.
    IF EXISTS (
         SELECT 1 FROM receta_items ri JOIN insumos i ON i.id = ri.insumo_id
          WHERE ri.producto_id = p_enlace_producto_id AND i.enlace_producto_id IS NOT NULL
       )
       OR EXISTS (
         SELECT 1 FROM receta_items ri JOIN insumos o ON o.enlace_producto_id = ri.producto_id
          WHERE ri.insumo_id = p_insumo_id
       )
       OR EXISTS (SELECT 1 FROM insumos WHERE enlace_insumo_id = p_insumo_id) THEN
      RAISE EXCEPTION 'ENLACE_EN_CADENA';
    END IF;
  END IF;

  UPDATE insumos
     SET enlace_insumo_id   = p_enlace_insumo_id,
         enlace_producto_id = p_enlace_producto_id,
         enlace_factor      = CASE
                                WHEN p_enlace_insumo_id IS NULL AND p_enlace_producto_id IS NULL THEN 1
                                ELSE COALESCE(p_factor, 1)
                              END
   WHERE id = p_insumo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION enlazar_insumo IS
  'Hace que un insumo tome su precio de otro insumo o del costo de un producto, × factor (admin/dev). Los dos en NULL quita el enlace.';

CREATE OR REPLACE FUNCTION eliminar_compra_insumo(p_compra_id INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  DELETE FROM compras_insumo WHERE id = p_compra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_NO_ENCONTRADA';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION eliminar_compra_insumo IS
  'Borra una compra mal escrita (admin/dev). El costo del insumo vuelve a salir de la compra anterior.';

CREATE OR REPLACE FUNCTION actualizar_insumo(
  p_insumo_id INT,
  p_nombre VARCHAR,
  p_unidad_base VARCHAR,
  p_promedia BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF BTRIM(COALESCE(p_unidad_base, '')) = '' THEN
    RAISE EXCEPTION 'UNIDAD_REQUERIDA';
  END IF;

  UPDATE insumos
     SET nombre = BTRIM(p_nombre),
         unidad_base = BTRIM(p_unidad_base),
         promedia = COALESCE(p_promedia, FALSE)
   WHERE id = p_insumo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION actualizar_insumo IS
  'Corrige el nombre o la unidad de un insumo y decide si su costo se promedia (admin/dev).';

-- ============================================================
-- 5. Foto del costo en cada línea nueva
-- ============================================================
-- Trigger y no un cambio en create_order_with_details: así queda cubierta
-- cualquier vía que inserte líneas (crear, editar) sin tocar sus firmas.
CREATE OR REPLACE FUNCTION fijar_costo_de_linea()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.costo_unitario IS NULL THEN
    SELECT CASE WHEN v.costo_manual IS NOT NULL OR v.insumos_en_receta > 0 THEN v.costo_total END
      INTO NEW.costo_unitario
      FROM vw_producto_costos v
     WHERE v.producto_id = NEW.producto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_fijar_costo_de_linea ON public.detalle_pedidos;
CREATE TRIGGER trg_fijar_costo_de_linea
  BEFORE INSERT ON public.detalle_pedidos
  FOR EACH ROW EXECUTE FUNCTION fijar_costo_de_linea();
