-- Migration: Revertir 20260905000000 — esa migración estaba equivocada
--
-- La migración anterior (20260905000000_restaurar_lectura_publica.sql)
-- reabrió el rol `anon` en pedidos/detalle_pedidos/pagos_pedido/arqueos_caja
-- porque una lectura vía API con la clave pública devolvía cero filas y se
-- interpretó como una regresión accidental.
--
-- No lo era. El PR #4 (commit 43ea8d1, "Filtro de rango en Dashboard +
-- cierre de lectura pública") había cerrado esas tablas a propósito y con
-- una solución correcta: `src/lib/session.ts` firma un JWT real de Supabase
-- (con SUPABASE_JWT_SECRET) a partir de la sesión propia por PIN, y
-- `/api/supabase-token` se lo entrega al navegador para que PostgREST y
-- Realtime vean `role=authenticated`. Ese trabajo ya estaba probado
-- (scripts/test-lectura-publica.mjs) y verificado en producción antes de
-- aplicarse. La lectura vacía que se observó no era por la política RLS:
-- era un síntoma a investigar en el flujo que entrega ese JWT, no un motivo
-- para reabrir la tabla.
--
-- Esta migración deshace 20260905000000 y devuelve las políticas a como
-- las dejó el PR #4.

ALTER POLICY "authenticated_read_pedidos" ON public.pedidos
  TO authenticated;

ALTER POLICY "authenticated_read_detalle_pedidos" ON public.detalle_pedidos
  TO authenticated;

ALTER POLICY "authenticated_read_pagos_pedido" ON public.pagos_pedido
  TO authenticated;

ALTER POLICY "authenticated_read_arqueos_caja" ON public.arqueos_caja
  TO authenticated;
