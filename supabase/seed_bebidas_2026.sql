-- Seed: bebidas por sabor con sus compras, según el Excel de la dueña
-- (Control venta diaria Ricuras Fegaf 2026 - CAJAS.xlsx, hoja PRECIOS filas
-- 218-225). Requiere la migración 20260921000000 (productos.insumo_id).
--
--   node scripts/aplicar-migracion.mjs supabase/seed_bebidas_2026.sql
--
-- Idempotente: cada producto se crea solo si no existe uno con ese nombre,
-- y las compras solo si el insumo todavía no tiene ninguna.
--
-- Qué hace:
--   · Crea Coca-Cola y Postobón en 400 ml y 1,5 L como productos que se
--     compran hechos, con las compras del Excel (precio, cantidad, fecha).
--   · Enlaza los productos que ya existían y también se compran hechos
--     (Jugo Hit 500 ml, Agua con gas) a un insumo propio; al Hit le carga
--     su compra del Excel, al agua no hay dato (queda "sin compras").
--   · Desactiva "Gaseosa personal 400 ml" y "Gaseosa 1.5 Lt": los reemplazan
--     los sabores. No se borran porque tienen pedidos en el historial.
--
-- Los sabores de Postobón (Manzana, Colombiana, Uva…) y el agua sin gas los
-- crea la dueña desde el dashboard: el Excel no los distingue.

DO $$
DECLARE
  v_cat_bebidas INT;
  v_id INT;
  v_insumo INT;
BEGIN
  SELECT id INTO v_cat_bebidas FROM categorias WHERE LOWER(BTRIM(nombre)) = 'bebidas' LIMIT 1;
  IF v_cat_bebidas IS NULL THEN
    RAISE EXCEPTION 'No existe la categoría Bebidas';
  END IF;

  -- ── Coca-Cola 400 ml ─────────────────────────────────────────────
  SELECT id INTO v_id FROM productos WHERE LOWER(nombre) = LOWER('Gaseosa Coca-Cola 400 ml');
  IF v_id IS NULL THEN
    v_id := crear_producto('Gaseosa Coca-Cola 400 ml', 5000, v_cat_bebidas, FALSE, TRUE);
  END IF;
  SELECT insumo_id INTO v_insumo FROM productos WHERE id = v_id;
  IF v_insumo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compras_insumo WHERE insumo_id = v_insumo) THEN
    -- Paca x 12 a 30.500 → 2.999,67 la unidad (SALSAMENTARIA, junio 30/2025)
    PERFORM registrar_compra_insumo(v_insumo, 30500, 12, DATE '2025-06-30');
  END IF;

  -- ── Postobón 400 ml ──────────────────────────────────────────────
  SELECT id INTO v_id FROM productos WHERE LOWER(nombre) = LOWER('Gaseosa Postobón 400 ml');
  IF v_id IS NULL THEN
    v_id := crear_producto('Gaseosa Postobón 400 ml', 5000, v_cat_bebidas, FALSE, TRUE);
  END IF;
  SELECT insumo_id INTO v_insumo FROM productos WHERE id = v_id;
  IF v_insumo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compras_insumo WHERE insumo_id = v_insumo) THEN
    -- PET 400 ml a 2.550 (MERCAMIO, enero 06/2026)
    PERFORM registrar_compra_insumo(v_insumo, 2550, 1, DATE '2026-01-06');
  END IF;

  -- ── Coca-Cola 1,5 L ──────────────────────────────────────────────
  SELECT id INTO v_id FROM productos WHERE LOWER(nombre) = LOWER('Gaseosa Coca-Cola 1,5 L');
  IF v_id IS NULL THEN
    v_id := crear_producto('Gaseosa Coca-Cola 1,5 L', 10000, v_cat_bebidas, FALSE, TRUE);
  END IF;
  SELECT insumo_id INTO v_insumo FROM productos WHERE id = v_id;
  IF v_insumo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compras_insumo WHERE insumo_id = v_insumo) THEN
    -- Dos compras: 6.490 (D1, enero 10/2026) y 6.200 (SALSAMENTARIA, enero 16/2026)
    PERFORM registrar_compra_insumo(v_insumo, 6490, 1, DATE '2026-01-10');
    PERFORM registrar_compra_insumo(v_insumo, 6200, 1, DATE '2026-01-16');
  END IF;

  -- ── Postobón 1,5 L ───────────────────────────────────────────────
  SELECT id INTO v_id FROM productos WHERE LOWER(nombre) = LOWER('Gaseosa Postobón 1,5 L');
  IF v_id IS NULL THEN
    v_id := crear_producto('Gaseosa Postobón 1,5 L', 10000, v_cat_bebidas, FALSE, TRUE);
  END IF;
  SELECT insumo_id INTO v_insumo FROM productos WHERE id = v_id;
  IF v_insumo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compras_insumo WHERE insumo_id = v_insumo) THEN
    -- "Matrimonio" (2 unidades) a 8.500 → 4.250 c/u (MERCAMIO, enero 09/2026)
    PERFORM registrar_compra_insumo(v_insumo, 8500, 2, DATE '2026-01-09');
  END IF;

  -- ── Jugo Hit 500 ml: ya existe en el menú, se enlaza a su insumo ──
  SELECT id, insumo_id INTO v_id, v_insumo FROM productos WHERE LOWER(nombre) = LOWER('Jugo Hit 500 ml');
  IF v_id IS NOT NULL AND v_insumo IS NULL THEN
    INSERT INTO insumos (nombre, unidad_base) VALUES ('Jugo Hit 500 ml', 'unidad') RETURNING id INTO v_insumo;
    UPDATE productos SET insumo_id = v_insumo WHERE id = v_id;
    DELETE FROM receta_items WHERE producto_id = v_id;
    INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada) VALUES (v_id, v_insumo, 1);
  END IF;
  IF v_insumo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM compras_insumo WHERE insumo_id = v_insumo) THEN
    -- 3.000 (DOLLARCITY, junio 21/2025)
    PERFORM registrar_compra_insumo(v_insumo, 3000, 1, DATE '2025-06-21');
  END IF;

  -- ── Agua con gas: se enlaza; el costo lo registra la dueña ────────
  SELECT id, insumo_id INTO v_id, v_insumo FROM productos WHERE LOWER(nombre) = LOWER('Agua con gas');
  IF v_id IS NOT NULL AND v_insumo IS NULL THEN
    INSERT INTO insumos (nombre, unidad_base) VALUES ('Agua con gas', 'unidad') RETURNING id INTO v_insumo;
    UPDATE productos SET insumo_id = v_insumo WHERE id = v_id;
    DELETE FROM receta_items WHERE producto_id = v_id;
    INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada) VALUES (v_id, v_insumo, 1);
  END IF;

  -- ── Los genéricos salen del menú (no del historial) ──────────────
  UPDATE productos SET activo = FALSE
   WHERE LOWER(nombre) IN (LOWER('Gaseosa personal 400 ml'), LOWER('Gaseosa 1.5 Lt'));
END $$;
