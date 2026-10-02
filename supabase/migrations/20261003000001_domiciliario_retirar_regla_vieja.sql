-- Migration: retirar la regla vieja del domiciliario
--
-- Segunda parte de 20261003000000. Se aplica JUNTO con el despliegue de la
-- app que ya calcula con la regla nueva: la versión anterior lee estos
-- parámetros y resta el pago completo al domiciliario, así que con esto
-- aplicado y sin desplegar mostraría cifras distintas.
--
--   - Parámetros que ya no se usan: el mínimo y el máximo por día (ahora hay
--     un pago fijo, domiciliario_pago_dia) y la categoría de bebidas (ahora
--     cada producto dice si aporta, productos.aporta_domiciliario).
--   - Churrascos: el costo manual pasa a escribirse como en el Excel, CON la
--     línea "Pago auxiliares $1.500". Las recetas ya la traen como un insumo
--     más, y la utilidad deja de restar el pago al domiciliario aparte (se
--     estaba restando dos veces). Ver src/app/actions/reportes.ts.

DELETE FROM public.parametros
 WHERE clave IN ('domiciliario_minimo_dia', 'domiciliario_maximo_dia', 'categoria_bebidas_id');

-- 16.228 y 17.358 eran el costo del Excel menos los $1.500 (migración
-- 20261001000000). Solo se tocan si siguen con ese valor exacto.
UPDATE public.productos SET costo_manual = 17728
 WHERE nombre ILIKE '%churrasco%' AND nombre ILIKE '%200%' AND costo_manual = 16228;

UPDATE public.productos SET costo_manual = 18858
 WHERE nombre ILIKE '%churrasco%' AND nombre ILIKE '%250%' AND costo_manual = 17358;

COMMENT ON COLUMN public.productos.costo_manual IS
  'Costo escrito a mano (pesos). Si no es NULL manda sobre el de la receta. Se escribe como en el Excel, con la línea Pago auxiliares incluida.';
