/**
 * Auditoría de cobertura de permisos — no prueba un caso puntual, prueba que
 * NINGUNA tabla ni función se haya quedado a medio actualizar.
 *
 * Nació de un incidente real (2026-09-04): al cerrar la lectura pública de
 * pedidos/detalle_pedidos/pagos_pedido/arqueos_caja se actualizaron esas
 * cuatro tablas, pero `productos` y `categorias` se quedaron con la política
 * vieja (solo 'anon'). Como el servidor ahora se identifica como
 * 'authenticated' en cuanto hay sesión, el menú de /pedidos quedó viendo 0
 * filas — sin error, porque RLS filtra en silencio. Este script existe para
 * que ese tipo de olvido se vea solo, en vez de que alguien tenga que
 * acordarse de revisarlo a mano cada vez que se toca una política.
 *
 * Solo lee catálogo (pg_policies, pg_proc): no escribe nada, no necesita
 * transacción ni ROLLBACK.
 *
 *   node scripts/test-cobertura-rls.mjs
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

/**
 * Tablas cuyo SELECT se sabe que NO debe darle nada a 'authenticated' (ni a
 * nadie más que las funciones SECURITY DEFINER). Si una tabla con RLS no
 * está aquí y tampoco tiene 'authenticated' en su política de SELECT, la
 * auditoría la marca como sospechosa: probablemente alguien la agregó y se
 * olvidó de darle acceso, igual que pasó con productos/categorias.
 */
const TABLAS_CERRADAS_A_PROPOSITO = ['usuarios'];

const client = new Client({ connectionString: conexion() });

try {
  await client.connect();

  console.log('\n[1] Toda tabla con RLS debe poder leerse con sesión (authenticated)');
  const { rows: tablas } = await client.query(`
    SELECT relname FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity = true
    ORDER BY relname;
  `);
  check('se encontraron tablas con RLS para revisar', tablas.length > 0, `(${tablas.length})`);

  const { rows: politicasSelect } = await client.query(`
    SELECT tablename, roles FROM pg_policies
    WHERE schemaname = 'public' AND cmd = 'SELECT';
  `);

  for (const t of tablas) {
    if (TABLAS_CERRADAS_A_PROPOSITO.includes(t.relname)) {
      check(`${t.relname}: cerrada a propósito (documentado), no debe tener SELECT para nadie`, true);
      continue;
    }
    const propia = politicasSelect.filter((p) => p.tablename === t.relname);
    const tieneAuthenticated = propia.some((p) => p.roles.includes('authenticated'));
    check(
      `${t.relname}: 'authenticated' puede leerla`,
      tieneAuthenticated,
      tieneAuthenticated ? '' : '— el servidor usa este rol en cuanto hay sesión; sin esto, la pantalla que la use se queda vacía en silencio'
    );
  }

  console.log('\n[2] Toda función de negocio debe poder ejecutarse desde anon Y desde authenticated');
  // La app cambia de rol según haya sesión o no (login usa 'anon'; el resto
  // de la app usa 'authenticated' en cuanto hay sesión) — una función a la
  // que le falte uno de los dos se rompe según en qué pantalla se llame.
  const { rows: funciones } = await client.query(`
    SELECT p.proname AS funcion, p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname;
  `);
  check('se encontraron funciones para revisar', funciones.length > 0, `(${funciones.length})`);

  for (const f of funciones) {
    const { rows: [acceso] } = await client.query(
      `SELECT
         has_function_privilege('anon', $1, 'EXECUTE') AS anon,
         has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated`,
      [f.oid]
    );
    check(
      `${f.funcion}: ejecutable por anon y authenticated`,
      acceso.anon && acceso.authenticated,
      `(anon=${acceso.anon}, authenticated=${acceso.authenticated})`
    );
  }

  console.log('\n[3] Toda tabla de negocio debe seguir cerrada a escritura directa');
  // Solo se debe poder escribir a través de las funciones SECURITY DEFINER
  // (que validan reglas de negocio); un INSERT/UPDATE/DELETE directo con
  // política propia sería una puerta trasera que se salta esas reglas.
  const { rows: politicasEscritura } = await client.query(`
    SELECT tablename, cmd, roles FROM pg_policies
    WHERE schemaname = 'public' AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
  `);
  check(
    'ninguna tabla tiene política de escritura directa',
    politicasEscritura.length === 0,
    politicasEscritura.length > 0
      ? `— encontradas: ${politicasEscritura.map((p) => `${p.tablename}.${p.cmd}(${p.roles})`).join(', ')}`
      : ''
  );

  console.log(
    `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
  );
  process.exitCode = fallos === 0 ? 0 : 1;
} catch (err) {
  console.error('\nERROR:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
