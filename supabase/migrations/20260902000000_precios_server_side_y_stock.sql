-- Migration: Los precios los pone el servidor, no quien hace la petición
--
-- Hallazgo de la auditoría: `create_order_with_details` y
-- `update_order_with_details` insertaban en `pedidos`/`detalle_pedidos`
-- exactamente el subtotal, el recargo, el total y el precio de cada línea
-- que mandaba el cliente — sin comparar nada contra el catálogo. Además,
-- `pedidos` tenía política RLS de UPDATE completamente abierta
-- (`USING (true) WITH CHECK (true)`), así que cualquiera con la clave
-- pública podía reescribir directamente el total o el estado de un pedido
-- ya existente por fuera de estas funciones.
--
-- Esta migración:
--   1. Recalcula subtotal/recargo/total EN EL SERVIDOR a partir de
--      `productos.precio`, no de lo que venga en la petición.
--   2. Al editar un pedido, valida cada precio de línea: o es el precio
--      actual del catálogo (línea nueva), o ya era el precio de esa línea
--      en el pedido antes de esta edición (conserva el precio histórico si
--      el producto subió después — comportamiento que ya existía y que
--      esta migración no cambia, solo deja de confiar ciegamente en él).
--   3. Cierra las políticas de INSERT/UPDATE abiertas en `pedidos`,
--      `detalle_pedidos` y `pagos_pedido`: a partir de ahora esas tablas
--      SOLO se escriben desde las funciones de este archivo, marcadas
--      `SECURITY DEFINER` para que sigan funcionando sin el permiso directo.
--   4. `mark_order_ready` (cocina) y `toggle_producto_activo` (stock) pasan
--      de UPDATE directo a funciones — el UPDATE directo de "Control de
--      Stock Rápido" no tenía política y fallaba en silencio (toast de
--      éxito, producto sin cambiar).

-- ============================================================
-- 1. Cerrar las políticas de escritura directa
-- ============================================================
DROP POLICY IF EXISTS "public_insert_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "public_update_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "public_insert_detalle_pedidos" ON public.detalle_pedidos;
DROP POLICY IF EXISTS "public_insert_pagos_pedido" ON public.pagos_pedido;
DROP POLICY IF EXISTS "public_delete_pagos_pedido" ON public.pagos_pedido;

-- La lectura pública se conserva: el tablero de cocina, liquidación y el
-- dashboard siguen leyendo en tiempo real con la clave pública.

-- ============================================================
-- 2. create_order_with_details — subtotal y precios desde el catálogo
-- ============================================================
DO $$
DECLARE
  v_firma TEXT;
BEGIN
  FOR v_firma IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_order_with_details'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || v_firma;
  END LOOP;
END $$;

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
  v_faltantes  INT;
BEGIN
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'CARRITO_VACIO';
  END IF;

  -- Todo producto debe existir en el catálogo: sin eso no hay precio de
  -- dónde sacarlo, y así se evita insertar un pedido con un id inventado.
  SELECT COUNT(*) INTO v_faltantes
  FROM jsonb_array_elements(p_detalles) AS d
  WHERE NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = (d->>'producto_id')::INT);

  IF v_faltantes > 0 THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  -- p_subtotal/p_recargo/p_total llegan en la petición pero NO se usan: son
  -- solo lo que el cliente cree que va a costar. Lo que se cobra sale de acá.
  SELECT COALESCE(SUM(p.precio * (d->>'cantidad')::INT), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(p_detalles) AS d
  JOIN productos p ON p.id = (d->>'producto_id')::INT;

  v_recargo := CASE
    WHEN p_tipo = 'domicilio' AND p_metodo_pago = 'datafono'
      THEN ROUND((v_subtotal + COALESCE(p_costo_domicilio, 0)) * 0.05)
    ELSE 0
  END;
  v_total := v_subtotal + COALESCE(p_costo_domicilio, 0) + v_recargo;

  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - v_total, 0)
  END;

  INSERT INTO pedidos (
    tipo, numero_mesa, cliente_nombre, cliente_telefono, cliente_direccion,
    estado, metodo_pago, subtotal, recargo, total, hora_entrega, paga_con,
    vuelto, costo_domicilio, creado_por
  )
  VALUES (
    p_tipo, p_numero_mesa, p_cliente_nombre, p_cliente_telefono, p_cliente_direccion,
    -- Un pedido siempre nace 'pendiente': nadie inserta uno ya 'pagado' de
    -- una para inflar la venta del día.
    'pendiente', p_metodo_pago, v_subtotal, v_recargo, v_total, p_hora_entrega, p_paga_con,
    v_vuelto, COALESCE(p_costo_domicilio, 0), NULLIF(BTRIM(p_creado_por), '')
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, notas)
  SELECT v_pedido_id, (d->>'producto_id')::INT, (d->>'cantidad')::INT, p.precio, d->>'notas'
  FROM jsonb_array_elements(p_detalles) AS d
  JOIN productos p ON p.id = (d->>'producto_id')::INT;

  RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_order_with_details IS
  'Crea un pedido. Los precios y el total se calculan aquí desde productos.precio, nunca desde lo que mande el cliente.';

-- ============================================================
-- 3. update_order_with_details — precio validado por línea
-- ============================================================
DO $$
DECLARE
  v_firma TEXT;
BEGIN
  FOR v_firma IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_order_with_details'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || v_firma;
  END LOOP;
END $$;

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
  p_costo_domicilio NUMERIC DEFAULT 0,
  p_volver_a_cocina BOOLEAN DEFAULT TRUE
) RETURNS INT AS $$
DECLARE
  v_estado       VARCHAR;
  v_tipo         VARCHAR;
  v_vuelto       NUMERIC;
  v_nuevo_estado VARCHAR;
  v_subtotal     NUMERIC;
  v_recargo      NUMERIC;
  v_total        NUMERIC;
  v_invalidos    INT;
BEGIN
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'CARRITO_VACIO';
  END IF;

  SELECT estado, tipo INTO v_estado, v_tipo
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  IF v_estado NOT IN ('pendiente', 'listo') THEN
    RAISE EXCEPTION 'PEDIDO_NO_EDITABLE';
  END IF;

  v_nuevo_estado := CASE
    WHEN v_estado = 'listo' AND p_volver_a_cocina THEN 'pendiente'
    ELSE v_estado
  END;

  -- Cada precio de línea tiene que ser legítimo: o es el precio actual del
  -- catálogo (se agregó algo nuevo en esta edición), o ya era el precio de
  -- esa línea en el pedido ANTES de esta edición (se conserva el precio
  -- histórico aunque el producto haya subido después — eso ya lo hacía la
  -- app, aquí solo se deja de confiar a ciegas en lo que llega).
  SELECT COUNT(*) INTO v_invalidos
  FROM jsonb_array_elements(p_detalles) AS d
  WHERE NOT EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = (d->>'producto_id')::INT
      AND p.precio = (d->>'precio_unitario')::NUMERIC
  )
  AND NOT EXISTS (
    SELECT 1 FROM detalle_pedidos dp
    WHERE dp.pedido_id = p_pedido_id
      AND dp.producto_id = (d->>'producto_id')::INT
      AND dp.precio_unitario = (d->>'precio_unitario')::NUMERIC
  );

  IF v_invalidos > 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  SELECT COALESCE(SUM((d->>'precio_unitario')::NUMERIC * (d->>'cantidad')::INT), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(p_detalles) AS d;

  -- El recargo se valida contra el tipo GUARDADO del pedido (v_tipo), no
  -- contra lo que diga la petición: el tipo de atención no se puede cambiar
  -- desde una edición.
  v_recargo := CASE
    WHEN v_tipo = 'domicilio' AND p_metodo_pago = 'datafono'
      THEN ROUND((v_subtotal + COALESCE(p_costo_domicilio, 0)) * 0.05)
    ELSE 0
  END;
  v_total := v_subtotal + COALESCE(p_costo_domicilio, 0) + v_recargo;

  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - v_total, 0)
  END;

  UPDATE pedidos SET
    estado            = v_nuevo_estado,
    numero_mesa       = p_numero_mesa,
    cliente_nombre    = p_cliente_nombre,
    cliente_telefono  = p_cliente_telefono,
    cliente_direccion = p_cliente_direccion,
    metodo_pago       = p_metodo_pago,
    subtotal          = v_subtotal,
    recargo           = v_recargo,
    total             = v_total,
    hora_entrega      = p_hora_entrega,
    paga_con          = p_paga_con,
    vuelto            = v_vuelto,
    costo_domicilio   = COALESCE(p_costo_domicilio, 0),
    modificado_at     = NOW()
  WHERE id = p_pedido_id;

  DELETE FROM detalle_pedidos WHERE pedido_id = p_pedido_id;

  INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, notas)
  SELECT
    p_pedido_id,
    (d->>'producto_id')::INT,
    (d->>'cantidad')::INT,
    (d->>'precio_unitario')::NUMERIC,
    d->>'notas'
  FROM jsonb_array_elements(p_detalles) AS d;

  RETURN p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION update_order_with_details IS
  'Reescribe un pedido pendiente o listo. Cada precio de línea se valida contra el catálogo o contra el precio que ya tenía; nada se acepta a ciegas.';

-- ============================================================
-- 4. Las demás funciones que tocan pedidos/pagos, con privilegios propios
--    Ya existían; solo se marcan SECURITY DEFINER para que sigan
--    funcionando ahora que la escritura directa a las tablas está cerrada.
-- ============================================================
DO $$
DECLARE
  v_firma TEXT;
  v_nombre TEXT;
BEGIN
  FOR v_nombre IN SELECT unnest(ARRAY[
    'cancel_order', 'mark_order_debe', 'link_rehecho', 'close_order_with_payments'
  ])
  LOOP
    FOR v_firma IN
      SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_nombre
    LOOP
      EXECUTE 'ALTER FUNCTION public.' || v_firma || ' SECURITY DEFINER SET search_path = public';
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 5. Cocina: marcar listo pasa de UPDATE directo a función
--    El UPDATE directo dejó de tener política tras el punto 1.
-- ============================================================
CREATE OR REPLACE FUNCTION mark_order_ready(p_pedido_id INT)
RETURNS VOID AS $$
DECLARE
  v_estado VARCHAR;
BEGIN
  SELECT estado INTO v_estado FROM pedidos WHERE id = p_pedido_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'PEDIDO_NO_PENDIENTE';
  END IF;

  UPDATE pedidos SET estado = 'listo' WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION mark_order_ready IS
  'Cocina marca un pedido pendiente como listo para cobrar.';

-- ============================================================
-- 6. Stock: "Control de Stock Rápido" pasa de UPDATE directo (sin
--    política — fallaba en silencio) a función.
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_producto_activo(p_producto_id INT, p_activo BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE productos SET activo = p_activo WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION toggle_producto_activo IS
  'Marca un producto disponible o agotado desde el dashboard.';
