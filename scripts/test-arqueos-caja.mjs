/**
 * Prueba de la migración de RLS de arqueos_caja, en transacción revertida.
 *
 *   node scripts/test-arqueos-caja.mjs
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
  process.argv[2] ?? './supabase/migrations/20260902000001_rls_arqueos_caja.sql';

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

  // Desde 20260904000000_cerrar_lectura_publica, la lectura de arqueos_caja
  // ya no es para 'anon': el dashboard la lee con sesión, así que el rol
  // real a simular es 'authenticated'. anon se prueba aparte, para
  // confirmar que de verdad quedó afuera (antes sí podía leerla).
  await client.query("SET LOCAL ROLE authenticated");

  console.log('\n[2] Con sesión (authenticated) la lectura sigue funcionando (la necesita el dashboard)');
  const lectura = await client.query('SELECT * FROM arqueos_caja LIMIT 1');
  check('SELECT no lanza error', true, `(${lectura.rowCount} filas)`);

  console.log('\n[3] Escritura directa queda bloqueada, incluso con sesión');
  await client.query('SAVEPOINT intento_insert');
  const ins = await client.query(
    `INSERT INTO arqueos_caja (base_inicial, estado) VALUES (0, 'abierto') RETURNING id`
  ).catch((e) => ({ error: e }));
  if (ins.error) await client.query('ROLLBACK TO SAVEPOINT intento_insert');
  check(
    'INSERT directo se rechaza (RLS sin política = error, no filtrado silencioso)',
    !!ins.error && ins.error.message.includes('row-level security'),
    ins.error ? '' : '(se insertó igual)'
  );

  await client.query('RESET ROLE');
  await client.query('SET LOCAL ROLE anon');

  console.log('\n[4] Sin sesión (anon) la lectura ya NO funciona');
  const { rows: sinSesion } = await client.query('SELECT * FROM arqueos_caja');
  check('anon ve 0 filas (antes veía todas)', sinSesion.length === 0, `(vio ${sinSesion.length})`);

  await client.query('ROLLBACK');
  console.log(
    `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
  );
  process.exitCode = fallos === 0 ? 0 : 1;
} catch (err) {
  console.error('\nERROR:', err.message);
  try {
    await client.query('ROLLBACK');
  } catch {
    /* noop */
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
