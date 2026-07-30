-- Migration: Actualizar RPC create_order_with_details para soportar hora_entrega

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
  p_hora_entrega TIMESTAMPTZ DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_pedido_id INT;
BEGIN
  -- Insert into pedidos
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
    hora_entrega
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
    p_hora_entrega
  )
  RETURNING id INTO v_pedido_id;

  -- Insert into detalle_pedidos extracting from JSONB array
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
  -- Postgres automatically rolls back the entire transaction if any error occurs
  RAISE;
END;
$$ LANGUAGE plpgsql;
