-- Migration: Cambio de PIN voluntario, bebidas "que se compran hechas" y
-- parámetros del negocio (pago al domiciliario, programados).
--
-- Peticiones del 19-21/9/2026:
--
--  1. PIN. El domiciliario vio el PIN de administración y no había forma de
--     cambiarlo sin que admin lo reseteara. Ahora:
--       · `cambiar_pin` sirve en cualquier momento (ya exigía el PIN actual),
--         sube `sesion_version` (cierra las sesiones abiertas en otras
--         tablets) y deja constancia en `pin_cambiado_at`.
--       · `forzar_cambio_pin`: administración obliga a alguien a elegir PIN
--         nuevo al próximo ingreso SIN conocer ni tocar su PIN actual.
--       · `listar_usuarios_admin` muestra cuándo cambió cada quien su PIN.
--
--  2. Bebidas por sabor. Las gaseosas, aguas y jugos no llevan receta: se
--     compran hechas. Un producto puede enlazarse a un insumo propio
--     (`productos.insumo_id`) con receta "1 unidad de sí mismo": el costo
--     sale del historial de compras igual que la hoja PRECIOS del Excel
--     (varias compras, promedio) y la vista de costos no cambia.
--
--  3. `parametros`: tarifa por producto y mínimo diario del domiciliario,
--     minutos de anticipación de los programados en cocina, categoría de
--     bebidas. Editables desde el dashboard, no en el código.
--
-- Idempotente.

-- ============================================================
-- 1. PIN
-- ============================================================
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS pin_cambiado_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.usuarios.pin_cambiado_at IS
  'Última vez que la persona eligió su PIN. NULL = todavía tiene el temporal o nunca lo cambió.';

/**
 * Cambiar el propio PIN. Exige el actual (nadie, ni admin, puede cambiárselo
 * a otro). Cierra las sesiones que la persona tuviera abiertas en otras
 * tablets: si alguien vio el PIN y entró, se cae.
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
         bloqueado_hasta = NULL,
         sesion_version = sesion_version + 1,
         pin_cambiado_at = NOW()
   WHERE id = p_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/**
 * Obligar a alguien a elegir PIN nuevo al próximo ingreso, sin conocer ni
 * tocar el actual. Para "todos cambien el PIN" tras un incidente.
 */
CREATE OR REPLACE FUNCTION forzar_cambio_pin(p_admin_id INT, p_admin_pin TEXT, p_usuario_id INT)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  UPDATE usuarios
     SET debe_cambiar_pin = TRUE,
         sesion_version = sesion_version + 1
   WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

/**
 * Cuándo cambió su PIN la persona de la sesión (para avisar en el dashboard
 * si lleva mucho sin cambiarlo). Solo con sesión; devuelve NULL si nunca.
 */
CREATE OR REPLACE FUNCTION pin_cambiado_at_de(p_usuario_id INT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_fecha TIMESTAMPTZ;
BEGIN
  PERFORM exigir_rol('cajero', 'cocina', 'admin', 'dev');
  SELECT pin_cambiado_at INTO v_fecha FROM usuarios WHERE id = p_usuario_id;
  RETURN v_fecha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Cambia el tipo de retorno: hay que borrarla antes.
DROP FUNCTION IF EXISTS public.listar_usuarios_admin(INT, TEXT);

CREATE FUNCTION listar_usuarios_admin(p_admin_id INT, p_admin_pin TEXT)
RETURNS TABLE (
  id INT,
  nombre VARCHAR,
  rol VARCHAR,
  activo BOOLEAN,
  debe_cambiar_pin BOOLEAN,
  bloqueado BOOLEAN,
  ultimo_ingreso TIMESTAMPTZ,
  pin_cambiado_at TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM exigir_admin(p_admin_id, p_admin_pin);

  RETURN QUERY
    SELECT u.id, u.nombre, u.rol, u.activo, u.debe_cambiar_pin,
           (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado,
           u.ultimo_ingreso,
           u.pin_cambiado_at
    FROM usuarios u
    ORDER BY u.activo DESC, u.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================
-- 2. Productos que se compran hechos (bebidas)
-- ============================================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS insumo_id INT NULL REFERENCES public.insumos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.productos.insumo_id IS
  'Si no es NULL, el producto se compra hecho (gaseosa, agua, jugo): su costo es el de este insumo, con receta de 1 unidad.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_insumo_id
  ON public.productos (insumo_id) WHERE insumo_id IS NOT NULL;

-- crear_producto gana un parámetro: borrar todas las versiones primero
-- (CREATE OR REPLACE con firma nueva crea una sobrecarga y rompe las llamadas).
DO $$
DECLARE
  v_firma TEXT;
BEGIN
  FOR v_firma IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'crear_producto'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || v_firma;
  END LOOP;
END $$;

CREATE FUNCTION crear_producto(
  p_nombre VARCHAR,
  p_precio INT,
  p_categoria_id INT DEFAULT NULL,
  p_es_adicion BOOLEAN DEFAULT FALSE,
  p_se_compra_hecho BOOLEAN DEFAULT FALSE
)
RETURNS INT AS $$
DECLARE
  v_producto_id INT;
  v_insumo_id INT;
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

  -- Se compra hecho: insumo propio + receta de 1 unidad. Las compras se
  -- registran después con registrar_compra_insumo, como cualquier insumo.
  IF COALESCE(p_se_compra_hecho, FALSE) THEN
    INSERT INTO insumos (nombre, unidad_base)
    VALUES (BTRIM(p_nombre), 'unidad')
    RETURNING id INTO v_insumo_id;

    UPDATE productos SET insumo_id = v_insumo_id WHERE id = v_producto_id;

    INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada)
    VALUES (v_producto_id, v_insumo_id, 1);
  END IF;

  RETURN v_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION crear_producto IS
  'Da de alta un producto (admin/dev). Con p_se_compra_hecho crea también su insumo y una receta de 1 unidad: el costo sale de las compras registradas.';

/** Editar; si el producto se compra hecho, su insumo se renombra con él */
CREATE OR REPLACE FUNCTION actualizar_producto(
  p_producto_id INT,
  p_nombre VARCHAR,
  p_precio INT,
  p_categoria_id INT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_insumo_id INT;
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
   WHERE id = p_producto_id
   RETURNING insumo_id INTO v_insumo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  IF v_insumo_id IS NOT NULL THEN
    UPDATE insumos SET nombre = BTRIM(p_nombre) WHERE id = v_insumo_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

/** Borrar (solo si nunca se vendió); se lleva su insumo propio si nadie más lo usa */
CREATE OR REPLACE FUNCTION eliminar_producto(p_producto_id INT)
RETURNS VOID AS $$
DECLARE
  v_insumo_id INT;
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF EXISTS (SELECT 1 FROM detalle_pedidos WHERE producto_id = p_producto_id) THEN
    RAISE EXCEPTION 'PRODUCTO_CON_HISTORIAL';
  END IF;

  DELETE FROM productos WHERE id = p_producto_id RETURNING insumo_id INTO v_insumo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;

  -- Su receta ya se fue en cascada; si el insumo no aparece en otra receta,
  -- tampoco tiene sentido dejarlo en el catálogo.
  IF v_insumo_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM receta_items WHERE insumo_id = v_insumo_id) THEN
    DELETE FROM insumos WHERE id = v_insumo_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. Parámetros del negocio
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametros (
  clave       TEXT PRIMARY KEY,
  valor       NUMERIC NOT NULL,
  descripcion TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.parametros IS
  'Cifras del negocio que cambian sin tocar el código (tarifa del domiciliario, mínimo del día, anticipación de programados).';

ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_read_parametros ON public.parametros;
CREATE POLICY authenticated_read_parametros ON public.parametros
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.parametros (clave, valor, descripcion) VALUES
  ('domiciliario_tarifa_producto', 1500,
   'Lo que se le paga al domiciliario por cada producto de comida (no bebidas) entregado a domicilio.'),
  ('domiciliario_minimo_dia', 40000,
   'Mínimo que recibe el domiciliario por día. Si la tarifa por productos no lo alcanza, el faltante sale del fondo aparte, no del negocio.'),
  ('domiciliario_maximo_dia', 0,
   'Máximo que recibe el domiciliario por día. Si la tarifa por productos lo supera, se paga el tope. 0 = sin tope.'),
  ('programados_minutos_antes', 15,
   'Minutos antes de la hora de entrega en que un pedido programado entra al tablero de cocina.'),
  ('categoria_bebidas_id',
   COALESCE((SELECT id FROM categorias WHERE LOWER(BTRIM(nombre)) = 'bebidas' LIMIT 1), 0),
   'Categoría cuyos productos NO cuentan para el pago al domiciliario (gaseosas, jugos, aguas).')
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION actualizar_parametro(p_clave TEXT, p_valor NUMERIC)
RETURNS VOID AS $$
BEGIN
  PERFORM exigir_rol('admin', 'dev');

  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  UPDATE parametros SET valor = p_valor, updated_at = NOW() WHERE clave = p_clave;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARAMETRO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION actualizar_parametro IS
  'Cambia una cifra del negocio (admin/dev). Solo se editan claves que ya existen.';
