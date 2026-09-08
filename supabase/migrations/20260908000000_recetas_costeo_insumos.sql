-- Migration: Fase 2 / Módulo 6 — Constructor de Recetas y Costeo
--
-- Digitaliza la hoja "Costeo" del Excel de la dueña
-- (Control venta diaria Ricuras Fegaf 2026 - CAJAS.xlsx): cada insumo tiene
-- un historial de compras (precio + rendimiento por lote, igual que la hoja
-- "PRECIOS" — ej. queso mozarella con dos filas de compras distintas), y el
-- costo de un producto sale de sumar lo que cuesta cada insumo de su receta
-- según su costo vigente. Se modela como lotes y no como un precio fijo por
-- insumo para no perder ese historial, y porque esa misma tabla de lotes
-- cubre el "registro de compras a proveedores" del Módulo 7 — no hace falta
-- capturar la compra dos veces.
--
-- Igual que pedidos/pagos_pedido: datos financieros, lectura solo para
-- 'authenticated' (ver 20260904000000_cerrar_lectura_publica.sql), y
-- escritura únicamente vía funciones SECURITY DEFINER — nada de política de
-- INSERT/UPDATE directa.

-- ============================================================
-- 1. Tablas
-- ============================================================

CREATE TABLE public.insumos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    unidad_base VARCHAR(50) NOT NULL, -- ej. 'gramo', 'unidad', 'mililitro'
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.insumos IS
  'Catálogo de materias primas. El precio no vive aquí: cada compra real queda en compras_insumo.';

CREATE TABLE public.compras_insumo (
    id SERIAL PRIMARY KEY,
    insumo_id INT REFERENCES public.insumos(id) ON DELETE CASCADE NOT NULL,
    precio_compra NUMERIC NOT NULL CHECK (precio_compra > 0),
    rendimiento NUMERIC NOT NULL CHECK (rendimiento > 0), -- cuántas unidad_base rinde esta compra
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.compras_insumo IS
  'Un renglón por cada compra real de un insumo (equivalente a cada fila de la hoja PRECIOS del Excel). También es el registro de compras a proveedores del Módulo 7.';

CREATE TABLE public.receta_items (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES public.productos(id) ON DELETE CASCADE NOT NULL,
    insumo_id INT REFERENCES public.insumos(id) ON DELETE RESTRICT NOT NULL,
    cantidad_usada NUMERIC NOT NULL CHECK (cantidad_usada > 0), -- en la unidad_base del insumo
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (producto_id, insumo_id)
);

COMMENT ON TABLE public.receta_items IS
  'Receta de un producto: cuánto de cada insumo lleva (equivalente a la tabla "Proceso" de la hoja Costeo del Excel).';

-- ============================================================
-- 2. RLS: solo lectura authenticated, escritura solo por RPC
-- ============================================================

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_read_insumos ON public.insumos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_read_compras_insumo ON public.compras_insumo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_read_receta_items ON public.receta_items
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Vistas de costeo
-- ============================================================

CREATE VIEW public.vw_insumo_costo_actual AS
SELECT
  i.id AS insumo_id,
  i.nombre,
  i.unidad_base,
  AVG(ultimos.precio_compra / ultimos.rendimiento) AS costo_unitario
FROM public.insumos i
JOIN LATERAL (
  SELECT ci.precio_compra, ci.rendimiento
  FROM public.compras_insumo ci
  WHERE ci.insumo_id = i.id
  ORDER BY ci.fecha DESC, ci.id DESC
  LIMIT 5
) ultimos ON true
GROUP BY i.id, i.nombre, i.unidad_base;

COMMENT ON VIEW public.vw_insumo_costo_actual IS
  'Costo por unidad_base de cada insumo: promedio de sus últimos 5 lotes de compra. Con un solo lote, el costo es el de ese lote; con varios (gas, aceite, etc.) se promedia, igual que la fila "PROMEDIO" del Excel.';

CREATE VIEW public.vw_producto_costos AS
SELECT
  p.id AS producto_id,
  p.nombre,
  p.precio,
  COALESCE(SUM(ri.cantidad_usada * vc.costo_unitario), 0) AS costo_total,
  CASE
    WHEN p.precio > 0
      THEN (p.precio - COALESCE(SUM(ri.cantidad_usada * vc.costo_unitario), 0)) / p.precio
    ELSE NULL
  END AS margen
FROM public.productos p
LEFT JOIN public.receta_items ri ON ri.producto_id = p.id
LEFT JOIN public.vw_insumo_costo_actual vc ON vc.insumo_id = ri.insumo_id
GROUP BY p.id, p.nombre, p.precio;

COMMENT ON VIEW public.vw_producto_costos IS
  'Costo total y margen de cada producto, sumando su receta contra el costo vigente de cada insumo.';

-- ============================================================
-- 4. RPCs SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION crear_insumo(p_nombre VARCHAR, p_unidad_base VARCHAR)
RETURNS INT AS $$
DECLARE
  v_insumo_id INT;
BEGIN
  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF BTRIM(COALESCE(p_unidad_base, '')) = '' THEN
    RAISE EXCEPTION 'UNIDAD_REQUERIDA';
  END IF;

  INSERT INTO insumos (nombre, unidad_base)
  VALUES (BTRIM(p_nombre), BTRIM(p_unidad_base))
  RETURNING id INTO v_insumo_id;

  RETURN v_insumo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION crear_insumo IS
  'Da de alta un insumo en el catálogo. El precio se registra aparte, con registrar_compra_insumo.';

CREATE OR REPLACE FUNCTION registrar_compra_insumo(
  p_insumo_id INT,
  p_precio_compra NUMERIC,
  p_rendimiento NUMERIC,
  p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS INT AS $$
DECLARE
  v_compra_id INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM insumos WHERE id = p_insumo_id) THEN
    RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
  END IF;

  IF p_precio_compra IS NULL OR p_precio_compra <= 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  IF p_rendimiento IS NULL OR p_rendimiento <= 0 THEN
    RAISE EXCEPTION 'RENDIMIENTO_INVALIDO';
  END IF;

  INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento, fecha)
  VALUES (p_insumo_id, p_precio_compra, p_rendimiento, COALESCE(p_fecha, CURRENT_DATE))
  RETURNING id INTO v_compra_id;

  RETURN v_compra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION registrar_compra_insumo IS
  'Registra un lote de compra de un insumo (precio + cuánto rindió). Alimenta el costo vigente del insumo y sirve como registro de compras a proveedores.';

CREATE OR REPLACE FUNCTION guardar_receta(p_producto_id INT, p_items JSONB)
RETURNS VOID AS $$
DECLARE
  v_faltantes INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM productos WHERE id = p_producto_id) THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  IF p_items IS NULL THEN
    RAISE EXCEPTION 'ITEMS_REQUERIDOS';
  END IF;

  -- Todo insumo referenciado debe existir, igual que create_order_with_details
  -- valida que cada producto_id exista antes de insertar el pedido.
  SELECT COUNT(*) INTO v_faltantes
  FROM jsonb_array_elements(p_items) AS it
  WHERE NOT EXISTS (SELECT 1 FROM insumos i WHERE i.id = (it->>'insumo_id')::INT);

  IF v_faltantes > 0 THEN
    RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
  END IF;

  DELETE FROM receta_items WHERE producto_id = p_producto_id;

  INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada)
  SELECT p_producto_id, (it->>'insumo_id')::INT, (it->>'cantidad_usada')::NUMERIC
  FROM jsonb_array_elements(p_items) AS it
  WHERE (it->>'cantidad_usada')::NUMERIC > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION guardar_receta IS
  'Reemplaza por completo la receta de un producto con la lista de insumos+cantidades recibida.';
