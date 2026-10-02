-- Migration: pedidos de evento con precio especial (audio del 1/10/2026)
--
-- Para un pedido grande de un buen cliente (8 hamburguesas, un cumpleaños) el
-- dueño no cobra el precio del menú: lo ajusta según el cliente, mirando que
-- el margen le dé. En su Excel es el bloque EVENTOS. Hasta ahora la base
-- imponía productos.precio en cada línea y no había forma de registrar esa
-- venta al precio real.
--
--   - pedidos.es_evento: marca el pedido para cocina, caja y reportes.
--   - create_order_with_details: una línea de p_detalles puede traer
--     "precio_especial". Si alguna lo trae, el pedido es de evento, solo lo
--     puede crear admin/dev y esa línea se cobra a ese precio. Las líneas sin
--     precio_especial siguen saliendo del catálogo. La firma no cambia: la app
--     desplegada sigue llamándola igual.
--   - update_order_with_details no se toca: ya acepta que una línea conserve
--     el precio que tenía, así que editar un pedido de evento (agregar una
--     gaseosa al precio del menú) respeta los precios especiales.
--
-- El resto del pedido no cambia: pasa a cocina, se cobra en liquidación,
-- cuenta en ventas y sus productos dejan la tarifa del domiciliario como
-- cualquier otro.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS es_evento BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.pedidos.es_evento IS
  'TRUE = pedido de evento: al menos una línea se vendió a un precio especial fijado por administración.';

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
  p_costo_domicilio NUMERIC DEFAULT 0,
  p_creado_por VARCHAR DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_pedido_id  INT;
  v_vuelto     NUMERIC;
  v_subtotal   NUMERIC;
  v_recargo    NUMERIC;
  v_total      NUMERIC;
  v_domicilio  NUMERIC;
  v_evento     BOOLEAN;
  v_malas      INT;
BEGIN
  PERFORM exigir_rol('cajero', 'admin', 'dev');

  IF p_tipo NOT IN ('mesa', 'domicilio') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;

  IF p_metodo_pago IS NOT NULL
     AND p_metodo_pago NOT IN ('efectivo', 'nequi', 'datafono', 'bancolombia') THEN
    RAISE EXCEPTION 'METODO_INVALIDO';
  END IF;

  PERFORM validar_lineas_pedido(p_detalles);

  -- Precio especial: solo administración, y tiene que ser un entero positivo.
  -- Un cajero no puede vender por debajo del menú mandando el campo a mano.
  SELECT COUNT(*) > 0 INTO v_evento
  FROM jsonb_array_elements(p_detalles) AS d
  WHERE d ? 'precio_especial' AND jsonb_typeof(d->'precio_especial') <> 'null';

  IF v_evento THEN
    PERFORM exigir_rol('admin', 'dev');

    SELECT COUNT(*) INTO v_malas
    FROM jsonb_array_elements(p_detalles) AS d
    WHERE d ? 'precio_especial' AND jsonb_typeof(d->'precio_especial') <> 'null'
      AND ((d->>'precio_especial') !~ '^[0-9]+$' OR (d->>'precio_especial')::NUMERIC <= 0);

    IF v_malas > 0 THEN
      RAISE EXCEPTION 'PRECIO_ESPECIAL_INVALIDO';
    END IF;
  END IF;

  v_domicilio := GREATEST(COALESCE(p_costo_domicilio, 0), 0);

  -- p_subtotal/p_recargo/p_total llegan en la petición pero NO se usan: son
  -- solo lo que el cliente cree que va a costar. Lo que se cobra sale de acá.
  SELECT COALESCE(SUM(COALESCE((d->>'precio_especial')::NUMERIC, p.precio) * (d->>'cantidad')::INT), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(p_detalles) AS d
  JOIN productos p ON p.id = (d->>'producto_id')::INT;

  v_recargo := CASE
    WHEN p_tipo = 'domicilio' AND p_metodo_pago = 'datafono'
      THEN ROUND((v_subtotal + v_domicilio) * 0.05)
    ELSE 0
  END;
  v_total := v_subtotal + v_domicilio + v_recargo;

  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - v_total, 0)
  END;

  INSERT INTO pedidos (
    tipo, numero_mesa, cliente_nombre, cliente_telefono, cliente_direccion,
    estado, metodo_pago, subtotal, recargo, total, hora_entrega, paga_con,
    vuelto, costo_domicilio, creado_por, es_evento
  )
  VALUES (
    p_tipo, p_numero_mesa, p_cliente_nombre, p_cliente_telefono, p_cliente_direccion,
    -- Un pedido siempre nace 'pendiente'
    'pendiente', p_metodo_pago, v_subtotal, v_recargo, v_total, p_hora_entrega, p_paga_con,
    v_vuelto, v_domicilio, NULLIF(BTRIM(p_creado_por), ''), v_evento
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, notas)
  SELECT
    v_pedido_id,
    (d->>'producto_id')::INT,
    (d->>'cantidad')::INT,
    COALESCE((d->>'precio_especial')::NUMERIC, p.precio),
    d->>'notas'
  FROM jsonb_array_elements(p_detalles) AS d
  JOIN productos p ON p.id = (d->>'producto_id')::INT;

  RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_order_with_details IS
  'Crea un pedido (rol cajero/admin/dev). Precios y total salen de productos.precio, salvo las líneas con precio_especial (pedido de evento, solo admin/dev); rechaza cantidades no positivas y productos agotados.';
