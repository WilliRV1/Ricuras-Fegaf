-- Migration: Fase 2 / Módulo 7 — Control de Egresos Operativos
--
-- Las compras de insumos ya quedan cubiertas por compras_insumo (Módulo 6,
-- migración 20260908000000): mismo dato, misma pantalla, no se duplica esa
-- captura. Lo que falta es el resto de gastos que la dueña lleva a mano en
-- la hoja GASTOS F&F del Excel — servicios públicos, gasolina, arriendo,
-- pagos a ayudantes, mantenimiento — con descripción y categoría libres,
-- porque en el Excel real las categorías son muy variadas y no encajan en
-- un catálogo fijo.
--
-- Mismo criterio que el resto de la Fase 2: datos financieros, lectura solo
-- 'authenticated', escritura únicamente vía RPC SECURITY DEFINER.

CREATE TABLE public.gastos (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('fijo', 'variable')),
    valor NUMERIC NOT NULL CHECK (valor > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.gastos IS
  'Gastos operativos que no son compra de insumos (servicios, arriendo, pagos a ayudantes, mantenimiento). Las compras de insumos van en compras_insumo.';

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_read_gastos ON public.gastos
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- RPCs SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION crear_gasto(
  p_descripcion VARCHAR,
  p_categoria VARCHAR,
  p_tipo VARCHAR,
  p_valor NUMERIC,
  p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS INT AS $$
DECLARE
  v_gasto_id INT;
BEGIN
  IF BTRIM(COALESCE(p_descripcion, '')) = '' THEN
    RAISE EXCEPTION 'DESCRIPCION_REQUERIDA';
  END IF;

  IF BTRIM(COALESCE(p_categoria, '')) = '' THEN
    RAISE EXCEPTION 'CATEGORIA_REQUERIDA';
  END IF;

  IF p_tipo NOT IN ('fijo', 'variable') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  INSERT INTO gastos (descripcion, categoria, tipo, valor, fecha)
  VALUES (BTRIM(p_descripcion), BTRIM(p_categoria), p_tipo, p_valor, COALESCE(p_fecha, CURRENT_DATE))
  RETURNING id INTO v_gasto_id;

  RETURN v_gasto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION crear_gasto IS
  'Registra un gasto operativo (no insumos: eso va en compras_insumo).';

CREATE OR REPLACE FUNCTION eliminar_gasto(p_gasto_id INT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM gastos WHERE id = p_gasto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GASTO_NO_ENCONTRADO';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION eliminar_gasto IS
  'Borra un gasto registrado por error.';
