/**
 * Prueba de la migración 20260916000000_autorizacion_en_la_base.sql contra la
 * base real y SIN dejar rastro: todo corre en una transacción que termina en
 * ROLLBACK (lo único que se consume son números de secuencia).
 *
 * Simula cómo llega cada petición por la API: PostgREST deja los claims del
 * JWT en `request.jwt.claims`, y la app mete ahí el `app_rol`. Con
 * set_config(..., true) el valor vive solo en esta transacción.
 *
 *   node scripts/test-autorizacion.mjs
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
  process.argv[2] ?? './supabase/migrations/20260916000000_autorizacion_en_la_base.sql';

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

/** Simula el rol con el que entra la petición por la API */
async function como(client, rol) {
  const claims = rol === 'anon' ? { role: 'anon' } : { role: 'authenticated', app_rol: rol };
  await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
}

/** Conexión directa (sin JWT), como los scripts y migraciones */
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

  // ── Datos de prueba (viven solo en esta transacción) ─────────────────
  const crearUsuario = async (nombre, rol) => {
    const { rows: [u] } = await client.query(
      `INSERT INTO usuarios (nombre, pin_hash, rol, activo, debe_cambiar_pin)
       VALUES ($1, extensions.crypt('2580', extensions.gen_salt('bf')), $2, true, false)
       RETURNING id, nombre, rol, sesion_version`,
      [nombre, rol]
    );
    return u;
  };
  const admin = await crearUsuario('QA Admin Auth', 'admin');
  const cajero = await crearUsuario('QA Cajero Auth', 'cajero');
  const cocina = await crearUsuario('QA Cocina Auth', 'cocina');

  const { rows: [prodActivo] } = await client.query(
    `SELECT id, precio FROM productos WHERE activo ORDER BY id LIMIT 1`
  );
  const { rows: [prodAgotado] } = await client.query(
    `INSERT INTO productos (nombre, precio, activo, es_adicion)
     VALUES ('QA Agotado', 5000, false, false) RETURNING id, precio`
  );

  const lineas = (items) => JSON.stringify(items);
  const crear = (items, extra = {}) =>
    client.query(
      `SELECT create_order_with_details('mesa', 7, NULL, NULL, NULL, 'pendiente', NULL, 0, 0, 0, $1::jsonb, NULL, NULL, 0, $2) AS id`,
      [lineas(items), extra.creado_por ?? 'QA']
    );

  // ── 2. Rol de la sesión ──────────────────────────────────────────────
  console.log('\n[2] Quién puede crear pedidos');

  await como(client, 'anon');
  const { rows: [{ rol_de_sesion: rolAnon }] } = await client.query('SELECT rol_de_sesion()');
  check('sin app_rol la sesión es anon', rolAnon === 'anon');
  await debeFallar(
    client,
    'anon (clave pública sola) NO crea pedidos',
    () => crear([{ producto_id: prodActivo.id, cantidad: 1 }]),
    'ROL_NO_AUTORIZADO'
  );

  await como(client, 'cocina');
  await debeFallar(
    client,
    'cocina NO crea pedidos',
    () => crear([{ producto_id: prodActivo.id, cantidad: 1 }]),
    'ROL_NO_AUTORIZADO'
  );

  await como(client, 'cajero');
  const { rows: [{ id: pedidoId }] } = await crear([{ producto_id: prodActivo.id, cantidad: 2 }]);
  check('cajero sí crea pedidos', Number.isInteger(pedidoId));
  const { rows: [ped] } = await client.query('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
  check('el total sale del catálogo', Number(ped.total) === Number(prodActivo.precio) * 2);

  await directo(client);
  const { rows: [{ rol_de_sesion: rolDirecto }] } = await client.query('SELECT rol_de_sesion()');
  check('la conexión directa (scripts) se reconoce como tal', rolDirecto === 'directo');

  // ── 3. Validaciones nuevas ───────────────────────────────────────────
  console.log('\n[3] Validaciones de líneas');
  await como(client, 'cajero');
  await debeFallar(
    client,
    'cantidad negativa se rechaza',
    () => crear([{ producto_id: prodActivo.id, cantidad: -5 }]),
    'CANTIDAD_INVALIDA'
  );
  await debeFallar(
    client,
    'cantidad cero se rechaza',
    () => crear([{ producto_id: prodActivo.id, cantidad: 0 }]),
    'CANTIDAD_INVALIDA'
  );
  await debeFallar(
    client,
    'producto agotado no se vende',
    () => crear([{ producto_id: prodAgotado.id, cantidad: 1 }]),
    'PRODUCTO_AGOTADO'
  );
  await debeFallar(
    client,
    'tipo de atención inventado se rechaza',
    () =>
      client.query(
        `SELECT create_order_with_details('barra', NULL, NULL, NULL, NULL, 'pendiente', NULL, 0, 0, 0, $1::jsonb)`,
        [lineas([{ producto_id: prodActivo.id, cantidad: 1 }])]
      ),
    'TIPO_INVALIDO'
  );

  // Editar: lo que ya estaba en el pedido se conserva aunque se agote después
  await client.query('UPDATE productos SET activo = false WHERE id = $1', [prodActivo.id]);
  await client.query(
    `SELECT update_order_with_details($1, 7, NULL, NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
    [pedidoId, lineas([{ producto_id: prodActivo.id, cantidad: 3, precio_unitario: prodActivo.precio }])]
  );
  const { rows: [tras] } = await client.query('SELECT total FROM pedidos WHERE id = $1', [pedidoId]);
  check('al editar se conserva un producto que se agotó después', Number(tras.total) === Number(prodActivo.precio) * 3);
  await client.query('UPDATE productos SET activo = true WHERE id = $1', [prodActivo.id]);

  await debeFallar(
    client,
    'al editar no se puede meter un producto agotado nuevo',
    () =>
      client.query(
        `SELECT update_order_with_details($1, 7, NULL, NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
        [
          pedidoId,
          lineas([
            { producto_id: prodActivo.id, cantidad: 1, precio_unitario: prodActivo.precio },
            { producto_id: prodAgotado.id, cantidad: 1, precio_unitario: prodAgotado.precio },
          ]),
        ]
      ),
    'PRODUCTO_AGOTADO'
  );

  // ── 4. Cocina y cobro ────────────────────────────────────────────────
  console.log('\n[4] Cocina y cobro');
  await como(client, 'anon');
  await debeFallar(
    client,
    'anon NO marca listo',
    () => client.query('SELECT mark_order_ready($1)', [pedidoId]),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'cocina');
  await client.query('SELECT mark_order_ready($1)', [pedidoId]);
  const { rows: [listo] } = await client.query('SELECT estado FROM pedidos WHERE id = $1', [pedidoId]);
  check('cocina sí marca listo', listo.estado === 'listo');

  await debeFallar(
    client,
    'cocina NO cobra',
    () =>
      client.query(`SELECT close_order_with_payments($1, $2::jsonb, 'QA')`, [
        pedidoId,
        JSON.stringify([{ metodo: 'efectivo', monto: Number(tras.total) }]),
      ]),
    'ROL_NO_AUTORIZADO'
  );

  await como(client, 'cajero');
  await debeFallar(
    client,
    'método de pago fuera de la lista se rechaza',
    () =>
      client.query(`SELECT close_order_with_payments($1, $2::jsonb, 'QA')`, [
        pedidoId,
        JSON.stringify([{ metodo: 'efectivo ', monto: Number(tras.total) }]),
      ]),
    'METODO_INVALIDO'
  );
  const { rows: [{ close_order_with_payments: totalCobrado }] } = await client.query(
    `SELECT close_order_with_payments($1, $2::jsonb, 'QA')`,
    [pedidoId, JSON.stringify([{ metodo: 'datafono', monto: Number(tras.total) }])]
  );
  check(
    'cajero cobra y el datáfono suma su 5%',
    Number(totalCobrado) === Number(tras.total) + Math.round(Number(tras.total) * 0.05)
  );

  // ── 5. Cancelar exige PIN dentro de la base ──────────────────────────
  console.log('\n[5] Cancelar con PIN verificado en la base');
  const { rows: [{ id: pedido2 }] } = await crear([{ producto_id: prodActivo.id, cantidad: 1 }]);

  await debeFallar(
    client,
    'la firma vieja (nombre libre) ya no existe',
    () => client.query(`SELECT cancel_order($1, 'x', 'Cualquiera')`, [pedido2]),
    'does not exist'
  );
  await debeFallar(
    client,
    'PIN equivocado no cancela',
    () => client.query(`SELECT cancel_order($1, 'Error al digitar', $2, '0000')`, [pedido2, cocina.id]),
    'CREDENCIALES_INVALIDAS'
  );
  await como(client, 'anon');
  await debeFallar(
    client,
    'anon no cancela ni con PIN bueno',
    () => client.query(`SELECT cancel_order($1, 'Error al digitar', $2, '2580')`, [pedido2, cocina.id]),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'cocina');
  await client.query(`SELECT cancel_order($1, 'Error al digitar', $2, '2580')`, [pedido2, cocina.id]);
  const { rows: [cancelado] } = await client.query(
    'SELECT estado, cancelado_por, motivo_cancelacion FROM pedidos WHERE id = $1',
    [pedido2]
  );
  check('cancela con el PIN correcto', cancelado.estado === 'cancelado');
  check('el nombre registrado sale de la tabla de usuarios', cancelado.cancelado_por === cocina.nombre);
  await debeFallar(
    client,
    'un pedido cancelado no se cancela dos veces',
    () => client.query(`SELECT cancel_order($1, 'x', $2, '2580')`, [pedido2, cocina.id]),
    'PEDIDO_YA_CANCELADO'
  );

  // ── 6. Menú solo administración ──────────────────────────────────────
  console.log('\n[6] Menú y recetas: solo administración');
  await como(client, 'cajero');
  await debeFallar(
    client,
    'cajero NO cambia precios',
    () => client.query(`SELECT actualizar_producto($1, 'Hackeado', 1, NULL)`, [prodAgotado.id]),
    'ROL_NO_AUTORIZADO'
  );
  await debeFallar(
    client,
    'cajero NO borra categorías',
    () => client.query(`SELECT eliminar_categoria(999999)`),
    'ROL_NO_AUTORIZADO'
  );
  await debeFallar(
    client,
    'cajero NO marca agotados',
    () => client.query(`SELECT toggle_producto_activo($1, true)`, [prodAgotado.id]),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'admin');
  await client.query(`SELECT toggle_producto_activo($1, true)`, [prodAgotado.id]);
  const { rows: [reactivado] } = await client.query('SELECT activo FROM productos WHERE id = $1', [prodAgotado.id]);
  check('admin sí marca disponible', reactivado.activo === true);

  await debeFallar(
    client,
    'receta con insumo repetido se rechaza',
    async () => {
      const { rows: [ins] } = await client.query(`SELECT crear_insumo('QA Insumo', 'gramo') AS id`);
      await client.query(`SELECT guardar_receta($1, $2::jsonb)`, [
        prodAgotado.id,
        JSON.stringify([
          { insumo_id: ins.id, cantidad_usada: 10 },
          { insumo_id: ins.id, cantidad_usada: 5 },
        ]),
      ]);
    },
    'INSUMO_REPETIDO'
  );
  await debeFallar(
    client,
    'receta vacía se rechaza',
    () => client.query(`SELECT guardar_receta($1, '[]'::jsonb)`, [prodAgotado.id]),
    'ITEMS_REQUERIDOS'
  );

  // ── 7. Vistas: insumo sin compras no se vuelve costo 0 en silencio ───
  console.log('\n[7] Vistas de costeo');
  const { rows: [ins] } = await client.query(`SELECT crear_insumo('QA Sin Precio', 'gramo') AS id`);
  await client.query(`SELECT guardar_receta($1, $2::jsonb)`, [
    prodAgotado.id,
    JSON.stringify([{ insumo_id: ins.id, cantidad_usada: 10 }]),
  ]);
  const { rows: [costo] } = await client.query(
    'SELECT costo_total, insumos_en_receta, insumos_sin_costo FROM vw_producto_costos WHERE producto_id = $1',
    [prodAgotado.id]
  );
  check('la vista cuenta los insumos de la receta', costo.insumos_en_receta === 1);
  check('la vista señala el insumo sin compras', costo.insumos_sin_costo === 1);
  const { rows: [vista] } = await client.query(
    `SELECT reloptions FROM pg_class WHERE relname = 'vw_producto_costos'`
  );
  check('la vista respeta RLS (security_invoker)', (vista.reloptions ?? []).some((o) => o.includes('security_invoker=true')));

  // ── 8. Sesión: desactivar cierra sesiones abiertas ───────────────────
  console.log('\n[8] Versión de sesión');
  await directo(client);
  const { rows: [{ sesion_vigente: v1 }] } = await client.query('SELECT sesion_vigente($1, $2)', [cajero.id, cajero.sesion_version]);
  check('la sesión recién abierta es vigente', v1 === true);

  const { rows: sesion } = await client.query('SELECT * FROM iniciar_sesion($1, $2)', [cajero.id, '2580']);
  check('iniciar_sesion devuelve la versión', sesion[0].sesion_version === cajero.sesion_version);

  await client.query('SELECT cambiar_estado_usuario($1, $2, $3, false)', [admin.id, '2580', cajero.id]);
  const { rows: [{ sesion_vigente: v2 }] } = await client.query('SELECT sesion_vigente($1, $2)', [cajero.id, cajero.sesion_version]);
  check('al desactivar, la sesión deja de valer', v2 === false);

  await client.query('SELECT cambiar_estado_usuario($1, $2, $3, true)', [admin.id, '2580', cajero.id]);
  const { rows: [{ sesion_vigente: v3 }] } = await client.query('SELECT sesion_vigente($1, $2)', [cajero.id, cajero.sesion_version]);
  check('al reactivar, la cookie vieja sigue sin valer (hay que entrar de nuevo)', v3 === false);

  await client.query('SELECT resetear_pin($1, $2, $3, $4)', [admin.id, '2580', cocina.id, '2581']);
  const { rows: [{ sesion_vigente: v4 }] } = await client.query('SELECT sesion_vigente($1, $2)', [cocina.id, cocina.sesion_version]);
  check('resetear el PIN cierra las sesiones abiertas', v4 === false);

  // ── 9. Arqueo de caja ────────────────────────────────────────────────
  console.log('\n[9] Arqueo de caja');
  const { rows: abiertas } = await client.query(`SELECT id FROM arqueos_caja WHERE estado = 'abierto'`);
  check('no hay más de un turno abierto en la base (si falla, el índice único no se pudo crear)', abiertas.length <= 1);

  await como(client, 'cajero');
  await debeFallar(
    client,
    'cajero NO abre caja',
    () => client.query('SELECT abrir_caja(50000)'),
    'ROL_NO_AUTORIZADO'
  );
  await como(client, 'admin');
  if (abiertas.length === 0) {
    const { rows: [{ abrir_caja: cajaId }] } = await client.query('SELECT abrir_caja(50000)');
    check('admin abre caja', Number.isInteger(cajaId));
    await debeFallar(client, 'no se abre una segunda', () => client.query('SELECT abrir_caja(1)'), 'CAJA_YA_ABIERTA');
    await client.query('SELECT cerrar_caja($1, 100000, 20000)', [cajaId]);
    await debeFallar(client, 'no se cierra dos veces', () => client.query('SELECT cerrar_caja($1, 1, 1)', [cajaId]), 'CAJA_YA_CERRADA');
  } else {
    await debeFallar(client, 'con un turno abierto, no se abre otro', () => client.query('SELECT abrir_caja(1)'), 'CAJA_YA_ABIERTA');
  }

  // ── 10. Realtime ─────────────────────────────────────────────────────
  console.log('\n[10] Realtime');
  const { rows: pub } = await client.query(
    `SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'productos'`
  );
  check('productos está en la publicación de realtime', pub.length === 1);
} catch (err) {
  fallos++;
  console.error(`\n  ERROR: ${err.message}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

console.log(`\n${pruebas - fallos}/${pruebas} pruebas ok${fallos ? ` — ${fallos} fallas` : ''}\n`);
process.exitCode = fallos ? 1 : 0;
