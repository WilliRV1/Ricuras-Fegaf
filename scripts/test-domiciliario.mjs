/**
 * Prueba de 20261003000000_domiciliario_recaudo.sql, de su segunda parte
 * (20261003000001_domiciliario_retirar_regla_vieja.sql) y del cálculo de
 * src/lib/domiciliario.ts y src/lib/semanas.ts, contra la base real y SIN
 * dejar rastro (transacción con ROLLBACK).
 *
 *   node scripts/test-domiciliario.mjs
 *
 * Los .ts se importan directo: Node los ejecuta quitándoles los tipos
 * (22.18+), por eso esos dos archivos no tienen imports ni sintaxis que
 * necesite compilarse.
 */
import { Client } from 'pg';
import fs from 'fs';
import { calcularLiquidacion, totalesEntre } from '../src/lib/domiciliario.ts';
import { describirRango, lunesDe, rangoDeSemana, semanaDelAnio, semanaExacta, sumarDias } from '../src/lib/semanas.ts';

function conexion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const seed = fs.readFileSync('./execute-seed.mjs', 'utf8');
  const match = seed.match(/connectionString\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Define DATABASE_URL para poder conectarte.');
  return match[1];
}

const MIGRACIONES = [
  './supabase/migrations/20261003000000_domiciliario_recaudo.sql',
  './supabase/migrations/20261003000001_domiciliario_retirar_regla_vieja.sql',
];

let fallos = 0;
let pruebas = 0;

function check(nombre, condicion, detalle = '') {
  pruebas++;
  if (condicion) console.log(`  ok    ${nombre}`);
  else {
    fallos++;
    console.log(`  FALLA ${nombre} ${detalle}`);
  }
}

async function debeFallar(client, nombre, fn, fragmento) {
  pruebas++;
  await client.query('SAVEPOINT intento');
  try {
    await fn();
    await client.query('RELEASE SAVEPOINT intento');
    fallos++;
    console.log(`  FALLA ${nombre} — no lanzó error`);
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT intento');
    if (err.message.includes(fragmento)) console.log(`  ok    ${nombre}`);
    else {
      fallos++;
      console.log(`  FALLA ${nombre} — error inesperado: ${err.message}`);
    }
  }
}

async function como(client, rol) {
  const claims = rol === 'anon' ? { role: 'anon' } : { role: 'authenticated', app_rol: rol };
  await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
}
async function directo(client) {
  await client.query(`SELECT set_config('request.jwt.claims', '', true)`);
}

// ------------------------------------------------------------
// [1] Semanas del año (sin base de datos)
// ------------------------------------------------------------
console.log('\n[1] Semanas del año');
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('25/9/2026 es la semana 39', igual(semanaDelAnio('2026-09-25'), { anio: 2026, semana: 39 }));
check('19/9/2026 es la semana 38', igual(semanaDelAnio('2026-09-19'), { anio: 2026, semana: 38 }));
check('1/1/2027 (viernes) sigue en la semana 53 de 2026', igual(semanaDelAnio('2027-01-01'), { anio: 2026, semana: 53 }));
check('29/12/2025 (lunes) ya es la semana 1 de 2026', igual(semanaDelAnio('2025-12-29'), { anio: 2026, semana: 1 }));
check('la semana 39 va del 21 al 27 de septiembre', igual(rangoDeSemana(2026, 39), { from: '2026-09-21', to: '2026-09-27' }));
check('la semana 1 de 2026 empieza el 29/12/2025', rangoDeSemana(2026, 1).from === '2025-12-29');
check('lunes de un domingo', lunesDe('2026-09-27') === '2026-09-21');
check('sumar días cruza de mes', sumarDias('2026-09-28', 6) === '2026-10-04');
check('semana completa se reconoce', igual(semanaExacta('2026-09-21', '2026-09-27'), { anio: 2026, semana: 39 }));
check('semana en curso cortada en hoy', igual(semanaExacta('2026-09-28', '2026-10-02', '2026-10-02'), { anio: 2026, semana: 40 }));
check('un rango cualquiera no es semana', semanaExacta('2026-09-22', '2026-09-27') === null);
check('lunes a miércoles pasado no es semana', semanaExacta('2026-09-21', '2026-09-23', '2026-10-02') === null);
check('rango en un mes', describirRango('2026-09-21', '2026-09-27') === '21 al 27 de sept' || describirRango('2026-09-21', '2026-09-27') === '21 al 27 de sep', describirRango('2026-09-21', '2026-09-27'));
check('rango entre dos meses nombra los dos', /^28 de sep\w* al 4 de oct$/.test(describirRango('2026-09-28', '2026-10-04')), describirRango('2026-09-28', '2026-10-04'));

// ------------------------------------------------------------
// [2] Cálculo (sin base de datos)
// ------------------------------------------------------------
console.log('\n[2] Cálculo de la liquidación');
const cifras = { tarifa: 1500, pagoDia: 40000 };
{
  const r = calcularLiquidacion(
    [
      { dia: '2026-09-25', cantidad: 19, aporta: true },
      { dia: '2026-09-25', cantidad: 1, aporta: true },
      { dia: '2026-09-25', cantidad: 4, aporta: false },
    ],
    cifras
  );
  check('20 unidades dejan $30.000', r.unidades === 20 && r.recaudo === 30000, JSON.stringify(r));
  check('faltan $10.000 para los $40.000', r.pago === 40000 && r.aporte === 10000);
  check('lo que no aporta no cuenta', r.dias[0].unidades === 20);
}
{
  const r = calcularLiquidacion(
    [
      { dia: '2026-09-18', cantidad: 15, aporta: true },
      { dia: '2026-09-19', cantidad: 38, aporta: true },
      { dia: '2026-09-20', cantidad: 21, aporta: true },
    ],
    cifras
  );
  check('el sobrante del sábado cubre los otros días', r.aporte === 9000 && r.pago === 120000, JSON.stringify(r));
  check('el sábado sobra', r.dias[1].aporte === -17000);
  check('tres días pagados', r.diasPagados === 3);
  check('totales de un tramo', totalesEntre(r.dias, '2026-09-19', '2026-09-20').aporte === -8500);
}
{
  const r = calcularLiquidacion([{ dia: '2026-09-07', cantidad: 1, aporta: true }], cifras, { '2026-09-07': 0 });
  check('ajuste en 0: ese día no se paga y lo recaudado sobra', r.pago === 0 && r.aporte === -1500 && r.diasPagados === 0, JSON.stringify(r));
  check('el día queda marcado como ajustado', r.dias[0].ajustado === true);
}
{
  const r = calcularLiquidacion([], cifras, { '2026-09-10': 25000 });
  check('ajuste en un día sin ventas igual se paga', r.pago === 25000 && r.aporte === 25000 && r.dias.length === 1);
}
{
  const r = calcularLiquidacion([{ dia: '2026-09-11', cantidad: 3, aporta: false }], cifras);
  check('un día de solo bebidas es día trabajado', r.pago === 40000 && r.recaudo === 0);
  check('sin ventas no hay días', calcularLiquidacion([], cifras).dias.length === 0);
}

// ------------------------------------------------------------
// [3] Migración y ventas reales
// ------------------------------------------------------------
const client = new Client({ connectionString: conexion() });

try {
  await client.connect();
  await client.query('BEGIN');

  console.log('\n[3] Migración');
  const sql = MIGRACIONES.map((ruta) => fs.readFileSync(ruta, 'utf8'));
  // En una base que ya tiene la segunda parte aplicada no queda ninguno: lo
  // que se comprueba es que la primera, sola, no borra los que haya.
  const viejos = async () =>
    (
      await client.query(
        `SELECT COUNT(*)::INT AS n FROM parametros
          WHERE clave IN ('domiciliario_minimo_dia', 'domiciliario_maximo_dia', 'categoria_bebidas_id')`
      )
    ).rows[0].n;
  const viejosAntes = await viejos();
  await client.query(sql[0]);
  check('la primera parte no quita nada de lo que usa la app desplegada', (await viejos()) === viejosAntes);
  await client.query(sql[1]);
  console.log('  ok    se aplican sin errores');
  await client.query(sql[0]);
  await client.query(sql[1]);
  console.log('  ok    son idempotentes');

  const { rows: parametros } = await client.query(`SELECT clave, valor FROM parametros`);
  const valor = (clave) => {
    const fila = parametros.find((p) => p.clave === clave);
    return fila ? Number(fila.valor) : undefined;
  };
  check('pago fijo por día = 40.000', valor('domiciliario_pago_dia') === 40000, String(valor('domiciliario_pago_dia')));
  check('la tarifa sigue en 1.500', valor('domiciliario_tarifa_producto') === 1500);
  check('ya no hay mínimo, máximo ni categoría de bebidas',
    valor('domiciliario_minimo_dia') === undefined &&
    valor('domiciliario_maximo_dia') === undefined &&
    valor('categoria_bebidas_id') === undefined);

  console.log('\n[4] Qué productos aportan');
  const { rows: productos } = await client.query(
    `SELECT p.nombre, p.es_adicion, p.aporta_domiciliario, c.nombre AS categoria
       FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id`
  );
  const bebidas = productos.filter((p) => p.categoria === 'Bebidas');
  const adiciones = productos.filter((p) => p.es_adicion);
  const comida = productos.filter((p) => p.categoria !== 'Bebidas' && !p.es_adicion);
  check('ninguna bebida aporta', bebidas.length > 0 && bebidas.every((p) => !p.aporta_domiciliario));
  check('toda la comida aporta', comida.length > 0 && comida.every((p) => p.aporta_domiciliario),
    comida.filter((p) => !p.aporta_domiciliario).map((p) => p.nombre).join(', '));
  check('de los adicionales solo las papas francesas',
    igual(adiciones.filter((p) => p.aporta_domiciliario).map((p) => p.nombre), ['Papa Francesa 200 gr']),
    adiciones.filter((p) => p.aporta_domiciliario).map((p) => p.nombre).join(', '));

  const { rows: churrascos } = await client.query(
    `SELECT nombre, costo_manual FROM productos WHERE nombre ILIKE '%churrasco%' ORDER BY nombre`
  );
  check('churrascos con el costo del Excel (17.728 y 18.858)',
    igual(churrascos.map((c) => c.costo_manual), [17728, 18858]), JSON.stringify(churrascos));

  console.log('\n[5] Ventas reales de septiembre con la regla nueva');
  const { rows: ventas } = await client.query(
    `SELECT to_char(pe.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS dia,
            d.cantidad, p.aporta_domiciliario AS aporta
       FROM detalle_pedidos d
       JOIN pedidos pe ON pe.id = d.pedido_id
       JOIN productos p ON p.id = d.producto_id
      WHERE pe.estado IN ('pagado', 'debe')
        AND pe.created_at >= '2026-09-07T00:00:00-05:00'
        AND pe.created_at <  '2026-09-28T00:00:00-05:00'`
  );
  // El lunes 7/9 hubo un solo pedido y no fue noche pagada: es el caso para el que existe el ajuste.
  const real = calcularLiquidacion(ventas, cifras, { '2026-09-07': 0 });
  const dia25 = real.dias.find((d) => d.dia === '2026-09-25');
  check('25/9: 20 unidades, $30.000, faltan $10.000 (el ejemplo del audio)',
    dia25?.unidades === 20 && dia25?.recaudo === 30000 && dia25?.aporte === 10000, JSON.stringify(dia25));
  const semana = (n) => totalesEntre(real.dias, rangoDeSemana(2026, n).from, rangoDeSemana(2026, n).to);
  check('semana 38: puso $9.000', semana(38).aporte === 9000, JSON.stringify(semana(38)));
  check('semana 37: puso $30.000', semana(37).aporte === 30000, JSON.stringify(semana(37)));

  console.log('\n[6] Ajustar el pago de un día');
  await como(client, 'admin');
  await client.query(`SELECT fijar_pago_domiciliario('2026-09-07', 0)`);
  await client.query(`SELECT fijar_pago_domiciliario('2026-09-07', 25000)`);
  let { rows: ajustes } = await client.query(`SELECT fecha::TEXT, pago FROM domiciliario_dias WHERE fecha = '2026-09-07'`);
  check('fijar dos veces deja una sola fila con el último valor', ajustes.length === 1 && ajustes[0].pago === 25000, JSON.stringify(ajustes));
  await client.query(`SELECT fijar_pago_domiciliario('2026-09-07', NULL)`);
  ({ rows: ajustes } = await client.query(`SELECT 1 FROM domiciliario_dias WHERE fecha = '2026-09-07'`));
  check('NULL quita el ajuste', ajustes.length === 0);
  await debeFallar(client, 'pago negativo se rechaza', () => client.query(`SELECT fijar_pago_domiciliario('2026-09-07', -1)`), 'PAGO_INVALIDO');
  await debeFallar(client, 'fecha vacía se rechaza', () => client.query(`SELECT fijar_pago_domiciliario(NULL, 100)`), 'FECHA_REQUERIDA');

  console.log('\n[7] Marcar si un producto aporta');
  const papa = (await client.query(`SELECT id FROM productos WHERE nombre = 'Papa Francesa 200 gr'`)).rows[0];
  await client.query(`SELECT fijar_aporta_domiciliario($1, FALSE)`, [papa.id]);
  let { rows: [fila] } = await client.query(`SELECT aporta_domiciliario FROM productos WHERE id = $1`, [papa.id]);
  check('se puede quitar', fila.aporta_domiciliario === false);
  await client.query(`SELECT fijar_aporta_domiciliario($1, TRUE)`, [papa.id]);
  ({ rows: [fila] } = await client.query(`SELECT aporta_domiciliario FROM productos WHERE id = $1`, [papa.id]));
  check('y volver a poner', fila.aporta_domiciliario === true);
  await debeFallar(client, 'producto inexistente', () => client.query(`SELECT fijar_aporta_domiciliario(-1, TRUE)`), 'PRODUCTO_NO_ENCONTRADO');

  console.log('\n[8] Permisos');
  await como(client, 'cajero');
  await debeFallar(client, 'cajero no cambia el pago de un día', () => client.query(`SELECT fijar_pago_domiciliario('2026-09-07', 0)`), 'ROL_NO_AUTORIZADO');
  await debeFallar(client, 'cajero no marca productos', () => client.query(`SELECT fijar_aporta_domiciliario($1, FALSE)`, [papa.id]), 'ROL_NO_AUTORIZADO');
  await como(client, 'anon');
  await debeFallar(client, 'anon no cambia el pago de un día', () => client.query(`SELECT fijar_pago_domiciliario('2026-09-07', 0)`), 'ROL_NO_AUTORIZADO');
  await directo(client);

  const { rows: [rls] } = await client.query(
    `SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'domiciliario_dias'`
  );
  check('domiciliario_dias tiene RLS', rls?.rowsecurity === true);
} catch (err) {
  fallos++;
  console.error(`\n  ERROR: ${err.message}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas ok${fallos ? ` — ${fallos} fallas` : ''}\n`);
process.exitCode = fallos ? 1 : 0;
