-- Migration: tope diario para el pago al domiciliario
--
-- Además del mínimo por día, la dueña quiere poder fijar un MÁXIMO: si la
-- tarifa por productos lo supera, el domiciliario recibe el tope y no más.
-- 0 = sin tope (comportamiento de hasta ahora). Se edita desde
-- "Parámetros del Negocio" como los demás.

INSERT INTO public.parametros (clave, valor, descripcion) VALUES
  ('domiciliario_maximo_dia', 0,
   'Máximo que recibe el domiciliario por día. Si la tarifa por productos lo supera, se paga el tope. 0 = sin tope.')
ON CONFLICT (clave) DO NOTHING;
