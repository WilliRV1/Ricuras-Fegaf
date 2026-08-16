-- Migration: Modificar un pedido mientras siga pendiente en cocina
--
-- Caso de uso: el cliente pide "uno en agua y uno en leche" y al rato dice que
-- los quiere los dos en leche. Antes tocaba cancelar y volver a digitar todo,
-- lo que ensuciaba las estadísticas con cancelaciones que no lo fueron.

-- ============================================================
-- 1. Marca de modificación (para avisar a cocina)
-- ============================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS modificado_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.pedidos.modificado_at IS
  'Última vez que se modificó el pedido después de enviarlo. NULL = nunca se modificó.';

-- ============================================================
-- 2. RPC transaccional de modificación
--    Reescribe los detalles y recalcula los totales en una sola transacción.
--    Solo funciona mientras el pedido siga en estado 'pendiente'.
-- ============================================================
CREATE OR REPLACE FUNCTION update_order_with_details(
  p_pedido_id INT,
  p_numero_mesa INT,
  p_cliente_nombre VARCHAR,
  p_cliente_telefono VARCHAR,
  p_cliente_direccion TEXT,
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
  v_estado VARCHAR;
  v_vuelto NUMERIC;
BEGIN
  -- Bloquear la fila para que cocina no pueda marcarla como lista mientras se edita
  SELECT estado INTO v_estado
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  IF v_estado <> 'pendiente' THEN
    -- Cocina ya lo despachó: no se puede tocar
    RAISE EXCEPTION 'PEDIDO_NO_EDITABLE';
  END IF;

  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - p_total, 0)
  END;

  UPDATE pedidos SET
    numero_mesa       = p_numero_mesa,
    cliente_nombre    = p_cliente_nombre,
    cliente_telefono  = p_cliente_telefono,
    cliente_direccion = p_cliente_direccion,
    metodo_pago       = p_metodo_pago,
    subtotal          = p_subtotal,
    recargo           = p_recargo,
    total             = p_total,
    hora_entrega      = p_hora_entrega,
    paga_con          = p_paga_con,
    vuelto            = v_vuelto,
    costo_domicilio   = COALESCE(p_costo_domicilio, 0),
    modificado_at     = NOW()
  WHERE id = p_pedido_id;

  -- Los detalles se reescriben completos: es más simple y seguro que intentar
  -- casar línea por línea, y el pedido es pequeño.
  DELETE FROM detalle_pedidos WHERE pedido_id = p_pedido_id;

  INSERT INTO detalle_pedidos (
    pedido_id,
    producto_id,
    cantidad,
    precio_unitario,
    notas
  )
  SELECT
    p_pedido_id,
    (value->>'producto_id')::INT,
    (value->>'cantidad')::INT,
    (value->>'precio_unitario')::NUMERIC,
    value->>'notas'
  FROM jsonb_array_elements(p_detalles);

  RETURN p_pedido_id;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql;
