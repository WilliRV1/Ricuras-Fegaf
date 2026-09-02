-- Migration: Cada persona con su propio PIN
--
-- Hasta ahora había UNA clave para todo el local, escrita en el código
-- (`fgaf2026`) más un PIN fijo para el dashboard (`3136`). Eso trae dos
-- problemas:
--
--   1. La base no puede saber quién hizo qué. Cuando en el local preguntan
--      "¿quién borró ese pedido?", no hay respuesta posible.
--   2. Sacar a alguien del sistema exige cambiar el código y desplegar.
--
-- Ahora cada persona tiene su usuario y su PIN de 4 dígitos, que ella misma
-- elige y que nadie más conoce — ni siquiera quien administra, que solo puede
-- resetearlo, nunca verlo.
--
-- NOTA DE SEGURIDAD
-- La app se conecta con la clave pública (anon), que cualquiera puede leer
-- desde el navegador. Por eso:
--   · El PIN nunca sale de la base: se guarda cifrado (bcrypt) y solo se
--     compara adentro. Ninguna función devuelve el hash.
--   · Las funciones administrativas exigen el PIN de quien administra, así
--     que tener la clave pública no alcanza para crear usuarios.
--   · Hay bloqueo por intentos fallidos, para que no se pueda adivinar un PIN
--     de 4 dígitos a fuerza de probar.

-- ============================================================
-- 1. Tabla de usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id                SERIAL PRIMARY KEY,
  nombre            VARCHAR(60) NOT NULL,
  -- bcrypt del PIN. Nunca sale de la base.
  pin_hash          TEXT NOT NULL,
  rol               VARCHAR(20) NOT NULL DEFAULT 'cajero',
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  -- TRUE mientras el PIN sea el temporal que puso quien administra: la app
  -- obliga a cambiarlo antes de dejar entrar.
  debe_cambiar_pin  BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ NULL,
  ultimo_ingreso    TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT usuarios_rol_check CHECK (rol IN ('cajero', 'cocina', 'admin'))
);

-- Dos personas no pueden llamarse igual: el nombre es lo que se toca al entrar
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nombre
  ON public.usuarios (LOWER(BTRIM(nombre)));

COMMENT ON TABLE public.usuarios IS
  'Personas que operan el local. El PIN se guarda cifrado y nunca se devuelve.';
COMMENT ON COLUMN public.usuarios.rol IS
  'cajero = pedidos y liquidación · cocina = solo el tablero · admin = todo, incluido el dashboard.';
COMMENT ON COLUMN public.usuarios.debe_cambiar_pin IS
  'TRUE = todavía tiene el PIN temporal. La app exige cambiarlo antes de dejar entrar.';

-- ============================================================
-- 2. RLS: la tabla NO se lee ni se escribe directamente
--
--    Todo pasa por las funciones de abajo, que son las únicas que pueden
--    tocar los hashes. Sin políticas para `anon`, cualquier consulta directa
--    a `usuarios` desde la app devuelve vacío.
-- ============================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "public_insert_usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "public_update_usuarios" ON public.usuarios;

-- ============================================================
-- 3. Ayudas internas
-- ============================================================

/** Un PIN válido son exactamente 4 dígitos y no puede ser algo obvio */
CREATE OR REPLACE FUNCTION pin_valido(p_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RETURN FALSE;
  END IF;

  -- 0000, 1111… y 1234 / 4321: los primeros que prueba cualquiera
  IF p_pin ~ '^(.)\1{3}$' OR p_pin IN ('1234', '4321') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

/**
 * Comprueba el PIN de un usuario activo y devuelve su id, o NULL.
 * Lleva la cuenta de intentos fallidos y aplica el bloqueo temporal.
 */
CREATE OR REPLACE FUNCTION verificar_credenciales(p_usuario_id INT, p_pin TEXT)
RETURNS INT AS $$
DECLARE
  v_usuario RECORD;
BEGIN
  SELECT * INTO v_usuario
  FROM usuarios
  WHERE id = p_usuario_id AND activo
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_usuario.bloqueado_hasta IS NOT NULL AND v_usuario.bloqueado_hasta > NOW() THEN
    RAISE EXCEPTION 'USUARIO_BLOQUEADO';
  END IF;

  IF v_usuario.pin_hash = extensions.crypt(p_pin, v_usuario.pin_hash) THEN
    UPDATE usuarios
       SET intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = p_usuario_id;
    RETURN p_usuario_id;
  END IF;

  -- Falló: a los 5 intentos se bloquea 5 minutos. Adivinar un PIN de 4
  -- dígitos pasa de segundos a más de una semana de intentos seguidos.
  UPDATE usuarios
     SET intentos_fallidos = intentos_fallidos + 1,
         bloqueado_hasta = CASE
           WHEN intentos_fallidos + 1 >= 5 THEN NOW() + INTERVAL '5 minutes'
           ELSE NULL
         END
   WHERE id = p_usuario_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/** Verifica que quien pide una acción administrativa sea un admin con su PIN */
CREATE OR REPLACE FUNCTION exigir_admin(p_admin_id INT, p_admin_pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_rol VARCHAR;
BEGIN
  IF verificar_credenciales(p_admin_id, p_admin_pin) IS NULL THEN
    RAISE EXCEPTION 'ADMIN_NO_AUTORIZADO';
  END IF;

  SELECT rol INTO v_rol FROM usuarios WHERE id = p_admin_id;

  IF v_rol <> 'admin' THEN
    RAISE EXCEPTION 'ADMIN_NO_AUTORIZADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 4. Entrar
-- ============================================================

/**
 * Lista para la pantalla de entrada: solo nombre y rol de la gente activa.
 * No expone hashes ni intentos fallidos.
 */
CREATE OR REPLACE FUNCTION listar_usuarios_activos()
RETURNS TABLE (id INT, nombre VARCHAR, rol VARCHAR) AS $$
  SELECT u.id, u.nombre, u.rol
  FROM usuarios u
  WHERE u.activo
  ORDER BY u.nombre;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

/**
 * Entrar con nombre + PIN.
 * Devuelve quién es y si todavía tiene que elegir su propio PIN.
 */
CREATE OR REPLACE FUNCTION iniciar_sesion(p_usuario_id INT, p_pin TEXT)
RETURNS TABLE (id INT, nombre VARCHAR, rol VARCHAR, debe_cambiar_pin BOOLEAN) AS $$
DECLARE
  v_id INT;
BEGIN
  v_id := verificar_credenciales(p_usuario_id, p_pin);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  UPDATE usuarios SET ultimo_ingreso = NOW() WHERE usuarios.id = v_id;

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol, u.debe_cambiar_pin
    FROM usuarios u
    WHERE u.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/**
 * Confirmar el PIN sin abrir sesión.
 * Se usa al anular un pedido: en una tablet compartida, la sesión abierta no
 * prueba quién está parado ahí en ese momento.
 */
CREATE OR REPLACE FUNCTION confirmar_pin(p_usuario_id INT, p_pin TEXT)
RETURNS TABLE (id INT, nombre VARCHAR, rol VARCHAR) AS $$
DECLARE
  v_id INT;
BEGIN
  v_id := verificar_credenciales(p_usuario_id, p_pin);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol FROM usuarios u WHERE u.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 5. Cada quien con su PIN
-- ============================================================

/**
 * Cambiar el propio PIN. Exige el PIN actual, así que ni quien administra
 * puede cambiárselo a otro: solo resetearlo (abajo).
 */
CREATE OR REPLACE FUNCTION cambiar_pin(p_usuario_id INT, p_pin_actual TEXT, p_pin_nuevo TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT pin_valido(p_pin_nuevo) THEN
    RAISE EXCEPTION 'PIN_INVALIDO';
  END IF;

  IF p_pin_actual = p_pin_nuevo THEN
    RAISE EXCEPTION 'PIN_REPETIDO';
  END IF;

  IF verificar_credenciales(p_usuario_id, p_pin_actual) IS NULL THEN
    RAISE EXCEPTION 'CREDENCIALES_INVALIDAS';
  END IF;

  UPDATE usuarios
     SET pin_hash = extensions.crypt(p_pin_nuevo, extensions.gen_salt('bf')),
         debe_cambiar_pin = FALSE,
         intentos_fallidos = 0,
         bloqueado_hasta = NULL
   WHERE id = p_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 6. Administración (exige el PIN de quien administra)
-- ============================================================

/**
 * Dar de alta a alguien con un PIN temporal.
 * Ese PIN sirve una sola vez: al entrar, la app lo obliga a poner el suyo.
 */
CREATE OR REPLACE FUNCTION crear_usuario(
  p_admin_id INT,
  p_admin_pin TEXT,
  p_nombre VARCHAR,
  p_rol VARCHAR,
  p_pin_temporal TEXT
) RETURNS INT AS $$
DECLARE
  v_nombre VARCHAR;
  v_id INT;
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  v_nombre := NULLIF(BTRIM(p_nombre), '');
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'NOMBRE_REQUERIDO';
  END IF;

  IF p_rol NOT IN ('cajero', 'cocina', 'admin') THEN
    RAISE EXCEPTION 'ROL_INVALIDO';
  END IF;

  IF NOT pin_valido(p_pin_temporal) THEN
    RAISE EXCEPTION 'PIN_INVALIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM usuarios WHERE LOWER(BTRIM(nombre)) = LOWER(v_nombre)) THEN
    RAISE EXCEPTION 'NOMBRE_REPETIDO';
  END IF;

  INSERT INTO usuarios (nombre, pin_hash, rol, debe_cambiar_pin)
  VALUES (v_nombre, extensions.crypt(p_pin_temporal, extensions.gen_salt('bf')), p_rol, TRUE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/**
 * Resetear el PIN de alguien que lo olvidó: se le pone uno temporal y queda
 * obligado a elegir el suyo al entrar. Quien administra nunca ve el PIN real.
 */
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
         bloqueado_hasta = NULL
   WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/**
 * Activar o desactivar a alguien. No se borra: los pedidos que registró
 * conservan su nombre y el historial queda intacto.
 */
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

  -- No dejar el local sin nadie que pueda administrar
  IF NOT p_activo THEN
    SELECT COUNT(*) INTO v_admins_activos
    FROM usuarios
    WHERE rol = 'admin' AND activo AND id <> p_usuario_id;

    IF v_admins_activos = 0 THEN
      RAISE EXCEPTION 'ULTIMO_ADMIN';
    END IF;
  END IF;

  UPDATE usuarios SET activo = p_activo WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/** Listado completo para la pantalla de administración (sin hashes) */
CREATE OR REPLACE FUNCTION listar_usuarios_admin(p_admin_id INT, p_admin_pin TEXT)
RETURNS TABLE (
  id INT,
  nombre VARCHAR,
  rol VARCHAR,
  activo BOOLEAN,
  debe_cambiar_pin BOOLEAN,
  bloqueado BOOLEAN,
  ultimo_ingreso TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol, u.activo, u.debe_cambiar_pin,
           (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado,
           u.ultimo_ingreso
    FROM usuarios u
    ORDER BY u.activo DESC, u.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 7. Quién hizo qué
--
--    Se guarda el NOMBRE, no el id: si mañana se da de baja a alguien, el
--    historial sigue diciendo quién tomó ese pedido.
-- ============================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS creado_por VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS cobrado_por VARCHAR(60) NULL;

COMMENT ON COLUMN public.pedidos.creado_por IS
  'Nombre de quien tomó el pedido, según la sesión abierta en la terminal.';
COMMENT ON COLUMN public.pedidos.cobrado_por IS
  'Nombre de quien registró el cobro.';

-- ============================================================
-- 8. Primer usuario, para poder entrar
--
--    Se crea la cuenta de administración con el PIN que ya se usaba para el
--    dashboard. Marcada para cambio obligatorio: al primer ingreso hay que
--    elegir un PIN propio.
-- ============================================================
INSERT INTO public.usuarios (nombre, pin_hash, rol, debe_cambiar_pin)
SELECT 'Administración', extensions.crypt('3136', extensions.gen_salt('bf')), 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios);

-- ============================================================
-- 9. Registrar quién tomó y quién cobró cada pedido
--
--    Se hace DENTRO de los RPC existentes, no con un UPDATE posterior: un
--    UPDATE sobre `pedidos` recién insertado dispara el evento de tiempo real
--    y a cocina le sonaría la campana de "pedido modificado" en cada venta.
--
--    Como en la migración anterior: agregar un parámetro con CREATE OR REPLACE
--    crea una sobrecarga en vez de reemplazar, así que primero se borran todas
--    las versiones.
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
      AND p.proname IN ('create_order_with_details', 'close_order_with_payments')
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
    costo_domicilio,
    creado_por
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
    COALESCE(p_costo_domicilio, 0),
    NULLIF(BTRIM(p_creado_por), '')
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
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION close_order_with_payments(
  p_pedido_id INT,
  -- [{ "metodo": "efectivo", "monto": 30000 }, { "metodo": "datafono", "monto": 20000 }]
  p_pagos JSONB,
  p_cobrado_por VARCHAR DEFAULT NULL
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

  -- Un pedido anulado no se cobra: si se quiere cobrar, hay que volver a montarlo
  IF v_estado = 'cancelado' THEN
    RAISE EXCEPTION 'PEDIDO_CANCELADO';
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
    cobrado_por = NULLIF(BTRIM(p_cobrado_por), ''),
    closed_at   = NOW()
  WHERE id = p_pedido_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;
