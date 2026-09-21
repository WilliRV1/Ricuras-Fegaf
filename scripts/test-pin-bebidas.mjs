/**
 * Prueba de 20260921000000_pin_bebidas_parametros.sql y del seed de bebidas,
 * contra la base real y SIN dejar rastro (transacción con ROLLBACK).
 *
 *   node scripts/test-pin-bebidas.mjs
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

const MIGRACION = './supabase/migrations/20260921000000_pin_bebidas_parametros.sql';
const SEED = './supabase/seed_bebidas_2026.sql';

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

  // ── Usuarios de prueba ───────────────────────────────────────────────
  const crearUsuario = async (nombre, rol) => {
    const { rows: [u] } = await client.query(
      `INSERT INTO usuarios (nombre, pin_hash, rol, activo, debe_cambiar_pin)
       VALUES ($1, extensions.crypt('2580', extensions.gen_salt('bf')), $2, true, false)
       RETURNING id, nombre, rol, sesion_version`,
      [nombre, rol]
    );
    return u;
  };
  const admin = await crearUsuario('QA Admin PIN', 'admin');
  const simon = await crearUsuario('QA Simón PIN', 'cajero');

  // ── 2. Cambio voluntario de PIN ──────────────────────────────────────
  console.log('\n[2] Cambiar el propio PIN');
  const { rows: [antes] } = await client.query('SELECT pin_cambiado_at FROM usuarios WHERE id = $1', [simon.id]);
  check('antes de cambiarlo no hay fecha de cambio', antes.pin_cambiado_at === null);

  await debeFallar(
    client,
    'sin el PIN actual no se cambia',
    () => client.query('SELECT cambiar_pin($1, $2, $3)', [simon.id, '0000', '7391']),
    'CREDENCIALES_INVALIDAS'
  );
  await client.query('SELECT cambiar_pin($1, $2, $3)', [simon.id, '2580', '7391']);
  const { rows: [despues] } = await client.query(
    'SELECT sesion_version, pin_cambiado_at, debe_cambiar_pin FROM usuarios WHERE id = $1',
    [simon.id]
  );
  check('sube la versión de sesión (cierra otras tablets)', despues.sesion_version === simon.sesion_version + 1);
  check('queda la fecha del cambio', despues.pin_cambiado_at !== null);
  const { rows: [{ sesion_vigente: vieja }] } = await client.query('SELECT sesion_vigente($1, $2)', [simon.id, simon.sesion_version]);
  check('la cookie vieja deja de valer', vieja === false);
  const { rows: sesionNueva } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [simon.id, '7391']);
  check('entra con el PIN nuevo y la versión nueva', sesionNueva[0].sesion_version === despues.sesion_version);

  // ── 3. Forzar cambio desde administración ────────────────────────────
  console.log('\n[3] Forzar cambio de PIN');
  await debeFallar(
    client,
    'un cajero no puede forzar cambios',
    () => client.query('SELECT forzar_cambio_pin($1, $2, $3)', [simon.id, '7391', admin.id]),
    'ADMIN_NO_AUTORIZADO'
  );
  await client.query('SELECT forzar_cambio_pin($1, $2, $3)', [admin.id, '2580', simon.id]);
  const { rows: [forzado] } = await client.query('SELECT debe_cambiar_pin, sesion_version FROM usuarios WHERE id = $1', [simon.id]);
  check('queda obligado a elegir PIN nuevo', forzado.debe_cambiar_pin === true);
  check('y sus sesiones abiertas se cierran', forzado.sesion_version === despues.sesion_version + 1);
  const { rows: alEntrar } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [simon.id, '7391']);
  check('sigue entrando con su PIN (no se le cambió)', alEntrar.length === 1 && alEntrar[0].debe_cambiar_pin === true);
  await debeFallar(
    client,
    'forzar a alguien que no existe da error claro',
    () => client.query('SELECT forzar_cambio_pin($1, $2, $3)', [admin.id, '2580', 999999]),
    'USUARIO_NO_ENCONTRADO'
  );

  const { rows: listado } = await client.query('SELECT * FROM listar_usuarios_admin($1, $2)', [admin.id, '2580']);
  const filaSimon = listado.find((u) => u.id === simon.id);
  check('el listado de personal trae la fecha de cambio de PIN', filaSimon && filaSimon.pin_cambiado_at !== null);

  // ── 4. Productos que se compran hechos ───────────────────────────────
  console.log('\n[4] Producto que se compra hecho');
  await como(client, 'cajero');
  await debeFallar(
    client,
    'cajero no crea productos',
    () => client.query(`SELECT crear_producto('QA Agua', 3000, NULL, FALSE, TRUE)`),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'admin');
  const { rows: [{ crear_producto: bebidaId }] } = await client.query(
    `SELECT crear_producto('QA Agua sin gas', 3000, NULL, FALSE, TRUE)`
  );
  const { rows: [bebida] } = await client.query('SELECT insumo_id FROM productos WHERE id = $1', [bebidaId]);
  check('crea el insumo enlazado', bebida.insumo_id !== null);
  const { rows: receta } = await client.query('SELECT cantidad_usada FROM receta_items WHERE producto_id = $1', [bebidaId]);
  check('y una receta de 1 unidad', receta.length === 1 && Number(receta[0].cantidad_usada) === 1);

  let { rows: [costo] } = await client.query(
    'SELECT costo_total, insumos_en_receta, insumos_sin_costo FROM vw_producto_costos WHERE producto_id = $1',
    [bebidaId]
  );
  check('sin compras, la vista lo marca como costo incompleto', costo.insumos_en_receta === 1 && costo.insumos_sin_costo === 1);

  await client.query('SELECT registrar_compra_insumo($1, 2550, 1)', [bebida.insumo_id]);
  ({ rows: [costo] } = await client.query(
    'SELECT costo_total, margen, insumos_sin_costo FROM vw_producto_costos WHERE producto_id = $1',
    [bebidaId]
  ));
  check('con una compra, el costo es el precio de compra', Number(costo.costo_total) === 2550, `(${costo.costo_total})`);
  check('y el margen se calcula', Math.abs(Number(costo.margen) - (3000 - 2550) / 3000) < 1e-6);

  await client.query(`SELECT actualizar_producto($1, 'QA Agua sin gas 600', 3500, NULL)`, [bebidaId]);
  const { rows: [insumoRenombrado] } = await client.query('SELECT nombre FROM insumos WHERE id = $1', [bebida.insumo_id]);
  check('renombrar el producto renombra su insumo', insumoRenombrado.nombre === 'QA Agua sin gas 600');

  const { rows: [{ crear_producto: normalId }] } = await client.query(
    `SELECT crear_producto('QA Arepa', 8000, NULL, FALSE, FALSE)`
  );
  const { rows: [normal] } = await client.query('SELECT insumo_id FROM productos WHERE id = $1', [normalId]);
  check('un producto normal no crea insumo', normal.insumo_id === null);

  await client.query('SELECT eliminar_producto($1)', [bebidaId]);
  const { rows: insumoBorrado } = await client.query('SELECT 1 FROM insumos WHERE id = $1', [bebida.insumo_id]);
  check('borrar el producto se lleva su insumo propio', insumoBorrado.length === 0);

  // ── 5. Parámetros ────────────────────────────────────────────────────
  console.log('\n[5] Parámetros del negocio');
  await directo(client);
  const { rows: params } = await client.query('SELECT clave, valor FROM parametros ORDER BY clave');
  const valor = (k) => Number(params.find((p) => p.clave === k)?.valor);
  check('tarifa del domiciliario = 1500', valor('domiciliario_tarifa_producto') === 1500);
  check('mínimo del día = 40000', valor('domiciliario_minimo_dia') === 40000);
  check('programados 15 min antes', valor('programados_minutos_antes') === 15);
  check('categoría de bebidas detectada', valor('categoria_bebidas_id') > 0, `(${valor('categoria_bebidas_id')})`);

  await como(client, 'cajero');
  await debeFallar(
    client,
    'cajero no edita parámetros',
    () => client.query(`SELECT actualizar_parametro('domiciliario_minimo_dia', 1)`),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'admin');
  await client.query(`SELECT actualizar_parametro('domiciliario_minimo_dia', 45000)`);
  const { rows: [min] } = await client.query(`SELECT valor FROM parametros WHERE clave = 'domiciliario_minimo_dia'`);
  check('admin sí edita', Number(min.valor) === 45000);
  await debeFallar(
    client,
    'clave inexistente da error claro',
    () => client.query(`SELECT actualizar_parametro('no_existe', 1)`),
    'PARAMETRO_NO_ENCONTRADO'
  );
  await debeFallar(
    client,
    'valor negativo se rechaza',
    () => client.query(`SELECT actualizar_parametro('domiciliario_minimo_dia', -1)`),
    'VALOR_INVALIDO'
  );

  // ── 6. Seed de bebidas ───────────────────────────────────────────────
  console.log('\n[6] Seed de bebidas del Excel');
  await directo(client);
  const seedSql = fs.readFileSync(SEED, 'utf8');
  await client.query(seedSql);
  console.log('  ok    se aplica sin errores');
  await client.query(seedSql);
  console.log('  ok    es idempotente');

  const { rows: bebidas } = await client.query(
    `SELECT p.nombre, p.activo, p.precio, c.costo_total, c.insumos_sin_costo
       FROM productos p JOIN vw_producto_costos c ON c.producto_id = p.id
      WHERE p.nombre ILIKE 'Gaseosa %' OR p.nombre ILIKE 'Jugo Hit%' OR p.nombre ILIKE 'Agua con gas'
      ORDER BY p.nombre`
  );
  const por = (n) => bebidas.find((b) => b.nombre.toLowerCase() === n.toLowerCase());
  check('Coca-Cola 400 ml costeada desde la paca', Math.round(Number(por('Gaseosa Coca-Cola 400 ml')?.costo_total)) === 2542, `(${por('Gaseosa Coca-Cola 400 ml')?.costo_total})`);
  check('Coca-Cola 1,5 L promedia sus dos compras', Number(por('Gaseosa Coca-Cola 1,5 L')?.costo_total) === 6345, `(${por('Gaseosa Coca-Cola 1,5 L')?.costo_total})`);
  check('Postobón 1,5 L a 4.250 (matrimonio)', Number(por('Gaseosa Postobón 1,5 L')?.costo_total) === 4250);
  check('Postobón 400 ml a 2.550', Number(por('Gaseosa Postobón 400 ml')?.costo_total) === 2550);
  check('Jugo Hit queda enlazado y costeado', Number(por('Jugo Hit 500 ml')?.costo_total) === 3000, `(${por('Jugo Hit 500 ml')?.costo_total})`);
  check('Agua con gas enlazada, pendiente de compra', por('Agua con gas')?.insumos_sin_costo === 1);
  check('los genéricos quedan desactivados', por('Gaseosa personal 400 ml')?.activo === false && por('Gaseosa 1.5 Lt')?.activo === false);
  const { rows: sinDuplicar } = await client.query(`SELECT COUNT(*)::int AS n FROM productos WHERE nombre = 'Gaseosa Coca-Cola 400 ml'`);
  check('no duplica al reaplicar', sinDuplicar[0].n === 1);
} catch (err) {
  fallos++;
  console.error(`\n  ERROR: ${err.message}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas ok${fallos ? ` — ${fallos} fallas` : ''}\n`);
process.exitCode = fallos ? 1 : 0;
