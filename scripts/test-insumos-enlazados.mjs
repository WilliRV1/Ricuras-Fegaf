/**
 * Prueba de 20261004000000_insumos_enlazados.sql y de
 * scripts/enlazar-insumos.mjs contra la base real y SIN dejar rastro
 * (transacción con ROLLBACK).
 *
 *   node scripts/test-insumos-enlazados.mjs           # pruebas
 *   node scripts/test-insumos-enlazados.mjs --lista   # además imprime los enlaces y los costos que cambian
 */
import { Client } from 'pg';
import fs from 'fs';
import { enlazarInsumos } from './enlazar-insumos.mjs';

function conexion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const seed = fs.readFileSync('./execute-seed.mjs', 'utf8');
  const match = seed.match(/connectionString\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Define DATABASE_URL para poder conectarte.');
  return match[1];
}

// Las del domiciliario van primero: esta migración se monta sobre ellas.
const MIGRACIONES = [
  './supabase/migrations/20261003000000_domiciliario_recaudo.sql',
  './supabase/migrations/20261003000001_domiciliario_retirar_regla_vieja.sql',
  './supabase/migrations/20261004000000_insumos_enlazados.sql',
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

const client = new Client({ connectionString: conexion() });

try {
  await client.connect();
  await client.query('BEGIN');

  const costosAntes = (await client.query(`SELECT producto_id, costo_total FROM vw_producto_costos`)).rows;

  console.log('\n[1] Migración');
  for (const ruta of MIGRACIONES) await client.query(fs.readFileSync(ruta, 'utf8'));
  console.log('  ok    se aplica sin errores');
  await client.query(fs.readFileSync(MIGRACIONES[2], 'utf8'));
  console.log('  ok    es idempotente');

  console.log('\n[2] Foto del costo en las ventas ya hechas');
  const { rows: [fotos] } = await client.query(
    `SELECT COUNT(*)::INT AS lineas, COUNT(costo_unitario)::INT AS con_costo FROM detalle_pedidos`
  );
  check('las líneas vendidas quedaron con su costo', fotos.con_costo > 0 && fotos.con_costo >= fotos.lineas * 0.9, JSON.stringify(fotos));
  // Los churrascos ya traen +1.500 de la migración anterior: se comparan aparte.
  const { rows: [desfase] } = await client.query(
    `SELECT COUNT(*)::INT AS n FROM detalle_pedidos d JOIN vw_producto_costos v ON v.producto_id = d.producto_id
      WHERE d.costo_unitario IS NOT NULL AND v.costo_manual IS NOT NULL AND d.costo_unitario <> v.costo_total`
  );
  check('la foto de los productos con costo manual es su costo manual', desfase.n === 0, String(desfase.n));

  console.log('\n[3] Última compra en vez de promedio');
  await directo(client);
  const nuevoInsumo = async (nombre) =>
    (await client.query(`INSERT INTO insumos (nombre, unidad_base) VALUES ($1, 'unidad') RETURNING id`, [nombre])).rows[0].id;
  const costoInsumo = async (id) => {
    const { rows: [f] } = await client.query(`SELECT costo_unitario, origen FROM vw_insumo_costo_actual WHERE insumo_id = $1`, [id]);
    return f.costo_unitario === null ? null : Number(f.costo_unitario);
  };
  const base = await nuevoInsumo('zz prueba base');
  check('sin compras no tiene costo', (await costoInsumo(base)) === null);
  await client.query(`INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento, fecha) VALUES ($1, 1000, 1, '2026-01-01')`, [base]);
  const { rows: [compraNueva] } = await client.query(
    `INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento, fecha) VALUES ($1, 63000, 50, '2026-02-01') RETURNING id`, [base]);
  check('vale la última compra (63.000 / 50 = 1.260), no el promedio', (await costoInsumo(base)) === 1260, String(await costoInsumo(base)));

  await como(client, 'admin');
  await client.query(`SELECT actualizar_insumo($1, 'zz prueba base', 'par', TRUE)`, [base]);
  check('marcado para promediar vuelve al promedio (1.130)', (await costoInsumo(base)) === 1130, String(await costoInsumo(base)));
  await client.query(`SELECT actualizar_insumo($1, 'zz prueba base', 'par', FALSE)`, [base]);

  console.log('\n[4] Enlace a otro insumo');
  await directo(client);
  const sigue = await nuevoInsumo('zz prueba sigue');
  await client.query(`INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento) VALUES ($1, 500, 1)`, [sigue]);
  await como(client, 'admin');
  await client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [sigue, base]);
  check('enlazado vale lo del origen, no su compra', (await costoInsumo(sigue)) === 1260);
  await client.query(`SELECT enlazar_insumo($1, $2, NULL, 0.5)`, [sigue, base]);
  check('con factor 0,5 vale la mitad', (await costoInsumo(sigue)) === 630);
  await client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [sigue, base]);

  await directo(client);
  const tercero = await nuevoInsumo('zz prueba tercero');
  await como(client, 'admin');
  await debeFallar(client, 'no se enlaza a uno que ya está enlazado', () => client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [tercero, sigue]), 'ENLACE_EN_CADENA');
  await debeFallar(client, 'el origen de otro no se puede enlazar', () => client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [base, tercero]), 'ENLACE_EN_CADENA');
  await debeFallar(client, 'no se enlaza a sí mismo', () => client.query(`SELECT enlazar_insumo($1, $1, NULL, 1)`, [tercero]), 'ENLACE_CIRCULAR');
  await debeFallar(client, 'factor 0 se rechaza', () => client.query(`SELECT enlazar_insumo($1, $2, NULL, 0)`, [tercero, base]), 'FACTOR_INVALIDO');

  console.log('\n[5] Productos, combos y borrar una compra');
  await directo(client);
  const nuevoProducto = async (nombre, precio) =>
    (await client.query(`INSERT INTO productos (nombre, precio) VALUES ($1, $2) RETURNING id`, [nombre, precio])).rows[0].id;
  const costoProducto = async (id) =>
    Number((await client.query(`SELECT costo_total FROM vw_producto_costos WHERE producto_id = $1`, [id])).rows[0].costo_total);
  const hamburguesa = await nuevoProducto('zz prueba hamburguesa', 18000);
  await client.query(`INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada) VALUES ($1, $2, 2), ($1, $3, 1)`, [hamburguesa, base, sigue]);
  check('el producto usa el origen y el enlazado (3 × 1.260)', (await costoProducto(hamburguesa)) === 3780, String(await costoProducto(hamburguesa)));

  const incluye = await nuevoInsumo('zz Incluye: prueba hamburguesa');
  await client.query(`INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento) VALUES ($1, 9999, 1)`, [incluye]);
  const combo = await nuevoProducto('zz prueba combo x dos', 55000);
  await client.query(`INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada) VALUES ($1, $2, 1)`, [combo, incluye]);
  await como(client, 'admin');
  await client.query(`SELECT enlazar_insumo($1, NULL, $2, 2)`, [incluye, hamburguesa]);
  check('el combo vale dos hamburguesas (7.560)', (await costoProducto(combo)) === 7560, String(await costoProducto(combo)));

  await client.query(`SELECT registrar_compra_insumo($1, 70000, 50)`, [base]);
  check('sube el origen (1.400): sube la hamburguesa', (await costoProducto(hamburguesa)) === 4200);
  check('y sube el combo sin tocarlo (8.400)', (await costoProducto(combo)) === 8400, String(await costoProducto(combo)));

  const { rows: [ultima] } = await client.query(`SELECT id FROM compras_insumo WHERE insumo_id = $1 ORDER BY fecha DESC, id DESC LIMIT 1`, [base]);
  await client.query(`SELECT eliminar_compra_insumo($1)`, [ultima.id]);
  check('borrar la compra devuelve el costo anterior', (await costoProducto(combo)) === 7560 && ultima.id !== compraNueva.id);
  await debeFallar(client, 'compra inexistente', () => client.query(`SELECT eliminar_compra_insumo(-1)`), 'COMPRA_NO_ENCONTRADA');

  await directo(client);
  const otroIncluye = await nuevoInsumo('zz Incluye: prueba combo');
  await como(client, 'admin');
  await debeFallar(client, 'un combo no puede ser origen de otro insumo', () => client.query(`SELECT enlazar_insumo($1, NULL, $2, 1)`, [otroIncluye, combo]), 'ENLACE_EN_CADENA');
  await debeFallar(client, 'un insumo de la hamburguesa no puede colgar de un producto', () => client.query(`SELECT enlazar_insumo($1, NULL, $2, 1)`, [base, combo]), 'ENLACE_EN_CADENA');
  await debeFallar(client, 'un producto no cuelga de un insumo de su propia receta', () => client.query(`SELECT enlazar_insumo($1, NULL, $2, 1)`, [incluye, combo]), 'ENLACE_CIRCULAR');
  await client.query(`SELECT enlazar_insumo($1, NULL, NULL, 1)`, [incluye]);
  check('quitar el enlace vuelve a su propia compra (9.999)', (await costoProducto(combo)) === 9999);
  await client.query(`SELECT enlazar_insumo($1, NULL, $2, 2)`, [incluye, hamburguesa]);

  console.log('\n[6] Foto del costo al vender');
  await directo(client);
  const { rows: [pedido] } = await client.query(
    `INSERT INTO pedidos (tipo, numero_mesa, estado, subtotal, recargo, total) VALUES ('mesa', 99, 'pendiente', 55000, 0, 55000) RETURNING id`
  );
  const { rows: [linea] } = await client.query(
    `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, 1, 55000) RETURNING id, costo_unitario`,
    [pedido.id, combo]
  );
  check('la línea guarda el costo de ese momento (7.560)', Number(linea.costo_unitario) === 7560, String(linea.costo_unitario));
  await client.query(`INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento) VALUES ($1, 100000, 50)`, [base]);
  const { rows: [despues] } = await client.query(`SELECT costo_unitario FROM detalle_pedidos WHERE id = $1`, [linea.id]);
  check('y no cambia cuando sube el insumo', Number(despues.costo_unitario) === 7560 && (await costoProducto(combo)) === 12000);
  const sinReceta = await nuevoProducto('zz prueba sin receta', 5000);
  const { rows: [lineaSin] } = await client.query(
    `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, 1, 5000) RETURNING costo_unitario`,
    [pedido.id, sinReceta]
  );
  check('un producto sin receta queda sin foto (NULL), no en 0', lineaSin.costo_unitario === null);

  console.log('\n[7] Permisos');
  await como(client, 'cajero');
  await debeFallar(client, 'cajero no enlaza', () => client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [tercero, base]), 'ROL_NO_AUTORIZADO');
  await debeFallar(client, 'cajero no borra compras', () => client.query(`SELECT eliminar_compra_insumo($1)`, [compraNueva.id]), 'ROL_NO_AUTORIZADO');
  await debeFallar(client, 'cajero no edita insumos', () => client.query(`SELECT actualizar_insumo($1, 'x', 'y', FALSE)`, [base]), 'ROL_NO_AUTORIZADO');
  await directo(client);

  console.log('\n[8] Los enlaces reales (scripts/enlazar-insumos.mjs)');
  // Se deshace lo de prueba para que no se cuele en la detección por costo.
  await client.query(`DELETE FROM detalle_pedidos WHERE pedido_id = $1`, [pedido.id]);
  await client.query(`DELETE FROM pedidos WHERE id = $1`, [pedido.id]);
  await client.query(`DELETE FROM productos WHERE nombre LIKE 'zz prueba%'`);
  await client.query(`DELETE FROM insumos WHERE nombre LIKE 'zz %'`);

  const costosSinEnlaces = (await client.query(`SELECT producto_id, costo_total FROM vw_producto_costos`)).rows;
  const cambiaronSoloPorLaVista = costosSinEnlaces.filter((c) => {
    const a = costosAntes.find((x) => x.producto_id === c.producto_id);
    return a && Math.abs(Number(a.costo_total) - Number(c.costo_total)) >= 1;
  });
  if (process.argv.includes('--lista')) {
    console.log(`  (${cambiaronSoloPorLaVista.length} productos cambian solo por pasar de promedio a última compra o por los churrascos)`);
  }

  const { enlaces, cambios, avisos } = await enlazarInsumos(client);
  const costoDe = async (nombre) =>
    Math.round(Number((await client.query(`SELECT costo_total FROM vw_producto_costos WHERE nombre = $1`, [nombre])).rows[0].costo_total));
  const insumoVale = async (nombre) =>
    Math.round(Number((await client.query(`SELECT costo_unitario FROM vw_insumo_costo_actual WHERE nombre = $1`, [nombre])).rows[0].costo_unitario));

  check('Queso tajado a 1.260', (await insumoVale('Queso tajado')) === 1260);
  check('"queso" y "Queso Mozarella PAR" lo siguen', (await insumoVale('queso')) === 1260 && (await insumoVale('Queso Mozarella "PAR"')) === 1260);
  check('Carne Res - Ampolleta a 3.309 y la siguen las otras dos',
    (await insumoVale('Carne Res - Ampolleta')) === 3309 && (await insumoVale('Adicion Carne')) === 3309 && (await insumoVale('Carne de Hamburguesa')) === 3309);
  const clasica = await costoDe('Hamburguesa CLASICA');
  // 11.419 + 100 del queso + 121 de la carne
  check('la Hamburguesa CLASICA sube a 11.640', clasica === 11640, String(clasica));
  const { rows: comboDos } = await client.query(
    `SELECT ROUND(v.costo_unitario) AS costo, i.enlace_factor FROM insumos i JOIN vw_insumo_costo_actual v ON v.insumo_id = i.id
       JOIN receta_items ri ON ri.insumo_id = i.id JOIN productos p ON p.id = ri.producto_id
      WHERE p.nombre = 'COMBO X DOS CLASICAS' AND i.nombre ILIKE 'Incluye:%'`
  );
  check('el COMBO X DOS CLASICAS lleva dos hamburguesas al costo nuevo',
    comboDos.length === 1 && Number(comboDos[0].costo) === clasica * 2 && Number(comboDos[0].enlace_factor) === 2, JSON.stringify(comboDos));
  // "Incluye: Chorizo" o "Incluye: Arepa de Maiz" son ingredientes, no un plato
  // del menú: esos se quedan con su propia compra y salen como aviso.
  const { rows: sueltos } = await client.query(
    `SELECT nombre FROM insumos
      WHERE nombre ILIKE 'Incluye:%' AND enlace_producto_id IS NULL
        AND nombre ~* '(hamburguesa|perro|aplastado)'`
  );
  check('las hamburguesas, perros y aplastados de los combos quedaron enlazados', sueltos.length === 0,
    sueltos.map((s) => s.nombre).join(', '));
  check('lo que no se pudo enlazar se avisa', avisos.every((a) => a.includes('No se enlaza')));

  if (process.argv.includes('--lista')) {
    console.log('\nEnlaces:');
    console.table(enlaces);
    console.log('Productos que cambian de costo con el queso y la carne nuevos:');
    console.table(cambios);
    if (avisos.length) console.log(`Avisos:\n  - ${avisos.join('\n  - ')}`);
  }
} catch (err) {
  fallos++;
  console.error(`\n  ERROR: ${err.message}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas ok${fallos ? ` — ${fallos} fallas` : ''}\n`);
process.exitCode = fallos ? 1 : 0;
