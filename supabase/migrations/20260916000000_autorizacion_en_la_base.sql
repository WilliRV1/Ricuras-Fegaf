-- Migration: La base también decide quién puede hacer qué
--
-- Hallazgos de la auditoría del 2026-09-16. Hasta ahora TODAS las funciones
-- de negocio eran SECURITY DEFINER ejecutables por `anon`, y la única barrera
-- era la app de Next: cualquiera con la clave pública del proyecto (que está
-- en el bundle del navegador, es normal que lo esté) podía llamar directo a
-- /rest/v1/rpc/cancel_order, close_order_with_payments, actualizar_producto…
-- sin sesión, sin rol y sin PIN. El nombre de quien anulaba se mandaba como
-- texto libre, así que la trazabilidad era falsificable desde fuera.
--
-- Esta migración:
--   1. Lee el rol de la sesión desde el JWT que la app ya firma
--      (`app_rol`, ver src/lib/session.ts:crearTokenSupabase) y exige un rol
--      concreto en cada función de escritura. Las conexiones directas a la
--      base (scripts de prueba, psql) no traen JWT y se dejan pasar: el
--      control es para lo que entra por la API con la clave pública.
--   2. `cancel_order` verifica el PIN DENTRO de la base y toma el nombre del
--      usuario de la tabla, no de la petición.
--   3. Versión de sesión por usuario: desactivar a alguien o resetearle el
--      PIN invalida las sesiones que ya tenía abiertas (antes la cookie
--      seguía sirviendo hasta 16 horas).
--   4. Validaciones que faltaban: cantidad > 0, producto activo al crear un
--      pedido, tipo de atención válido, método de pago dentro de la lista.
--   5. Vistas de costeo con security_invoker (respetan RLS) y que distinguen
--      "costo cero" de "no hay receta / insumo sin precio".
--   6. Arqueo de caja: un solo turno abierto a la vez, escritura solo por
--      función, cierre solo de un turno abierto.
--   7. Índices sobre pedidos(estado) y pedidos(created_at); realtime sobre
--      productos para que /pedidos se entere de los agotados.
--
-- Es idempotente: se puede volver a correr sin efectos.

-- ============================================================
-- 1. Rol de la sesión y helper para exigirlo
-- ============================================================

/**
 * Rol con el que llegó la petición:
 *   · el `app_rol` del JWT firmado por la app (cajero/cocina/admin/dev);
 *   · 'anon' si la petición entró por la API sin ese claim;
 *   · 'directo' si no vino por PostgREST (conexión de superusuario:
 *     scripts de prueba, migraciones, psql) — esas no se restringen.
 */
CREATE OR REPLACE FUNCTION rol_de_sesion()
RETURNS TEXT AS $$
DECLARE
  v_claims TEXT;
BEGIN
  v_claims := current_setting('request.jwt.claims', true);

  IF v_claims IS NOT NULL AND v_claims <> '' THEN
    RETURN COALESCE(v_claims::jsonb->>'app_rol', 'anon');
  END IF;

  -- PostgREST siempre entra como `authenticator` y luego cambia de rol; si
  -- llegó por ahí sin claims, es público.
  IF session_user = 'authenticator' THEN
    RETURN 'anon';
  END IF;

  RETURN 'directo';
END;
$$ LANGUAGE plpgsql STABLE;

/** Lanza ROL_NO_AUTORIZADO si la sesión no tiene uno de los roles pedidos */
CREATE OR REPLACE FUNCTION exigir_rol(VARIADIC p_roles TEXT[])
RETURNS VOID AS $$
DECLARE
  v_rol TEXT := rol_de_sesion();
BEGIN
  IF v_rol = 'directo' THEN
    RETURN;
  END IF;

  IF NOT (v_rol = ANY (p_roles)) THEN
    RAISE EXCEPTION 'ROL_NO_AUTORIZADO';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 2. Versión de sesión: desactivar o resetear cierra sesiones abiertas
-- ============================================================
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS sesion_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.usuarios.sesion_version IS
  'Sube al desactivar a la persona o resetearle el PIN. La cookie guarda la versión con la que entró; si no coincide, la sesión ya no vale.';

/**
 * ¿La sesión que lleva la cookie sigue valiendo? La app la llama cada pocos
 * minutos (no en cada petición) desde el proxy y desde los server actions.
 */
CREATE OR REPLACE FUNCTION sesion_vigente(p_usuario_id INT, p_version INT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = p_usuario_id AND activo AND sesion_version = p_version
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- iniciar_sesion y confirmar_pin devuelven la versión para meterla en la
-- cookie. Cambia el tipo de retorno, así que hay que borrarlas primero.
DROP FUNCTION IF EXISTS public.iniciar_sesion(INT, TEXT);
DROP FUNCTION IF EXISTS public.confirmar_pin(INT, TEXT);

CREATE FUNCTION iniciar_sesion(p_usuario_id INT, p_pin TEXT)
RETURNS TABLE (id INT, nombre VARCHAR, rol VARCHAR, debe_cambiar_pin BOOLEAN, sesion_version INT) AS $$
DECLARE
  v_id INT;
BEGIN
  v_id := verificar_credenciales(p_usuario_id, p_pin);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  UPDATE usuarios SET ultimo_ingreso = NOW() WHERE usuarios.id = v_id;

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol, u.debe_cambiar_pin, u.sesion_version
    FROM usuarios u
    WHERE u.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE FUNCTION confirmar_pin(p_usuario_id INT, p_pin TEXT)
RETURNS TABLE (id INT, nombre VARCHAR, rol VARCHAR, sesion_version INT) AS $$
DECLARE
  v_id INT;
BEGIN
  v_id := verificar_credenciales(p_usuario_id, p_pin);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol, u.sesion_version FROM usuarios u WHERE u.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/** Resetear el PIN también cierra las sesiones que esa persona tenía abiertas */
CREATE OR REPLACE FUNCTION resetear_pin(
  p_admin_id INT,
  p_admin_pin TEXT,
  p_usuario_id INT,
  p_pin_temporal TEXT
) RETURNS VOID AS $$
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  IF NOT pin_valido(p_pin_temporal) THEN
    RAISE EXCEPTION 'PIN_INVALIDO';
  END IF;

  UPDATE usuarios
     SET pin_hash = extensions.crypt(p_pin_temporal, extensions.gen_salt('bf')),
         debe_cambiar_pin = TRUE,
         intentos_fallidos = 0,
         bloqueado_hasta = NULL,
         sesion_version = sesion_version + 1
   WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/** Desactivar a alguien lo saca de verdad: sus sesiones abiertas dejan de valer */
CREATE OR REPLACE FUNCTION cambiar_estado_usuario(
  p_admin_id INT,
  p_admin_pin TEXT,
  p_usuario_id INT,
  p_activo BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_admins_activos INT;
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  IF NOT p_activo THEN
    SELECT COUNT(*) INTO v_admins_activos
    FROM usuarios
    WHERE rol = 'admin' AND activo AND id <> p_usuario_id;

    IF v_admins_activos = 0 THEN
      RAISE EXCEPTION 'ULTIMO_ADMIN';
    END IF;
  END IF;

  UPDATE usuarios
     SET activo = p_activo,
         sesion_version = CASE WHEN p_activo THEN sesion_version ELSE sesion_version + 1 END
   WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 3. Pedidos: rol exigido + validaciones que faltaban
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
      AND p.proname IN ('create_order_with_details', 'update_order_with_details', 'cancel_order')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || v_firma;
  END LOOP;
END $$;

/**
 * Comprueba las líneas de un pedido: cantidad entera > 0, producto existente
 * y —salvo las líneas que ya estaban en el pedido— activo. Compartida por
 * crear y modificar.
 */
CREATE OR REPLACE FUNCTION validar_lineas_pedido(p_detalles JSONB, p_pedido_id INT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_malas INT;
BEGIN
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'CARRITO_VACIO';
  END IF;

  -- Cantidad: entero positivo. Un -5 dejaba un pedido con total negativo.
  SELECT COUNT(*) INTO v_malas
  FROM jsonb_array_elements(p_detalles) AS d
  WHERE (d->>'cantidad') IS NULL
     OR (d->>'cantidad') !~ '^[0-9]+$'
     OR (d->>'cantidad')::INT <= 0;

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA';
  END IF;

  SELECT COUNT(*) INTO v_malas
  FROM jsonb_array_elements(p_detalles) AS d
  WHERE (d->>'producto_id') IS NULL
     OR (d->>'producto_id') !~ '^[0-9]+$'
     OR NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = (d->>'producto_id')::INT);

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  -- Agotado: no se vende. Al modificar un pedido, lo que ya estaba dentro se
  -- conserva aunque se haya agotado después (ya se preparó o se va a preparar).
  SELECT COUNT(*) INTO v_malas
  FROM jsonb_array_elements(p_detalles) AS d
  JOIN productos p ON p.id = (d->>'producto_id')::INT
  WHERE NOT p.activo
    AND (
      p_pedido_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM detalle_pedidos dp
        WHERE dp.pedido_id = p_pedido_id AND dp.producto_id = p.id
      )
    );

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'PRODUCTO_AGOTADO';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE FUNCTION create_order_with_details(
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

  v_domicilio := GREATEST(COALESCE(p_costo_domicilio, 0), 0);

  -- p_subtotal/p_recargo/p_total llegan en la petición pero NO se usan: son
  -- solo lo que el cliente cree que va a costar. Lo que se cobra sale de acá.
  SELECT COALESCE(SUM(p.precio * (d->>'cantidad')::INT), 0)
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
    vuelto, costo_domicilio, creado_por
  )
  VALUES (
    p_tipo, p_numero_mesa, p_cliente_nombre, p_cliente_telefono, p_cliente_direccion,
    -- Un pedido siempre nace 'pendiente'
    'pendiente', p_metodo_pago, v_subtotal, v_recargo, v_total, p_hora_entrega, p_paga_con,
    v_vuelto, v_domicilio, NULLIF(BTRIM(p_creado_por), '')
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
  'Crea un pedido (rol cajero/admin/dev). Precios y total salen de productos.precio; rechaza cantidades no positivas y productos agotados.';

CREATE FUNCTION update_order_with_details(
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
  v_domicilio    NUMERIC;
  v_invalidos    INT;
BEGIN
  PERFORM exigir_rol('cajero', 'admin', 'dev');

  IF p_metodo_pago IS NOT NULL
     AND p_metodo_pago NOT IN ('efectivo', 'nequi', 'datafono', 'bancolombia') THEN
    RAISE EXCEPTION 'METODO_INVALIDO';
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

  PERFORM validar_lineas_pedido(p_detalles, p_pedido_id);

  v_nuevo_estado := CASE
    WHEN v_estado = 'listo' AND p_volver_a_cocina THEN 'pendiente'
    ELSE v_estado
  END;

  -- Cada precio de línea tiene que ser legítimo: o es el precio actual del
  -- catálogo (se agregó algo nuevo en esta edición), o ya era el precio de
  -- esa línea en el pedido ANTES de esta edición.
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

  v_domicilio := GREATEST(COALESCE(p_costo_domicilio, 0), 0);

  SELECT COALESCE(SUM((d->>'precio_unitario')::NUMERIC * (d->>'cantidad')::INT), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(p_detalles) AS d;

  -- El recargo se valida contra el tipo GUARDADO del pedido (v_tipo): el
  -- tipo de atención no se puede cambiar desde una edición.
  v_recargo := CASE
    WHEN v_tipo = 'domicilio' AND p_metodo_pago = 'datafono'
      THEN ROUND((v_subtotal + v_domicilio) * 0.05)
    ELSE 0
  END;
  v_total := v_subtotal + v_domicilio + v_recargo;

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
    costo_domicilio   = v_domicilio,
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
  'Reescribe un pedido pendiente o listo (rol cajero/admin/dev). Cada precio de línea se valida contra el catálogo o contra el precio que ya tenía.';

/**
 * Cancelar exige el PIN de quien anula, verificado AQUÍ: el nombre que queda
 * registrado sale de la tabla de usuarios, no de la petición. Antes el PIN
 * se comprobaba solo en la app y `p_cancelado_por` era texto libre.
 */
CREATE FUNCTION cancel_order(
  p_pedido_id INT,
  p_motivo VARCHAR,
  p_usuario_id INT,
  p_pin TEXT
) RETURNS INT AS $$
DECLARE
  v_estado VARCHAR;
  v_quien  VARCHAR;
BEGIN
  PERFORM exigir_rol('cocina', 'cajero', 'admin', 'dev');

  IF verificar_credenciales(p_usuario_id, p_pin) IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  SELECT nombre INTO v_quien FROM usuarios WHERE id = p_usuario_id;

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
    RAISE EXCEPTION 'PEDIDO_YA_CANCELADO';
  END IF;

  UPDATE pedidos SET
    estado             = 'cancelado',
    motivo_cancelacion = NULLIF(BTRIM(p_motivo), ''),
    cancelado_por      = v_quien,
    closed_at          = NOW()
  WHERE id = p_pedido_id;

  RETURN p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

COMMENT ON FUNCTION cancel_order IS
  'Cancela un pedido no cobrado. Verifica el PIN de quien anula dentro de la base y registra su nombre desde la tabla de usuarios.';

CREATE OR REPLACE FUNCTION mark_order_ready(p_pedido_id INT)
RETURNS VOID AS $$
DECLARE
  v_estado VARCHAR;
BEGIN
  PERFORM exigir_rol('cocina', 'cajero', 'admin', 'dev');

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

CREATE OR REPLACE FUNCTION mark_order_debe(
  p_pedido_id INT,
  p_deudor_nombre VARCHAR,
  p_deudor_telefono VARCHAR DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_estado VARCHAR;
  v_nombre VARCHAR;
BEGIN
  PERFORM exigir_rol('cajero', 'admin', 'dev');

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION link_rehecho(
  p_cancelado_id INT,
  p_nuevo_id INT
) RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('cajero', 'admin', 'dev');

  IF p_cancelado_id = p_nuevo_id THEN
    RAISE EXCEPTION 'REFERENCIA_CIRCULAR';
  END IF;

  UPDATE pedidos
  SET rehecho_en = p_nuevo_id
  WHERE id = p_cancelado_id
    AND estado = 'cancelado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. Cobro: rol exigido + método dentro de la lista
-- ============================================================

-- Un método fuera de la lista se guardaba sin queja y el dashboard lo
-- descartaba en silencio: la plata desaparecía del desglose. NOT VALID para
-- no fallar si hubiera alguna fila vieja rara; las nuevas sí se comprueban.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagos_pedido_metodo_check'
  ) THEN
    ALTER TABLE public.pagos_pedido
      ADD CONSTRAINT pagos_pedido_metodo_check
      CHECK (metodo IN ('efectivo', 'nequi', 'datafono', 'bancolombia')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION close_order_with_payments(
  p_pedido_id INT,
  p_pagos JSONB,
  p_cobrado_por VARCHAR DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_estado          VARCHAR;
  v_subtotal        NUMERIC;
  v_costo_domicilio NUMERIC;
  v_base            NUMERIC;
  v_suma            NUMERIC;
  v_recargo         NUMERIC;
  v_total           NUMERIC;
  v_metodos         INT;
  v_metodo_final    VARCHAR;
  v_malos           INT;
BEGIN
  PERFORM exigir_rol('cajero', 'admin', 'dev');

  IF p_pagos IS NULL OR jsonb_typeof(p_pagos) <> 'array' OR jsonb_array_length(p_pagos) = 0 THEN
    RAISE EXCEPTION 'SIN_PAGOS';
  END IF;

  SELECT COUNT(*) INTO v_malos
  FROM jsonb_array_elements(p_pagos) AS pg
  WHERE (pg->>'metodo') IS NULL
     OR (pg->>'metodo') NOT IN ('efectivo', 'nequi', 'datafono', 'bancolombia')
     OR (pg->>'monto') IS NULL
     OR (pg->>'monto')::NUMERIC <= 0;

  IF v_malos > 0 THEN
    RAISE EXCEPTION 'METODO_INVALIDO';
  END IF;

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

  IF v_estado = 'cancelado' THEN
    RAISE EXCEPTION 'PEDIDO_CANCELADO';
  END IF;

  v_base := v_subtotal + v_costo_domicilio;

  SELECT COALESCE(SUM((value->>'monto')::NUMERIC), 0),
         COUNT(DISTINCT value->>'metodo')
    INTO v_suma, v_metodos
  FROM jsonb_array_elements(p_pagos);

  IF ROUND(v_suma) <> ROUND(v_base) THEN
    RAISE EXCEPTION 'MONTOS_NO_CUADRAN';
  END IF;

  -- 5% solo sobre lo que efectivamente pasa por el datáfono
  SELECT COALESCE(SUM(ROUND((value->>'monto')::NUMERIC * 0.05)), 0)
    INTO v_recargo
  FROM jsonb_array_elements(p_pagos)
  WHERE value->>'metodo' = 'datafono';

  v_total := v_base + v_recargo;

  DELETE FROM pagos_pedido WHERE pedido_id = p_pedido_id;

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
    cobrado_por = NULLIF(BTRIM(p_cobrado_por), ''),
    closed_at   = NOW()
  WHERE id = p_pedido_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. Menú, categorías, insumos, recetas: solo administración
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_producto_activo(p_producto_id INT, p_activo BOOLEAN)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  UPDATE productos SET activo = p_activo WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION crear_producto(
  p_nombre VARCHAR,
  p_precio INT,
  p_categoria_id INT DEFAULT NULL,
  p_es_adicion BOOLEAN DEFAULT FALSE
)
RETURNS INT AS $$
DECLARE
  v_producto_id INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF p_precio IS NULL OR p_precio <= 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  IF p_categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categorias WHERE id = p_categoria_id) THEN
    RAISE EXCEPTION 'CATEGORIA_NO_ENCONTRADA';
  END IF;

  INSERT INTO productos (nombre, precio, categoria_id, es_adicion, activo)
  VALUES (BTRIM(p_nombre), p_precio, p_categoria_id, COALESCE(p_es_adicion, FALSE), TRUE)
  RETURNING id INTO v_producto_id;

  RETURN v_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION actualizar_producto(
  p_producto_id INT,
  p_nombre VARCHAR,
  p_precio INT,
  p_categoria_id INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF p_precio IS NULL OR p_precio <= 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  IF p_categoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categorias WHERE id = p_categoria_id) THEN
    RAISE EXCEPTION 'CATEGORIA_NO_ENCONTRADA';
  END IF;

  UPDATE productos
     SET nombre = BTRIM(p_nombre),
         precio = p_precio,
         categoria_id = p_categoria_id
   WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION eliminar_producto(p_producto_id INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF EXISTS (SELECT 1 FROM detalle_pedidos WHERE producto_id = p_producto_id) THEN
    RAISE EXCEPTION 'PRODUCTO_CON_HISTORIAL';
  END IF;

  DELETE FROM productos WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION crear_categoria(p_nombre VARCHAR, p_orden INT DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  v_categoria_id INT;
  v_orden INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM categorias WHERE LOWER(BTRIM(nombre)) = LOWER(BTRIM(p_nombre))) THEN
    RAISE EXCEPTION 'CATEGORIA_REPETIDA';
  END IF;

  v_orden := p_orden;
  IF v_orden IS NULL THEN
    SELECT COALESCE(MAX(orden), 0) + 1 INTO v_orden FROM categorias;
  END IF;

  INSERT INTO categorias (nombre, orden)
  VALUES (BTRIM(p_nombre), v_orden)
  RETURNING id INTO v_categoria_id;

  RETURN v_categoria_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION actualizar_categoria(p_categoria_id INT, p_nombre VARCHAR, p_orden INT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF BTRIM(COALESCE(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM categorias
    WHERE LOWER(BTRIM(nombre)) = LOWER(BTRIM(p_nombre)) AND id <> p_categoria_id
  ) THEN
    RAISE EXCEPTION 'CATEGORIA_REPETIDA';
  END IF;

  UPDATE categorias
     SET nombre = BTRIM(p_nombre),
         orden = COALESCE(p_orden, orden)
   WHERE id = p_categoria_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATEGORIA_NO_ENCONTRADA';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION eliminar_categoria(p_categoria_id INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  DELETE FROM categorias WHERE id = p_categoria_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATEGORIA_NO_ENCONTRADA';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION crear_insumo(p_nombre VARCHAR, p_unidad_base VARCHAR)
RETURNS INT AS $$
DECLARE
  v_insumo_id INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

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
  PERFORM exigir_rol('admin', 'dev');

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

/**
 * Reemplaza la receta completa. Ya no descarta en silencio las cantidades no
 * positivas ni acepta un insumo repetido: lo dice, para que el error se vea.
 */
CREATE OR REPLACE FUNCTION guardar_receta(p_producto_id INT, p_items JSONB)
RETURNS VOID AS $$
DECLARE
  v_malas INT;
  v_total INT;
  v_distintos INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF NOT EXISTS (SELECT 1 FROM productos WHERE id = p_producto_id) THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUERIDOS';
  END IF;

  SELECT COUNT(*) INTO v_malas
  FROM jsonb_array_elements(p_items) AS it
  WHERE NOT EXISTS (SELECT 1 FROM insumos i WHERE i.id = (it->>'insumo_id')::INT);

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'INSUMO_NO_ENCONTRADO';
  END IF;

  SELECT COUNT(*) INTO v_malas
  FROM jsonb_array_elements(p_items) AS it
  WHERE (it->>'cantidad_usada') IS NULL OR (it->>'cantidad_usada')::NUMERIC <= 0;

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT it->>'insumo_id') INTO v_total, v_distintos
  FROM jsonb_array_elements(p_items) AS it;

  IF v_total <> v_distintos THEN
    RAISE EXCEPTION 'INSUMO_REPETIDO';
  END IF;

  DELETE FROM receta_items WHERE producto_id = p_producto_id;

  INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada)
  SELECT p_producto_id, (it->>'insumo_id')::INT, (it->>'cantidad_usada')::NUMERIC
  FROM jsonb_array_elements(p_items) AS it;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. Vistas de costeo: respetan RLS y distinguen "sin costo" de "costo 0"
-- ============================================================
DROP VIEW IF EXISTS public.vw_producto_costos;
DROP VIEW IF EXISTS public.vw_insumo_costo_actual;

-- LEFT JOIN LATERAL: un insumo sin compras aparece con costo NULL en vez de
-- desaparecer de la vista (y de convertirse en costo 0 más abajo).
CREATE VIEW public.vw_insumo_costo_actual
WITH (security_invoker = true) AS
SELECT
  i.id AS insumo_id,
  i.nombre,
  i.unidad_base,
  AVG(ultimos.precio_compra / ultimos.rendimiento) AS costo_unitario
FROM public.insumos i
LEFT JOIN LATERAL (
  SELECT ci.precio_compra, ci.rendimiento
  FROM public.compras_insumo ci
  WHERE ci.insumo_id = i.id
  ORDER BY ci.fecha DESC, ci.id DESC
  LIMIT 5
) ultimos ON true
GROUP BY i.id, i.nombre, i.unidad_base;

COMMENT ON VIEW public.vw_insumo_costo_actual IS
  'Costo por unidad_base de cada insumo: promedio de sus últimos 5 lotes. NULL si nunca se registró una compra.';

CREATE VIEW public.vw_producto_costos
WITH (security_invoker = true) AS
SELECT
  p.id AS producto_id,
  p.nombre,
  p.precio,
  COALESCE(SUM(ri.cantidad_usada * vc.costo_unitario), 0) AS costo_total,
  CASE
    WHEN p.precio > 0
      THEN (p.precio - COALESCE(SUM(ri.cantidad_usada * vc.costo_unitario), 0)) / p.precio
    ELSE NULL
  END AS margen,
  COUNT(ri.id)::INT AS insumos_en_receta,
  COUNT(ri.id) FILTER (WHERE vc.costo_unitario IS NULL)::INT AS insumos_sin_costo
FROM public.productos p
LEFT JOIN public.receta_items ri ON ri.producto_id = p.id
LEFT JOIN public.vw_insumo_costo_actual vc ON vc.insumo_id = ri.insumo_id
GROUP BY p.id, p.nombre, p.precio;

COMMENT ON VIEW public.vw_producto_costos IS
  'Costo total y margen de cada producto. insumos_en_receta = 0 → sin receta; insumos_sin_costo > 0 → el costo está incompleto (falta registrar compras).';

-- ============================================================
-- 7. Arqueo de caja: un solo turno abierto, escritura por función
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_arqueos_caja_un_abierto
  ON public.arqueos_caja ((estado))
  WHERE estado = 'abierto';

CREATE OR REPLACE FUNCTION abrir_caja(p_base_inicial NUMERIC)
RETURNS INT AS $$
DECLARE
  v_id INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF p_base_inicial IS NULL OR p_base_inicial < 0 THEN
    RAISE EXCEPTION 'BASE_INVALIDA';
  END IF;

  IF EXISTS (SELECT 1 FROM arqueos_caja WHERE estado = 'abierto') THEN
    RAISE EXCEPTION 'CAJA_YA_ABIERTA';
  END IF;

  INSERT INTO arqueos_caja (base_inicial, estado)
  VALUES (ROUND(p_base_inicial), 'abierto')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cerrar_caja(p_id INT, p_efectivo NUMERIC, p_transferencias NUMERIC)
RETURNS VOID AS $$
DECLARE
  v_estado VARCHAR;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  SELECT estado INTO v_estado FROM arqueos_caja WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAJA_NO_ENCONTRADA';
  END IF;

  IF v_estado <> 'abierto' THEN
    RAISE EXCEPTION 'CAJA_YA_CERRADA';
  END IF;

  UPDATE arqueos_caja SET
    estado               = 'cerrado',
    closed_at            = NOW(),
    total_efectivo       = ROUND(COALESCE(p_efectivo, 0)),
    total_transferencias = ROUND(COALESCE(p_transferencias, 0))
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 8. Índices para las consultas calientes y realtime del menú
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON public.pedidos (created_at);

-- /pedidos escucha cambios en productos para enterarse de los agotados sin
-- recargar. La publicación ya existe en Supabase; solo se agrega la tabla.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'productos'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.productos;
  END IF;
END $$;
