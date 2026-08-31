/**
 * Prueba de la migración y de los flujos nuevos contra la base de datos real,
 * SIN dejar rastro: todo corre dentro de una transacción que termina en
 * ROLLBACK, así que la base queda exactamente como estaba.
 *
 *   node scripts/test-migracion.mjs [ruta-de-la-migracion.sql]
 *
 * La conexión sale de DATABASE_URL o, si no está definida, de `execute-seed.mjs`.
 *
 * Lo único que no se revierte son los números de pedido consumidos (las
 * secuencias de Postgres no vuelven atrás): quedan algunos ids sin usar.
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
  process.argv[2] ?? './supabase/migrations/20260831000000_deudas_control_y_edicion.sql';

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
 * Ejecuta algo que DEBE lanzar una excepción con cierto mensaje.
 *
 * Un error aborta la transacción entera, así que cada intento se envuelve en
 * su propio savepoint: al volver atrás se deshace solo la operación fallida,
 * no los datos de prueba creados antes.
 */
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

  // ── 1. Aplicar la migración ──────────────────────────────────────────
  console.log('\n[1] Migración');
  const sql = fs.readFileSync(MIGRACION, 'utf8');
  await client.query(sql);
  console.log('  ok    se aplica sin errores');

  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pedidos'
      AND column_name IN ('deudor_nombre','deudor_telefono','cancelado_por','rehecho_en')
  `);
  check('las 4 columnas nuevas existen', cols.rowCount === 4, `(${cols.rowCount})`);

  await client.query(sql);
  console.log('  ok    es idempotente (se puede correr dos veces)');

  // ── Datos de prueba ──────────────────────────────────────────────────
  const { rows: prods } = await client.query(
    'SELECT id, precio FROM productos ORDER BY id LIMIT 2'
  );
  if (prods.length < 2) throw new Error('Se necesitan al menos 2 productos en la base');
  const [comida, bebida] = prods;

  const detalles = (items) => JSON.stringify(items);

  const crearPedido = async (subtotal, items) => {
    const { rows } = await client.query(
      `SELECT create_order_with_details(
         'mesa', 99, NULL, NULL, NULL, 'pendiente', NULL,
         $1, 0, $1, $2::jsonb
       ) AS id`,
      [subtotal, detalles(items)]
    );
    return rows[0].id;
  };

  const estadoDe = async (id) => {
    const { rows } = await client.query('SELECT * FROM pedidos WHERE id = $1', [id]);
    return rows[0];
  };


  // ── 2. Agregar algo a un pedido que YA salió de cocina ───────────────
  console.log('\n[2] Agregar productos a un pedido ya despachado');
  const linea1 = [
    { producto_id: comida.id, cantidad: 2, precio_unitario: Number(comida.precio), notas: null },
  ];
  const total1 = Number(comida.precio) * 2;

  const pedidoA = await crearPedido(total1, linea1);
  await client.query(`UPDATE pedidos SET estado = 'listo' WHERE id = $1`, [pedidoA]);

  // Caso "una gaseosa de la nevera": no hace falta volver a cocina
  const linea2 = [
    ...linea1,
    { producto_id: bebida.id, cantidad: 1, precio_unitario: Number(bebida.precio), notas: null },
  ];
  const total2 = total1 + Number(bebida.precio);

  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, NULL, $2, 0, $2, $3::jsonb, NULL, NULL, 0, FALSE)`,
    [pedidoA, total2, detalles(linea2)]
  );

  let p = await estadoDe(pedidoA);
  check('un pedido "listo" sí se puede modificar', true);
  check('sin avisar a cocina se queda en "listo"', p.estado === 'listo', `(${p.estado})`);
  check('el total sube con lo agregado', Number(p.total) === total2, `(${p.total} vs ${total2})`);
  check('queda marcado como modificado', p.modificado_at !== null);

  const { rows: det } = await client.query(
    'SELECT * FROM detalle_pedidos WHERE pedido_id = $1',
    [pedidoA]
  );
  check('el producto agregado quedó en el detalle', det.length === 2, `(${det.length})`);

  // Caso "hay que prepararlo": vuelve al tablero de cocina
  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, NULL, $2, 0, $2, $3::jsonb, NULL, NULL, 0, TRUE)`,
    [pedidoA, total2, detalles(linea2)]
  );
  p = await estadoDe(pedidoA);
  check('avisando a cocina vuelve a "pendiente"', p.estado === 'pendiente', `(${p.estado})`);

  // Un pedido pendiente sigue editándose como siempre
  await client.query(
    `SELECT update_order_with_details(
       $1, 99, NULL, NULL, NULL, NULL, $2, 0, $2, $3::jsonb, NULL, NULL, 0, TRUE)`,
    [pedidoA, total1, detalles(linea1)]
  );
  p = await estadoDe(pedidoA);
  check('un pedido pendiente se sigue editando igual', p.estado === 'pendiente' && Number(p.total) === total1);

  // ── 3. Lo que NO se puede modificar ──────────────────────────────────
  console.log('\n[3] Un pedido cerrado no se toca');
  const pedidoPagado = await crearPedido(total1, linea1);
  await client.query(`UPDATE pedidos SET estado = 'pagado' WHERE id = $1`, [pedidoPagado]);

  await debeFallar(
    client,
    'un pedido pagado no se puede modificar',
    () =>
      client.query(
        `SELECT update_order_with_details($1, 99, NULL, NULL, NULL, NULL, $2, 0, $2, $3::jsonb)`,
        [pedidoPagado, total1, detalles(linea1)]
      ),
    'PEDIDO_NO_EDITABLE'
  );

  await debeFallar(
    client,
    'un pedido inexistente da un error claro',
    () =>
      client.query(
        `SELECT update_order_with_details(-1, 99, NULL, NULL, NULL, NULL, 1, 0, 1, '[]'::jsonb)`
      ),
    'PEDIDO_NO_ENCONTRADO'
  );

  // ── 4. Deuda con nombre ──────────────────────────────────────────────
  console.log('\n[4] Registrar quién debe');
  const pedidoDeuda = await crearPedido(total1, linea1);
  await client.query(`UPDATE pedidos SET estado = 'listo' WHERE id = $1`, [pedidoDeuda]);

  await debeFallar(
    client,
    'sin nombre no deja registrar la deuda',
    () => client.query('SELECT mark_order_debe($1, $2)', [pedidoDeuda, '   ']),
    'DEUDOR_REQUERIDO'
  );

  await client.query('SELECT mark_order_debe($1, $2, $3)', [
    pedidoDeuda,
    '  Doña Rosa  ',
    ' 3001234567 ',
  ]);
  p = await estadoDe(pedidoDeuda);
  check('el pedido queda en estado "debe"', p.estado === 'debe', `(${p.estado})`);
  check('el nombre se guarda sin espacios sobrantes', p.deudor_nombre === 'Doña Rosa', `(${JSON.stringify(p.deudor_nombre)})`);
  check('el teléfono se guarda limpio', p.deudor_telefono === '3001234567', `(${p.deudor_telefono})`);
  check('queda con hora de cierre', p.closed_at !== null);

  await debeFallar(
    client,
    'un pedido pagado no se puede volver deuda',
    () => client.query('SELECT mark_order_debe($1, $2)', [pedidoPagado, 'X']),
    'PEDIDO_YA_PAGADO'
  );

  await debeFallar(
    client,
    'una deuda no se puede modificar después',
    () =>
      client.query(
        `SELECT update_order_with_details($1, 99, NULL, NULL, NULL, NULL, $2, 0, $2, $3::jsonb)`,
        [pedidoDeuda, total1, detalles(linea1)]
      ),
    'PEDIDO_NO_EDITABLE'
  );

  // ── 5. Cancelar dejando constancia + rehacer ─────────────────────────
  console.log('\n[5] Cancelación con responsable y pedido rehecho');
  const pedidoCancelado = await crearPedido(total1, linea1);
  await client.query('SELECT cancel_order($1, $2, $3)', [
    pedidoCancelado,
    'El cliente cambió el pedido',
    ' Simón ',
  ]);
  p = await estadoDe(pedidoCancelado);
  check('queda cancelado', p.estado === 'cancelado', `(${p.estado})`);
  check('guarda el motivo', p.motivo_cancelacion === 'El cliente cambió el pedido');
  check('guarda quién lo canceló', p.cancelado_por === 'Simón', `(${JSON.stringify(p.cancelado_por)})`);
  check(
    'conserva los productos del pedido anulado',
    (await client.query('SELECT 1 FROM detalle_pedidos WHERE pedido_id = $1', [pedidoCancelado]))
      .rowCount > 0
  );
  check('todavía no está rehecho', p.rehecho_en === null);

  const pedidoNuevo = await crearPedido(total2, linea2);
  await client.query('SELECT link_rehecho($1, $2)', [pedidoCancelado, pedidoNuevo]);
  p = await estadoDe(pedidoCancelado);
  check('queda enlazado con el pedido que lo reemplazó', p.rehecho_en === pedidoNuevo, `(${p.rehecho_en})`);

  await debeFallar(
    client,
    'un pedido pagado no se puede cancelar',
    () => client.query('SELECT cancel_order($1, $2, $3)', [pedidoPagado, 'x', 'y']),
    'PEDIDO_YA_PAGADO'
  );

  await debeFallar(
    client,
    'no se puede enlazar un pedido consigo mismo',
    () => client.query('SELECT link_rehecho($1, $1)', [pedidoCancelado]),
    'REFERENCIA_CIRCULAR'
  );

  // ── 6. Las cuentas del dashboard ─────────────────────────────────────
  console.log('\n[6] Cuentas del dashboard');

  // Pedido de hace 3 días que se cobra HOY: la plata entra hoy, la venta es vieja
  const pedidoViejo = await crearPedido(total1, linea1);
  await client.query(
    `UPDATE pedidos
       SET estado = 'pagado', created_at = NOW() - INTERVAL '3 days', closed_at = NOW()
     WHERE id = $1`,
    [pedidoViejo]
  );

  const inicioHoy = `(NOW() AT TIME ZONE 'America/Bogota')::date::timestamptz`;
  const { rows: [cobros] } = await client.query(
    `SELECT COALESCE(SUM(total - COALESCE(costo_domicilio,0)), 0)::numeric AS monto,
            COUNT(*)::int AS n
       FROM pedidos
      WHERE estado = 'pagado'
        AND closed_at >= ${inicioHoy}
        AND created_at < ${inicioHoy}
        AND id = $1`,
    [pedidoViejo]
  );
  check(
    'una deuda vieja cobrada hoy se detecta aparte de la venta del día',
    Number(cobros.monto) === total1 && cobros.n === 1,
    `(${cobros.monto}, ${cobros.n})`
  );

  const { rows: [cart] } = await client.query(
    `SELECT COALESCE(SUM(total - COALESCE(costo_domicilio,0)),0)::numeric AS monto,
            COUNT(*)::int AS n
       FROM pedidos WHERE estado = 'debe' AND id = $1`,
    [pedidoDeuda]
  );
  check('la cartera suma el pedido fiado', Number(cart.monto) === total1 && cart.n === 1, `(${cart.monto})`);

  // Un domicilio fiado no debe inflar la venta: el cobro del domiciliario se resta
  const pedidoDomicilio = await crearPedido(total1, linea1);
  await client.query(
    `UPDATE pedidos SET estado = 'debe', costo_domicilio = 5000, total = $2, deudor_nombre = 'Prueba'
      WHERE id = $1`,
    [pedidoDomicilio, total1 + 5000]
  );
  const { rows: [dom] } = await client.query(
    `SELECT (total - COALESCE(costo_domicilio,0))::numeric AS neto FROM pedidos WHERE id = $1`,
    [pedidoDomicilio]
  );
  check('el cobro del domiciliario no entra en el fiado', Number(dom.neto) === total1, `(${dom.neto})`);

  // ── Resultado ────────────────────────────────────────────────────────
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
