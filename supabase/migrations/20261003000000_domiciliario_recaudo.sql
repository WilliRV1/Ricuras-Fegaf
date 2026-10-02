-- Migration: el pago al domiciliario como lo lleva el dueño (audio del 1/10/2026)
--
-- Hasta ahora la app contaba solo la comida de los pedidos A DOMICILIO y
-- pagaba "tarifa por producto, con mínimo y tope por día". Él lo lleva así:
--
--   - Cada producto vendido deja $1.500 para el domiciliario, se haya vendido
--     en mesa o a domicilio. No dejan nada las bebidas ni los adicionales,
--     salvo las papas francesas (se piden solas a domicilio muy seguido).
--   - El domiciliario recibe un pago FIJO por noche ($40.000).
--   - Si lo recaudado no alcanza, la diferencia la pone él de su ganancia; si
--     sobra, ese sobrante cubre los días flojos de la misma semana.
--
-- Comprobado contra las ventas reales: 25/9/2026 → 20 unidades = $30.000,
-- faltan $10.000; semana 38 → $9.000; semana 37 → $30.000. Un combo cuenta 1.
--
--   - productos.aporta_domiciliario: qué productos dejan la tarifa. Antes se
--     deducía de la categoría (parámetro categoria_bebidas_id), y eso no
--     alcanza para "adicionales no, papas sí".
--   - parametros: domiciliario_pago_dia reemplaza al mínimo y al máximo.
--   - domiciliario_dias: el pago de un día puntual cuando no fue el fijo
--     ("ese día no vino", "le pagué otra cifra").
--
-- Esta migración solo AGREGA: la app que esté desplegada sigue calculando
-- igual con ella aplicada. Lo que cambia las cifras de la versión vieja
-- (borrar los parámetros retirados, subir el costo de los churrascos) va en
-- 20261003000001 y se aplica junto con el despliegue.

-- ============================================================
-- 1. Qué productos dejan la tarifa
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'aporta_domiciliario'
  ) THEN
    ALTER TABLE public.productos ADD COLUMN aporta_domiciliario BOOLEAN NOT NULL DEFAULT FALSE;

    -- Carga inicial, una sola vez: toda la comida, y de los adicionales solo
    -- las papas francesas. Después se cambia producto por producto.
    UPDATE public.productos p
       SET aporta_domiciliario = TRUE
     WHERE (
             NOT p.es_adicion
             AND NOT EXISTS (
               SELECT 1 FROM public.categorias c
                WHERE c.id = p.categoria_id AND LOWER(BTRIM(c.nombre)) = 'bebidas'
             )
           )
        OR p.nombre ILIKE 'papa%frances%';
  END IF;
END $$;

COMMENT ON COLUMN public.productos.aporta_domiciliario IS
  'TRUE = cada unidad vendida (mesa o domicilio) deja la tarifa del domiciliario. Bebidas y adicionales no; las papas francesas sí.';

CREATE OR REPLACE FUNCTION fijar_aporta_domiciliario(p_producto_id INT, p_aporta BOOLEAN)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  UPDATE productos SET aporta_domiciliario = COALESCE(p_aporta, FALSE) WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fijar_aporta_domiciliario IS
  'Marca si un producto deja la tarifa del domiciliario (admin/dev). RPC aparte de actualizar_producto para no cambiar su firma.';

-- ============================================================
-- 2. Parámetros: pago fijo por día en vez de mínimo y máximo
-- ============================================================
INSERT INTO public.parametros (clave, valor, descripcion) VALUES
  ('domiciliario_pago_dia',
   COALESCE((SELECT valor FROM public.parametros WHERE clave = 'domiciliario_minimo_dia'), 40000),
   'Lo que recibe el domiciliario por cada día trabajado. Si lo que dejan los productos no alcanza, la diferencia sale de la ganancia; si sobra, cubre los días flojos de la semana.')
ON CONFLICT (clave) DO NOTHING;

UPDATE public.parametros
   SET descripcion = 'Lo que deja cada producto vendido (mesa o domicilio) para pagarle al domiciliario. Es la línea "Pago auxiliares" del costeo.'
 WHERE clave = 'domiciliario_tarifa_producto';

-- ============================================================
-- 3. Pago de un día puntual
-- ============================================================
CREATE TABLE IF NOT EXISTS public.domiciliario_dias (
  fecha      DATE PRIMARY KEY,
  pago       INT NOT NULL CHECK (pago >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.domiciliario_dias IS
  'Pago al domiciliario de un día cuando no fue el fijo de parametros.domiciliario_pago_dia. 0 = ese día no se le pagó.';

ALTER TABLE public.domiciliario_dias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_read_domiciliario_dias ON public.domiciliario_dias;
CREATE POLICY authenticated_read_domiciliario_dias ON public.domiciliario_dias
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION fijar_pago_domiciliario(p_fecha DATE, p_pago INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'FECHA_REQUERIDA';
  END IF;

  -- NULL quita el ajuste: el día vuelve al pago fijo.
  IF p_pago IS NULL THEN
    DELETE FROM domiciliario_dias WHERE fecha = p_fecha;
    RETURN;
  END IF;

  IF p_pago < 0 THEN
    RAISE EXCEPTION 'PAGO_INVALIDO';
  END IF;

  INSERT INTO domiciliario_dias (fecha, pago) VALUES (p_fecha, p_pago)
  ON CONFLICT (fecha) DO UPDATE SET pago = EXCLUDED.pago, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fijar_pago_domiciliario IS
  'Fija lo que se le pagó al domiciliario un día puntual (admin/dev). NULL quita el ajuste.';
