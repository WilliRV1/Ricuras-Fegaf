/**
 * Quita las compras mal escritas del 2/10/2026 (queso y carne), en una sola
 * transacción.
 *
 *   node scripts/corregir-compras-2026-10-02.mjs            # solo muestra
 *   node scripts/corregir-compras-2026-10-02.mjs --aplicar  # borra
 *
 * El campo "Rindió cuántos" se llenó con gramos y con el precio por par, y el
 * costo del "Queso Mozarella PAR" quedó en $309 en vez de $1.260. La carne
 * quedó registrada tres veces. Se deja una sola compra de carne ($3.309) y el
 * queso vuelve a su compra anterior hasta que se cargue el precio nuevo con
 * los insumos enlazados.
 *
 * Solo borra una fila si sigue teniendo los valores que se revisaron: si
 * alguien la corrigió entretanto, no se toca.
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

// id, precio_compra y rendimiento tal como quedaron guardados
const ERRADAS = [
  { id: 536, precio: 1260, rendimiento: 2500 },
  { id: 537, precio: 63000, rendimiento: 2500 },
  { id: 538, precio: 63000, rendimiento: 1260 },
  { id: 540, precio: 3309, rendimiento: 1 },
  { id: 541, precio: 84472, rendimiento: 26 },
];

const aplicar = process.argv.includes('--aplicar');
const client = new Client({ connectionString: conexion() });

const costos = () =>
  client.query(
    `SELECT i.nombre, ROUND(v.costo_unitario, 2) AS costo
       FROM insumos i JOIN vw_insumo_costo_actual v ON v.insumo_id = i.id
      WHERE i.id IN (SELECT insumo_id FROM compras_insumo WHERE id = ANY($1))
      ORDER BY i.nombre`,
    [ERRADAS.map((e) => e.id)]
  );

try {
  await client.connect();
  await client.query('BEGIN');

  const { rows: filas } = await client.query(
    `SELECT ci.id, ci.insumo_id, i.nombre, ci.precio_compra, ci.rendimiento, ci.fecha
       FROM compras_insumo ci JOIN insumos i ON i.id = ci.insumo_id
      WHERE ci.id = ANY($1) ORDER BY ci.id`,
    [ERRADAS.map((e) => e.id)]
  );

  const aBorrar = filas.filter((f) => {
    const esperada = ERRADAS.find((e) => e.id === f.id);
    return Number(f.precio_compra) === esperada.precio && Number(f.rendimiento) === esperada.rendimiento;
  });

  console.log('\nCompras a borrar:');
  console.table(aBorrar);
  if (aBorrar.length !== ERRADAS.length) {
    console.log(`Se esperaban ${ERRADAS.length} y coinciden ${aBorrar.length}: las demás cambiaron o ya no existen.`);
  }

  if (aBorrar.length > 0) {
    console.log('Costo vigente antes:');
    console.table((await costos()).rows);
    const insumos = [...new Set(aBorrar.map((f) => f.insumo_id))];

    await client.query(`DELETE FROM compras_insumo WHERE id = ANY($1)`, [aBorrar.map((f) => f.id)]);

    console.log('Costo vigente después:');
    console.table(
      (
        await client.query(
          `SELECT i.nombre, ROUND(v.costo_unitario, 2) AS costo
             FROM insumos i JOIN vw_insumo_costo_actual v ON v.insumo_id = i.id
            WHERE i.id = ANY($1) ORDER BY i.nombre`,
          [insumos]
        )
      ).rows
    );
  }

  if (aplicar) {
    await client.query('COMMIT');
    console.log(`Listo: ${aBorrar.length} compras borradas.`);
  } else {
    await client.query('ROLLBACK');
    console.log('Nada se guardó. Para borrarlas de verdad: --aplicar');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`No se cambió nada. Error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
