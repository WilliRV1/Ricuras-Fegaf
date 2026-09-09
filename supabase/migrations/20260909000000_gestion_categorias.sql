-- Migration: Gestión de categorías del menú — crear/editar/borrar
--
-- Hasta ahora `categorias` solo se podía leer; para asignarle una nueva a un
-- producto había que crearla directo en la base. Mismo patrón que
-- 20260908000002_gestion_menu_productos.sql: la tabla nunca tuvo política de
-- escritura para la clave pública, se agregan solo las funciones.
--
-- Borrar una categoría no rompe nada: `productos.categoria_id` ya es
-- ON DELETE SET NULL — los productos que la usaban quedan "sin categoría",
-- no se bloquean ni se borran.

CREATE OR REPLACE FUNCTION crear_categoria(p_nombre VARCHAR, p_orden INT DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  v_categoria_id INT;
  v_orden INT;
BEGIN
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

COMMENT ON FUNCTION crear_categoria IS
  'Da de alta una categoría del menú. Sin orden explícito, va al final.';

CREATE OR REPLACE FUNCTION actualizar_categoria(p_categoria_id INT, p_nombre VARCHAR, p_orden INT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
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

COMMENT ON FUNCTION actualizar_categoria IS
  'Edita nombre y/u orden de una categoría existente.';

CREATE OR REPLACE FUNCTION eliminar_categoria(p_categoria_id INT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM categorias WHERE id = p_categoria_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATEGORIA_NO_ENCONTRADA';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION eliminar_categoria IS
  'Borra una categoría. Los productos que la tenían quedan sin categoría (ON DELETE SET NULL), no se bloquean.';
