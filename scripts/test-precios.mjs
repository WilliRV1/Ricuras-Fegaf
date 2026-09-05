/**
 * Prueba de la migración de precios server-side y del cierre de escritura
 * directa, contra la base real y SIN dejar rastro: todo corre dentro de una
 * transacción que termina en ROLLBACK.
 *
 * A diferencia de los otros scripts de prueba, este SÍ verifica RLS de
 * verdad: usa `SET LOCAL ROLE authenticated` para que las consultas directas
 * a las tablas se ejecuten con los mismos permisos que tiene la app en
 * producción cuando hay sesión (la conexión de este script es superusuario y
 * por defecto se saltaría RLS). Antes de la migración
 * 20260904000000_cerrar_lectura_publica esto probaba con `anon`, porque el
 * servidor siempre leía como público; ahora el servidor firma un JWT y se
 * identifica como `authenticated` en cuanto hay sesión — que es el caso real
 * en toda pantalla que llega a llamar estas funciones (nunca se llaman sin
 * sesión), así que ese es el rol que hay que simular.
 *
 *   node scripts/test-precios.mjs
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
  process.argv[2] ?? './supabase/migrations/20260902000000_precios_server_side_y_stock.sql';

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

  console.log('\n[1] Migración');
  const sql = fs.readFileSync(MIGRACION, 'utf8');
  await client.query(sql);
  console.log('  ok    se aplica sin errores');
  await client.query(sql);
  console.log('  ok    es idempotente');

  const { rows: prods } = await client.query(
    'SELECT id, precio FROM productos ORDER BY id LIMIT 2'
  );
  if (prods.length < 2) throw new Error('Se necesitan al menos 2 productos');
  const [comida, bebida] = prods;
  const precioComida = Number(comida.precio);
  const precioBebida = Number(bebida.precio);

  const detalles = (items) => JSON.stringify(items);

  // ── Simular exactamente lo que hace la app: mismo usuario RPC (postgres
  //    ejecuta las funciones, pero SET LOCAL ROLE authenticated hace que
  //    cualquier intento de tocar una tabla DIRECTAMENTE pase por las
  //    políticas RLS reales, igual que en producción con una sesión activa). ──
  await client.query("SET LOCAL ROLE authenticated");

  console.log('\n[2] La app ya no puede escribir las tablas directamente');
  await debeFallar(
    client,
    'INSERT directo en pedidos queda bloqueado',
    () =>
      client.query(
        `INSERT INTO pedidos (tipo, estado, subtotal, recargo, total) VALUES ('mesa','pendiente',1,0,1)`
      ),
    'row-level security'
  );

  // Sin política de UPDATE, Postgres no lanza excepción: filtra la fila
  // en silencio (0 filas afectadas), igual que ya se comprobó con
  // productos.activo antes de escribir esta migración.
  const { rows: [pedidoExistente] } = await client.query(
    "SELECT id, total FROM pedidos ORDER BY id DESC LIMIT 1"
  );
  const totalOriginal = pedidoExistente.total;
  const resUpdate = await client.query(`UPDATE pedidos SET total = 1 WHERE id = $1`, [
    pedidoExistente.id,
  ]);
  check(
    'UPDATE directo del total de un pedido queda bloqueado (0 filas afectadas)',
    resUpdate.rowCount === 0,
    `(${resUpdate.rowCount} filas)`
  );
  const { rows: [tras] } = await client.query('SELECT total FROM pedidos WHERE id = $1', [
    pedidoExistente.id,
  ]);
  check('y el total sigue siendo el mismo', String(tras.total) === String(totalOriginal));

  console.log('\n[3] Crear un pedido: el precio lo pone el servidor');
  const { rows: [pedidoTrucado] } = await client.query(
    `SELECT create_order_with_details(
       'mesa', 99, NULL, NULL, NULL, 'pendiente', NULL,
       1, 0, 1, $1::jsonb
     ) AS id`,
    [detalles([{ producto_id: comida.id, cantidad: 2, precio_unitario: 1, notas: null }])]
  );
  const { rows: [guardado] } = await client.query(
    'SELECT subtotal, total FROM pedidos WHERE id = $1',
    [pedidoTrucado.id]
  );
  check(
    'aunque el cliente mande precio_unitario=1 y subtotal=1, se guarda el precio real del catálogo',
    Number(guardado.subtotal) === precioComida * 2,
    `(esperado ${precioComida * 2}, guardado ${guardado.subtotal})`
  );

  const { rows: [detalleGuardado] } = await client.query(
    'SELECT precio_unitario FROM detalle_pedidos WHERE pedido_id = $1',
    [pedidoTrucado.id]
  );
  check(
    'el detalle también queda con el precio real, no el enviado',
    Number(detalleGuardado.precio_unitario) === precioComida
  );

  await debeFallar(
    client,
    'crear un pedido con un producto que no existe se rechaza',
    () =>
      client.query(
        `SELECT create_order_with_details('mesa', 1, NULL, NULL, NULL, 'pendiente', NULL, 1, 0, 1, $1::jsonb)`,
        [detalles([{ producto_id: -999, cantidad: 1, precio_unitario: 1, notas: null }])]
      ),
    'PRODUCTO_NO_ENCONTRADO'
  );

  await debeFallar(
    client,
    'crear un pedido sin productos se rechaza',
    () =>
      client.query(
        `SELECT create_order_with_details('mesa', 1, NULL, NULL, NULL, 'pendiente', NULL, 0, 0, 0, '[]'::jsonb)`
      ),
    'CARRITO_VACIO'
  );

  console.log('\n[4] Editar un pedido: precio válido o rechazado');
  const pedidoBase = pedidoTrucado.id;

  // Línea nueva con el precio ACTUAL del catálogo -> válida
  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
    [
      pedidoBase,
      detalles([
        { producto_id: comida.id, cantidad: 2, precio_unitario: precioComida, notas: null },
        { producto_id: bebida.id, cantidad: 1, precio_unitario: precioBebida, notas: null },
      ]),
    ]
  );
  const { rows: [tras1] } = await client.query('SELECT subtotal FROM pedidos WHERE id = $1', [
    pedidoBase,
  ]);
  check(
    'agregar una línea nueva con el precio de catálogo funciona y recalcula el subtotal',
    Number(tras1.subtotal) === precioComida * 2 + precioBebida
  );

  // Ahora el precio de esa línea de comida en el pedido YA es precioComida
  // (quedó guardado tras la edición anterior). Volver a mandarla con ese
  // mismo precio debe seguir siendo válido (conserva precio histórico).
  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
    [
      pedidoBase,
      detalles([{ producto_id: comida.id, cantidad: 3, precio_unitario: precioComida, notas: null }]),
    ]
  );
  const { rows: [tras2] } = await client.query('SELECT subtotal FROM pedidos WHERE id = $1', [
    pedidoBase,
  ]);
  check(
    'una línea con el precio que ya tenía el pedido se acepta (precio histórico)',
    Number(tras2.subtotal) === precioComida * 3
  );

  // Intentar colar un precio inventado (ni el del catálogo ni el histórico)
  await debeFallar(
    client,
    'un precio inventado en una edición se rechaza',
    () =>
      client.query(
        `SELECT update_order_with_details(
           $1, 99, NULL, NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
        [pedidoBase, detalles([{ producto_id: comida.id, cantidad: 1, precio_unitario: 1, notas: null }])]
      ),
    'PRECIO_INVALIDO'
  );

  // El total enviado por el cliente (p_total) se ignora: se recalcula
  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, 'datafono', 999999, 999999, 999999, $2::jsonb)`,
    [pedidoBase, detalles([{ producto_id: comida.id, cantidad: 1, precio_unitario: precioComida, notas: null }])]
  );
  const { rows: [tras3] } = await client.query(
    'SELECT total, subtotal FROM pedidos WHERE id = $1',
    [pedidoBase]
  );
  check(
    'el total que manda el cliente (999999) se ignora, se recalcula',
    Number(tras3.total) !== 999999 && Number(tras3.subtotal) === precioComida
  );

  console.log('\n[5] El recargo se valida contra el tipo guardado del pedido, no el enviado');
  const { rows: [pedidoDom] } = await client.query(
    `SELECT create_order_with_details(
       'domicilio', NULL, NULL, NULL, 'Calle falsa 123', 'pendiente', 'datafono',
       1, 0, 1, $1::jsonb) AS id`,
    [detalles([{ producto_id: comida.id, cantidad: 1, precio_unitario: 1, notas: null }])]
  );
  const { rows: [conRecargo] } = await client.query(
    'SELECT recargo, total FROM pedidos WHERE id = $1',
    [pedidoDom.id]
  );
  check(
    'domicilio + datáfono sí calcula el 5% de recargo desde el precio real',
    Number(conRecargo.recargo) === Math.round(precioComida * 0.05),
    `(${conRecargo.recargo})`
  );

  console.log('\n[6] Cocina y stock, ahora por función');
  await client.query(
    `SELECT create_order_with_details('mesa', 5, NULL, NULL, NULL, 'pendiente', NULL, 0,0,0, $1::jsonb) AS id`,
    [detalles([{ producto_id: comida.id, cantidad: 1, precio_unitario: 1, notas: null }])]
  );
  const { rows: [pendiente] } = await client.query(
    "SELECT id FROM pedidos WHERE tipo='mesa' AND numero_mesa=5 AND estado='pendiente' ORDER BY id DESC LIMIT 1"
  );
  await client.query('SELECT mark_order_ready($1)', [pendiente.id]);
  const { rows: [yaListo] } = await client.query('SELECT estado FROM pedidos WHERE id = $1', [
    pendiente.id,
  ]);
  check('mark_order_ready marca el pedido como listo', yaListo.estado === 'listo');

  await debeFallar(
    client,
    'mark_order_ready no deja marcar dos veces (ya no está pendiente)',
    () => client.query('SELECT mark_order_ready($1)', [pendiente.id]),
    'PEDIDO_NO_PENDIENTE'
  );

  const resProducto = await client.query('UPDATE productos SET activo = false WHERE id = $1', [
    comida.id,
  ]);
  check(
    'un UPDATE directo a productos sigue sin política (0 filas) — la puerta real es la función',
    resProducto.rowCount === 0,
    `(${resProducto.rowCount} filas)`
  );

  await client.query('SELECT toggle_producto_activo($1, false)', [comida.id]);
  const { rows: [productoApagado] } = await client.query(
    'SELECT activo FROM productos WHERE id = $1',
    [comida.id]
  );
  check(
    'toggle_producto_activo sí apaga el producto de verdad (antes fallaba en silencio)',
    productoApagado.activo === false
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
