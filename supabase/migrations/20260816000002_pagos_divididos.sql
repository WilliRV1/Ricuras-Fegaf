-- Migration: Pagos divididos (una parte en Nequi, otra en efectivo, etc.)
--
-- Hasta ahora `pedidos.metodo_pago` era un solo texto, así que un pago partido
-- no cabía en el modelo. Se agrega una tabla de pagos por pedido.
--
-- Compatibilidad: los pedidos viejos NO tienen filas en `pagos_pedido`; los
-- reportes deben caer a `pedidos.metodo_pago` + `pedidos.total` cuando no haya
-- filas. Los pedidos nuevos siempre escriben aquí, incluso con un solo método.

-- ============================================================
-- 1. Tabla de pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pagos_pedido (
  id          SERIAL PRIMARY KEY,
  pedido_id   INT NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  metodo      VARCHAR NOT NULL,
  -- Monto realmente cobrado por ese método (en datáfono ya incluye su 5%)
  monto       NUMERIC NOT NULL CHECK (monto > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_pedido_pedido_id ON public.pagos_pedido(pedido_id);

COMMENT ON TABLE public.pagos_pedido IS
  'Pagos de un pedido. Varias filas = pago dividido. Sin filas = pedido anterior a esta función.';
COMMENT ON COLUMN public.pagos_pedido.monto IS
  'Monto cobrado por ese método. En datáfono incluye el recargo del 5% de su parte.';

-- ============================================================
-- 2. RLS — mismas reglas que el resto de la app (terminales del local)
-- ============================================================
ALTER TABLE public.pagos_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_pagos_pedido" ON public.pagos_pedido;
CREATE POLICY "public_read_pagos_pedido"
  ON public.pagos_pedido FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "public_insert_pagos_pedido" ON public.pagos_pedido;
CREATE POLICY "public_insert_pagos_pedido"
  ON public.pagos_pedido FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_pagos_pedido" ON public.pagos_pedido;
CREATE POLICY "public_delete_pagos_pedido"
  ON public.pagos_pedido FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- 3. RPC: cerrar un pedido con uno o varios pagos
--    Calcula el recargo del datáfono SOLO sobre la parte pagada con datáfono
--    y valida que los montos cuadren con lo que se debe cobrar.
-- ============================================================
CREATE OR REPLACE FUNCTION close_order_with_payments(
  p_pedido_id INT,
  -- [{ "metodo": "efectivo", "monto": 30000 }, { "metodo": "datafono", "monto": 20000 }]
  p_pagos JSONB
) RETURNS NUMERIC AS $$
DECLARE
  v_estado          VARCHAR;
  v_subtotal        NUMERIC;
  v_costo_domicilio NUMERIC;
  v_base            NUMERIC;  -- lo que vale el pedido antes del recargo
  v_suma            NUMERIC;  -- suma de los montos informados
  v_recargo         NUMERIC;
  v_total           NUMERIC;
  v_metodos         INT;
  v_metodo_final    VARCHAR;
BEGIN
  SELECT estado, subtotal, COALESCE(costo_domicilio, 0)
    INTO v_estado, v_subtotal, v_costo_domicilio
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  IF v_estado = 'pagado' THEN
    RAISE EXCEPTION 'PEDIDO_YA_PAGADO';
  END IF;

  v_base := v_subtotal + v_costo_domicilio;

  SELECT COALESCE(SUM((value->>'monto')::NUMERIC), 0),
         COUNT(DISTINCT value->>'metodo')
    INTO v_suma, v_metodos
  FROM jsonb_array_elements(p_pagos);

  IF v_metodos = 0 THEN
    RAISE EXCEPTION 'SIN_PAGOS';
  END IF;

  -- Los montos informados son la parte "limpia" de cada método: deben sumar
  -- exactamente el valor del pedido. El recargo del datáfono se agrega después.
  IF ROUND(v_suma) <> ROUND(v_base) THEN
    RAISE EXCEPTION 'MONTOS_NO_CUADRAN';
  END IF;

  -- 5% solo sobre lo que efectivamente pasa por el datáfono
  SELECT COALESCE(SUM(ROUND((value->>'monto')::NUMERIC * 0.05)), 0)
    INTO v_recargo
  FROM jsonb_array_elements(p_pagos)
  WHERE value->>'metodo' = 'datafono';

  v_total := v_base + v_recargo;

  -- Si el pedido se está recobrando, limpiar pagos anteriores
  DELETE FROM pagos_pedido WHERE pedido_id = p_pedido_id;

  -- Se guarda lo realmente cobrado por método: la fila de datáfono ya trae su 5%
  INSERT INTO pagos_pedido (pedido_id, metodo, monto)
  SELECT
    p_pedido_id,
    value->>'metodo',
    CASE
      WHEN value->>'metodo' = 'datafono'
        THEN (value->>'monto')::NUMERIC + ROUND((value->>'monto')::NUMERIC * 0.05)
      ELSE (value->>'monto')::NUMERIC
    END
  FROM jsonb_array_elements(p_pagos);

  -- `metodo_pago` se conserva por compatibilidad con los reportes existentes
  IF v_metodos > 1 THEN
    v_metodo_final := 'mixto';
  ELSE
    SELECT value->>'metodo' INTO v_metodo_final FROM jsonb_array_elements(p_pagos) LIMIT 1;
  END IF;

  UPDATE pedidos SET
    estado      = 'pagado',
    metodo_pago = v_metodo_final,
    recargo     = v_recargo,
    total       = v_total,
    closed_at   = NOW()
  WHERE id = p_pedido_id;

  RETURN v_total;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql;
