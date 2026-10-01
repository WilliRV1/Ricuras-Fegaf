/**
 * Prueba de 20261001000000_costo_manual_producto.sql contra la base real y
 * SIN dejar rastro (transacción con ROLLBACK).
 *
 *   node scripts/test-costo-manual.mjs
 */
import { Client } from 'pg';
import fs from 'fs';

function conexion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const seed = fs.readFileSync('./execute-seed.mjs', 'utf8');
  const match = seed.match(/connectionString\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Define DATABASE_URL para poder conectarte.');
  return match[1];
}

const MIGRACION = './supabase/migrations/20261001000000_costo_manual_producto.sql';

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

  console.log('\n[1] Migración');
  const sql = fs.readFileSync(MIGRACION, 'utf8');
  await client.query(sql);
  console.log('  ok    se aplica sin errores');
  await client.query(sql);
  console.log('  ok    es idempotente');

  console.log('\n[2] Churrasco');
  const { rows: churrascos } = await client.query(
    `SELECT p.nombre, p.precio, p.costo_manual, v.costo_total
       FROM productos p JOIN vw_producto_costos v ON v.producto_id = p.id
      WHERE p.nombre ILIKE '%churrasco%'`
  );
  const de = (gramos) => churrascos.find((c) => c.nombre.includes(gramos));
  check('200 gr a $30.000 con costo 16.228', de('200')?.precio === 30000 && de('200')?.costo_manual === 16228, JSON.stringify(de('200')));
  check('250 gr a $33.000 con costo 17.358', de('250')?.precio === 33000 && de('250')?.costo_manual === 17358, JSON.stringify(de('250')));
  check('la vista usa el costo manual', Number(de('200')?.costo_total) === 16228);

  console.log('\n[3] Costo manual vs receta');
  await directo(client);
  const { rows: [insumo] } = await client.query(
    `INSERT INTO insumos (nombre, unidad_base) VALUES ('zz prueba costo manual', 'unidad') RETURNING id`
  );
  await client.query(
    `INSERT INTO compras_insumo (insumo_id, precio_compra, rendimiento) VALUES ($1, 5000, 1)`,
    [insumo.id]
  );
  const { rows: [prod] } = await client.query(
    `INSERT INTO productos (nombre, precio) VALUES ('zz prueba costo manual', 10000) RETURNING id`
  );
  await client.query(
    `INSERT INTO receta_items (producto_id, insumo_id, cantidad_usada) VALUES ($1, $2, 2)`,
    [prod.id, insumo.id]
  );
  const costoDe = async () =>
    (await client.query(`SELECT * FROM vw_producto_costos WHERE producto_id = $1`, [prod.id])).rows[0];

  let fila = await costoDe();
  check('sin costo manual sale de la receta', Number(fila.costo_total) === 10000 && fila.costo_manual === null, JSON.stringify(fila));

  await como(client, 'admin');
  await client.query(`SELECT fijar_costo_manual($1, 4000)`, [prod.id]);
  fila = await costoDe();
  check('con costo manual manda el manual', Number(fila.costo_total) === 4000, JSON.stringify(fila));
  check('el margen usa el costo manual', Math.abs(Number(fila.margen) - 0.6) < 1e-9, String(fila.margen));
  check('costo_receta sigue disponible', Number(fila.costo_receta) === 10000);

  await client.query(`SELECT fijar_costo_manual($1, NULL)`, [prod.id]);
  fila = await costoDe();
  check('NULL lo quita y vuelve a la receta', Number(fila.costo_total) === 10000 && fila.costo_manual === null);

  await debeFallar(client, 'costo negativo se rechaza', () => client.query(`SELECT fijar_costo_manual($1, -1)`, [prod.id]), 'COSTO_INVALIDO');
  await debeFallar(client, 'producto inexistente', () => client.query(`SELECT fijar_costo_manual(-1, 100)`), 'PRODUCTO_NO_ENCONTRADO');

  await como(client, 'cajero');
  await debeFallar(client, 'cajero no puede fijar costos', () => client.query(`SELECT fijar_costo_manual($1, 100)`, [prod.id]), 'ROL_NO_AUTORIZADO');
  await como(client, 'anon');
  await debeFallar(client, 'anon no puede fijar costos', () => client.query(`SELECT fijar_costo_manual($1, 100)`, [prod.id]), 'ROL_NO_AUTORIZADO');
  await directo(client);
} catch (err) {
  fallos++;
  console.error(`\n  ERROR: ${err.message}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas ok${fallos ? ` — ${fallos} fallas` : ''}\n`);
process.exitCode = fallos ? 1 : 0;
