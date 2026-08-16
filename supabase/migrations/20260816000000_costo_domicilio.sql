-- Migration: Costo de domicilio fuera del sector
--
-- Cuando el domiciliario sale del sector se cobran $5.000 adicionales.
-- Va en columna propia (NO en `recargo`, que se usa solo para el 5% del datáfono)
-- para poder reportar aparte cuánto se cobró por domicilios y cuánto ganó el
-- domiciliario, sin ensuciar las estadísticas de recargos por datáfono.

-- ============================================================
-- 1. Columna nueva en `pedidos`
-- ============================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS costo_domicilio NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pedidos.costo_domicilio IS
  'Cobro adicional por domicilio fuera del sector. 0 = sin cobro. Suma al total del pedido.';

-- ============================================================
-- 2. RPC create_order_with_details — soporte para costo_domicilio
--    Se elimina la firma anterior para no dejar overloads ambiguos.
-- ============================================================
DROP FUNCTION IF EXISTS create_order_with_details(
  VARCHAR, INT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, JSONB, TIMESTAMPTZ, NUMERIC
);

CREATE OR REPLACE FUNCTION create_order_with_details(
  p_tipo VARCHAR,
  p_numero_mesa INT,
  p_cliente_nombre VARCHAR,
  p_cliente_telefono VARCHAR,
  p_cliente_direccion TEXT,
  p_estado VARCHAR,
  p_metodo_pago VARCHAR,
  p_subtotal NUMERIC,
  p_recargo NUMERIC,
  p_total NUMERIC,
  p_detalles JSONB,
  p_hora_entrega TIMESTAMPTZ DEFAULT NULL,
  p_paga_con NUMERIC DEFAULT NULL,
  p_costo_domicilio NUMERIC DEFAULT 0
) RETURNS INT AS $$
DECLARE
  v_pedido_id INT;
  v_vuelto NUMERIC;
BEGIN
  -- La vuelta se calcula en el servidor para que siempre sea coherente con el total
  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - p_total, 0)
  END;

  INSERT INTO pedidos (
    tipo,
    numero_mesa,
    cliente_nombre,
    cliente_telefono,
    cliente_direccion,
    estado,
    metodo_pago,
    subtotal,
    recargo,
    total,
    hora_entrega,
    paga_con,
    vuelto,
    costo_domicilio
  )
  VALUES (
    p_tipo,
    p_numero_mesa,
    p_cliente_nombre,
    p_cliente_telefono,
    p_cliente_direccion,
    p_estado,
    p_metodo_pago,
    p_subtotal,
    p_recargo,
    p_total,
    p_hora_entrega,
    p_paga_con,
    v_vuelto,
    COALESCE(p_costo_domicilio, 0)
  )
  RETURNING id INTO v_pedido_id;

  -- Cada elemento del JSONB es una línea independiente del pedido:
  -- dos veces el mismo producto con observaciones distintas = dos filas.
  INSERT INTO detalle_pedidos (
    pedido_id,
    producto_id,
    cantidad,
    precio_unitario,
    notas
  )
  SELECT
    v_pedido_id,
    (value->>'producto_id')::INT,
    (value->>'cantidad')::INT,
    (value->>'precio_unitario')::NUMERIC,
    value->>'notas'
  FROM jsonb_array_elements(p_detalles);

  RETURN v_pedido_id;
EXCEPTION WHEN OTHERS THEN
  -- Postgres revierte toda la transacción automáticamente ante cualquier error
  RAISE;
END;
$$ LANGUAGE plpgsql;
