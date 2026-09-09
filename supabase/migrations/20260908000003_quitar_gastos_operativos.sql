-- Migration: Quitar el Módulo 7 (Egresos Operativos)
--
-- La tabla `gastos` mezclaba, tal como está en el Excel original de la
-- dueña (hoja GASTOS F&F), gastos del negocio con gastos personales
-- (peluquería, uñas, celular) sin ninguna forma confiable de separarlos.
-- A pedido del usuario, se retira por completo: no había ningún gasto
-- real cargado todavía (tabla vacía al momento de este cambio).
--
-- El Módulo 8 (Reportes) ya no resta gastos en la utilidad neta —
-- ver actions/reportes.ts: `utilidadNeta = ventas - costoProductos`.

DROP FUNCTION IF EXISTS eliminar_gasto(INT);
DROP FUNCTION IF EXISTS crear_gasto(VARCHAR, VARCHAR, VARCHAR, NUMERIC, DATE);
DROP TABLE IF EXISTS public.gastos;
