-- Migration: Cartera con nombre, control de cancelaciones y edición antes de cobrar
--
-- Resuelve tres problemas reportados desde el local:
--
-- 1. "Necesito saber QUIÉN me debe, no solo el número del pedido."
--    Las deudas solo guardaban el id del pedido. En mesa ni siquiera se pide
--    el nombre del cliente, así que la cartera quedaba anónima.
--
-- 2. "El cliente pidió una gaseosa al final y no había forma de meterla."
--    Un pedido solo se podía modificar mientras estuviera 'pendiente'. Si
--    cocina ya lo había despachado tocaba borrar la venta y volverla a montar
--    — y a veces no se volvía a montar, lo que descuadraba la caja.
--
-- 3. "¿Cómo sé qué pedido borró y si lo volvió a subir?"
--    Se guarda quién cancela y, cuando el pedido se vuelve a montar, queda el
--    enlace al pedido que lo reemplazó.

-- ============================================================
-- 1. Columnas nuevas en pedidos
-- ============================================================

-- Quién quedó debiendo. Es independiente de `cliente_nombre` (dato del
-- domicilio) porque en mesa quien debe puede no ser quien pidió, y porque
-- tocar la deuda no debe alterar los datos de entrega.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS deudor_nombre VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS deudor_telefono VARCHAR(40) NULL;

-- Quién canceló el pedido. Texto libre alimentado por una lista fija en la
-- app: no hay usuarios individuales, todos entran con la misma clave.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(60) NULL;

-- Pedido que reemplazó a uno cancelado. Permite responder "¿lo volvió a
-- montar?" con un dato y no con la memoria de alguien.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS rehecho_en INT NULL REFERENCES public.pedidos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos.deudor_nombre IS
  'Nombre de quien quedó debiendo. Obligatorio al marcar el pedido como "debe".';
COMMENT ON COLUMN public.pedidos.deudor_telefono IS
  'Teléfono de contacto del deudor (opcional).';
COMMENT ON COLUMN public.pedidos.cancelado_por IS
  'Persona que canceló el pedido, elegida de la lista del local.';
COMMENT ON COLUMN public.pedidos.rehecho_en IS
  'Id del pedido que reemplazó a este después de cancelarlo. NULL = nunca se volvió a montar.';

-- La cartera se consulta sin filtro de fecha (arrastra deudas viejas), así que
-- conviene un índice parcial sobre el estado.
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_debe
  ON public.pedidos (created_at)
  WHERE estado = 'debe';

-- El dashboard suma aparte los cobros de deudas viejas, por fecha de cierre.
CREATE INDEX IF NOT EXISTS idx_pedidos_closed_at
  ON public.pedidos (closed_at)
  WHERE closed_at IS NOT NULL;

-- ============================================================
-- 2. Modificar un pedido que cocina YA despachó
--
--    Antes solo se permitía en estado 'pendiente'. Ahora también en 'listo',
--    que es justo el momento en que el cliente dice "y me das una gaseosa".
--
--    `p_volver_a_cocina` decide qué pasa con un pedido 'listo':
--      TRUE  → vuelve al tablero de cocina marcado como modificado (hay algo
--              nuevo que preparar). Sale de liquidación hasta que cocina lo
--              marque listo otra vez.
--      FALSE → sigue en liquidación con el total actualizado (lo agregado no
--              pasa por cocina: una gaseosa de la nevera).
--
--    Ojo: `CREATE OR REPLACE FUNCTION` con un parámetro nuevo NO reemplaza la
--    función, crea una sobrecarga. Quedarían dos versiones y cualquier llamada
--    fallaría con "function name is not unique". Por eso primero se borran
--    todas las versiones que existan, sea cual sea su firma.
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
  v_vuelto       NUMERIC;
  v_nuevo_estado VARCHAR;
BEGIN
  -- Bloquear la fila para que cocina no cambie el estado mientras se edita
  SELECT estado INTO v_estado
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  -- Un pedido ya cobrado, cancelado o marcado como deuda no se toca: mover esa
  -- plata sin dejar rastro es exactamente lo que descuadra la caja.
  IF v_estado NOT IN ('pendiente', 'listo') THEN
    RAISE EXCEPTION 'PEDIDO_NO_EDITABLE';
  END IF;

  v_nuevo_estado := CASE
    WHEN v_estado = 'listo' AND p_volver_a_cocina THEN 'pendiente'
    ELSE v_estado
  END;

  v_vuelto := CASE
    WHEN p_paga_con IS NULL THEN NULL
    ELSE GREATEST(p_paga_con - p_total, 0)
  END;

  UPDATE pedidos SET
    estado            = v_nuevo_estado,
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_order_with_details IS
  'Reescribe un pedido pendiente o listo. Si estaba listo y p_volver_a_cocina, regresa al tablero de cocina.';

-- ============================================================
-- 3. Marcar un pedido como deuda, con el nombre de quien debe
--
--    Antes era un UPDATE suelto desde la app, sin validar el estado: se podía
--    marcar como deuda un pedido ya cobrado y desaparecer la venta.
-- ============================================================
CREATE OR REPLACE FUNCTION mark_order_debe(
  p_pedido_id INT,
  p_deudor_nombre VARCHAR,
  p_deudor_telefono VARCHAR DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_estado VARCHAR;
  v_nombre VARCHAR;
BEGIN
  v_nombre := NULLIF(BTRIM(p_deudor_nombre), '');

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'DEUDOR_REQUERIDO';
  END IF;

  SELECT estado INTO v_estado
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  IF v_estado = 'pagado' THEN
    RAISE EXCEPTION 'PEDIDO_YA_PAGADO';
  END IF;

  IF v_estado = 'cancelado' THEN
    RAISE EXCEPTION 'PEDIDO_CANCELADO';
  END IF;

  UPDATE pedidos SET
    estado          = 'debe',
    deudor_nombre   = v_nombre,
    deudor_telefono = NULLIF(BTRIM(p_deudor_telefono), ''),
    closed_at       = NOW()
  WHERE id = p_pedido_id;

  RETURN p_pedido_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_order_debe IS
  'Deja el pedido en estado "debe" registrando quién quedó debiendo. Rechaza pedidos ya cobrados o cancelados.';

-- ============================================================
-- 4. Cancelar un pedido dejando constancia de quién lo hizo
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_order(
  p_pedido_id INT,
  p_motivo VARCHAR,
  p_cancelado_por VARCHAR DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_estado VARCHAR;
BEGIN
  SELECT estado INTO v_estado
  FROM pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO';
  END IF;

  -- Cancelar un pedido ya cobrado borraría plata que sí entró a la caja
  IF v_estado = 'pagado' THEN
    RAISE EXCEPTION 'PEDIDO_YA_PAGADO';
  END IF;

  UPDATE pedidos SET
    estado             = 'cancelado',
    motivo_cancelacion = NULLIF(BTRIM(p_motivo), ''),
    cancelado_por      = NULLIF(BTRIM(p_cancelado_por), ''),
    closed_at          = NOW()
  WHERE id = p_pedido_id;

  RETURN p_pedido_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_order IS
  'Cancela un pedido guardando motivo y responsable. Rechaza pedidos ya cobrados.';

-- ============================================================
-- 5. Enlazar un pedido cancelado con el que lo reemplazó
-- ============================================================
CREATE OR REPLACE FUNCTION link_rehecho(
  p_cancelado_id INT,
  p_nuevo_id INT
) RETURNS VOID AS $$
BEGIN
  IF p_cancelado_id = p_nuevo_id THEN
    RAISE EXCEPTION 'REFERENCIA_CIRCULAR';
  END IF;

  UPDATE pedidos
  SET rehecho_en = p_nuevo_id
  WHERE id = p_cancelado_id
    AND estado = 'cancelado';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION link_rehecho IS
  'Marca un pedido cancelado como ya rehecho, apuntando al pedido que lo reemplazó.';
