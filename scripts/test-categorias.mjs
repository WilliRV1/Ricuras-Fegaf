/**
 * Prueba de la migración 20260909000000_gestion_categorias.sql contra la
 * base real, sin dejar rastro (todo en una transacción con ROLLBACK).
 *
 *   node scripts/test-categorias.mjs
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
    if (err.message.includes(fragmento)) {
      console.log(`  ok    ${nombre}`);
    } else {
      fallos++;
      console.log(`  FALLA ${nombre} — error inesperado: ${err.message}`);
    }
  }
}

const client = new Client({ connectionString: conexion() });

try {
  await client.connect();
  await client.query('BEGIN');

  // Enlazar un producto a la categoría de prueba antes de simular el rol
  // `authenticated`: esa tabla solo se escribe vía RPC (sin RLS de INSERT/
  // UPDATE directo), así que como superusuario es la única forma de armar
  // el escenario para probar el ON DELETE SET NULL más abajo.
  const { rows: [catSetup] } = await client.query(`SELECT crear_categoria('QA Categoria Setup', NULL) AS id`);
  const { rows: [productoSetup] } = await client.query('SELECT id FROM productos LIMIT 1');
  await client.query('UPDATE productos SET categoria_id = $1 WHERE id = $2', [catSetup.id, productoSetup.id]);

  await client.query('SET LOCAL ROLE authenticated');

  console.log('\n[1] RLS: sin política de escritura directa');
  await debeFallar(
    client,
    'INSERT directo en categorias queda bloqueado',
    () => client.query(`INSERT INTO categorias (nombre) VALUES ('Trucha')`),
    'row-level security'
  );

  console.log('\n[2] crear_categoria');
  const { rows: [cat] } = await client.query(`SELECT crear_categoria('QA Categoria Prueba', NULL) AS id`);
  check('devuelve un id', Number.isInteger(cat.id));

  const { rows: [maxOrden] } = await client.query('SELECT MAX(orden) AS m FROM categorias');
  const { rows: [guardada] } = await client.query('SELECT nombre, orden FROM categorias WHERE id = $1', [cat.id]);
  check('sin orden explícito, queda al final', Number(guardada.orden) === Number(maxOrden.m));

  await debeFallar(
    client,
    'nombre vacío se rechaza',
    () => client.query(`SELECT crear_categoria('   ', NULL)`),
    'NOMBRE_REQUERIDO'
  );
  await debeFallar(
    client,
    'nombre repetido se rechaza (sin importar mayúsculas)',
    () => client.query(`SELECT crear_categoria('qa categoria prueba', NULL)`),
    'CATEGORIA_REPETIDA'
  );

  console.log('\n[3] actualizar_categoria');
  await client.query(`SELECT actualizar_categoria($1, 'QA Categoria Editada', 99)`, [cat.id]);
  const { rows: [editada] } = await client.query('SELECT nombre, orden FROM categorias WHERE id = $1', [cat.id]);
  check('nombre y orden se actualizan', editada.nombre === 'QA Categoria Editada' && Number(editada.orden) === 99);

  await debeFallar(
    client,
    'editar una categoría inexistente se rechaza',
    () => client.query(`SELECT actualizar_categoria(-999, 'X', NULL)`),
    'CATEGORIA_NO_ENCONTRADA'
  );

  console.log('\n[4] eliminar_categoria: producto que la usaba queda sin categoría');
  await client.query('SELECT eliminar_categoria($1)', [catSetup.id]);
  const { rows: [productoTrasBorrar] } = await client.query(
    'SELECT categoria_id FROM productos WHERE id = $1',
    [productoSetup.id]
  );
  check('el producto queda sin categoría, no se bloquea el borrado', productoTrasBorrar.categoria_id === null);

  await debeFallar(
    client,
    'borrar una categoría inexistente se rechaza',
    () => client.query('SELECT eliminar_categoria($1)', [catSetup.id]),
    'CATEGORIA_NO_ENCONTRADA'
  );

  await client.query('ROLLBACK');
  console.log(
    `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
  );
  console.log('Transacción revertida: la base quedó exactamente como estaba.');
  process.exitCode = fallos === 0 ? 0 : 1;
} catch (err) {
  console.error('\nERROR:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
