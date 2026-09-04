/**
 * Prueba del sistema de usuarios con PIN, contra la base real y SIN dejar
 * rastro: todo corre dentro de una transacción que termina en ROLLBACK.
 *
 *   node scripts/test-usuarios.mjs
 *
 * La conexión sale de DATABASE_URL o, si no está definida, de `execute-seed.mjs`.
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
  process.argv[2] ?? './supabase/migrations/20260901000000_usuarios_con_pin.sql';

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

  // ── 1. Migración ─────────────────────────────────────────────────────
  console.log('\n[1] Migración');
  const sql = fs.readFileSync(MIGRACION, 'utf8');
  await client.query(sql);
  console.log('  ok    se aplica sin errores');
  await client.query(sql);
  console.log('  ok    es idempotente');

  const { rows: admins } = await client.query(
    `SELECT * FROM usuarios WHERE rol = 'admin' ORDER BY id LIMIT 1`
  );
  check('queda una cuenta de administración para poder entrar', admins.length === 1);
  const admin = admins[0];
  check('esa cuenta arranca obligada a cambiar el PIN', admin.debe_cambiar_pin === true);

  // ── 2. El PIN nunca sale de la base ──────────────────────────────────
  console.log('\n[2] El PIN no se puede leer');
  check('el PIN se guarda cifrado, no en claro', !admin.pin_hash.includes('3136') && admin.pin_hash.startsWith('$2'));

  const { fields: camposLogin } = await client.query('SELECT * FROM listar_usuarios_activos()');
  const nombresLogin = camposLogin.map((f) => f.name);
  check(
    'la lista de la pantalla de entrada no expone el hash',
    !nombresLogin.includes('pin_hash'),
    `(${nombresLogin.join(',')})`
  );

  const { fields: camposSesion } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [
    admin.id,
    '3136',
  ]);
  check(
    'al entrar tampoco se devuelve el hash',
    !camposSesion.map((f) => f.name).includes('pin_hash')
  );

  // ── 3. Entrar ────────────────────────────────────────────────────────
  console.log('\n[3] Entrar');
  const { rows: sesion } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [
    admin.id,
    '3136',
  ]);
  check('entra con el PIN correcto', sesion.length === 1 && sesion[0].nombre === 'Administración');
  check('avisa que todavía debe elegir su PIN', sesion[0].debe_cambiar_pin === true);

  await debeFallar(
    client,
    'no entra con el PIN equivocado',
    () => client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '9999']),
    'CREDENCIALES_INVALIDAS'
  );

  const { rows: [tras] } = await client.query('SELECT ultimo_ingreso FROM usuarios WHERE id = $1', [admin.id]);
  check('registra la hora del ingreso', tras.ultimo_ingreso !== null);

  // ── 4. Bloqueo por intentos ──────────────────────────────────────────
  console.log('\n[4] Bloqueo tras varios intentos');
  for (let i = 0; i < 5; i++) {
    await client.query('SAVEPOINT intento');
    try {
      await client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '9998']);
      await client.query('RELEASE SAVEPOINT intento');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT intento');
    }
  }
  // Ojo: el ROLLBACK del savepoint deshace el contador, así que se cuenta aparte
  await client.query(
    `UPDATE usuarios SET intentos_fallidos = 5, bloqueado_hasta = NOW() + INTERVAL '5 minutes' WHERE id = $1`,
    [admin.id]
  );
  await debeFallar(
    client,
    'estando bloqueado no deja entrar ni con el PIN bueno',
    () => client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '3136']),
    'USUARIO_BLOQUEADO'
  );

  await client.query(
    `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1`,
    [admin.id]
  );
  const { rows: reintento } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '3136']);
  check('pasado el bloqueo vuelve a entrar', reintento.length === 1);

  // ── 5. Cada quien elige su PIN ───────────────────────────────────────
  console.log('\n[5] Elegir el PIN propio');
  await debeFallar(
    client,
    'rechaza un PIN que no sean 4 dígitos',
    () => client.query('SELECT cambiar_pin($1, $2, $3)', [admin.id, '3136', '12']),
    'PIN_INVALIDO'
  );
  await debeFallar(
    client,
    'rechaza 1111',
    () => client.query('SELECT cambiar_pin($1, $2, $3)', [admin.id, '3136', '1111']),
    'PIN_INVALIDO'
  );
  await debeFallar(
    client,
    'rechaza 1234',
    () => client.query('SELECT cambiar_pin($1, $2, $3)', [admin.id, '3136', '1234']),
    'PIN_INVALIDO'
  );
  await debeFallar(
    client,
    'no deja cambiarlo sin saber el PIN actual',
    () => client.query('SELECT cambiar_pin($1, $2, $3)', [admin.id, '0000', '8462']),
    'CREDENCIALES_INVALIDAS'
  );

  await client.query('SELECT cambiar_pin($1, $2, $3)', [admin.id, '3136', '8462']);
  const { rows: [yaCambio] } = await client.query('SELECT debe_cambiar_pin FROM usuarios WHERE id = $1', [admin.id]);
  check('tras elegir su PIN ya no se le vuelve a pedir', yaCambio.debe_cambiar_pin === false);

  const { rows: conNuevo } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '8462']);
  check('entra con el PIN nuevo', conNuevo.length === 1);

  await debeFallar(
    client,
    'el PIN viejo ya no sirve',
    () => client.query('SELECT * FROM iniciar_sesion($1, $2)', [admin.id, '3136']),
    'CREDENCIALES_INVALIDAS'
  );

  // ── 6. Administración ────────────────────────────────────────────────
  console.log('\n[6] Dar de alta y administrar');
  const { rows: [nuevo] } = await client.query(
    'SELECT crear_usuario($1, $2, $3, $4, $5) AS id',
    [admin.id, '8462', '  Simón  ', 'cajero', '5027']
  );
  check('la dueña puede crear a alguien', Number.isInteger(nuevo.id));

  const { rows: [simon] } = await client.query('SELECT * FROM usuarios WHERE id = $1', [nuevo.id]);
  check('el nombre se guarda limpio', simon.nombre === 'Simón', `(${JSON.stringify(simon.nombre)})`);
  check('entra obligado a elegir su propio PIN', simon.debe_cambiar_pin === true);

  await debeFallar(
    client,
    'nadie puede crear usuarios sin el PIN de administración',
    () => client.query('SELECT crear_usuario($1, $2, $3, $4, $5)', [admin.id, '0000', 'Intruso', 'admin', '5027']),
    'ADMIN_NO_AUTORIZADO'
  );

  await debeFallar(
    client,
    'un cajero no puede crear usuarios aunque sepa su PIN',
    () => client.query('SELECT crear_usuario($1, $2, $3, $4, $5)', [nuevo.id, '5027', 'Intruso', 'admin', '5027']),
    'ADMIN_NO_AUTORIZADO'
  );

  await debeFallar(
    client,
    'no deja dos personas con el mismo nombre',
    () => client.query('SELECT crear_usuario($1, $2, $3, $4, $5)', [admin.id, '8462', 'simón', 'cocina', '5027']),
    'NOMBRE_REPETIDO'
  );

  const { rows: [nuevoDev] } = await client.query(
    'SELECT crear_usuario($1, $2, $3, $4, $5) AS id',
    [admin.id, '8462', '  Tester  ', 'dev', '5031']
  );
  check('la dueña puede crear una cuenta dev/tester', Number.isInteger(nuevoDev.id));

  const { rows: [tester] } = await client.query('SELECT rol FROM usuarios WHERE id = $1', [nuevoDev.id]);
  check('la cuenta dev queda con rol dev', tester.rol === 'dev', `(${tester.rol})`);

  const { rows: [creadoPorDev] } = await client.query(
    'SELECT crear_usuario($1, $2, $3, $4, $5) AS id',
    [nuevoDev.id, '5031', 'Creado por dev', 'cajero', '5032']
  );
  check('una cuenta dev administra igual que admin', Number.isInteger(creadoPorDev.id));

  await debeFallar(
    client,
    'rechaza un rol inventado',
    () => client.query('SELECT crear_usuario($1, $2, $3, $4, $5)', [admin.id, '8462', 'Otro', 'jefe', '5027']),
    'ROL_INVALIDO'
  );

  // Simón elige el suyo y la dueña ya no lo conoce
  await client.query('SELECT cambiar_pin($1, $2, $3)', [nuevo.id, '5027', '7391']);
  await debeFallar(
    client,
    'quien administra no puede entrar con el PIN temporal que puso',
    () => client.query('SELECT * FROM iniciar_sesion($1, $2)', [nuevo.id, '5027']),
    'CREDENCIALES_INVALIDAS'
  );

  // Reseteo por olvido
  await client.query('SELECT resetear_pin($1, $2, $3, $4)', [admin.id, '8462', nuevo.id, '6248']);
  const { rows: reseteado } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [nuevo.id, '6248']);
  check('tras resetear entra con el temporal', reseteado.length === 1);
  check('y vuelve a estar obligado a elegir el suyo', reseteado[0].debe_cambiar_pin === true);

  // Confirmar identidad sin abrir sesión (al anular)
  const { rows: confirmado } = await client.query('SELECT * FROM confirmar_pin($1, $2)', [nuevo.id, '6248']);
  check('confirmar el PIN devuelve quién es', confirmado[0].nombre === 'Simón');
  await debeFallar(
    client,
    'confirmar con el PIN equivocado falla',
    () => client.query('SELECT * FROM confirmar_pin($1, $2)', [nuevo.id, '1357']),
    'CREDENCIALES_INVALIDAS'
  );

  // Desactivar
  await client.query('SELECT cambiar_estado_usuario($1, $2, $3, $4)', [admin.id, '8462', nuevo.id, false]);
  await debeFallar(
    client,
    'alguien desactivado ya no entra',
    () => client.query('SELECT * FROM iniciar_sesion($1, $2)', [nuevo.id, '6248']),
    'CREDENCIALES_INVALIDAS'
  );
  const { rows: visibles } = await client.query('SELECT * FROM listar_usuarios_activos()');
  check(
    'y desaparece de la pantalla de entrada',
    !visibles.some((u) => u.id === nuevo.id)
  );

  await debeFallar(
    client,
    'no deja desactivar al último administrador',
    () => client.query('SELECT cambiar_estado_usuario($1, $2, $3, $4)', [admin.id, '8462', admin.id, false]),
    'ULTIMO_ADMIN'
  );

  const { rows: listado } = await client.query('SELECT * FROM listar_usuarios_admin($1, $2)', [admin.id, '8462']);
  check('el listado de administración trae a todos', listado.length >= 2, `(${listado.length})`);
  check('sin exponer el hash', !Object.keys(listado[0]).includes('pin_hash'));

  // ── 7. Quién hizo qué ────────────────────────────────────────────────
  console.log('\n[7] Atribución en los pedidos');
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name IN ('creado_por','cobrado_por','cancelado_por')
  `);
  check('los pedidos guardan quién los tomó, cobró y anuló', cols.rowCount === 3, `(${cols.rowCount})`);

  // ── 8. La tabla no se puede leer de frente ───────────────────────────
  console.log('\n[8] La tabla usuarios está cerrada');
  const { rows: [rls] } = await client.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'usuarios'`
  );
  check('tiene RLS activo', rls.relrowsecurity === true);
  const { rows: pol } = await client.query(
    `SELECT policyname FROM pg_policies WHERE tablename = 'usuarios'`
  );
  check('sin ninguna política que permita leerla desde la app', pol.length === 0, `(${pol.length})`);

  await client.query('ROLLBACK');
  console.log(
    `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
  );
  console.log('Transacción revertida: la base quedó exactamente como estaba.');
  process.exitCode = fallos === 0 ? 0 : 1;
} catch (err) {
  console.error('\nERROR:', err.message);
  try {
    await client.query('ROLLBACK');
  } catch {
    /* la conexión ya se cayó */
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
