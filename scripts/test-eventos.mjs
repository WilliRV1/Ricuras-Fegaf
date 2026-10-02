/**
 * Prueba de 20261005000000_eventos_precio_especial.sql contra la base real y
 * SIN dejar rastro (transacción con ROLLBACK). Lo único que no se revierte
 * son los números de pedido consumidos.
 *
 *   node scripts/test-eventos.mjs
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

// Las anteriores van primero: el trigger de costo viene de la de insumos.
const MIGRACIONES = [
  './supabase/migrations/20261003000000_domiciliario_recaudo.sql',
  './supabase/migrations/20261003000001_domiciliario_retirar_regla_vieja.sql',
  './supabase/migrations/20261004000000_insumos_enlazados.sql',
  './supabase/migrations/20261005000000_eventos_precio_especial.sql',
];

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

const crear = (tipo, detalles, metodo = null) =>
  client.query(
    `SELECT create_order_with_details($1, $2, 'zz prueba evento', NULL, NULL, 'pendiente', $3, 0, 0, 0, $4::jsonb) AS id`,
    [tipo, tipo === 'mesa' ? 98 : null, metodo, JSON.stringify(detalles)]
  );
const pedido = async (id) =>
  (await client.query(`SELECT subtotal, recargo, total, es_evento FROM pedidos WHERE id = $1`, [id])).rows[0];
const lineas = async (id) =>
  (await client.query(`SELECT producto_id, cantidad, precio_unitario, costo_unitario FROM detalle_pedidos WHERE pedido_id = $1 ORDER BY id`, [id])).rows;

try {
  await client.connect();
  await client.query('BEGIN');

  console.log('\n[1] Migración');
  for (const ruta of MIGRACIONES) await client.query(fs.readFileSync(ruta, 'utf8'));
  console.log('  ok    se aplica sin errores');
  await client.query(fs.readFileSync(MIGRACIONES[3], 'utf8'));
  console.log('  ok    es idempotente');
  const { rows: firmas } = await client.query(
    `SELECT COUNT(*)::INT AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_order_with_details'`
  );
  check('sigue habiendo una sola create_order_with_details (sin sobrecarga)', firmas[0].n === 1, String(firmas[0].n));

  const { rows: [hamburguesa] } = await client.query(`SELECT id, precio FROM productos WHERE nombre = 'Hamburguesa CLASICA'`);
  const { rows: [gaseosa] } = await client.query(
    `SELECT p.id, p.precio FROM productos p JOIN categorias c ON c.id = p.categoria_id
      WHERE c.nombre = 'Bebidas' AND p.activo ORDER BY p.id LIMIT 1`
  );

  console.log('\n[2] Pedido normal: nada cambia');
  await como(client, 'cajero');
  let { rows: [{ id }] } = await crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 2 }]);
  let p = await pedido(id);
  check('el cajero sigue creando pedidos al precio del menú', Number(p.total) === hamburguesa.precio * 2 && p.es_evento === false, JSON.stringify(p));
  ({ rows: [{ id }] } = await crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 1, precio_unitario: 1 }]));
  check('un precio_unitario mandado a mano se sigue ignorando', Number((await pedido(id)).total) === hamburguesa.precio);
  ({ rows: [{ id }] } = await crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 1, precio_especial: null }]));
  check('precio_especial en null es un pedido normal', (await pedido(id)).es_evento === false);

  console.log('\n[3] Pedido de evento');
  await debeFallar(client, 'el cajero no puede poner precio especial',
    () => crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 8, precio_especial: 13000 }]), 'ROL_NO_AUTORIZADO');
  await como(client, 'cocina');
  await debeFallar(client, 'cocina tampoco',
    () => crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 8, precio_especial: 13000 }]), 'ROL_NO_AUTORIZADO');

  await como(client, 'admin');
  ({ rows: [{ id }] } = await crear('mesa', [
    { producto_id: hamburguesa.id, cantidad: 8, precio_especial: 13000, notas: 'sin cebolla' },
    { producto_id: gaseosa.id, cantidad: 2 },
  ]));
  p = await pedido(id);
  const esperado = 8 * 13000 + 2 * gaseosa.precio;
  check('administración crea el evento y queda marcado', p.es_evento === true);
  check('el total sale del precio especial y del menú para lo demás', Number(p.subtotal) === esperado && Number(p.total) === esperado, JSON.stringify(p));
  const ls = await lineas(id);
  check('la línea guarda el precio especial', Number(ls[0].precio_unitario) === 13000 && Number(ls[1].precio_unitario) === gaseosa.precio, JSON.stringify(ls));
  check('y la foto del costo de ese momento', ls[0].costo_unitario !== null && Number(ls[0].costo_unitario) > 0, JSON.stringify(ls[0]));
  const eventoId = id;

  ({ rows: [{ id }] } = await crear('domicilio', [{ producto_id: hamburguesa.id, cantidad: 10, precio_especial: 13000 }], 'datafono'));
  p = await pedido(id);
  check('el recargo del datáfono se calcula sobre el precio especial', Number(p.recargo) === Math.round(130000 * 0.05) && Number(p.total) === 130000 + Number(p.recargo), JSON.stringify(p));

  await debeFallar(client, 'precio especial en 0 se rechaza',
    () => crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 1, precio_especial: 0 }]), 'PRECIO_ESPECIAL_INVALIDO');
  await debeFallar(client, 'precio especial negativo se rechaza',
    () => crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 1, precio_especial: -5 }]), 'PRECIO_ESPECIAL_INVALIDO');
  await debeFallar(client, 'precio especial con texto se rechaza',
    () => crear('mesa', [{ producto_id: hamburguesa.id, cantidad: 1, precio_especial: 'gratis' }]), 'PRECIO_ESPECIAL_INVALIDO');

  console.log('\n[4] Editar un pedido de evento');
  await como(client, 'cajero');
  await client.query(
    `SELECT update_order_with_details($1, 98, 'zz prueba evento', NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
    [eventoId, JSON.stringify([
      { producto_id: hamburguesa.id, cantidad: 8, precio_unitario: 13000 },
      { producto_id: gaseosa.id, cantidad: 3, precio_unitario: gaseosa.precio },
    ])]
  );
  p = await pedido(eventoId);
  check('agregar una gaseosa conserva el precio especial de lo demás', Number(p.total) === 8 * 13000 + 3 * gaseosa.precio && p.es_evento === true, JSON.stringify(p));
  await debeFallar(client, 'el cajero no puede inventar otro precio al editar',
    () => client.query(
      `SELECT update_order_with_details($1, 98, 'zz', NULL, NULL, NULL, 0, 0, 0, $2::jsonb)`,
      [eventoId, JSON.stringify([{ producto_id: hamburguesa.id, cantidad: 8, precio_unitario: 5000 }])]
    ), 'PRECIO_INVALIDO');
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
