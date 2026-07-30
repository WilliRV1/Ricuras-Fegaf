-- Migration: Agregar Bancolombia, estado 'debe' y hora_entrega a pedidos

-- 1. Agregar columna hora_entrega (para pedidos programados)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS hora_entrega TIMESTAMPTZ NULL;

-- 2. Agregar columna 'debe' como nuevo estado posible
--    Nota: el CHECK constraint actual debe actualizarse o eliminarse si existe
--    para permitir el nuevo estado 'debe'.
--    Verificar si existe un constraint en la columna 'estado':
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'listo', 'pagado', 'cancelado', 'debe'));

-- 3. El campo metodo_pago es VARCHAR libre, no tiene CHECK constraint,
--    por lo que 'bancolombia' ya es válido sin cambios adicionales.

-- 4. Comentarios descriptivos
COMMENT ON COLUMN public.pedidos.hora_entrega IS
  'Hora programada de entrega (opcional). NULL = pedido normal inmediato.';
