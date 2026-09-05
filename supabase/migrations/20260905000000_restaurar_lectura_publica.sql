-- Migration: Restaurar la lectura pública de pedidos
--
-- Hallazgo urgente: las políticas de SELECT de `pedidos`, `detalle_pedidos`,
-- `pagos_pedido` y `arqueos_caja` fueron cambiadas por fuera de estas
-- migraciones — de "pública" (rol `anon`) a "solo `authenticated`". Los
-- nombres de las políticas (`authenticated_read_*`) no coinciden con nada
-- de lo escrito aquí, así que el cambio se hizo directamente en el panel de
-- Supabase, probablemente siguiendo una sugerencia de su Security Advisor
-- tras la auditoría (que sí señaló, correctamente, que esos datos eran
-- públicos — ver la migración de precios/RLS del 2 de septiembre).
--
-- El problema: esta app NUNCA inicia sesión de Supabase Auth. El sistema de
-- PIN es propio (cookie firmada, tabla `usuarios`), así que el cliente
-- siempre se conecta como `anon`, nunca como `authenticated`. Restringir a
-- `authenticated` no cierra el hueco que señaló la auditoría — lo que hace
-- es dejar a la app entera sin poder leer sus propios pedidos: cocina,
-- liquidación y el dashboard quedan vacíos.
--
-- Esta migración devuelve el acceso de lectura a `anon` para que la
-- operación del local vuelva a funcionar. El hueco real de fondo (cualquiera
-- con la URL puede leer estos datos sin pasar por el PIN) sigue abierto y
-- necesita una solución de fondo — moverse a Supabase Auth de verdad — que
-- se está evaluando aparte, con cuidado de no apagar el tablero de cocina
-- en pleno servicio.

ALTER POLICY "authenticated_read_pedidos" ON public.pedidos
  TO anon, authenticated;

ALTER POLICY "authenticated_read_detalle_pedidos" ON public.detalle_pedidos
  TO anon, authenticated;

ALTER POLICY "authenticated_read_pagos_pedido" ON public.pagos_pedido
  TO anon, authenticated;

ALTER POLICY "authenticated_read_arqueos_caja" ON public.arqueos_caja
  TO anon, authenticated;
