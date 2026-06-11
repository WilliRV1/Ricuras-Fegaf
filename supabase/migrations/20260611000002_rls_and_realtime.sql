-- Migration: RLS Policies + Realtime para Ricuras FegaF
-- Fase 1 MVP — Sin autenticación. Acceso público para el rol `anon`.

-- ============================================================
-- 1. HABILITAR ROW LEVEL SECURITY EN TODAS LAS TABLAS
-- ============================================================
ALTER TABLE public.categorias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedidos  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. POLÍTICAS RLS — ACCESO PÚBLICO (ROL: anon)
-- Justificación: El sistema solo opera dentro de la red del
-- restaurante. No hay login ni roles de usuario (PROJECT.md §2.2)
-- ============================================================

-- CATEGORIAS — Solo lectura pública (no se modifican en runtime)
CREATE POLICY "public_read_categorias"
  ON public.categorias FOR SELECT
  TO anon
  USING (true);

-- PRODUCTOS — Solo lectura pública (el menú es visible para todos)
CREATE POLICY "public_read_productos"
  ON public.productos FOR SELECT
  TO anon
  USING (true);

-- PEDIDOS — Lectura y escritura completa pública
-- (cualquier terminal del restaurante puede crear/actualizar pedidos)
CREATE POLICY "public_read_pedidos"
  ON public.pedidos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "public_insert_pedidos"
  ON public.pedidos FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "public_update_pedidos"
  ON public.pedidos FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- DETALLE_PEDIDOS — Lectura e inserción pública
-- (los detalles se crean con cada pedido, cocina puede leerlos)
CREATE POLICY "public_read_detalle_pedidos"
  ON public.detalle_pedidos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "public_insert_detalle_pedidos"
  ON public.detalle_pedidos FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================
-- 3. HABILITAR REALTIME EN LA TABLA `pedidos`
-- Ya fue habilitado manualmente a través del Dashboard.
-- ============================================================
