-- Migration: Gestión del menú — crear/editar/eliminar productos
--
-- `productos` nunca tuvo política de escritura para la clave pública (ver
-- 20260902000000_precios_server_side_y_stock.sql): hoy el menú se administra
-- directo en la base. Este módulo no estaba en los módulos 6-8 de la Fase 2
-- (esos asumen que el menú ya existe) — se agrega aparte, a pedido del
-- usuario, para poder crear/editar/borrar productos desde el front.
--
-- `categorias`/`productos` siguen con lectura pública (no hay dato de
-- cliente ahí); solo se agregan las funciones de escritura.

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

COMMENT ON FUNCTION crear_producto IS
  'Da de alta un producto del menú. Nace activo, disponible de inmediato en la toma de pedidos.';

CREATE OR REPLACE FUNCTION actualizar_producto(
  p_producto_id INT,
  p_nombre VARCHAR,
  p_precio INT,
  p_categoria_id INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
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

COMMENT ON FUNCTION actualizar_producto IS
  'Edita nombre/precio/categoría de un producto existente. Los pedidos ya facturados conservan el precio que tenían (ver update_order_with_details), así que subir el precio aquí no altera el historial.';

CREATE OR REPLACE FUNCTION eliminar_producto(p_producto_id INT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM detalle_pedidos WHERE producto_id = p_producto_id) THEN
    RAISE EXCEPTION 'PRODUCTO_CON_HISTORIAL';
  END IF;

  DELETE FROM productos WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION eliminar_producto IS
  'Borra un producto que nunca se vendió. Si ya aparece en algún pedido, se rechaza (PRODUCTO_CON_HISTORIAL) para no romper el historial facturado — la alternativa es desactivarlo con toggle_producto_activo.';
