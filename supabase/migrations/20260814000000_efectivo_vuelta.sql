-- Migration: Registrar con cuánto paga el cliente en efectivo y la vuelta a alistar
--
-- Caso de uso: en un domicilio pagado en efectivo, el cliente avisa con qué billete
-- va a pagar (ej. $50.000). El domiciliario necesita salir con la vuelta ya alistada.

-- ============================================================
-- 1. Columnas nuevas en `pedidos`
-- ============================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS paga_con NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS vuelto NUMERIC NULL;

COMMENT ON COLUMN public.pedidos.paga_con IS
  'Monto en efectivo con el que el cliente va a pagar. NULL = no aplica (otro método o sin informar).';

COMMENT ON COLUMN public.pedidos.vuelto IS
  'Vuelta que se debe alistar (paga_con - total). NULL = no aplica.';

-- ============================================================
-- 2. RPC create_order_with_details — soporte para paga_con / vuelto
--    Se eliminan los overloads anteriores para evitar ambigüedad
--    al llamar la función por nombre desde PostgREST.
-- ============================================================
DROP FUNCTION IF EXISTS create_order_with_details(
  VARCHAR, INT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, JSONB
);

DROP FUNCTION IF EXISTS create_order_with_details(
  VARCHAR, INT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, NUMERIC, NUMERIC, NUMERIC, JSONB, TIMESTAMPTZ
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
  p_paga_con NUMERIC DEFAULT NULL
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
    vuelto
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
    v_vuelto
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
