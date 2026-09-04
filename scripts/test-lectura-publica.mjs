/**
 * Prueba del cierre de lectura pública, contra la base real y SIN dejar
 * rastro: todo corre dentro de una transacción que termina en ROLLBACK.
 *
 * Usa `SET LOCAL ROLE anon` / `SET LOCAL ROLE authenticated` para probar RLS
 * de verdad, igual que scripts/test-precios.mjs.
 *
 *   node scripts/test-lectura-publica.mjs
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

const MIGRACION =
  process.argv[2] ?? './supabase/migrations/20260904000000_cerrar_lectura_publica.sql';

let fallos = 0;
let pruebas = 0;

function check(nombre, condicion, detalle = '') {
  pruebas++;
  if (condicion) {
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre} ${detalle}`);
  }
}

const client = new Client({ connectionString: conexion() });

try {
  await client.connect();
  await client.query('BEGIN');

  // Necesitamos al menos una fila real en cada tabla para que la prueba
  // signifique algo (0 filas de por sí no prueba nada).
  const { rows: [conteoAntes] } = await client.query(`
    SELECT
      (SELECT count(*) FROM pedidos) AS pedidos,
      (SELECT count(*) FROM arqueos_caja) AS arqueos
  `);
  console.log(`\n[0] Datos existentes: ${conteoAntes.pedidos} pedidos, ${conteoAntes.arqueos} arqueos`);

  console.log('\n[1] Migración');
  const sql = fs.readFileSync(MIGRACION, 'utf8');
  await client.query(sql);
  console.log('  ok    se aplica sin errores');
  await client.query(sql);
  console.log('  ok    es idempotente');

  console.log('\n[2] Rol anon (sin sesión) ya no puede leer');
  await client.query('SET LOCAL ROLE anon');

  const { rows: pedidosAnon } = await client.query('SELECT id FROM pedidos');
  check('pedidos: 0 filas para anon', pedidosAnon.length === 0, `(vio ${pedidosAnon.length})`);

  const { rows: detalleAnon } = await client.query('SELECT id FROM detalle_pedidos');
  check('detalle_pedidos: 0 filas para anon', detalleAnon.length === 0, `(vio ${detalleAnon.length})`);

  const { rows: pagosAnon } = await client.query('SELECT id FROM pagos_pedido');
  check('pagos_pedido: 0 filas para anon', pagosAnon.length === 0, `(vio ${pagosAnon.length})`);

  const { rows: arqueosAnon } = await client.query('SELECT id FROM arqueos_caja');
  check('arqueos_caja: 0 filas para anon', arqueosAnon.length === 0, `(vio ${arqueosAnon.length})`);

  // El menú sigue siendo público: no hay dato de cliente ahí.
  const { rows: productosAnon } = await client.query('SELECT id FROM productos');
  check('productos sigue visible para anon (no se tocó)', productosAnon.length > 0);

  await client.query('RESET ROLE');

  console.log('\n[3] Rol authenticated (con sesión) sigue viendo todo');
  await client.query('SET LOCAL ROLE authenticated');

  const { rows: pedidosAuth } = await client.query('SELECT id FROM pedidos');
  check(
    'pedidos: ve las mismas filas que antes',
    pedidosAuth.length === Number(conteoAntes.pedidos),
    `(ve ${pedidosAuth.length}, había ${conteoAntes.pedidos})`
  );

  const { rows: arqueosAuth } = await client.query('SELECT id FROM arqueos_caja');
  check(
    'arqueos_caja: ve las mismas filas que antes',
    arqueosAuth.length === Number(conteoAntes.arqueos),
    `(ve ${arqueosAuth.length}, había ${conteoAntes.arqueos})`
  );

  await client.query('RESET ROLE');

  console.log(
    `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
  );
} catch (err) {
  fallos++;
  console.error(`\n💥 Error inesperado: ${err.message}`);
} finally {
  try {
    await client.query('ROLLBACK');
    console.log('Transacción revertida: la base quedó exactamente como estaba.');
  } catch {
    /* la conexión ya se cayó */
  }
  await client.end();
}

process.exitCode = fallos === 0 ? 0 : 1;
