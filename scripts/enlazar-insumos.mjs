/**
 * Devuelve a los insumos los enlaces que tenían en el Excel y carga los
 * precios nuevos del queso y la carne (2/10/2026). Va DESPUÉS de la migración
 * 20261004000000_insumos_enlazados.sql.
 *
 *   node scripts/enlazar-insumos.mjs            # solo muestra qué haría
 *   node scripts/enlazar-insumos.mjs --aplicar  # lo guarda
 *
 * Los enlaces se sacan de lo que hay en la base, no de una lista escrita a
 * mano: un insumo "Incluye: …" o "HAMBURGUESA DOBLE" vale hoy exactamente el
 * costo de un producto del menú (× 1, 2, 3 o 4), porque así se copió del
 * Excel. Si ese valor ya no coincide con ningún producto, no se enlaza y se
 * avisa.
 */
import { Client } from 'pg';
import fs from 'fs';
import { pathToFileURL } from 'url';

function conexion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const seed = fs.readFileSync('./execute-seed.mjs', 'utf8');
  const match = seed.match(/connectionString\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Define DATABASE_URL para poder conectarte.');
  return match[1];
}

/** Ingredientes que el Excel toma de una sola celda de la hoja PRECIOS */
const GRUPOS = [
  {
    // PRECIOS: $63.000 la bolsa de 2.500 g, 50 pares → $1.260 el par
    origen: 'Queso tajado',
    compra: { precio: 63000, rendimiento: 50 },
    siguen: ['queso', 'Queso Mozarella "PAR"'],
  },
  {
    // PRECIOS: $84.472 / 26 porciones + $60 → $3.309 la carne de 125 g
    origen: 'Carne Res - Ampolleta',
    compra: { precio: 3309, rendimiento: 1 },
    siguen: ['Adicion Carne', 'Carne de Hamburguesa'],
  },
];

const costosDeProductos = async (client) =>
  (
    await client.query(
      `SELECT producto_id, nombre, precio, ROUND(costo_total) AS costo, ROUND(margen * 100, 1) AS margen
         FROM vw_producto_costos ORDER BY nombre`
    )
  ).rows;

/**
 * Aplica compras y enlaces sobre la conexión que reciba (sin abrir ni cerrar
 * la transacción: eso lo decide quien llama). Devuelve lo que hizo.
 */
export async function enlazarInsumos(client) {
  const antes = await costosDeProductos(client);
  const enlaces = [];
  const avisos = [];

  const insumoPorNombre = async (nombre) => {
    const { rows } = await client.query(`SELECT id, nombre FROM insumos WHERE nombre = $1`, [nombre]);
    if (rows.length !== 1) {
      avisos.push(`"${nombre}": se esperaba 1 insumo con ese nombre y hay ${rows.length}.`);
      return null;
    }
    return rows[0];
  };

  // 1. Insumos que valen el costo de un producto: se detectan ANTES de mover
  //    precios, mientras todavía coinciden con el costo del producto.
  const { rows: candidatos } = await client.query(
    `SELECT i.id, i.nombre, v.costo_unitario AS costo
       FROM insumos i JOIN vw_insumo_costo_actual v ON v.insumo_id = i.id
      WHERE i.enlace_insumo_id IS NULL AND i.enlace_producto_id IS NULL
        AND (i.nombre ILIKE 'Incluye:%' OR i.nombre = 'HAMBURGUESA DOBLE')
        AND v.costo_unitario IS NOT NULL`
  );
  const { rows: productos } = await client.query(
    `SELECT v.producto_id, v.nombre, v.costo_total AS costo
       FROM vw_producto_costos v
      WHERE v.insumos_en_receta > 0 AND v.costo_total > 0
        AND NOT EXISTS (
          SELECT 1 FROM receta_items ri JOIN insumos i ON i.id = ri.insumo_id
           WHERE ri.producto_id = v.producto_id
             AND (i.nombre ILIKE 'Incluye:%' OR i.nombre = 'HAMBURGUESA DOBLE')
        )`
  );
  const porProducto = [];
  for (const insumo of candidatos) {
    const coincidencias = [];
    for (const producto of productos) {
      for (const factor of [1, 2, 3, 4]) {
        if (Math.abs(Number(producto.costo) * factor - Number(insumo.costo)) < 1) {
          coincidencias.push({ producto, factor });
        }
      }
    }
    if (coincidencias.length === 1) {
      porProducto.push({ insumo, ...coincidencias[0] });
    } else {
      avisos.push(
        `"${insumo.nombre}" ($${Math.round(insumo.costo)}): ${
          coincidencias.length === 0
            ? 'su valor no coincide con el costo de ningún producto'
            : `coincide con ${coincidencias.length} productos (${coincidencias.map((c) => c.producto.nombre).join(', ')})`
        }. No se enlaza.`
      );
    }
  }

  // 2. Queso y carne: compra nueva en el insumo de origen, los demás lo siguen
  for (const grupo of GRUPOS) {
    const origen = await insumoPorNombre(grupo.origen);
    if (!origen) continue;
    await client.query(`SELECT registrar_compra_insumo($1, $2, $3)`, [
      origen.id,
      grupo.compra.precio,
      grupo.compra.rendimiento,
    ]);
    for (const nombre of grupo.siguen) {
      const insumo = await insumoPorNombre(nombre);
      if (!insumo) continue;
      await client.query(`SELECT enlazar_insumo($1, $2, NULL, 1)`, [insumo.id, origen.id]);
      enlaces.push({ insumo: insumo.nombre, 'toma el precio de': origen.nombre, factor: 1 });
    }
  }

  // 3. Los que valen el costo de un producto
  for (const { insumo, producto, factor } of porProducto) {
    await client.query(`SELECT enlazar_insumo($1, NULL, $2, $3)`, [insumo.id, producto.producto_id, factor]);
    enlaces.push({ insumo: insumo.nombre, 'toma el precio de': `producto ${producto.nombre}`, factor });
  }

  const despues = await costosDeProductos(client);
  const cambios = despues
    .map((d) => {
      const a = antes.find((x) => x.producto_id === d.producto_id);
      return {
        producto: d.nombre,
        'costo antes': Number(a.costo),
        'costo ahora': Number(d.costo),
        'margen antes %': Number(a.margen),
        'margen ahora %': Number(d.margen),
      };
    })
    .filter((c) => c['costo antes'] !== c['costo ahora']);

  return { enlaces, cambios, avisos };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const aplicar = process.argv.includes('--aplicar');
  const client = new Client({ connectionString: conexion() });
  try {
    await client.connect();
    await client.query('BEGIN');
    const { enlaces, cambios, avisos } = await enlazarInsumos(client);

    console.log('\nEnlaces:');
    console.table(enlaces);
    console.log('Productos que cambian de costo:');
    console.table(cambios);
    if (avisos.length) console.log(`Avisos:\n  - ${avisos.join('\n  - ')}`);

    if (aplicar) {
      await client.query('COMMIT');
      console.log(`\nListo: ${enlaces.length} enlaces guardados.`);
    } else {
      await client.query('ROLLBACK');
      console.log('\nNada se guardó. Para guardarlo: --aplicar');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`No se cambió nada. Error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
