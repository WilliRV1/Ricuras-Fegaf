-- ============================================================
-- Rol "dev": mismo alcance que admin, pero separado de la cuenta
-- real de administración del negocio — para pruebas y desarrollo.
-- ============================================================

ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('cajero', 'cocina', 'admin', 'dev'));

/** Verifica que quien pide una acción administrativa sea admin o dev, con su PIN */
CREATE OR REPLACE FUNCTION exigir_admin(p_admin_id INT, p_admin_pin TEXT)
RETURNS VOID AS $$
DECLARE
  v_rol VARCHAR;
BEGIN
  IF verificar_credenciales(p_admin_id, p_admin_pin) IS NULL THEN
    RAISE EXCEPTION 'ADMIN_NO_AUTORIZADO';
  END IF;

  SELECT rol INTO v_rol FROM usuarios WHERE id = p_admin_id;

  IF v_rol NOT IN ('admin', 'dev') THEN
    RAISE EXCEPTION 'ADMIN_NO_AUTORIZADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

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

  IF p_rol NOT IN ('cajero', 'cocina', 'admin', 'dev') THEN
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
